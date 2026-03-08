/**
 * deploy/setup/init.ts — First-run initialization for self-hosted Gratonite instances.
 * Run by the setup container before the API starts.
 *
 * Responsibilities:
 * 1. Wait for Postgres to be ready
 * 2. Run database migrations
 * 3. Generate JWT secrets if not provided
 * 4. Generate instance Ed25519 keypair (for federation)
 * 5. Create admin account if it doesn't exist
 */

import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  console.info('=== Gratonite Instance Setup ===\n');

  // 1. Run migrations
  console.info('Running database migrations...');
  try {
    execFileSync('node', ['dist/db/migrate.js'], { stdio: 'inherit' });
    console.info('Migrations complete.\n');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }

  // 2. Generate JWT secrets if not provided
  const envPath = '/app/.env';
  let envContent = '';
  try {
    envContent = fs.readFileSync(envPath, 'utf-8');
  } catch { /* no .env file yet */ }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    const jwtSecret = crypto.randomBytes(48).toString('base64url');
    const jwtRefreshSecret = crypto.randomBytes(48).toString('base64url');
    console.info('Generated JWT secrets.');

    envContent += `\nJWT_SECRET=${jwtSecret}\nJWT_REFRESH_SECRET=${jwtRefreshSecret}\n`;
  }

  // 3. Generate instance keypair for federation
  const keysDir = '/app/keys';
  const pubKeyPath = path.join(keysDir, 'instance.pub');
  const privKeyPath = path.join(keysDir, 'instance.key');

  if (!fs.existsSync(pubKeyPath)) {
    console.info('Generating Ed25519 instance keypair...');
    fs.mkdirSync(keysDir, { recursive: true });

    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    fs.writeFileSync(pubKeyPath, publicKey, { mode: 0o644 });
    fs.writeFileSync(privKeyPath, privateKey, { mode: 0o600 });
    console.info('Instance keypair generated.\n');
  } else {
    console.info('Instance keypair already exists.\n');
  }

  // 4. Create admin account if env vars are set
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (adminEmail && adminPassword) {
    console.info(`Creating admin account: ${adminUsername} (${adminEmail})...`);
    try {
      // Use the API's DB connection to check/create admin
      const { Pool } = await import('pg');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });

      // Check if admin exists
      const existing = await pool.query(
        'SELECT id FROM users WHERE email = $1 OR username = $2',
        [adminEmail.toLowerCase(), adminUsername],
      );

      if (existing.rows.length === 0) {
        const { hash } = await import('argon2');
        const passwordHash = await hash(adminPassword);

        await pool.query(
          `INSERT INTO users (username, email, password_hash, display_name, is_admin, email_verified)
           VALUES ($1, $2, $3, $4, true, true)`,
          [adminUsername, adminEmail.toLowerCase(), passwordHash, adminUsername],
        );
        console.info('Admin account created.\n');
      } else {
        console.info('Admin account already exists.\n');
      }

      await pool.end();
    } catch (err) {
      console.error('Failed to create admin account:', err);
      // Non-fatal — admin can register manually
    }
  }

  // Write updated env content
  if (envContent.trim()) {
    try {
      fs.writeFileSync(envPath, envContent);
    } catch { /* env file may be read-only */ }
  }

  console.info('=== Setup complete! ===');
  console.info(`Your instance will be available at https://${process.env.INSTANCE_DOMAIN || 'localhost'}`);
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
