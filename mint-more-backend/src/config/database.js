const { Pool } = require('pg');
const env = require('./env');
const logger = require('../utils/logger');

/**
 * IMPORTANT — Mint More Network Policy:
 * We use Supabase Session Pooler (IPv4-compatible).
 *
 * Pooler host : aws-1-ap-south-1.pooler.supabase.com
 * Pooler port : 5432  ← Supabase uses 5432 for Session Pooler
 * User format : postgres.yourprojectref
 * SSL         : required, rejectUnauthorized: false
 */
const pool = new Pool({
  host:     env.db.host,       // aws-xxxx.pooler.supabase.com
  port:     env.db.port,       // 5432
  database: env.db.name,       // postgres
  user:     env.db.user,       // postgres.yourprojectref
  password: env.db.password,
  ssl: {
    rejectUnauthorized: false, // required for Supabase SSL
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // slightly longer for pooler
  maxLifetimeSeconds: 300,
});

const attachClientErrorHandler = (client, source = 'unknown') => {
  if (!client || client.__mintMoreErrorHandlerAttached) return client;
  client.__mintMoreErrorHandlerAttached = true;
  client.on('error', (err) => {
    logger.error('PostgreSQL client connection error', {
      source,
      error: err.message,
      code: err.code,
    });
  });
  return client;
};

pool.on('connect', (client) => {
  attachClientErrorHandler(client, 'pool');
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error', { error: err.message, code: err.code });
});

const isTransientConnectionError = (err) => {
  const message = String(err?.message || '').toLowerCase();
  return (
    message.includes('connection terminated') ||
    message.includes('connection timeout') ||
    message.includes('connection reset') ||
    message.includes('econnreset') ||
    message.includes('terminating connection') ||
    ['57P01', '57P02', '08006', '08003', 'ECONNRESET', 'ETIMEDOUT'].includes(err?.code)
  );
};

/**
 * Verify DB connectivity on startup.
 */
const connectDB = async () => {
  const client = attachClientErrorHandler(await pool.connect(), 'startup');
  try {
    const result = await client.query('SELECT NOW() AS now');
    logger.info(`✅ PostgreSQL (Supabase Pooler) connected — server time: ${result.rows[0].now}`);
  } finally {
    client.release();
  }
};

/**
 * Thin query wrapper with logging.
 * NOTE: Session Pooler does NOT support prepared statements.
 * Always use parameterised queries like query('SELECT $1', [value])
 * but never pool.query({ name: '...', text: '...' }) named queries.
 */
const query = async (text, params) => {
  const start = Date.now();
  const runQuery = () => pool.query(text, params);
  try {
    const result = await runQuery();
    const duration = Date.now() - start;
    logger.debug('DB query executed', { text, duration, rows: result.rowCount });
    return result;
  } catch (err) {
    if (isTransientConnectionError(err)) {
      logger.warn('DB query connection failed; retrying once', { text, error: err.message });
      try {
        const result = await runQuery();
        const duration = Date.now() - start;
        logger.debug('DB query executed after retry', { text, duration, rows: result.rowCount });
        return result;
      } catch (retryErr) {
        logger.error('DB query failed after retry', { text, error: retryErr.message });
        throw retryErr;
      }
    }
    logger.error('DB query failed', { text, error: err.message });
    throw err;
  }
};

/**
 * Use for transactions — caller manages BEGIN / COMMIT / ROLLBACK.
 */
const getClient = async () => attachClientErrorHandler(await pool.connect(), 'transaction');

module.exports = { connectDB, query, getClient, pool };
