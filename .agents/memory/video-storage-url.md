---
name: Video object storage URL construction
description: objectPath from the server already starts with /objects/; don't add /objects/ again
---

## Rule: never add `/objects/` when building a video storage URL

The `POST /api/storage/uploads/video-url` endpoint returns `{ uploadURL, objectPath }` where `objectPath` is normalized by `normalizeObjectEntityPath()` to `/objects/<UUID>`.

When building the playback URL for the stored video, the correct form is:
```
`${BASE}/api/storage${objectPath}`
```

**Wrong** (doubles the segment):
```
`${BASE}/api/storage/objects/${objectPath}`  // → /api/storage/objects//objects/UUID
```

**Why:** `normalizeObjectEntityPath` always prepends `/objects/` to the signed URL path. The GET route in storage.ts reconstructs the path as `/objects/${wildcardPath}`. So the frontend only needs to prefix `/api/storage`.

**How to apply:** Any time a page uploads a video to object storage and stores the resulting path (registrar-os, fechar-os, os-detail, etc.), use `BASE + "/api/storage" + objectPath`.
