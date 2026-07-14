const { query } = require('./src/config/database');

async function test() {
  const queries = [
    `SELECT COUNT(*) FILTER (WHERE role = 'client') FROM users`,
    `SELECT COUNT(*) FILTER (WHERE status = 'open') FROM jobs`,
    `SELECT COUNT(*) AS pending_kyc FROM kyc_submissions`,
    `SELECT COUNT(*) AS pending_proposals FROM proposals`,
    `SELECT (SELECT COUNT(*) FROM jobs WHERE status='pending_admin_approval') AS pending_deals`,
    `SELECT COALESCE(SUM(amount),0) AS total_escrow FROM escrow_records WHERE status IN ('held','disputed')`,
    `SELECT COUNT(DISTINCT j.id) AS stalled_deliveries FROM jobs j JOIN mintbox_files file ON file.job_id=j.id AND file.purpose='delivery'`,
    `WITH latest_transactions AS (SELECT DISTINCT ON (wallet_id) wallet_id, balance_after, escrow_after FROM transactions WHERE status = 'completed' ORDER BY wallet_id, created_at DESC, id DESC), held_escrow AS (SELECT client_id, COALESCE(SUM(amount), 0) AS amount FROM escrow_records WHERE status IN ('held', 'disputed') GROUP BY client_id) SELECT COUNT(*) AS reconciliation_issues FROM wallets wallet LEFT JOIN latest_transactions latest ON latest.wallet_id = wallet.id LEFT JOIN held_escrow held ON held.client_id = wallet.user_id WHERE (latest.wallet_id IS NOT NULL AND (wallet.balance <> latest.balance_after OR wallet.escrow_balance <> latest.escrow_after)) OR wallet.escrow_balance <> COALESCE(held.amount, 0)`,
    `SELECT COUNT(*) FILTER (WHERE status = 'failed') AS failed_events FROM event_outbox`
  ];

  for (let i = 0; i < queries.length; i++) {
    try {
      await query(queries[i]);
      console.log(`Query ${i + 1} OK`);
    } catch (err) {
      console.error(`Query ${i + 1} FAILED: ${err.message}`);
    }
  }
  process.exit(0);
}
test();
