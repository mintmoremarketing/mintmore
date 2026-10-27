#!/usr/bin/env node
/**
 * Loads scripts/catalogue/reference-catalogue.json (see extract-reference-catalogue.js)
 * into the services catalogue. Idempotent: upserts by slug and by
 * (template, option, pack). Services that are not in the file are hidden, not
 * deleted, because past orders reference them.
 *
 *   node scripts/catalogue/seed-reference-catalogue.js
 */
const path = require('path');
const { query, getClient, pool } = require('../../src/config/database');

const data = require(path.join(__dirname, 'reference-catalogue.json'));

const decode = (s) => String(s || '').replace(/&amp;/g, '&').trim();
const slugify = (s) => decode(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const DEFAULT_UNIT = {
  'video-editing': 'video',
  design: 'design',
  'ai-service': 'video',
  'content-writing': 'script',
  consultation: 'session',
};

// Homepage FAQs are Creatyv's own copy.
const STOREFRONT_FAQS = [
  { q: 'How does booking work?', a: 'Pick a service, choose the option and pack you need, and pay once. A vetted freelancer is assigned automatically and a chat opens so you can share files and instructions.' },
  { q: 'Who works on my order?', a: 'Every order is assigned to an available, KYC-verified freelancer who offers that service. You can rebook a freelancer you liked at checkout.' },
  { q: 'What if I need changes?', a: 'Each service includes a fixed number of revisions, shown on the service page. Request changes on any delivery until you are happy.' },
  { q: 'When does the freelancer get paid?', a: 'Your payment is held by Creatyv and released to the freelancer only after you approve the work and complete the order.' },
  { q: 'Do I get a GST invoice?', a: 'Yes. Prices exclude 18% GST, which is added at checkout. Add your GSTIN in the cart to get a business invoice.' },
];

const main = async () => {
  const categories = await query('SELECT id, slug FROM categories WHERE slug = ANY($1)', [data.categories.map((c) => c.slug)]);
  const categoryId = Object.fromEntries(categories.rows.map((r) => [r.slug, r.id]));
  const missing = data.categories.filter((c) => !categoryId[c.slug]);
  if (missing.length) throw new Error(`Run migration 057 first; missing categories: ${missing.map((c) => c.slug).join(', ')}`);

  const client = await getClient();
  const seededSlugs = [];
  try {
    await client.query('BEGIN');

    // Category ordering follows the reference storefront.
    for (const [i, category] of data.categories.entries()) {
      await client.query('UPDATE categories SET is_active = true, sort_order = $2 WHERE id = $1', [categoryId[category.slug], i * 10]);
    }

    const subcategoryId = {};
    for (const [i, section] of data.sections.entries()) {
      const name = decode(section.name);
      const result = await client.query(
        `INSERT INTO service_subcategories (category_id, name, slug, sort_order)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (category_id, slug) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, is_active = true
         RETURNING id`,
        [categoryId[section.category], name, slugify(name), i]
      );
      subcategoryId[`${section.category}/${name}`] = result.rows[0].id;
    }

    for (const [i, s] of data.services.entries()) {
      const highlights = s.highlights || [];
      const template = await client.query(
        `INSERT INTO service_templates
           (slug, category_id, subcategory_id, title, summary, unit_label, option_group_label, revisions,
            includes, excludes, tools, faqs, highlights, sort_order, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12::jsonb,$13::jsonb,$14,true)
         ON CONFLICT (slug) DO UPDATE SET
           category_id = EXCLUDED.category_id, subcategory_id = EXCLUDED.subcategory_id, title = EXCLUDED.title,
           summary = EXCLUDED.summary, unit_label = EXCLUDED.unit_label, option_group_label = EXCLUDED.option_group_label,
           revisions = EXCLUDED.revisions, includes = EXCLUDED.includes, excludes = EXCLUDED.excludes,
           tools = EXCLUDED.tools, faqs = EXCLUDED.faqs, highlights = EXCLUDED.highlights,
           sort_order = EXCLUDED.sort_order, is_active = true
         RETURNING id`,
        [
          s.slug, categoryId[s.category], subcategoryId[`${s.category}/${decode(s.section)}`] || null, s.title,
          highlights[0] || null, s.unit || DEFAULT_UNIT[s.category] || 'order', s.option_group || null, s.revisions ?? 2,
          JSON.stringify(s.includes || []), JSON.stringify(s.excludes || []), s.tools || [],
          JSON.stringify(s.faqs || []), JSON.stringify(highlights), i,
        ]
      );
      const templateId = template.rows[0].id;
      seededSlugs.push(s.slug);

      const baseLabel = decode(s.base_option) || 'Standard';
      const optionLabel = Object.fromEntries((s.options || []).map((o) => [o.ref, decode(o.label)]));
      const rows = [
        { label: baseLabel, pack: 1, price: s.price, mrp: s.mrp, payout: s.payout, days: s.delivery_days, isDefault: true },
        ...(s.options || []).map((o) => ({ label: decode(o.label), pack: 1, price: o.price, mrp: o.mrp, payout: o.payout, days: o.delivery_days })),
        ...(s.packs || []).map((p) => ({
          label: p.option_ref ? optionLabel[p.option_ref] || baseLabel : baseLabel,
          pack: p.count, price: p.price, mrp: p.mrp, payout: p.payout, days: p.delivery_days,
        })),
      ];

      const keep = [];
      for (const [j, row] of rows.entries()) {
        const price = Number(row.price);
        const mrp = row.mrp && Number(row.mrp) >= price ? Number(row.mrp) : null;
        const saved = await client.query(
          `INSERT INTO service_variants
             (template_id, option_label, pack_size, price, mrp, freelancer_payout, delivery_days, is_default, is_active, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9)
           ON CONFLICT (template_id, option_label, pack_size) DO UPDATE SET
             price = EXCLUDED.price, mrp = EXCLUDED.mrp, freelancer_payout = EXCLUDED.freelancer_payout,
             delivery_days = EXCLUDED.delivery_days, is_default = EXCLUDED.is_default, is_active = true,
             sort_order = EXCLUDED.sort_order
           RETURNING id`,
          [templateId, row.label, row.pack, price, mrp, Math.min(Number(row.payout) || 0, price), Math.max(1, Number(row.days) || 1), !!row.isDefault, j]
        );
        keep.push(saved.rows[0].id);
      }
      await client.query(
        'UPDATE service_variants SET is_active = false WHERE template_id = $1 AND NOT (id = ANY($2::uuid[]))',
        [templateId, keep]
      );
    }

    // Earlier placeholder services stay in the DB for past orders but leave the storefront.
    const hidden = await client.query(
      'UPDATE service_templates SET is_active = false WHERE NOT (slug = ANY($1)) AND is_active RETURNING slug',
      [seededSlugs]
    );

    const rows = (data.homepage || []).map((row) => ({ title: decode(row.title), slugs: row.slugs.filter((slug) => seededSlugs.includes(slug)) }));
    await client.query(
      `UPDATE platform_settings SET value = jsonb_set(jsonb_set(value, '{rows}', $1::jsonb), '{faqs}', $2::jsonb), updated_at = NOW()
       WHERE key = 'storefront'`,
      [JSON.stringify(rows), JSON.stringify(STOREFRONT_FAQS)]
    );

    // Demo freelancers (scripts/seed-demo-services.js) offer the new catalogue too.
    await client.query(
      `INSERT INTO freelancer_service_optins (freelancer_id, template_id, is_active)
       SELECT u.id, t.id, true
       FROM users u
       JOIN service_templates t ON t.is_active
       JOIN categories c ON c.id = t.category_id
       WHERE (u.email = 'editor.one@creatyv-demo.test')
          OR (u.email = 'designer.two@creatyv-demo.test' AND c.slug IN ('design', 'ai-service'))
       ON CONFLICT (freelancer_id, template_id) DO UPDATE SET is_active = true`
    );

    await client.query('COMMIT');
    console.log(`Seeded ${seededSlugs.length} services in ${data.sections.length} sections; hid ${hidden.rows.length} old services; ${rows.length} homepage rows.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => pool.end());
