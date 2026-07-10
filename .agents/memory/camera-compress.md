---
name: Camera photo compression via Canvas API
description: How camera input files are handled in registrar-os and nova-os — type detection bypass, Canvas compression, Promise safety.
---

## The rule
Camera inputs (`capture="environment"`) must bypass `isImageFile()` and use `compressImage()` instead of plain FileReader. Size guard is 50 MB (MAX_COMPRESS_BYTES), not the 8 MB gallery limit.

**Why:** On Samsung Internet and some Android OEM browsers, camera capture delivers `file.type=""` AND `file.name="image"` (no extension). `isImageFile()` returns false → photo silently dropped. The browser's `accept="image/*"` attribute already guarantees the file is an image, so the MIME check is redundant for camera inputs.

**Why compressImage:** A 12 MP raw JPEG is 8–15 MB. After base64 encoding the JSON payload is 8–20 MB. Over 4G this takes 20–60 s and looks "broken." Gallery photos are pre-compressed by the gallery app (~1–3 MB). `compressImage` resizes to 1920 px max, JPEG 0.82 → ~250 KB (≈30× smaller).

## How to apply
- Detect camera input: `const fromCamera = e.target.id === "photo-camera-pub"` (registrar-os) or `"nova-os-camera"` (nova-os)
- Image list: `fromCamera ? files : files.filter(isImageFile)` — camera files skip type check
- Size limit: `fromCamera ? MAX_COMPRESS_BYTES : MAX_IMAGE_BYTES` — camera files get 50 MB cap, gallery keeps 8 MB
- Encoding: `await Promise.all(validImages.map(f => compressImage(f)))` — replaces FileReader for all images

## compressImage safety guarantees
- Rejects before DOM touch if `file.size > MAX_COMPRESS_BYTES` (50 MB)
- `img.onload` wraps `drawImage`/`toDataURL` in try/catch → Promise always settles; `processingPhotosRef--` in finally always runs
- `img.onerror` rejects cleanly (NOT FileReader fallback) — avoids storing base64 of corrupted/non-image bytes
- FileReader fallback only for `ctx === null` (Canvas 2D API disabled on device), gated at 50 MB

## Files
- `artifacts/os-civil/src/lib/media-utils.ts` — `compressImage`, `MAX_COMPRESS_BYTES`
- `artifacts/os-civil/src/pages/registrar-os.tsx` — `handleFileChange`, camera id `"photo-camera-pub"`
- `artifacts/os-civil/src/pages/nova-os.tsx` — `handleFileChange`, camera id `"nova-os-camera"`
