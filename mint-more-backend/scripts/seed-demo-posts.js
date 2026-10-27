/**
 * Seeds demo portfolio posts for editor.one@creatyv-demo.test so the freelancer
 * Explore feed has something to show. Covers are generated SVGs written to the
 * frontend's public/demo-posts folder. Re-running replaces the posts.
 *
 *   node scripts/seed-demo-posts.js            # seed
 *   node scripts/seed-demo-posts.js --cleanup  # remove
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query } = require('../src/config/database');

const OWNER_EMAIL = 'editor.one@creatyv-demo.test';
const TAG = 'creatyv-demo';
const COVER_DIR = path.resolve(__dirname, '../../mint-more-frontend/public/demo-posts');

const POSTS = [
	{ title: 'Product launch reel', category: 'video-editing', colors: ['#e83b03', '#ffb36b'], ratio: [9, 16] },
	{ title: 'Podcast clip with captions', category: 'video-editing', colors: ['#1f2937', '#6b7280'], ratio: [9, 16] },
	{ title: 'Cafe brand kit', category: 'design', colors: ['#0f766e', '#99f6e4'], ratio: [4, 5] },
	{ title: 'YouTube thumbnail set', category: 'design', colors: ['#7c3aed', '#f0abfc'], ratio: [16, 9] },
	{ title: 'Travel vlog edit', category: 'video-editing', colors: ['#0369a1', '#7dd3fc'], ratio: [9, 16] },
	{ title: 'Festive sale posters', category: 'design', colors: ['#b91c1c', '#fde68a'], ratio: [1, 1] },
	{ title: 'Fitness transformation reel', category: 'video-editing', colors: ['#111827', '#e83b03'], ratio: [9, 16] },
	{ title: 'Skincare carousel', category: 'design', colors: ['#be185d', '#fbcfe8'], ratio: [4, 5] },
];

const slugify = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function coverSvg({ title, colors: [from, to], ratio: [w, h] }) {
	const width = 720;
	const height = Math.round((width * h) / w);
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
<rect width="100%" height="100%" fill="url(#g)"/>
<circle cx="${width * 0.78}" cy="${height * 0.22}" r="${width * 0.28}" fill="#fff" fill-opacity="0.12"/>
<text x="48" y="${height - 64}" font-family="Inter, Arial, sans-serif" font-size="44" font-weight="700" fill="#fff">${title}</text>
</svg>`;
}

async function main() {
	const cleanup = process.argv.includes('--cleanup');
	const { rows: [owner] } = await query('SELECT id FROM users WHERE email = $1', [OWNER_EMAIL]);
	if (!owner) throw new Error(`${OWNER_EMAIL} not found — run seed-demo-services.js first`);

	const removed = await query('DELETE FROM portfolio_items WHERE freelancer_id = $1 AND $2 = ANY(tags)', [owner.id, TAG]);
	if (cleanup) {
		fs.rmSync(COVER_DIR, { recursive: true, force: true });
		console.log(`Removed ${removed.rowCount} demo posts and their covers.`);
		return;
	}

	fs.mkdirSync(COVER_DIR, { recursive: true });
	const { rows: categories } = await query('SELECT id, slug FROM categories');
	const categoryId = (slug) => categories.find((c) => c.slug === slug)?.id || null;

	for (const [index, post] of POSTS.entries()) {
		const file = `${slugify(post.title)}.svg`;
		fs.writeFileSync(path.join(COVER_DIR, file), coverSvg(post));
		await query(
			`INSERT INTO portfolio_items (freelancer_id, title, description, category_id, cover_image_url, tags, tools_used, sort_order, created_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() - make_interval(mins => $8::int))`,
			[owner.id, post.title, 'Demo post for the Explore feed.', categoryId(post.category), `/demo-posts/${file}`, [TAG], ['Premiere Pro'], index],
		);
	}
	console.log(`Seeded ${POSTS.length} demo posts for ${OWNER_EMAIL} (replaced ${removed.rowCount}).`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err.message); process.exit(1); });
