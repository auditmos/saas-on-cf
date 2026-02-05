---
paths:
  - "apps/data-service/**/*.ts"
---

# Cloudflare Storage Rules (KV & R2)

## KV - When to Use

- Read-heavy workloads (config, routing, cache)
- Eventually consistent (not for real-time sync)
- Simple key-value access patterns

## KV - Patterns

```ts
// Read
const value = await env.MY_KV.get('user:123')
const data = await env.MY_KV.get('config', { type: 'json' })

// Write with TTL
await env.MY_KV.put('session:abc', JSON.stringify(session), {
  expirationTtl: 60 * 60 * 24, // 24 hours
})

// Delete
await env.MY_KV.delete('user:123')

// List keys
const { keys } = await env.MY_KV.list({ prefix: 'user:' })
```

## KV - Key Naming

- Use prefixes for namespacing: `user:`, `session:`, `config:`
- Include version for cache busting: `cache:v2:posts`
- Keep keys readable but concise

## KV - Best Practices

- Local dev uses local KV by default
- Set `remote: true` in wrangler to test against prod
- Wrap operations in try/catch
- Check for null (key doesn't exist)

## R2 - When to Use

- Large file storage (images, documents, backups)
- S3-compatible API
- No egress fees

## R2 - Patterns

```ts
// Upload
await env.MY_BUCKET.put('uploads/image.png', imageData, {
  httpMetadata: { contentType: 'image/png' },
})

// Download
const object = await env.MY_BUCKET.get('uploads/image.png')
if (object) {
  return new Response(object.body, {
    headers: { 'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream' },
  })
}

// Delete
await env.MY_BUCKET.delete('uploads/image.png')

// List objects
const { objects } = await env.MY_BUCKET.list({ prefix: 'uploads/' })
```

## R2 - Key Naming

- Use path-like structure: `users/{userId}/avatar.png`
- Include content hash for dedup: `files/{hash}.pdf`
- Use prefixes for organization

## R2 - Best Practices

- Set appropriate content-type metadata
- Use presigned URLs for direct client uploads
- Implement lifecycle rules for cleanup
- Consider multipart upload for large files (>100MB)

## Binding Configuration

In `wrangler.jsonc`:

```jsonc
{
  "kv_namespaces": [
    { "binding": "MY_KV", "id": "xxx" }
  ],
  "r2_buckets": [
    { "binding": "MY_BUCKET", "bucket_name": "my-bucket" }
  ]
}
```
