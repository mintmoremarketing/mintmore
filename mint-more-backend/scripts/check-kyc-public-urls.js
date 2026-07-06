const { query } = require('../src/config/database');

const fields = [
  'document_front_url',
  'document_back_url',
  'selfie_url',
  'address_proof_url',
];

const run = async () => {
  const publicPattern = '%/storage/v1/object/%kyc-docs/%';
  const publicRows = await query(
    `SELECT id, user_id, level, ${fields.join(', ')}
     FROM kyc_submissions
     WHERE document_front_url ILIKE $1
        OR document_back_url ILIKE $1
        OR selfie_url ILIKE $1
        OR address_proof_url ILIKE $1
     ORDER BY created_at DESC`,
    [publicPattern]
  );

  const nonJsonRows = await query(
    `SELECT id, user_id, level
     FROM kyc_submissions
     WHERE ${fields.map((field) => `${field} IS NOT NULL AND ${field} <> '' AND ${field} NOT LIKE '{%'`).join(' OR ')}
     ORDER BY created_at DESC`
  );

  console.log(JSON.stringify({
    public_kyc_url_rows: publicRows.rowCount,
    public_kyc_url_ids: publicRows.rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      level: row.level,
    })),
    non_json_kyc_reference_rows: nonJsonRows.rowCount,
    non_json_kyc_reference_ids: nonJsonRows.rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      level: row.level,
    })),
  }, null, 2));
};

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
