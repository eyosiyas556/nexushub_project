const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
  keepAlive: true
});

// CRITICAL: This catches idle connection drops (like ECONNRESET) so the server doesn't crash
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle database client:', err.message);
});

pool.connect()
  .then(client => {
    console.log('Connected to PostgreSQL database successfully.');
    client.release();
  })
  .catch(err => console.error('Database connection error:', err));

module.exports = pool;