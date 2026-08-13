-- Migration 0024: Add OAuth Client Branding and Customization fields

ALTER TABLE oauth_clients ADD COLUMN branding_display_name TEXT;
ALTER TABLE oauth_clients ADD COLUMN branding_primary_color TEXT;
ALTER TABLE oauth_clients ADD COLUMN branding_accent_color TEXT;
ALTER TABLE oauth_clients ADD COLUMN privacy_policy_url TEXT;
ALTER TABLE oauth_clients ADD COLUMN terms_of_service_url TEXT;
ALTER TABLE oauth_clients ADD COLUMN is_branding_verified INTEGER DEFAULT 0;
