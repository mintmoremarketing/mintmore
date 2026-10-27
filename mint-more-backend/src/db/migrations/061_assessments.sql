-- 061: Freelancer skill assessments.
-- One assessment per (category, level). A freelancer starts an attempt, gets a
-- timer, uploads files or links, submits, and an admin passes or fails it.
-- Additive only. No DO $$ blocks and no semicolons inside text, because the
-- runner splits statements on them.

CREATE TABLE IF NOT EXISTS assessments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id          UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  level                INTEGER NOT NULL CHECK (level > 0),
  level_name           VARCHAR(160) NOT NULL,
  slug                 VARCHAR(160) NOT NULL UNIQUE,
  title                VARCHAR(200) NOT NULL,
  summary              TEXT,
  task_brief           TEXT,
  task_guide           JSONB NOT NULL DEFAULT '[]',
  deliverables         JSONB NOT NULL DEFAULT '[]',
  expected_outcome     TEXT,
  duration_minutes     INTEGER NOT NULL DEFAULT 480 CHECK (duration_minutes > 0),
  max_attempts         INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  retry_cooldown_days  INTEGER NOT NULL DEFAULT 14 CHECK (retry_cooldown_days >= 0),
  allowed_formats      TEXT[] NOT NULL DEFAULT '{}',
  max_files            INTEGER NOT NULL DEFAULT 3 CHECK (max_files > 0),
  max_file_size_mb     INTEGER NOT NULL DEFAULT 2048 CHECK (max_file_size_mb > 0),
  required_items       JSONB NOT NULL DEFAULT '[]',
  evaluation_criteria  JSONB NOT NULL DEFAULT '[]',
  required_tools       JSONB NOT NULL DEFAULT '[]',
  languages            TEXT[] NOT NULL DEFAULT '{}',
  assets               JSONB NOT NULL DEFAULT '[]',
  unlock_slugs         TEXT[] NOT NULL DEFAULT '{}',
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (category_id, level)
);

CREATE TABLE IF NOT EXISTS assessment_attempts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id    UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  freelancer_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status           VARCHAR(20) NOT NULL DEFAULT 'in_progress'
                   CHECK (status IN ('in_progress', 'submitted', 'passed', 'failed', 'closed')),
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deadline_at      TIMESTAMPTZ NOT NULL,
  submitted_at     TIMESTAMPTZ,
  is_late          BOOLEAN NOT NULL DEFAULT false,
  notes            TEXT,
  score            INTEGER CHECK (score BETWEEN 0 AND 100),
  criteria_scores  JSONB NOT NULL DEFAULT '[]',
  review_note      TEXT,
  reviewed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one assessment in progress per freelancer at a time.
CREATE UNIQUE INDEX IF NOT EXISTS assessment_attempts_one_open
  ON assessment_attempts (freelancer_id) WHERE status = 'in_progress';
CREATE INDEX IF NOT EXISTS assessment_attempts_by_freelancer
  ON assessment_attempts (freelancer_id, assessment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS assessment_attempts_by_status
  ON assessment_attempts (status, submitted_at);

CREATE TABLE IF NOT EXISTS assessment_attempt_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id    UUID NOT NULL REFERENCES assessment_attempts(id) ON DELETE CASCADE,
  kind          VARCHAR(10) NOT NULL CHECK (kind IN ('file', 'link')),
  name          VARCHAR(300) NOT NULL,
  url           TEXT,
  storage_path  TEXT,
  mime_type     VARCHAR(160),
  size_bytes    BIGINT,
  status        VARCHAR(10) NOT NULL DEFAULT 'ready' CHECK (status IN ('pending', 'ready')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS assessment_attempt_items_by_attempt
  ON assessment_attempt_items (attempt_id, created_at);

-- Seed: two levels each for Video Editing and Design. Placeholder content the
-- admin can edit later. Assets are added per level when the team has them.
INSERT INTO assessments (category_id, level, level_name, slug, title, summary, task_brief, task_guide, deliverables,
  expected_outcome, duration_minutes, max_attempts, retry_cooldown_days, allowed_formats, max_files, max_file_size_mb,
  required_items, evaluation_criteria, required_tools, languages, unlock_slugs)
SELECT c.id, 1, 'Short-form reel edit', 'video-editing-level-1', 'Video Editing · Level 1',
  'Turn raw talking-head footage into a tight vertical reel that holds attention.',
  'You get about three minutes of raw talking-head footage. Cut it into a vertical reel of 30 to 60 seconds. Open with the strongest line, remove dead air and retakes, add burned-in captions, and use music and sound effects that support the speaker rather than compete with them. Keep the look clean: one caption style, consistent colour, no stock transitions for their own sake.',
  '["Watch all the raw footage once before cutting anything.","Pick the single strongest line and open on it.","Rough-cut for story first, then tighten every cut.","Add captions in one consistent style, timed to speech.","Balance voice, music and sound effects so the voice always leads.","Colour-correct so every shot matches.","Export 1080×1920 and watch it once on a phone before submitting."]',
  '["Final reel, 30 to 60 seconds, 1080×1920","Project file from your editing software"]',
  'A reel a client could post today: a hook in the first two seconds, no dead air, readable captions and clean audio.',
  480, 3, 14, '{MP4,MOV}', 2, 2048,
  '["Final reel export (MP4 or MOV)","Project or source file of the edit"]',
  '[{"name":"Hook and pacing","weight_pct":25},{"name":"Cuts and story","weight_pct":20},{"name":"Captions and text","weight_pct":20},{"name":"Audio mix","weight_pct":15},{"name":"Colour and finish","weight_pct":10},{"name":"Creativity","weight_pct":10}]',
  '[{"name":"Premiere Pro"},{"name":"After Effects"},{"name":"CapCut"},{"name":"DaVinci Resolve"}]',
  '{English,Hindi}',
  '{engaging-reel,cuts-with-captions-reel,daily-vlog-reel,grwm-reel-editing,gym-reel-editing,product-unboxing-reel-editing,food-vlog-reel-editing,couple-reel-editing}'
FROM categories c WHERE c.slug = 'video-editing'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO assessments (category_id, level, level_name, slug, title, summary, task_brief, task_guide, deliverables,
  expected_outcome, duration_minutes, max_attempts, retry_cooldown_days, allowed_formats, max_files, max_file_size_mb,
  required_items, evaluation_criteria, required_tools, languages, unlock_slugs)
SELECT c.id, 2, 'Retention and storytelling edit', 'video-editing-level-2', 'Video Editing · Level 2',
  'Build a high-retention edit with motion graphics, B-roll and a clear story arc.',
  'Edit the provided footage into a 60 to 90 second reel built for retention. Plan a story arc with a hook, a build and a payoff. Use B-roll, zooms, motion text and sound design to re-engage the viewer every few seconds, without the edit feeling busy. Include at least one custom motion-graphics moment.',
  '["Write a one-line hook, a three-beat structure and a payoff before you edit.","Rough-cut to that structure.","Add B-roll and pattern interrupts where attention would dip.","Build one custom motion-graphics moment.","Design sound: risers, hits and room tone, not just music.","Grade for a consistent, intentional look.","Export 1080×1920 and check pacing on a phone."]',
  '["Final reel, 60 to 90 seconds, 1080×1920","Project file","A short note on your story structure"]',
  'An edit that keeps a viewer to the end: a clear arc, purposeful pattern interrupts and polished motion and sound.',
  720, 2, 21, '{MP4,MOV,PDF}', 3, 4096,
  '["Final reel export (MP4 or MOV)","Project or source file","Story-structure note (text or PDF)"]',
  '[{"name":"Story and structure","weight_pct":25},{"name":"Retention techniques","weight_pct":20},{"name":"Motion graphics","weight_pct":20},{"name":"Sound design","weight_pct":15},{"name":"Colour grade","weight_pct":10},{"name":"Creativity","weight_pct":10}]',
  '[{"name":"Premiere Pro"},{"name":"After Effects"},{"name":"DaVinci Resolve"}]',
  '{English,Hindi}',
  '{advanced-retention-edit,enterprise-level-reel-editing,podcast-reel-edit,ugc-ad-creative-reel,advanced-storytelling-edit-upto-10-min,faceless-reel-editing}'
FROM categories c WHERE c.slug = 'video-editing'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO assessments (category_id, level, level_name, slug, title, summary, task_brief, task_guide, deliverables,
  expected_outcome, duration_minutes, max_attempts, retry_cooldown_days, allowed_formats, max_files, max_file_size_mb,
  required_items, evaluation_criteria, required_tools, languages, unlock_slugs)
SELECT c.id, 1, 'Social post design', 'design-level-1', 'Design · Level 1',
  'Design a set of on-brand social posts with clear hierarchy and readable type.',
  'Design three Instagram posts (1080×1350) for a fictional café launching a seasonal menu: one announcement post, one product post and one offer post. Use a consistent grid, a limited palette and no more than two typefaces. Each post must be readable at phone size in under three seconds.',
  '["Sketch the three layouts on one grid before designing.","Choose a palette of three or four colours and at most two typefaces.","Design the announcement post first and derive the other two from it.","Check every post at phone size for readability.","Export PNGs and package the source file."]',
  '["Three posts, 1080×1350 PNG","Source file (Figma link, PSD or AI)"]',
  'A cohesive three-post set a café could publish: clear hierarchy, consistent style and readable at a glance.',
  480, 3, 14, '{PNG,JPG,PDF,PSD,AI}', 5, 500,
  '["Three exported posts (PNG or JPG)","Editable source file or Figma link"]',
  '[{"name":"Hierarchy and layout","weight_pct":30},{"name":"Typography","weight_pct":25},{"name":"Colour and consistency","weight_pct":20},{"name":"Readability","weight_pct":15},{"name":"Creativity","weight_pct":10}]',
  '[{"name":"Figma"},{"name":"Photoshop"},{"name":"Illustrator"},{"name":"Canva"}]',
  '{English}',
  '{basic-post,5-slide-carousel-post,basic-thumbnail,business-card-designing}'
FROM categories c WHERE c.slug = 'design'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO assessments (category_id, level, level_name, slug, title, summary, task_brief, task_guide, deliverables,
  expected_outcome, duration_minutes, max_attempts, retry_cooldown_days, allowed_formats, max_files, max_file_size_mb,
  required_items, evaluation_criteria, required_tools, languages, unlock_slugs)
SELECT c.id, 2, 'Thumbnails and branded campaigns', 'design-level-2', 'Design · Level 2',
  'Design high-click thumbnails and a branded campaign post that sells one idea.',
  'Design two YouTube thumbnails (1280×720) for a fictional tech-review channel and one branded campaign post (1080×1350) for the same channel. Thumbnails should read at 160 px wide: one focal subject, one emotion, three words or fewer. The campaign post should carry the channel brand and a single call to action.',
  '["Write the one idea each thumbnail sells before designing.","Block in subject, text and background at thumbnail size first.","Push contrast and emotion, then test at 160 px wide.","Build the campaign post on the same visual language.","Export and package the source files."]',
  '["Two thumbnails, 1280×720 PNG","One campaign post, 1080×1350 PNG","Source files"]',
  'Thumbnails that win the click at small size and a campaign post that clearly belongs to the same brand.',
  360, 2, 21, '{PNG,JPG,PDF,PSD,AI}', 5, 500,
  '["Two thumbnails (PNG or JPG)","One campaign post (PNG or JPG)","Editable source files or Figma link"]',
  '[{"name":"Click-worthiness","weight_pct":30},{"name":"Composition and contrast","weight_pct":25},{"name":"Brand consistency","weight_pct":20},{"name":"Typography","weight_pct":15},{"name":"Creativity","weight_pct":10}]',
  '[{"name":"Photoshop"},{"name":"Figma"},{"name":"Illustrator"}]',
  '{English}',
  '{high-ctr-thumbnail,ai-prompted-design-post,premium-branded-post,logo-design,pitch-deck}'
FROM categories c WHERE c.slug = 'design'
ON CONFLICT (slug) DO NOTHING;

-- Notifications: admins hear about submissions, freelancers about results.
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'assessment_submitted';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'assessment_reviewed';
