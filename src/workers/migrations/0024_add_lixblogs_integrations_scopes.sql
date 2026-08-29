-- Add the new Cloudinary integration scopes to existing LixBlogs CLI
-- clients' allowed scope lists. Companion to elixpo/blogs.elixpo#252.
UPDATE oauth_clients
SET scopes = json_insert(
    json_insert(scopes, '$[#]', 'lixblogs:integrations:cloudinary:read'),
    '$[#]', 'lixblogs:integrations:cloudinary:disconnect'
)
WHERE client_id IN ('lixblogs-cli-dev', 'lixblogs-cli-staging', 'lixblogs-cli-prod')
  AND scopes NOT LIKE '%lixblogs:integrations:cloudinary:read%';
