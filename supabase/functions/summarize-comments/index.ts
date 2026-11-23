// Summarize a task's comments with OpenAI, and save the summary on the task.
//
// The app calls this function with { task_id }. The function runs as the signed-in
// user (it forwards the user's login token to Supabase), so Row Level Security
// applies: it can read only that user's task and comments.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import OpenAI from "npm:openai";
import { SUPABASE_PUBLISHABLE_KEY } from "../_shared/supabaseKeys.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// The same small, cheap model that suggests labels.
const OPENAI_MODEL = "gpt-4o-mini";

// Read at most this many comments (the newest ones), to keep the request small.
const MAX_COMMENTS = 50;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { task_id } = await req.json();
    if (!task_id) throw new Error("Missing task_id");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    // A Supabase client that acts as the signed-in user.
    const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No user found");

    // The task (RLS: only if it is the user's own task).
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("task_id, title, description")
      .eq("task_id", task_id)
      .single();
    if (taskError || !task) throw new Error("Task not found");

    // Its newest comments; reversed below so the AI reads them oldest first.
    const { data: comments, error: commentsError } = await supabase
      .from("task_comments")
      .select("content, created_at")
      .eq("task_id", task_id)
      .order("created_at", { ascending: false })
      .limit(MAX_COMMENTS);
    if (commentsError) throw commentsError;
    if (!comments || comments.length === 0) {
      return json({ error: "Add at least one comment before summarizing." }, 400);
    }
    const ordered = [...comments].reverse();

    const commentList = ordered
      .map(
        (c: { content: string; created_at: string }, i: number) =>
          `${i + 1}. (${c.created_at.slice(0, 10)}) ${c.content}`
      )
      .join("\n");

    const prompt = `You summarize the comments on a task in a to-do list app.

Task title: "${task.title}"
Task description: "${task.description ?? ""}"

Comments, oldest first:
${commentList}

Write a short summary (2 to 4 sentences) of what the comments say: progress so far, decisions, and what is still left to do. Write in the same language as the comments. Don't invent anything that isn't in the comments.`;

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 200,
    });
    const summary = completion.choices[0].message.content?.trim();
    if (!summary) throw new Error("OpenAI returned no summary");

    console.log(`📝 Summarized ${ordered.length} comments for task ${task_id}`);

    // Save the summary on the task.
    const { data: updated, error: updateError } = await supabase
      .from("tasks")
      .update({ ai_summary: summary, ai_summary_at: new Date().toISOString() })
      .eq("task_id", task_id)
      .select("ai_summary, ai_summary_at")
      .single();
    if (updateError) throw updateError;

    return json(updated);
  } catch (error) {
    const message = (error as { message?: string })?.message ?? String(error);
    console.error("Error in summarize-comments:", message);
    return json({ error: message }, 400);
  }
});
