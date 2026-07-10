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
