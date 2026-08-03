const { Pool } = require('pg');
require('dotenv').config({ path: 'c:\\Users\\devde\\OneDrive\\Desktop\\Demo projects\\Mint-more\\saas\\mint-more-backend\\.env' });

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    const res = await pool.query(`SELECT target_platforms FROM social_posts LIMIT 5`);
    console.log(res.rows.map(r => ({
      val: r.target_platforms,
      type: typeof r.target_platforms,
      isArray: Array.isArray(r.target_platforms)
    })));
  } finally {
    pool.end();
  }
}

test();
