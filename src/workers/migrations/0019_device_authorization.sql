-- 0019_device_authorization.sql
--
-- OAuth 2.0 Device Authorization Grant (RFC 8628) — issue #73.
--
-- Adds:
--   1. `is_public` / `client_type` on oauth_clients, so a client can be
--      registered WITHOUT a usable client_secret (CLI/device clients must
--      never ship one). `client_secret_hash` stays NOT NULL for schema
--      compatibility with existing code paths that read it — public
--      clients get a random, never-checked hash inserted at registration
--      time. Every code path that authenticates a public client MUST
--      branch on `is_public` and skip secret verification entirely
--      (see /api/auth/token grant_type=device_code) rather than relying
--      on the sentinel hash being "unguessable" as a security boundary.
--   2. `allowed_grant_types` so device-flow eligibility is explicit
--      per-client rather than inferred.
--   3. `device_authorizations`: pending/approved/denied device+user code
--      pairs. Device codes and user codes are stored HASHED — the raw
--      values exist only in the HTTP responses handed to the CLI and the
--      user's browser, never at rest.
--
-- Status lifecycle: pending -> approved | denied | expired
--                    approved -> consumed (tokens minted, terminal)
-- `consumed_at` is set atomically together with the pending->consumed
-- transition (via `UPDATE ... WHERE status = 'approved'`) so a device
-- code cannot mint two token sets even under concurrent polling.

ALTER TABLE oauth_clients ADD COLUMN is_public BOOLEAN DEFAULT 0;
ALTER TABLE oauth_clients ADD COLUMN client_type TEXT DEFAULT 'confidential';
ALTER TABLE oauth_clients ADD COLUMN allowed_grant_types TEXT DEFAULT '["authorization_code","refresh_token"]';

CREATE TABLE IF NOT EXISTS device_authorizations (
  id TEXT PRIMARY KEY,
  device_code_hash TEXT UNIQUE NOT NULL,
  user_code_hash TEXT UNIQUE NOT NULL,
  -- Human-typed display form kept only long enough to render "which code
  -- did I just approve" confirmation UI copy; never used for lookups.
  user_code_display TEXT NOT NULL,
  client_id TEXT NOT NULL,
  scopes TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | denied | consumed | expired
  user_id TEXT,
  poll_interval_seconds INTEGER NOT NULL DEFAULT 5,
  last_polled_at DATETIME,
  poll_count INTEGER NOT NULL DEFAULT 0,
  ip_hash TEXT,
  ua_short TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  approved_at DATETIME,
  denied_at DATETIME,
  consumed_at DATETIME,
  FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_device_auth_device_hash ON device_authorizations(device_code_hash);
CREATE INDEX IF NOT EXISTS idx_device_auth_user_code_hash ON device_authorizations(user_code_hash);
CREATE INDEX IF NOT EXISTS idx_device_auth_expires ON device_authorizations(expires_at);
CREATE INDEX IF NOT EXISTS idx_device_auth_status ON device_authorizations(status);
CREATE INDEX IF NOT EXISTS idx_device_auth_client ON device_authorizations(client_id);

-- Registered clients: production LixBlogs CLI + a separate dev/staging
-- client so a leaked dev device code can never be used against prod
-- scopes/rate-limit budgets. Secrets are random 32-byte hex, hashed with
-- the same SHA-256 helper used everywhere else (webcrypto.hashString) —
-- these hashes are NEVER checked for these two rows because is_public=1;
-- they exist only to satisfy the NOT NULL constraint.
INSERT INTO oauth_clients (client_id, client_secret_hash, name, redirect_uris, scopes, is_public, client_type, allowed_grant_types, is_active)
VALUES
  ('lixblogs-cli', 'unused_public_client_no_secret_check_prod', 'LixBlogs CLI', '[]',
   '["profile:read","profile:write","blog:read","blog:write","blog:publish","blog:delete","media:read","media:write","org:read","org:write","collab:read","collab:write","analytics:read","notifications:read","account:delete"]',
   1, 'public', '["urn:ietf:params:oauth:grant-type:device_code","refresh_token"]', 1),
  ('lixblogs-cli-dev', 'unused_public_client_no_secret_check_dev', 'LixBlogs CLI (Dev/Staging)', '[]',
   '["profile:read","profile:write","blog:read","blog:write","blog:publish","blog:delete","media:read","media:write","org:read","org:write","collab:read","collab:write","analytics:read","notifications:read","account:delete"]',
   1, 'public', '["urn:ietf:params:oauth:grant-type:device_code","refresh_token"]', 1)
ON CONFLICT(client_id) DO NOTHING;
