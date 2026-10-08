import assert from "node:assert/strict";
import test from "node:test";
import { validateProofImage } from "../utils/proofImageValidation.js";

const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test("accepts a supported image signature and returns metadata", () => {
  const buffer = Buffer.concat([pngHeader, Buffer.from("proof")]);
  assert.deepEqual(validateProofImage({ buffer, mimetype: "image/png" }), {
    mimeType: "image/png",
    sizeBytes: buffer.length,
  });
});

test("rejects bytes that do not match the claimed image type", () => {
  assert.throws(
    () => validateProofImage({ buffer: Buffer.from("not a png"), mimetype: "image/png" }),
    { status: 415 },
  );
});

test("rejects unsupported media types", () => {
  assert.throws(
    () => validateProofImage({ buffer: pngHeader, mimetype: "image/gif" }),
    { status: 415 },
  );
});

test("rejects empty and oversized files", () => {
  assert.throws(
    () => validateProofImage({ buffer: Buffer.alloc(0), mimetype: "image/png" }),
    { status: 400 },
  );
  assert.throws(
    () => validateProofImage({ buffer: Buffer.alloc(5 * 1024 * 1024 + 1), mimetype: "image/png" }),
    { status: 413 },
  );
});
