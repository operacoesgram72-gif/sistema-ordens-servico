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
 * Returns the effective MIME type of a file.
 * Uses the browser-reported type first (fast path), then falls back to
 * extension-based detection for the common Android/iOS case where the picker
 * doesn't set the type (e.g. files from Google Drive, some gallery apps).
 */
export function getMimeType(file: File): string {
  if (file.type) return file.type;
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return "image/jpeg";
  if (VIDEO_EXTENSIONS.has(ext)) return "video/mp4";
  return "";
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
