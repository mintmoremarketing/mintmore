-- Demo KYC so these freelancers can take assessments while testing.
-- An assessment needs: basic details, tools, 3 portfolio posts and verified KYC.
-- This fills ONLY what is missing, with values marked as demo, and never overwrites
-- anything the person already entered. Safe to run more than once.
BEGIN;

CREATE TEMP TABLE demo_testers ON COMMIT DROP AS
SELECT u.id, u.email, row_number() OVER (ORDER BY u.email) AS n
FROM users u
WHERE lower(u.email) IN ('sudhansusinha29@gmail.com', 'kaustavbhattacharya2002@gmail.com', 'karsumit2004@gmail.com')
  AND u.role = 'freelancer';

-- 1. Basic details and tools: only the blanks.
UPDATE users u SET
  phone      = COALESCE(NULLIF(u.phone, ''), '00000' || lpad(t.n::text, 5, '0')),
  username   = COALESCE(NULLIF(u.username, ''), regexp_replace(lower(split_part(u.email, '@', 1)), '[^a-z0-9_.]', '', 'g') || '_demo'),
  avatar_url = COALESCE(NULLIF(u.avatar_url, ''), '/demo-posts/avatar-editor-one.svg'),
  bio        = COALESCE(NULLIF(u.bio, ''), 'Demo profile for assessment testing.'),
  tools      = CASE WHEN COALESCE(array_length(u.tools, 1), 0) = 0 THEN ARRAY['Adobe Premiere Pro', 'CapCut', 'Canva'] ELSE u.tools END,
  kyc_status = 'verified',
  kyc_level  = 'address'
FROM demo_testers t
WHERE u.id = t.id;

-- 2. A demo KYC record, approved, so admin screens show it as verified.
INSERT INTO kyc_submissions (user_id, level, status, document_type, document_number, nationality, country, admin_note, reviewed_at)
SELECT t.id, 'address', 'approved', 'demo', 'DEMO-' || t.n, 'Indian', 'India', 'Demo KYC for assessment testing', NOW()
FROM demo_testers t
WHERE NOT EXISTS (SELECT 1 FROM kyc_submissions k WHERE k.user_id = t.id AND k.document_type = 'demo');

-- 3. Demo portfolio posts up to the 3 required (none added for anyone who already has 3).
INSERT INTO portfolio_items (freelancer_id, title, description, cover_image_url, tags, is_visible)
SELECT t.id, p.title, 'Demo post for assessment testing.', p.cover, ARRAY['demo'], true
FROM demo_testers t
CROSS JOIN (VALUES
  (1, 'Product launch reel', '/demo-posts/product-launch-reel.svg'),
  (2, 'Podcast clip with captions', '/demo-posts/podcast-clip-with-captions.svg'),
  (3, 'Skincare carousel', '/demo-posts/skincare-carousel.svg')
) AS p(k, title, cover)
WHERE p.k <= 3 - (SELECT COUNT(*) FROM portfolio_items pi WHERE pi.freelancer_id = t.id AND pi.is_visible IS NOT FALSE)
  AND NOT EXISTS (SELECT 1 FROM portfolio_items pi WHERE pi.freelancer_id = t.id AND pi.title = p.title AND 'demo' = ANY(pi.tags));

-- What changed, one row per person.
SELECT t.email, u.kyc_status, u.username,
       (SELECT COUNT(*) FROM portfolio_items pi WHERE pi.freelancer_id = t.id AND pi.is_visible IS NOT FALSE) AS posts,
       array_length(u.tools, 1) AS tools
FROM demo_testers t JOIN users u ON u.id = t.id;

COMMIT;
