# App webhooks

An OAuth app can have multiple independently signed webhook endpoints. Manage
them from the app dashboard or the authenticated management API.

## Events

| Event | Meaning |
| --- | --- |
| `user.deleted` | An authorized user permanently deleted their account |
| `user.updated` | An authorized user changed profile data |
| `app.revoked` | A user revoked this app |
| `app.authorized` | A user authorized this app |

Events are only sent for users who authorized the receiving app.

## Create an endpoint

```http
POST /api/auth/oauth-clients/:client_id/webhooks
Authorization: Bearer <owner-access-token>
Content-Type: application/json

{
  "url": "https://example.com/webhooks/elixpo",
  "events": ["user.deleted", "app.revoked"],
  "label": "production"
}
```

The response includes `webhook_secret` once. Store it immediately. Each endpoint
has its own URL, event selection, status, and secret.

## Verify a delivery

Each request includes:

```text
X-Elixpo-Event-Id: <uuid>
X-Elixpo-Event: user.deleted
X-Elixpo-Timestamp: <unix-seconds>
X-Elixpo-Signature: sha256=<hex>
```

The signed bytes are `${timestamp}.${rawBody}` using HMAC-SHA256. Reject
timestamps outside five minutes, compare signatures in constant time, and
deduplicate `X-Elixpo-Event-Id`.

```ts
async function verifyDelivery(
  rawBody: string,
  timestamp: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300) {
    return false;
  }

  const hex = signature.replace(/^sha256=/, "");
  if (!/^[0-9a-f]{64}$/.test(hex)) return false;
  const bytes = Uint8Array.from(hex.match(/.{2}/g) ?? [], (part) =>
    Number.parseInt(part, 16),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    bytes,
    new TextEncoder().encode(`${seconds}.${rawBody}`),
  );
}
```

Return `2xx` after durable processing. A `4xx` response stops retries; a `5xx`
response or timeout is retried. Delivery order is not guaranteed.

## Manage endpoints

- `GET /api/auth/oauth-clients/:client_id/webhooks`
- `PATCH /api/auth/oauth-clients/:client_id/webhooks/:endpoint_id`
- `DELETE /api/auth/oauth-clients/:client_id/webhooks/:endpoint_id`
- `POST /api/auth/oauth-clients/:client_id/webhooks/:endpoint_id/rotate`

Rotation returns a new secret once and immediately invalidates the previous
secret. Production endpoint URLs must use HTTPS.
