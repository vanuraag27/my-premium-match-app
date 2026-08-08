/**
 * Migration: ensure the `blocks` collection and its indexes exist.
 *
 * Schema (MongoDB collection: blocks):
 *   {
 *     blockerUserId: String,  // user who initiated the block
 *     blockedUserId: String,  // user who is blocked from messaging the blocker
 *     isBlocked: Boolean,     // true = active block, false = previously unblocked
 *     blockedAt: Date | null  // timestamp when the block was last activated
 *   }
 *
 * Usage (from project root, with MONGODB_URI in .env.local):
 *   node scripts/migrations/001-ensure-blocks-collection.js
 *
 * This migration is idempotent and safe to run multiple times.
 */

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

function loadEnvLocal() {
  const envPath = path.join(__dirname, '../../.env.local');
  if (!fs.existsSync(envPath)) return;

  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) return;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    });
}

async function run() {
  loadEnvLocal();

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Error: MONGODB_URI is not set. Add it to .env.local or the environment.');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('bandhan-engine');
    const blocks = db.collection('blocks');

    await blocks.createIndex(
      { blockerUserId: 1, blockedUserId: 1 },
      { unique: true, name: 'blocks_blocker_blocked_unique' }
    );

    await blocks.createIndex(
      { blockedUserId: 1, isBlocked: 1 },
      { name: 'blocks_blocked_active_lookup' }
    );

    const indexes = await blocks.indexes();
    console.log('blocks collection indexes:');
    indexes.forEach((idx) => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    console.log('\nMigration complete: blocks collection is ready.');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

run();
