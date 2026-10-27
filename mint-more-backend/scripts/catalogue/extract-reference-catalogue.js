#!/usr/bin/env node
/**
 * One-off research script: reads the public service catalogue of the reference
 * marketplace (category pages + each service page) and writes a normalised JSON
 * file that seed-reference-catalogue.js imports. It only reads public pages.
 *
 *   node scripts/catalogue/extract-reference-catalogue.js
 *
 * Output: scripts/catalogue/reference-catalogue.json
 */
const fs = require('fs');
const path = require('path');

const BASE = 'https://unjob.ai';
const CATEGORIES = [
  { slug: 'video-editing', name: 'Video Editing' },
  { slug: 'design', name: 'Design' },
  { slug: 'ai-service', name: 'AI Services' },
  { slug: 'content-writing', name: 'Content Writing' },
  { slug: 'consultation', name: 'Consultation' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (url) => {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (catalogue research)' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
};

// Next.js streams page data as self.__next_f.push([1,"..."]) string chunks.
const flightText = (html) =>
  [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)].map((m) => JSON.parse(`"${m[1]}"`)).join('');

const balancedAt = (text, start) => {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '[' || ch === '{') depth++;
    else if (ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
};

const findTemplate = (text, slug) => {
  let pos = text.indexOf(`"slug":"${slug}"`);
  while (pos >= 0) {
    for (let s = text.lastIndexOf('{', pos); s >= 0 && pos - s < 60000; s = text.lastIndexOf('{', s - 1)) {
      const raw = balancedAt(text, s);
      if (!raw || s + raw.length < pos) continue;
      try {
        const obj = JSON.parse(raw);
        if (obj.slug === slug && obj.basePriceINR) return obj;
      } catch { /* keep widening */ }
    }
    pos = text.indexOf(`"slug":"${slug}"`, pos + 1);
  }
  return null;
};

const arraysFor = (text, key, templateId) => {
  const out = [];
  let p = text.indexOf(`"${key}":[`);
  while (p >= 0) {
    try {
      for (const item of JSON.parse(balancedAt(text, p + key.length + 3))) {
        if (item && item.templateId === templateId && !out.some((o) => o.id === item.id)) out.push(item);
      }
    } catch { /* not a data array */ }
    p = text.indexOf(`"${key}":[`, p + 1);
  }
  return out;
};

const htmlToText = (html) => (html
  ? html.replace(/<\/(li|p|div)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/[ \t]+/g, ' ')
    .split('\n').map((l) => l.trim()).filter(Boolean)
  : []);

// Section headings (h2/h3) on a category page, each followed by its service links.
const categorySections = (html) => {
  const out = [];
  let section = null;
  const re = /<h[23][^>]*>([\s\S]*?)<\/h[23]>|href="\/services\/templates\/([a-z0-9-]+)"/g;
  for (const m of html.matchAll(re)) {
    if (m[1] !== undefined) section = m[1].replace(/<[^>]+>/g, '').trim();
    else if (!out.some((o) => o.slug === m[2])) out.push({ section, slug: m[2] });
  }
  return out;
};

const homepageSections = (html) => {
  const out = [];
  let section = null;
  const re = /<h2[^>]*>([\s\S]*?)<\/h2>|href="\/services\/templates\/([a-z0-9-]+)"/g;
  for (const m of html.matchAll(re)) {
    if (m[1] !== undefined) section = m[1].replace(/<[^>]+>/g, '').trim();
    else if (section) {
      let bucket = out.find((s) => s.title === section);
      if (!bucket) out.push((bucket = { title: section, slugs: [] }));
      if (!bucket.slugs.includes(m[2])) bucket.slugs.push(m[2]);
    }
  }
  return out;
};

module.exports = { BASE, get, sleep, flightText, balancedAt, findTemplate };

if (require.main === module) (async () => {
  const services = [];
  const sections = [];
  for (const category of CATEGORIES) {
    const listing = categorySections(await get(`${BASE}/categories/${category.slug}`));
    for (const { section, slug } of listing) {
      if (!sections.some((s) => s.category === category.slug && s.name === section)) {
        sections.push({ category: category.slug, name: section });
      }
      const text = flightText(await get(`${BASE}/services/templates/${slug}`));
      const t = findTemplate(text, slug);
      if (!t) {
        console.warn(`skip ${slug}: no template data`);
        continue;
      }
      const faqStart = text.indexOf('"faqs":[');
      let faqs = [];
      if (faqStart >= 0) {
        try { faqs = JSON.parse(balancedAt(text, faqStart + 7)).map((f) => ({ q: f.question, a: f.answer })).filter((f) => f.q && f.a); } catch { /* none */ }
      }
      const variants = arraysFor(text, 'variants', t.id).filter((v) => v.isActive);
      const packs = arraysFor(text, 'packs', t.id).filter((p) => p.isActive);
      services.push({
        category: category.slug,
        section,
        slug,
        title: t.title,
        unit: t.unitLabel,
        option_group: t.optionGroupLabel,
        base_option: t.baseVariantLabel,
        price: Number(t.basePriceINR),
        mrp: t.mrpINR ? Number(t.mrpINR) : null,
        payout: Number(t.paidToFreelancerINR),
        delivery_days: t.deliveryDays,
        revisions: t.revisions,
        includes: t.includes || [],
        excludes: t.excludes || [],
        tools: t.requiredTools || [],
        highlights: htmlToText(t.description),
        sort: t.sortOrder,
        faqs,
        options: variants.map((v) => ({
          ref: v.id,
          label: v.label,
          price: Number(v.basePriceINR),
          mrp: v.mrpINR ? Number(v.mrpINR) : null,
          payout: Number(v.paidToFreelancerINR),
          delivery_days: v.deliveryDays,
        })),
        packs: packs.map((p) => ({
          option_ref: p.variantId,
          count: p.itemCount,
          price: Number(p.basePriceINR),
          mrp: p.mrpINR ? Number(p.mrpINR) : null,
          payout: Number(p.paidToFreelancerINR),
          delivery_days: p.deliveryDays,
        })),
      });
      process.stdout.write('.');
      await sleep(250);
    }
  }
  const home = homepageSections(await get(BASE));
  const out = { source: BASE, extracted_at: new Date().toISOString(), categories: CATEGORIES, sections, homepage: home, services };
  fs.writeFileSync(path.join(__dirname, 'reference-catalogue.json'), JSON.stringify(out, null, 2));
  console.log(`\n${services.length} services, ${sections.length} sections, ${home.length} homepage rows`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
