// Server/utils/fileStorage.js
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import multer from "multer";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const COR_STORAGE_DIR = path.resolve(__dirname, "../storage/cor");

// Ensure storage directory exists
if (!fs.existsSync(COR_STORAGE_DIR)) {
  fs.mkdirSync(COR_STORAGE_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf"]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, COR_STORAGE_DIR);
  },
  filename: (req, file, cb) => {
    const userId = req.user?.id || req.user?.user_id || "guest";
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : ".jpg";
    const unique = crypto.randomBytes(8).toString("hex");
    const filename = `cor_${userId}_${Date.now()}_${unique}${safeExt}`;
    cb(null, filename);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error("Invalid file type. Only JPEG, PNG, WEBP, and PDF documents are allowed.");
    error.status = 422;
    cb(error, false);
  }
};

export const uploadCorMiddleware = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter,
});

/**
 * Saves a realtime camera capture picture sent as base64 / data URL
 */
export async function saveBase64CorImage(userId, base64String, originalName = "camera_cor.jpg") {
  if (typeof base64String !== "string" || !base64String.trim()) {
    throw new Error("No image data provided.");
  }

  const matches = base64String.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
  let mimeType = "image/jpeg";
  let base64Data = base64String.trim();

  if (matches) {
    mimeType = matches[1];
    base64Data = matches[2];
  }

  let ext = ".jpg";
  if (mimeType === "image/png") ext = ".png";
  else if (mimeType === "image/webp") ext = ".webp";
  else if (mimeType === "application/pdf") ext = ".pdf";

  const buffer = Buffer.from(base64Data, "base64");
  if (buffer.length === 0) {
    const err = new Error("Image buffer is empty.");
    err.status = 400;
    throw err;
  }
  if (buffer.length > 10 * 1024 * 1024) {
    const err = new Error("Uploaded photo exceeds maximum allowed size of 10MB.");
    err.status = 422;
    throw err;
  }

  const unique = crypto.randomBytes(8).toString("hex");
  const filename = `cor_${userId}_${Date.now()}_${unique}${ext}`;
  const filePath = path.join(COR_STORAGE_DIR, filename);

  await fs.promises.writeFile(filePath, buffer);

  return {
    filename,
    originalName,
    mimeType,
    size: buffer.length,
    filePath,
  };
}

/**
 * Safely resolves and validates a file path in private storage (preventing directory traversal)
 */
export function resolveCorFilePath(storedFilename) {
  if (!storedFilename || typeof storedFilename !== "string") return null;
  const basename = path.basename(storedFilename.trim());
  const fullPath = path.join(COR_STORAGE_DIR, basename);

  if (fs.existsSync(fullPath)) {
    return fullPath;
  }
  return null;
}

export function detectMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".jpg":
    case ".jpeg":
    default:
      return "image/jpeg";
  }
}
