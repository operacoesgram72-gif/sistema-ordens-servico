---
name: Mobile file MIME type empty on Android
description: Android browsers and iOS gallery pickers often deliver File objects with file.type="" — always use extension-based fallback for file classification
---

## Rule: never filter media files with `file.type.startsWith(...)` alone

Android Chrome, Samsung Internet, Edge Mobile, and some iOS gallery pickers
(e.g. Google Drive picker, certain OEM gallery apps) deliver `File` objects
where `file.type === ""` even for perfectly valid JPEG photos and MP4 videos.

Any filter like `files.filter(f => f.type.startsWith("image/"))` silently drops
those files — the user sees a preview (via `URL.createObjectURL`) but the file
never makes it into the payload.

**The fix**: use `artifacts/os-civil/src/lib/media-utils.ts`:
```ts
import { isImageFile, isVideoFile, getVideoContentType } from "@/lib/media-utils";

// Classification — works even when file.type is empty:
const imageFiles = files.filter(isImageFile);
const videoFiles = files.filter(isVideoFile);

// Content-Type for storage upload — never empty:
const mimeType = getVideoContentType(video); // fallback: "video/mp4"
```

**Why:** `getMimeType` checks `file.type` first (fast path), then falls back to
the file extension (e.g. `.jpg` → `image/jpeg`, `.mov` → `video/mp4`).

**How to apply:** Any time new file upload code is added to the OS Civil app,
import from media-utils instead of using `file.type` directly for filtering or
as the Content-Type header for storage PUT requests.

**Additional rule**: always validate the storage PUT response (`putRes.ok`) before
appending the resulting URL to the OS photos array — a failed PUT must not persist
a broken link.

## Race condition — photo processing vs. form submit

`FileReader.readAsDataURL` is async. On slow Android devices it can take 200–500ms
for a 5–8 MB photo. If the user taps submit during that window, `photosBase64 = []`
in the `onSubmit` closure → photos silently excluded.

Fix: use a `processingPhotosRef = useRef(0)` counter.
- Increment **before** creating any FileReaders (strictly before `.map(...)`).
- Decrement in `finally` so it always clears.
- In `onSubmit`, check `processingPhotosRef.current > 0` and show a toast + return early.

## Failed video uploads must NOT block form submission

If a video upload fails, `videoFiles` gets an entry with `error !== null`. Do NOT
`return` from `onSubmit` in the failed-video guard — just show a warning toast and
let submission proceed. Failed videos are already excluded by the existing
`.filter(v => v.objectPath && !v.error)` in the URL-building step.
Blocking here prevents saving photos even when the user only wanted to attach the OS without the failed video.
