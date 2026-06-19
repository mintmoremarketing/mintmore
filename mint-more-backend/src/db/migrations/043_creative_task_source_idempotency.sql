-- Make internal production task creation idempotent per source.
-- This prevents duplicate client-visible work when approvals/retries race.

WITH ranked AS (
  SELECT
    id,
    source_type,
    source_id,
    FIRST_VALUE(id) OVER (
      PARTITION BY source_type, source_id
      ORDER BY
        CASE
          WHEN status IN ('completed', 'delivered', 'in_progress', 'assigned', 'pending') THEN 0
          ELSE 1
        END,
        created_at ASC
    ) AS keep_id,
    ROW_NUMBER() OVER (
      PARTITION BY source_type, source_id
      ORDER BY
        CASE
          WHEN status IN ('completed', 'delivered', 'in_progress', 'assigned', 'pending') THEN 0
          ELSE 1
        END,
        created_at ASC
    ) AS rn
  FROM creative_tasks
  WHERE status <> 'cancelled'
),
duplicates AS (
  SELECT id, source_type, source_id, keep_id
  FROM ranked
  WHERE rn > 1
)
UPDATE client_event_selections selection
SET task_id = duplicates.keep_id
FROM duplicates
WHERE duplicates.source_type = 'calendar_event'
  AND selection.id = duplicates.source_id
  AND (selection.task_id IS NULL OR selection.task_id = duplicates.id);

WITH ranked AS (
  SELECT
    id,
    source_type,
    source_id,
    FIRST_VALUE(id) OVER (
      PARTITION BY source_type, source_id
      ORDER BY
        CASE
          WHEN status IN ('completed', 'delivered', 'in_progress', 'assigned', 'pending') THEN 0
          ELSE 1
        END,
        created_at ASC
    ) AS keep_id,
    ROW_NUMBER() OVER (
      PARTITION BY source_type, source_id
      ORDER BY
        CASE
          WHEN status IN ('completed', 'delivered', 'in_progress', 'assigned', 'pending') THEN 0
          ELSE 1
        END,
        created_at ASC
    ) AS rn
  FROM creative_tasks
  WHERE status <> 'cancelled'
),
duplicates AS (
  SELECT id, source_type, source_id, keep_id
  FROM ranked
  WHERE rn > 1
)
UPDATE creative_requests request
SET task_id = duplicates.keep_id
FROM duplicates
WHERE duplicates.source_type = 'custom_request'
  AND request.id = duplicates.source_id
  AND (request.task_id IS NULL OR request.task_id = duplicates.id);

WITH ranked AS (
  SELECT
    id,
    source_type,
    source_id,
    FIRST_VALUE(id) OVER (
      PARTITION BY source_type, source_id
      ORDER BY
        CASE
          WHEN status IN ('completed', 'delivered', 'in_progress', 'assigned', 'pending') THEN 0
          ELSE 1
        END,
        created_at ASC
    ) AS keep_id,
    ROW_NUMBER() OVER (
      PARTITION BY source_type, source_id
      ORDER BY
        CASE
          WHEN status IN ('completed', 'delivered', 'in_progress', 'assigned', 'pending') THEN 0
          ELSE 1
        END,
        created_at ASC
    ) AS rn
  FROM creative_tasks
  WHERE status <> 'cancelled'
)
UPDATE creative_tasks task
SET
  status = 'cancelled',
  client_status = 'Duplicate task removed',
  metadata = COALESCE(task.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'cancelled_reason', 'duplicate_source_task',
      'merged_into_task_id', ranked.keep_id,
      'cancelled_at', NOW()
    )
FROM ranked
WHERE task.id = ranked.id
  AND ranked.rn > 1;

WITH active_tasks AS (
  SELECT DISTINCT ON (source_type, source_id)
    id,
    source_type,
    source_id,
    job_id
  FROM creative_tasks
  WHERE status <> 'cancelled'
  ORDER BY source_type, source_id, created_at ASC
)
UPDATE client_event_selections selection
SET
  task_id = active_tasks.id,
  job_id = COALESCE(selection.job_id, active_tasks.job_id)
FROM active_tasks
WHERE active_tasks.source_type = 'calendar_event'
  AND selection.id = active_tasks.source_id
  AND selection.task_id IS NULL;

WITH active_tasks AS (
  SELECT DISTINCT ON (source_type, source_id)
    id,
    source_type,
    source_id,
    job_id
  FROM creative_tasks
  WHERE status <> 'cancelled'
  ORDER BY source_type, source_id, created_at ASC
)
UPDATE creative_requests request
SET
  task_id = active_tasks.id,
  job_id = COALESCE(request.job_id, active_tasks.job_id)
FROM active_tasks
WHERE active_tasks.source_type = 'custom_request'
  AND request.id = active_tasks.source_id
  AND request.task_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_creative_tasks_one_active_per_source
  ON creative_tasks(source_type, source_id)
  WHERE status <> 'cancelled';
