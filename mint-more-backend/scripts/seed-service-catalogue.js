/**
 * Seeds the launch service catalogue. Idempotent: templates upsert by slug and
 * variants by (template, option, pack). Prices are Creatyv placeholders that
 * admins edit from the Services admin page.
 *
 *   node scripts/seed-service-catalogue.js
 */
const { query, getClient, pool } = require('../src/config/database');

// payout ≈ 55% of price, rounded to the nearest ₹10
const payoutFor = (price) => Math.round((price * 0.55) / 10) * 10;
const v = (option, pack, price, mrp, days, extra = {}) => ({
  option, pack, price, mrp, days, payout: extra.payout ?? payoutFor(price), isDefault: extra.isDefault || false,
});

const CATALOGUE = [
  // ── Video Editing ──────────────────────────────────────────────────────────
  {
    slug: 'talking-head-reel', category: 'video-editing', title: 'Talking-Head Reel Edit', unit: 'Reel',
    summary: 'Hook-first edit of a single-camera talking-head reel with captions and B-roll.',
    optionGroup: 'Reel length', revisions: 3,
    includes: ['Hook-focused opening', 'Animated subtitles', 'Relevant B-roll', 'Sound effects and royalty-free music', 'Colour correction', '1080p vertical export'],
    excludes: ['Motion graphics', 'Multi-camera footage', 'Editable project files'],
    tools: ['Premiere Pro', 'CapCut'],
    requirementsHint: 'Share raw footage, any script or key points, and 1–2 reference reels you like.',
    variants: [
      v('Up to 60s', 1, 899, 1199, 1, { isDefault: true }), v('Up to 90s', 1, 1149, 1449, 1), v('Up to 3 min', 1, 2199, 2699, 2),
      v('Up to 60s', 3, 2499, 3597, 3), v('Up to 90s', 3, 3099, 4347, 3), v('Up to 60s', 10, 7999, 11990, 7),
    ],
  },
  {
    slug: 'retention-reel', category: 'video-editing', title: 'Advanced Retention Reel', unit: 'Reel',
    summary: 'Story-led edit with premium captions, zoom cuts and light motion graphics.',
    optionGroup: 'Reel length', revisions: 3,
    includes: ['Storyline restructuring', 'Premium animated captions', 'Light motion graphics and icons', 'Zoom and punch-in cuts', 'Sound design'],
    excludes: ['Licensed stock footage', 'Multi-language subtitles', 'Project files'],
    tools: ['Premiere Pro', 'After Effects'],
    variants: [v('Up to 60s', 1, 1399, 1699, 1, { isDefault: true }), v('Up to 90s', 1, 1849, 2199, 1), v('Up to 60s', 3, 3799, 5097, 3)],
  },
  {
    slug: 'captions-reel', category: 'video-editing', title: 'Quick Cuts + Captions Reel', unit: 'Reel',
    summary: 'Clean jump cuts, captions and music for everyday reels.',
    optionGroup: 'Reel length', revisions: 2,
    includes: ['Jump cuts and pacing', 'Captions', 'Background music'],
    excludes: ['B-roll sourcing', 'Advanced animation'],
    tools: ['CapCut'],
    variants: [v('Up to 60s', 1, 649, 899, 1, { isDefault: true }), v('Up to 60s', 3, 1749, 2697, 2), v('Up to 60s', 10, 5499, 8990, 6)],
  },
  {
    slug: 'youtube-long-form', category: 'video-editing', title: 'YouTube Long-Form Edit', unit: 'Video',
    summary: 'Silence removal, audio clean-up and YouTube-ready pacing for long videos.',
    optionGroup: 'Video length', revisions: 3,
    includes: ['Pause and filler removal', 'Audio clean-up', 'Chapter-friendly structure', 'Basic B-roll and lower thirds'],
    excludes: ['Script changes', '2D/3D animation', 'Thumbnail'],
    tools: ['Premiere Pro', 'DaVinci Resolve'],
    variants: [v('Up to 10 min', 1, 1899, 2399, 2, { isDefault: true }), v('Up to 15 min', 1, 2699, 3199, 3), v('Up to 20 min', 1, 3299, 3999, 3)],
  },
  {
    slug: 'podcast-edit', category: 'video-editing', title: 'Multi-Cam Podcast Edit', unit: 'Episode',
    summary: 'Angle switching, audio sync and clean-up for video podcasts up to an hour.',
    revisions: 3,
    includes: ['Multi-camera angle switching', 'Audio sync and levelling', 'Intro/outro placement'],
    excludes: ['Short-form clip extraction', 'Thumbnail'],
    tools: ['Premiere Pro'],
    variants: [v('Up to 60 min', 1, 6999, 8999, 5, { isDefault: true })],
  },
  {
    slug: 'product-showcase-reel', category: 'video-editing', title: 'Product Showcase Reel', unit: 'Reel',
    summary: 'Punchy product, unboxing or review reel cut from your footage.',
    revisions: 3,
    includes: ['Product-focused cuts', 'Text callouts', 'Music and SFX', 'Colour grade'],
    excludes: ['Shooting', 'VFX/3D', 'AI visuals'],
    tools: ['Premiere Pro', 'CapCut'],
    variants: [v('Up to 90s', 1, 949, 1199, 1, { isDefault: true }), v('Up to 90s', 3, 2599, 3597, 3)],
  },
  // ── Design ─────────────────────────────────────────────────────────────────
  {
    slug: 'youtube-thumbnail', category: 'graphic-design', title: 'YouTube Thumbnail', unit: 'Thumbnail',
    summary: 'Click-worthy thumbnail with strong text hierarchy and face enhancement.',
    optionGroup: 'Style', revisions: 3,
    includes: ['1280×720 export', 'Text layout', 'Background clean-up'],
    excludes: ['Custom illustration', 'Source files'],
    tools: ['Photoshop', 'Canva'],
    variants: [v('Basic', 1, 449, 599, 1, { isDefault: true }), v('High-CTR', 1, 899, 1199, 1), v('High-CTR', 3, 2399, 3597, 2)],
  },
  {
    slug: 'social-post-design', category: 'graphic-design', title: 'Branded Social Post', unit: 'Post',
    summary: 'On-brand static post in your colours and fonts.',
    optionGroup: 'Style', revisions: 2,
    includes: ['1 design in 1:1 or 4:5', 'Brand colours and fonts', 'PNG/JPG export'],
    excludes: ['Copywriting', 'Custom illustration'],
    tools: ['Canva', 'Figma'],
    variants: [v('Template-based', 1, 449, 599, 1, { isDefault: true }), v('Premium custom', 1, 899, 1199, 1), v('Premium custom', 10, 7499, 11990, 5)],
  },
  {
    slug: 'carousel-design', category: 'graphic-design', title: 'Carousel Post (5 slides)', unit: 'Carousel',
    summary: 'Five-slide educational or promotional carousel.',
    revisions: 3,
    includes: ['5 slides', 'Consistent layout system', 'PNG export'],
    excludes: ['Copywriting', 'Source files'],
    tools: ['Figma', 'Canva'],
    variants: [v('5 slides', 1, 1499, 1899, 2, { isDefault: true }), v('5 slides', 3, 3999, 5697, 4)],
  },
  {
    slug: 'logo-design', category: 'graphic-design', title: 'Logo Design', unit: 'Logo',
    summary: 'Original logo with multiple initial concepts and final files.',
    revisions: 5,
    includes: ['3 initial concepts', 'Final logo in PNG, SVG and PDF', 'Light and dark versions'],
    excludes: ['Full brand guidelines', 'Trademark search'],
    tools: ['Illustrator'],
    variants: [v('Standard', 1, 2799, 3499, 3, { isDefault: true })],
  },
  {
    slug: 'pitch-deck-design', category: 'graphic-design', title: 'Pitch Deck Design', unit: 'Deck',
    summary: 'Investor-ready deck design from your content.',
    optionGroup: 'Slides', revisions: 4,
    includes: ['Layout and visual design', 'Charts from your data', 'PPT/Google Slides/PDF'],
    excludes: ['Content writing', 'Data research'],
    tools: ['PowerPoint', 'Figma'],
    variants: [v('Up to 12 slides', 1, 6999, 8499, 3, { isDefault: true }), v('Up to 20 slides', 1, 9999, 11999, 5)],
  },
  // ── Content Writing ────────────────────────────────────────────────────────
  {
    slug: 'reel-script', category: 'content-writing', title: 'Instagram Reel Script', unit: 'Script',
    summary: 'Hook, story and CTA script for a 30–90 second reel.',
    revisions: 3,
    includes: ['Scroll-stopping hook', 'Story beats', 'Call to action', 'On-screen text suggestions'],
    excludes: ['Video editing', 'Voiceover'],
    variants: [v('30–90s', 1, 349, 449, 1, { isDefault: true }), v('30–90s', 10, 2999, 4490, 5)],
  },
  {
    slug: 'linkedin-post', category: 'content-writing', title: 'LinkedIn Post Writing', unit: 'Post',
    summary: 'Ghost-written LinkedIn post in your voice.',
    revisions: 2,
    includes: ['1 post up to 250 words', 'Hook and formatting', 'Hashtag suggestions'],
    excludes: ['Graphics', 'Posting on your behalf'],
    variants: [v('1 post', 1, 349, 449, 1, { isDefault: true }), v('1 post', 10, 2999, 4490, 6)],
  },
  {
    slug: 'youtube-script', category: 'content-writing', title: 'YouTube Video Script', unit: 'Script',
    summary: 'Retention-structured script for videos up to 10 minutes.',
    revisions: 3,
    includes: ['Hook and intro', 'Section structure', 'B-roll cues', 'Outro CTA'],
    excludes: ['Research beyond the brief', 'Voiceover'],
    variants: [v('Up to 10 min', 1, 1799, 2299, 2, { isDefault: true })],
  },
  // ── UGC ────────────────────────────────────────────────────────────────────
  {
    slug: 'ugc-ad-video', category: 'ugc-creation', title: 'UGC Ad Video', unit: 'Video',
    summary: 'A creator films an authentic UGC-style video of your product from your script.',
    optionGroup: 'Output', revisions: 2,
    includes: ['1 video up to 90s', 'Creator on camera', 'Commercial usage for your brand channels'],
    excludes: ['Scriptwriting', 'Posting on the creator’s account', 'Reshoots after script approval'],
    requirementsHint: 'Share the script, product details and any do/don’t notes. Physical products may need shipping.',
    variants: [v('Raw footage', 1, 3799, 4499, 3, { isDefault: true, payout: 2400 }), v('Edited ad', 1, 4799, 5699, 4, { payout: 2900 })],
  },
];

const main = async () => {
  const cats = await query('SELECT id, slug FROM categories');
  const catId = Object.fromEntries(cats.rows.map((r) => [r.slug, r.id]));

  const client = await getClient();
  try {
    await client.query('BEGIN');
    for (const [i, t] of CATALOGUE.entries()) {
      if (!catId[t.category]) throw new Error(`Unknown category ${t.category}`);
      const tpl = await client.query(
        `INSERT INTO service_templates
           (slug, category_id, title, summary, unit_label, option_group_label, revisions,
            includes, excludes, tools, requirements_hint, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12)
         ON CONFLICT (slug) DO UPDATE SET
           category_id = EXCLUDED.category_id, title = EXCLUDED.title, summary = EXCLUDED.summary,
           unit_label = EXCLUDED.unit_label, option_group_label = EXCLUDED.option_group_label,
           revisions = EXCLUDED.revisions, includes = EXCLUDED.includes, excludes = EXCLUDED.excludes,
           tools = EXCLUDED.tools, requirements_hint = EXCLUDED.requirements_hint, sort_order = EXCLUDED.sort_order
         RETURNING id`,
        [t.slug, catId[t.category], t.title, t.summary, t.unit, t.optionGroup || null, t.revisions,
          JSON.stringify(t.includes || []), JSON.stringify(t.excludes || []), t.tools || [],
          t.requirementsHint || null, i * 10]
      );
      const templateId = tpl.rows[0].id;
      for (const [j, variant] of t.variants.entries()) {
        await client.query(
          `INSERT INTO service_variants
             (template_id, option_label, pack_size, price, mrp, freelancer_payout, delivery_days, is_default, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (template_id, option_label, pack_size) DO UPDATE SET
             price = EXCLUDED.price, mrp = EXCLUDED.mrp, freelancer_payout = EXCLUDED.freelancer_payout,
             delivery_days = EXCLUDED.delivery_days, is_default = EXCLUDED.is_default, sort_order = EXCLUDED.sort_order`,
          [templateId, variant.option, variant.pack, variant.price, variant.mrp, variant.payout, variant.days, variant.isDefault, j]
        );
      }
      console.log(`✓ ${t.title} (${t.variants.length} variants)`);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

main()
  .then(() => { console.log(`\n✅ Seeded ${CATALOGUE.length} services`); return pool.end(); })
  .catch(async (err) => { console.error('❌', err.message); await pool.end(); process.exit(1); });
