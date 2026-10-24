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
]);

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

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
    const error = new Error("Invalid file type. Only realtime captured images (JPEG, PNG, WebP) are allowed.");
    error.status = 400;
    cb(error, false);
  }
};

const rawMulter = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter,
});

/**
 * Checks a buffer against known magic byte signatures for JPEG, PNG, and WebP images.
 * Returns { mimeType, ext } if recognized, or null if unrecognized.
 */
export function detectFileSignature(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 4) {
    return null;
  }

  // JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: "image/jpeg", ext: ".jpg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mimeType: "image/png", ext: ".png" };
  }

  // WebP: 'RIFF' at 0..3 and 'WEBP' at 8..11
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { mimeType: "image/webp", ext: ".webp" };
  }

  return null;
}

/**
 * Reads initial bytes from a disk file to verify its real file signature.
 */
export async function verifyDiskFileSignature(filePath) {
  try {
    const fd = await fs.promises.open(filePath, "r");
    try {
      const buffer = Buffer.alloc(16);
      const { bytesRead } = await fd.read(buffer, 0, 16, 0);
      return detectFileSignature(buffer.subarray(0, bytesRead));
    } finally {
      await fd.close();
    }
  } catch {
    return null;
  }
}

export const uploadCorMiddleware = Object.assign(
  (...args) => rawMulter(...args),
  rawMulter,
  {
    single(fieldName = "file") {
      const middleware = rawMulter.single(fieldName);
      return (req, res, next) => {
        middleware(req, res, async (err) => {
          if (err) return next(err);
          if (req.file) {
            const sig = await verifyDiskFileSignature(req.file.path);
            if (!sig) {
              try {
                if (fs.existsSync(req.file.path)) {
                  await fs.promises.unlink(req.file.path);
                }
              } catch (_) {}
              const error = new Error("Invalid file content. Real file signature does not match allowed image types (JPEG, PNG, WebP).");
              error.status = 400;
              return next(error);
            }
            req.file.mimetype = sig.mimeType;
            const currentExt = path.extname(req.file.filename).toLowerCase();
            if (currentExt !== sig.ext) {
              const newFilename = `${path.basename(req.file.filename, currentExt)}${sig.ext}`;
              const newPath = path.join(path.dirname(req.file.path), newFilename);
              try {
                await fs.promises.rename(req.file.path, newPath);
                req.file.filename = newFilename;
                req.file.path = newPath;
              } catch (_) {}
            }
          }
          next();
        });
      };
    },
  }
);

/**
 * Saves a realtime camera capture picture sent as base64 / data URL
 */
export async function saveBase64CorImage(userId, base64String, originalName = "camera_cor.jpg") {
  if (typeof base64String !== "string" || !base64String.trim()) {
    const err = new Error("No image data provided.");
    err.status = 400;
    throw err;
  }

  const matches = base64String.match(/^data:image\/[A-Za-z0-9.+-]+;base64,(.+)$/s);
  if (!matches) {
    const err = new Error("Invalid data URL format. Must be a valid data:image/... base64 string.");
    err.status = 400;
    throw err;
  }

  const base64Data = matches[1].trim();
  const buffer = Buffer.from(base64Data, "base64");
  if (buffer.length === 0) {
    const err = new Error("Image buffer is empty.");
    err.status = 400;
    throw err;
  }
  if (buffer.length > 10 * 1024 * 1024) {
    const err = new Error("Uploaded photo exceeds maximum allowed size of 10MB.");
    err.status = 400;
    throw err;
  }

  const signature = detectFileSignature(buffer);
  if (!signature) {
    const err = new Error("Invalid file content. Real file signature does not match allowed image types (JPEG, PNG, WebP).");
    err.status = 400;
    throw err;
  }

  const mimeType = signature.mimeType;
  const ext = signature.ext;

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
  try {
    if (fs.existsSync(filePath)) {
      const fd = fs.openSync(filePath, "r");
      try {
        const buffer = Buffer.alloc(16);
        const bytesRead = fs.readSync(fd, buffer, 0, 16, 0);
        const sig = detectFileSignature(buffer.subarray(0, bytesRead));
        if (sig) return sig.mimeType;
      } finally {
        fs.closeSync(fd);
      }
    }
  } catch (_) {}

  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
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
