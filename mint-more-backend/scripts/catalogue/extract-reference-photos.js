#!/usr/bin/env node
/**
 * TEMP-REFERENCE-PHOTOS: collects the reference marketplace's public image URLs
 * (service thumbnails + work samples, category tiles) so the
 * storefront has realistic photos until Creatyv's own are uploaded. The URLs
 * are hotlinked, not copied. Delete this script and the generated file once
 * our photos are in place.
 *
 *   node scripts/catalogue/extract-reference-photos.js
 *
 * Output: mint-more-frontend/src/components/storefront/referencePhotos.json
 */
const fs = require('fs');
const path = require('path');
const { BASE, get, sleep, flightText, balancedAt, findTemplate } = require('./extract-reference-catalogue');
const catalogue = require('./reference-catalogue.json');

const OUT = path.join(__dirname, '../../../mint-more-frontend/src/components/storefront/referencePhotos.json');

// Objects in the homepage payload that carry {categorySlug|title, mobileImageUrl, desktopImageUrl}.
const imageBlocks = (text) => {
  const out = [];
  let p = text.indexOf('"mobileImageUrl"');
  while (p >= 0) {
    for (let s = text.lastIndexOf('{', p); s >= 0 && p - s < 4000; s = text.lastIndexOf('{', s - 1)) {
      const raw = balancedAt(text, s);
      if (!raw || s + raw.length < p) continue;
      try {
        const obj = JSON.parse(raw);
        if (obj.mobileImageUrl) { out.push(obj); break; }
      } catch { /* keep widening */ }
    }
    p = text.indexOf('"mobileImageUrl"', p + 1);
  }
  return out;
};

(async () => {
  const home = flightText(await get(BASE));
  const blocks = imageBlocks(home);
  // Category tiles only. Their seasonal sale banner is skipped: it advertises offers we don't run.
  const categories = {};
  for (const block of blocks) {
    if (block.categorySlug) categories[block.categorySlug] ||= { desktop: block.desktopImageUrl || block.mobileImageUrl, mobile: block.mobileImageUrl };
  }

  const services = {};
  for (const { slug } of catalogue.services) {
    const t = findTemplate(flightText(await get(`${BASE}/services/templates/${slug}`)), slug);
    if (!t) continue;
    const gallery = (t.workReferences || [])
      .map((m) => (m.type === 'VIDEO' ? { type: 'video', url: m.url, poster: m.thumbnailUrl || null } : { type: 'image', url: m.url }))
      .filter((m) => m.url);
    services[slug] = { cover: t.thumbnailUrl || null, gallery };
    process.stdout.write('.');
    await sleep(250);
  }

  fs.writeFileSync(OUT, `${JSON.stringify({ source: BASE, categories, services }, null, 2)}\n`);
  const withCover = Object.values(services).filter((s) => s.cover).length;
  console.log(`\ncategories: ${Object.keys(categories).length}, services: ${withCover}/${catalogue.services.length} with cover`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
