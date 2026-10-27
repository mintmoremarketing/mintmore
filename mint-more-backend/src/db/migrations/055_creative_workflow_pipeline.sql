-- ── Migration: 055_creative_workflow_pipeline.sql ─────────────────────────────
-- Creative Workflow & Production Pipeline Database Foundations
-- Milestone 1: Schema additions for Admin-Designer-Client workflow, reviews, and notifications

-- 1. Extend social_post_status enum
ALTER TYPE social_post_status ADD VALUE IF NOT EXISTS 'pending_admin_review';
ALTER TYPE social_post_status ADD VALUE IF NOT EXISTS 'pending_client_review';
ALTER TYPE social_post_status ADD VALUE IF NOT EXISTS 'in_review';
ALTER TYPE social_post_status ADD VALUE IF NOT EXISTS 'rejected';

-- 2. Extend notification_type enum
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'calendar_completed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'designer_assigned';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'creative_uploaded';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'creative_rejected_by_admin';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'creative_ready_client_review';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'creative_rejected_by_client';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'creative_scheduled';

-- 3. Extend users table for Designer Assignment
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS assigned_designer_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_assigned_designer_id
  ON users(assigned_designer_id);

-- 4. Extend social_posts table for Creative Workflow & Feedback
ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS creative_url TEXT,
  ADD COLUMN IF NOT EXISTS designer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_feedback TEXT,
  ADD COLUMN IF NOT EXISTS client_feedback TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS rejection_history JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 5. Performance Indexes for Queues & Queries
CREATE INDEX IF NOT EXISTS idx_social_posts_designer_id
  ON social_posts(designer_id);

CREATE INDEX IF NOT EXISTS idx_social_posts_status_publish_at
  ON social_posts(status, publish_at);

CREATE INDEX IF NOT EXISTS idx_social_posts_designer_status
  ON social_posts(designer_id, status);

CREATE INDEX IF NOT EXISTS idx_social_posts_user_status
  ON social_posts(user_id, status);
