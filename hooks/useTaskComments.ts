import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { TaskComment } from "@/types/models";

const SUMMARIZE_ENDPOINT = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/summarize-comments`;

// Reads, adds and deletes the comments of one task (table task_comments), and asks
// the Edge Function summarize-comments for an AI summary of them.
// Row Level Security makes sure a user only ever sees comments on their own tasks.
export function useTaskComments(
  taskId: string,
  initialSummary: string | null = null,
  initialSummaryAt: string | null = null
) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(initialSummary);
  const [summaryAt, setSummaryAt] = useState<string | null>(initialSummaryAt);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  // When the task loads, show the summary that is already saved on it.
  useEffect(() => {
    setSummary(initialSummary);
    setSummaryAt(initialSummaryAt);
  }, [initialSummary, initialSummaryAt]);

  useEffect(() => {
    if (!taskId) return;
    const fetchComments = async () => {
      const { data, error } = await supabase
        .from("task_comments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (error) {
        console.error("Error fetching comments:", error);
        setError(error.message);
      } else {
        setComments(data || []);
      }
      setIsLoading(false);
    };
    fetchComments();
  }, [taskId]);

  const addComment = async (content: string) => {
    const text = content.trim();
    if (!text) return;
    // user_id fills itself in on the database (default auth.uid()).
    const { data, error } = await supabase
      .from("task_comments")
      .insert({ task_id: taskId, content: text })
      .select()
      .single();
    if (error) {
      console.error("Error adding comment:", error);
      throw error;
    }
    setComments((prev) => [...prev, data]);
  };

  const deleteComment = async (commentId: string) => {
    const { error } = await supabase
      .from("task_comments")
      .delete()
      .eq("comment_id", commentId);
    if (error) {
      console.error("Error deleting comment:", error);
      throw error;
    }
    setComments((prev) => prev.filter((c) => c.comment_id !== commentId));
  };

  const summarize = async () => {
    setIsSummarizing(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch(SUMMARIZE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session!.access_token}`,
        },
        body: JSON.stringify({ task_id: taskId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to summarize");
      setSummary(result.ai_summary);
      setSummaryAt(result.ai_summary_at);
    } finally {
      setIsSummarizing(false);
    }
  };

  return {
    comments,
    isLoading,
    isSummarizing,
    summary,
    summaryAt,
    error,
    addComment,
    deleteComment,
    summarize,
  };
}
