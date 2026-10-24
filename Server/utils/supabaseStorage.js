// Server/utils/supabaseStorage.js
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import path from "node:path";
import { detectFileSignature } from "./fileStorage.js";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

let supabaseClient = null;

/**
 * Returns the initialized Supabase client or null if env credentials are not present.
 */
export function getSupabaseClient() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_KEY?.trim();

  if (!url || !key) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return supabaseClient;
}

export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_KEY?.trim());
}

/**
 * Extracts the storage relative path (e.g. "covers/123_abc.jpg") from a full public Supabase URL.
 */
export function extractStoragePathFromUrl(fileUrl, bucketName) {
  if (!fileUrl || typeof fileUrl !== "string") return null;
  const bucket = bucketName || process.env.SUPABASE_BUCKET || "book-covers";

  const publicPrefix = `/${bucket}/`;
  const idx = fileUrl.indexOf(publicPrefix);
  if (idx !== -1) {
    return fileUrl.substring(idx + publicPrefix.length).split("?")[0];
  }

  if (fileUrl.startsWith("covers/")) {
    return fileUrl.split("?")[0];
  }

  return null;
}

/**
 * Uploads a book cover image buffer to Supabase Storage and returns its public URL.
 * 
 * @param {Object} options
 * @param {Buffer} options.buffer - Raw image file buffer
 * @param {string} [options.originalname] - Original file name
 * @param {string|number} [options.bookId] - Optional book ID for naming
 * @returns {Promise<string>} Public URL of the uploaded image
 */
export async function uploadCoverImage({ buffer, originalname, bookId = "new" }) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    const error = new Error("No image buffer provided.");
    error.status = 400;
    throw error;
  }

  if (buffer.length > 5 * 1024 * 1024) {
    const error = new Error("Cover image exceeds maximum allowed size of 5MB.");
    error.status = 400;
    throw error;
  }

  const sig = detectFileSignature(buffer);
  if (!sig || !ALLOWED_MIME_TYPES.has(sig.mimeType)) {
    const error = new Error("Invalid file content. Only JPEG, PNG, and WebP images are allowed.");
    error.status = 400;
    throw error;
  }

  const client = getSupabaseClient();
  if (!client) {
    const error = new Error(
      "Supabase Storage is not configured on the server. Please ensure SUPABASE_URL and SUPABASE_SERVICE_KEY are set."
    );
    error.status = 500;
    throw error;
  }

  const bucket = process.env.SUPABASE_BUCKET || "book-covers";
  const unique = crypto.randomBytes(8).toString("hex");
  const ext = sig.ext;
  const filePath = `covers/${bookId}_${Date.now()}_${unique}${ext}`;

  const { data: uploadData, error: uploadError } = await client.storage
    .from(bucket)
    .upload(filePath, buffer, {
      contentType: sig.mimeType,
      upsert: true,
    });

  if (uploadError) {
    const error = new Error(`Failed to upload cover image to Supabase Storage: ${uploadError.message}`);
    error.status = 502;
    throw error;
  }

  const { data: publicData } = client.storage.from(bucket).getPublicUrl(filePath);

  if (!publicData?.publicUrl) {
    const error = new Error("Failed to retrieve public URL from Supabase Storage.");
    error.status = 502;
    throw error;
  }

  return publicData.publicUrl;
}

/**
 * Deletes a previously uploaded cover image from Supabase Storage given its URL.
 * 
 * @param {string} coverUrl - Full public URL or storage path of the cover image
 * @returns {Promise<boolean>} True if deleted or skipped safely, false on error
 */
export async function deleteCoverImage(coverUrl) {
  if (!coverUrl || typeof coverUrl !== "string") return false;

  const client = getSupabaseClient();
  if (!client) return false;

  const bucket = process.env.SUPABASE_BUCKET || "book-covers";
  const storagePath = extractStoragePathFromUrl(coverUrl, bucket);
  if (!storagePath) {
    // Not a Supabase storage URL for this bucket, skip deletion
    return false;
  }

  try {
    const { error } = await client.storage.from(bucket).remove([storagePath]);
    if (error) {
      console.warn(`[Supabase Storage] Failed to delete old cover "${storagePath}":`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[Supabase Storage] Exception deleting old cover "${storagePath}":`, err.message);
    return false;
  }
}
