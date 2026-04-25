-- Older local schemas used canonical task_type/task_id only; current mainline
-- still has task_name consumers. Keep both column families available.

alter table task_results
  add column if not exists task_name text;

alter table drawing_reviews
  add column if not exists task_name text;
