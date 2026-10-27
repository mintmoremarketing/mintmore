/**
 * TEMP-REFERENCE-VIDEOS: pulls the work-sample reels listed on the reference
 * marketplace's home page and writes one clip per service (slug-matched to our
 * catalogue) to the frontend's referenceVideos.json. The clips are hotlinked.
 * Delete this script and the JSON before going live.
 *
 *   node scripts/catalogue/extract-reference-videos.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query } = require('../../src/config/database');

const SOURCE = 'https://unjob.ai/';
const OUT = path.resolve(__dirname, '../../../mint-more-frontend/src/components/storefront/referenceVideos.json');

/** Every `"workReferences":[...]` array in the page's streamed data. */
function workReferences(html) {
	const text = html.replace(/\\"/g, '"');
	const found = [];
	let at = 0;
	while ((at = text.indexOf('"workReferences":[', at)) >= 0) {
		const start = text.indexOf('[', at);
		let depth = 0;
		let end = start;
		for (; end < text.length; end++) {
			if (text[end] === '[') depth++;
			else if (text[end] === ']' && --depth === 0) break;
		}
		try { found.push(...JSON.parse(text.slice(start, end + 1))); } catch { /* partial chunk */ }
		at = end;
	}
	return found;
}

async function main() {
	const html = await (await fetch(SOURCE, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
	const refs = workReferences(html).filter((r) => r.type === 'VIDEO' && /\.mp4$/i.test(r.url));
	const { rows } = await query('SELECT slug, title FROM service_templates WHERE is_active');
	const titles = new Map(rows.map((r) => [r.slug, r.title]));

	// One clip per service, preferring clips that come with a poster frame.
	const bySlug = new Map();
	for (const ref of refs) {
		if (!titles.has(ref.templateSlug)) continue;
		const current = bySlug.get(ref.templateSlug);
		if (!current || (!current.poster && ref.thumbnailUrl)) {
			bySlug.set(ref.templateSlug, { slug: ref.templateSlug, title: titles.get(ref.templateSlug), src: ref.url, poster: ref.thumbnailUrl || null });
		}
	}
	const videos = [...bySlug.values()];
	fs.writeFileSync(OUT, `${JSON.stringify({ source: SOURCE, videos }, null, 2)}\n`);
	console.log(`Wrote ${videos.length} clips (from ${refs.length} references) to ${path.relative(process.cwd(), OUT)}`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err.message); process.exit(1); });
