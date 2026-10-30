-- Demo photos for the demo client's Files (client@creatyv-demo.test).
-- The images ship with the web app in public/demo-files; storage paths starting with
-- 'demo-files/' are served from there instead of storage. Safe to run more than once.
-- Each image is filed under the demo client's order that matches it (or their latest order),
-- as an approved delivery from the demo freelancer, so it shows in Files and can be downloaded.
WITH demo AS (
  SELECT
    (SELECT id FROM users WHERE email = 'client@creatyv-demo.test') AS client_id,
    (SELECT id FROM users WHERE email = 'designer.two@creatyv-demo.test') AS freelancer_id
),
art(name, mime, size_bytes, keyword, days_ago) AS (VALUES
  ('cafe-diwali-offer-1.jpg',     'image/jpeg', 85500, '%social%',    2),
  ('cafe-diwali-offer-2.jpg',     'image/jpeg', 68293, '%social%',    2),
  ('podcast-ep12-thumbnail.jpg',  'image/jpeg', 46063, '%thumbnail%', 9),
  ('skincare-carousel-1.jpg',     'image/jpeg', 53462, '%carousel%',  16),
  ('skincare-carousel-2.jpg',     'image/jpeg', 36780, '%carousel%',  16),
  ('skincare-carousel-3.jpg',     'image/jpeg', 40445, '%carousel%',  16),
  ('launch-teaser-cover.jpg',     'image/jpeg', 71458, '%reel%',      34)
),
picked AS (
  SELECT a.*, COALESCE(
    (SELECT j.id FROM jobs j, demo WHERE j.client_id = demo.client_id AND j.title ILIKE a.keyword ORDER BY j.created_at DESC LIMIT 1),
    (SELECT j.id FROM jobs j, demo WHERE j.client_id = demo.client_id ORDER BY j.created_at DESC LIMIT 1)
  ) AS job_id
  FROM art a
),
folders AS (
  INSERT INTO mintbox_folders (client_id, job_id, name, share_token, storage_prefix)
  SELECT DISTINCT demo.client_id, p.job_id, j.title, encode(gen_random_bytes(24), 'hex'), 'demo-files/' || p.job_id
  FROM picked p JOIN jobs j ON j.id = p.job_id, demo
  WHERE p.job_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM mintbox_folders f WHERE f.job_id = p.job_id)
  RETURNING id, job_id
),
all_folders AS (
  SELECT id, job_id FROM folders
  UNION ALL
  SELECT * FROM (
    SELECT DISTINCT ON (f.job_id) f.id, f.job_id FROM mintbox_folders f
    WHERE f.job_id IN (SELECT job_id FROM picked) ORDER BY f.job_id, f.created_at
  ) existing
)
INSERT INTO mintbox_files
  (folder_id, job_id, uploaded_by, original_name, storage_bucket, storage_path, public_url,
   mime_type, size_bytes, status, file_category, purpose, created_at, updated_at)
SELECT DISTINCT ON (p.name) af.id, p.job_id, demo.freelancer_id, p.name, 'demo',
       'demo-files/' || p.name, 'internal://mintbox/demo-files/' || p.name,
       p.mime, p.size_bytes, 'approved', 'photos', 'delivery',
       NOW() - (p.days_ago || ' days')::interval, NOW() - (p.days_ago || ' days')::interval
FROM picked p JOIN all_folders af ON af.job_id = p.job_id, demo
WHERE demo.freelancer_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM mintbox_files mf WHERE mf.job_id = p.job_id AND mf.storage_path = 'demo-files/' || p.name);
