-- Add audience column to clients
ALTER TABLE oauth_clients ADD COLUMN audience TEXT;

-- Create system user to satisfy oauth_clients.owner_id FK
INSERT INTO users (id, email, name, role) 
VALUES ('system-lixblogs-cli', 'system-cli@lixblogs.internal', 'System LixBlogs CLI', 'system') 
ON CONFLICT (id) DO NOTHING;

-- Seed public CLI clients
INSERT INTO oauth_clients (id, name, client_type, client_secret_hash, owner_id, audience, allowed_scopes) VALUES
('lixblogs-cli-dev', 'LixBlogs CLI (Dev)', 'public', '0000000000000000000000000000000000000000000000000000000000000000', 'system-lixblogs-cli', 'api-dev.lixblogs.com', 'read write'),
('lixblogs-cli-staging', 'LixBlogs CLI (Staging)', 'public', '0000000000000000000000000000000000000000000000000000000000000000', 'system-lixblogs-cli', 'api-staging.lixblogs.com', 'read write'),
('lixblogs-cli-prod', 'LixBlogs CLI (Prod)', 'public', '0000000000000000000000000000000000000000000000000000000000000000', 'system-lixblogs-cli', 'api.lixblogs.com', 'read write');
