-- Task comments, and an AI summary of them.
--
-- New table: task_comments. Each row is one comment on one task.
--   task_id points at the task the comment belongs to (tasks.task_id). If the task
--   is deleted, its comments are deleted too (on delete cascade).
--   user_id is the user who wrote it. It fills itself in with the signed-in user
--   (auth.uid()), so the app doesn't have to send it.
--
-- New columns on tasks: ai_summary (the latest summary of the task's comments, written
-- by the Edge Function summarize-comments with OpenAI) and ai_summary_at (when).

create table public.task_comments (
  comment_id uuid default gen_random_uuid() primary key,
  task_id uuid not null references public.tasks (task_id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (user_id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 2000),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- List a task's comments quickly, oldest first.
create index idx_task_comments_task_created
  on public.task_comments (task_id, created_at);

-- Security (Row Level Security): a user can read, add and delete only comments on
-- their own tasks. Nobody can edit a comment after writing it (no update policy).
alter table public.task_comments enable row level security;

create policy "Users can read comments on own tasks"
on public.task_comments for select
using (auth.uid() = user_id);

create policy "Users can add comments to own tasks"
on public.task_comments for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.tasks t
    where t.task_id = task_comments.task_id and t.user_id = auth.uid()
  )
);

create policy "Users can delete own comments"
on public.task_comments for delete
using (auth.uid() = user_id);

-- The AI summary lives on the task itself. The existing policy
-- "Users can CRUD own tasks" already protects these columns.
alter table public.tasks
  add column ai_summary text,
  add column ai_summary_at timestamp with time zone;
