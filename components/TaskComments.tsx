"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Loader2, MessageSquare, Send, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/hooks/use-toast";
import { useTaskComments } from "@/hooks/useTaskComments";

interface TaskCommentsProps {
  taskId: string;
  aiSummary: string | null;
  aiSummaryAt: string | null;
}

// The Comments section of a task: the list of comments, a box to add one, and the
// "Summarize with AI" button.
export default function TaskComments({
  taskId,
  aiSummary,
  aiSummaryAt,
}: TaskCommentsProps) {
  const {
    comments,
    isLoading,
    isSummarizing,
    summary,
    summaryAt,
    error,
    addComment,
    deleteComment,
    summarize,
  } = useTaskComments(taskId, aiSummary, aiSummaryAt);
  const { toast } = useToast();
  const [newComment, setNewComment] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    if (!newComment.trim()) return;
    setIsAdding(true);
    try {
      await addComment(newComment);
      setNewComment("");
    } catch (error: any) {
      toast({
        title: "❌ Error",
        description: error.message || "Failed to add comment",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deleteComment(commentId);
    } catch (error: any) {
      toast({
        title: "❌ Error",
        description: error.message || "Failed to delete comment",
        variant: "destructive",
      });
    }
  };

  const handleSummarize = async () => {
    try {
      await summarize();
      toast({ title: "✨ Summary ready", description: "AI summarized the comments" });
    } catch (error: any) {
      toast({
        title: "❌ Summary failed",
        description: error.message || "Failed to summarize comments",
        variant: "destructive",
      });
    }
  };

  return (
    <section className="mt-8 space-y-4 border-t pt-6" aria-label="Comments">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold flex items-center">
          <MessageSquare className="mr-2 h-5 w-5" />
          Comments ({comments.length})
        </h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSummarize}
          disabled={isSummarizing || comments.length === 0}
        >
          {isSummarizing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Summarize with AI
        </Button>
      </div>

      {summary && (
        <div className="rounded-md border border-purple-200 bg-purple-50 p-3">
          <p className="text-xs font-semibold text-purple-700 flex items-center mb-1">
            <Sparkles className="mr-1 h-3 w-3" />
            AI summary
            {summaryAt && (
              <span className="ml-2 font-normal text-purple-500">
                {format(new Date(summaryAt), "PPp")}
              </span>
            )}
          </p>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{summary}</p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-500">No comments yet.</p>
      ) : (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li
              key={c.comment_id}
              className="flex items-start justify-between gap-2 rounded-md border p-3"
            >
              <div>
                <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                {c.created_at && (
                  <p className="text-xs text-gray-400 mt-1">
                    {format(new Date(c.created_at), "PPp")}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Delete comment"
                onClick={() => handleDelete(c.comment_id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid w-full items-center gap-1.5">
        <Label htmlFor="new-comment">Add a comment</Label>
        <Textarea
          id="new-comment"
          placeholder="Write a comment..."
          value={newComment}
          maxLength={2000}
          onChange={(e) => setNewComment(e.target.value)}
        />
        <Button
          type="button"
          className="justify-self-end"
          onClick={handleAdd}
          disabled={isAdding || !newComment.trim()}
        >
          <Send className="mr-2 h-4 w-4" />
          Add Comment
        </Button>
      </div>
    </section>
  );
}
