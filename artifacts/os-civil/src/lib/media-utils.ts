/**
 * media-utils.ts — File type helpers for photo/video uploads on mobile.
 *
 * Problem: Android Chrome, Edge, Samsung Internet, and some iOS gallery pickers
 * deliver File objects with file.type === "" even for valid images and videos.
 * Any filter that uses file.type.startsWith("image/") will silently DROP the file
 * when the browser omits the MIME type.
 *
 * Solution: fall back to extension-based detection when file.type is empty.
 */

const IMAGE_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "gif", "webp", "heic", "heif",
  "bmp", "tiff", "tif", "avif",
]);

const VIDEO_EXTENSIONS = new Set([
  "mp4", "mov", "webm", "avi", "3gp", "3gpp", "m4v",
  "mkv", "ts", "mts", "ogv",
]);

/**
 * Generic / opaque MIME types that carry no real information about file content.
 * When a browser reports one of these we fall through to extension-based detection
 * just as we do for an empty type.
 *
 * "application/octet-stream" is delivered by Android camera apps, Google Drive
 * picker, and some file managers even for recognised video/image files.
 */
const OPAQUE_TYPES = new Set(["application/octet-stream", "binary/octet-stream"]);

/**
 * Returns the effective MIME type of a file.
 *
 * Priority order:
 *  1. Browser-reported type — used as-is when it is specific (not empty and
 *     not a generic binary blob type).
 *  2. Extension-based detection — used when the browser omits the type or
 *     reports a generic "application/octet-stream" that gives no real info.
 *  3. The original browser type (possibly empty) as a last-resort fallback.
 *
 * This covers three common Android scenarios:
 *  - file.type = ""                      → extension lookup
 *  - file.type = "application/octet-stream" → extension lookup
 *  - file.type = "video/mp4"             → returned as-is (fast path)
 */
export function getMimeType(file: File): string {
  if (file.type && !OPAQUE_TYPES.has(file.type)) return file.type;
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return "image/jpeg";
  if (VIDEO_EXTENSIONS.has(ext)) return "video/mp4";
  // Extension unrecognised — return the original type (may be "" or opaque).
  return file.type;
}

/** Returns true when the file is an image (by MIME type or file extension). */
export function isImageFile(file: File): boolean {
  return getMimeType(file).startsWith("image/");
}

/** Returns true when the file is a video (by MIME type or file extension). */
export function isVideoFile(file: File): boolean {
  return getMimeType(file).startsWith("video/");
}

/**
 * Returns the MIME type to send as Content-Type when uploading a video to
 * object storage. Falls back to "video/mp4" when the browser didn't report
 * a type — the storage server requires a non-empty video MIME type.
 */
export function getVideoContentType(file: File): string {
  const t = getMimeType(file);
  return t.startsWith("video/") ? t : "video/mp4";
}

/**
 * Hard upper bound for compressImage input.
 *
 * Decoding a raw image larger than this into a Canvas can exhaust memory on
 * mid-range Android phones (1–2 GB RAM). 50 MB is well above the realistic
 * maximum from any phone camera (12–50 MP ≈ 8–20 MB JPEG) while still blocking
 * genuinely problematic files. Callers that bypass the gallery size guard
 * (camera inputs) should apply this cap with a user-facing toast so the error
 * message is in Portuguese rather than a generic "Falha ao processar".
 */
export const MAX_COMPRESS_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * Compress and resize an image file using the Canvas API before base64 encoding.
 *
 * WHY THIS MATTERS FOR CAMERA PHOTOS
 * ------------------------------------
 * A 12 MP phone photo is typically 6–15 MB as raw JPEG. After base64 encoding
 * the JSON payload grows to 8–20 MB. Uploading 8–20 MB over mobile 4G takes
 * 20–60 s and looks "broken" — the OS saves eventually, but the wait resembles
 * a hang. Gallery photos appear to "work" because gallery apps already compress
 * images (thumbnails, share-size exports) before handing the File to the browser.
 *
 * This function resizes to at most maxPx on the longest edge and re-encodes as
 * JPEG, reducing a 12 MP photo from ~8 MB to ~200–300 KB (~30× smaller payload),
 * making uploads feel instant on every device and network.
 *
 * CAMERA INPUT SPECIAL CASE
 * --------------------------
 * Some Android / iOS combinations deliver capture="environment" files with
 * file.type="" AND file.name without a recognised extension (e.g. just "image"
 * with no .jpg suffix). In those cases isImageFile() returns false and the photo
 * is silently dropped. The callers in registrar-os.tsx and nova-os.tsx therefore
 * skip the isImageFile() check for camera-input files — the browser's
 * accept="image/*" attribute already guarantees every file from that input is an
 * image.
 *
 * Output: data:image/jpeg;base64,... — identical to FileReader.readAsDataURL,
 * so it is a drop-in replacement wherever a base64 data URL is expected.
 *
 * Safety: rejects files above MAX_COMPRESS_BYTES before touching the DOM.
 * drawImage/toDataURL failures under memory pressure are caught and propagated
 * rather than hanging the Promise. The FileReader fallback is used only when the
 * canvas 2D context itself is unavailable (not as a general error handler).
 *
 * @param file    The image File to compress.
 * @param maxPx   Maximum dimension (width or height) in pixels. Default 1920.
 * @param quality JPEG quality 0–1. Default 0.82.
 */
export function compressImage(
  file: File,
  maxPx = 1920,
  quality = 0.82,
): Promise<string> {
  // Reject before touching the DOM — no object URL created yet.
  if (file.size > MAX_COMPRESS_BYTES) {
    return Promise.reject(
      new Error(`Image too large for canvas compression (${(file.size / 1024 / 1024).toFixed(0)} MB)`),
    );
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(objectUrl);
    const img = new Image();

    img.onload = () => {
      cleanup();

      const { naturalWidth: w, naturalHeight: h } = img;
      const scale = Math.min(1, maxPx / Math.max(w, h, 1));
      const dw = Math.max(1, Math.round(w * scale));
      const dh = Math.max(1, Math.round(h * scale));

      const canvas = document.createElement("canvas");
      canvas.width = dw;
      canvas.height = dh;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        // Canvas 2D context unavailable (very low-memory device). File is already
        // guarded to MAX_COMPRESS_BYTES above, so FileReader is safe here.
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () =>
          reject(new Error("Canvas context unavailable and FileReader also failed"));
        return;
      }

      // drawImage / toDataURL can throw synchronously under memory pressure.
      // Catching here ensures the Promise always settles and the caller's
      // finally block (processingPhotosRef--) always executes.
      // We do NOT fall back to FileReader on this path — the file passed the
      // size guard but canvas still failed, meaning the device is under severe
      // memory pressure; attempting to encode a multi-MB blob via FileReader
      // would make things worse, not better.
      try {
        ctx.drawImage(img, 0, 0, dw, dh);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Canvas draw/encode failed"));
      }
    };

    img.onerror = () => {
      cleanup();
      // The file couldn't be decoded as an image (unsupported format or
      // corrupted). Reject cleanly — do NOT fall back to FileReader, which
      // would produce a base64 blob of non-image bytes that the server would
      // store as garbage.
      reject(new Error("Image failed to load (unsupported format or corrupted file)"));
    };

    img.src = objectUrl;
  });
}
