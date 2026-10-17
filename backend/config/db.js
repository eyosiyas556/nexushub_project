const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Sanitize connection string: remove channel_binding if present (causes unexpected termination in node-postgres with Neon pooler)
let connectionString = process.env.DATABASE_URL || '';
if (connectionString.includes('channel_binding')) {
  connectionString = connectionString
    .replace(/([?&])channel_binding=[^&]*(&|$)/g, '$1')
    .replace(/[?&]$/, '');
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 15000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
});

// Catch idle client drops so unhandled errors don't crash Node process
pool.on('error', (err) => {
  console.warn('[DB Pool] Idle client error (handled):', err.message);
});

// Automatic retry wrapper for transient Neon / serverless disconnections
const originalQuery = pool.query.bind(pool);
pool.query = async function (text, params) {
  try {
    return await originalQuery(text, params);
  } catch (err) {
    const msg = err.message || '';
    const isTransientConnectionError =
      msg.includes('Connection terminated unexpectedly') ||
      msg.includes('Connection terminated due to connection timeout') ||
      msg.includes('connection timeout') ||
      msg.includes('ECONNRESET') ||
      msg.includes('socket hang up') ||
      err.code === '57P01' || // terminating connection due to administrator command
      err.code === '08006' || // connection_failure
      err.code === '08001' || // sqlclient_unable_to_establish_sqlconnection
      err.code === '08004';   // sqlserver_rejected_establishment_of_sqlconnection

    if (isTransientConnectionError) {
      console.warn(`[DB] Transient database connection dropped (${msg}). Retrying query with a fresh connection...`);
      // Wait briefly for Neon compute to wake if waking up
      await new Promise(resolve => setTimeout(resolve, 600));
      return await originalQuery(text, params);
    }
    throw err;
  }
};

pool.connect()
  .then(client => {
    console.log('Connected to PostgreSQL database successfully.');
    client.release();
  })
  .catch(err => console.error('Initial database connection warning:', err.message));

module.exports = pool;