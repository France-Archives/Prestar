// Server/tests/supabaseCoverStorage.test.js
import test from "node:test";
import assert from "node:assert/strict";
import {
  extractStoragePathFromUrl,
  uploadCoverImage,
  deleteCoverImage,
  isSupabaseConfigured,
} from "../utils/supabaseStorage.js";
import { handleCoverUpload } from "../middleware/coverUpload.js";

test("Supabase Storage Utilities Suite", async (t) => {
  await t.test("extractStoragePathFromUrl correctly extracts relative path from Supabase public URL", () => {
    const url = "https://abcdefghij.supabase.co/storage/v1/object/public/book-covers/covers/42_1729000_deadbeef.jpg";
    const extracted = extractStoragePathFromUrl(url, "book-covers");
    assert.equal(extracted, "covers/42_1729000_deadbeef.jpg");

    // With query parameters
    const urlWithParams = "https://abcdefghij.supabase.co/storage/v1/object/public/book-covers/covers/42_1729000_deadbeef.png?token=xyz";
    assert.equal(extractStoragePathFromUrl(urlWithParams, "book-covers"), "covers/42_1729000_deadbeef.png");

    // Relative path directly
    assert.equal(extractStoragePathFromUrl("covers/test.webp", "book-covers"), "covers/test.webp");

    // Non-matching URL
    assert.equal(extractStoragePathFromUrl("https://example.com/other-image.jpg", "book-covers"), null);
    assert.equal(extractStoragePathFromUrl(null), null);
    assert.equal(extractStoragePathFromUrl(""), null);
  });

  await t.test("uploadCoverImage validates buffer and rejects empty/missing buffers", async () => {
    await assert.rejects(
      async () => {
        await uploadCoverImage({ buffer: null });
      },
      (err) => {
        assert.equal(err.status, 400);
        assert.match(err.message, /No image buffer provided/);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await uploadCoverImage({ buffer: Buffer.alloc(0) });
      },
      (err) => {
        assert.equal(err.status, 400);
        return true;
      }
    );
  });

  await t.test("uploadCoverImage rejects files larger than 5MB", async () => {
    // 5MB + 1 byte
    const largeBuffer = Buffer.alloc(5 * 1024 * 1024 + 1);
    await assert.rejects(
      async () => {
        await uploadCoverImage({ buffer: largeBuffer });
      },
      (err) => {
        assert.equal(err.status, 400);
        assert.match(err.message, /exceeds maximum allowed size/);
        return true;
      }
    );
  });

  await t.test("uploadCoverImage rejects invalid file signatures (e.g. text/exe)", async () => {
    const fakeBuffer = Buffer.from("this is plain text pretending to be an image");
    await assert.rejects(
      async () => {
        await uploadCoverImage({ buffer: fakeBuffer });
      },
      (err) => {
        assert.equal(err.status, 400);
        assert.match(err.message, /Invalid file content/);
        return true;
      }
    );
  });

  await t.test("deleteCoverImage gracefully returns false for invalid or external URLs", async () => {
    const result = await deleteCoverImage("https://images.unsplash.com/photo-1234");
    assert.equal(result, false);

    const emptyResult = await deleteCoverImage(null);
    assert.equal(emptyResult, false);
  });
});

test("Cover Upload Middleware Suite", async (t) => {
  await t.test("handleCoverUpload passes through non-multipart requests untouched", (_, done) => {
    const req = {
      headers: { "content-type": "application/json" },
      body: { title: "Test Book" },
    };
    const res = {};
    handleCoverUpload(req, res, () => {
      assert.equal(req.body.title, "Test Book");
      assert.equal(req.file, undefined);
      done();
    });
  });
});
