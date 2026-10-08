const MAX_PROOF_SIZE_BYTES = 5 * 1024 * 1024;
const allowedTypes = new Map([
  ["image/jpeg", (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff],
  ["image/png", (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))],
  ["image/webp", (buffer) => buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP"],
]);

function requestError(status, message) {
  return Object.assign(new Error(message), { status });
}

export function validateProofImage(file) {
  const buffer = file?.buffer;
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw requestError(400, "A non-empty proof image is required.");
  }
  if (buffer.length > MAX_PROOF_SIZE_BYTES) {
    throw requestError(413, "Proof image must not exceed 5 MB.");
  }

  const matchesType = allowedTypes.get(file.mimetype);
  if (!matchesType || !matchesType(buffer)) {
    throw requestError(415, "Proof must be a valid JPEG, PNG, or WebP image.");
  }

  return { mimeType: file.mimetype, sizeBytes: buffer.length };
}
