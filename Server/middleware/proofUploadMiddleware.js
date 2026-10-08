import multer from "multer";

const acceptedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 0,
    parts: 1,
  },
  fileFilter(_req, file, callback) {
    if (!acceptedMimeTypes.has(file.mimetype)) {
      return callback(Object.assign(new Error("Proof must be a JPEG, PNG, or WebP image."), { status: 415 }));
    }
    return callback(null, true);
  },
});

export function receiveSignupProof(req, res, next) {
  upload.single("proof")(req, res, (error) => {
    if (!error) {
      return next();
    }
    if (error instanceof multer.MulterError) {
      const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      const message = error.code === "LIMIT_FILE_SIZE"
        ? "Proof image must not exceed 5 MB."
        : "Upload exactly one image in the 'proof' field.";
      return res.status(status).json({ error: message });
    }
    return next(error);
  });
}
