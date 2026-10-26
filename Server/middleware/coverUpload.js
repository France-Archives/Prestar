// Server/middleware/coverUpload.js
import multer from "multer";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error("Invalid file type. Only JPEG, PNG, and WebP images are allowed.");
      error.status = 400;
      cb(error, false);
    }
  },
});

const multiFieldUpload = upload.fields([
  { name: "coverImage", maxCount: 1 },
  { name: "cover_image", maxCount: 1 },
  { name: "file", maxCount: 1 },
]);

/**
 * Middleware that handles optional multipart cover image uploads.
 * Attaches the uploaded file to req.file (supporting field names 'coverImage', 'cover_image', or 'file').
 * If content-type is not multipart/form-data, it safely passes through.
 */
export function handleCoverUpload(req, res, next) {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("multipart/form-data")) {
    return next();
  }

  multiFieldUpload(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          error: "Cover image exceeds maximum allowed size of 5MB.",
          message: "Cover image exceeds maximum allowed size of 5MB.",
        });
      }
      return res.status(err.status || 400).json({
        error: err.message || "Failed to process uploaded file.",
        message: err.message || "Failed to process uploaded file.",
      });
    }

    // Normalize attached file to req.file
    if (req.files) {
      req.file =
        req.files.coverImage?.[0] ||
        req.files.cover_image?.[0] ||
        req.files.file?.[0] ||
        null;
    }

    return next();
  });
}

export default handleCoverUpload;
