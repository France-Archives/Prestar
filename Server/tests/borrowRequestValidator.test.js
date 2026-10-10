// Server/tests/borrowRequestValidator.test.js
import assert from "node:assert/strict";
import test from "node:test";
import {
  validateCreateBorrowRequest,
  validateRequestId,
  validateReviewBorrowRequest,
} from "../validators/borrowRequestValidator.js";

function run(middleware, req) {
  const response = { statusCode: null, body: null };
  const res = {
    status(code) { response.statusCode = code; return this; },
    json(body) { response.body = body; return this; },
  };
  middleware(req, res, () => { response.nextCalled = true; });
  return { ...response, req };
}

test("accepts a positive integer book_id", () => {
  const result = run(validateCreateBorrowRequest, { body: { book_id: 12 } });
  assert.equal(result.nextCalled, true);
  assert.equal(result.req.validatedBookId, 12);
});

test("rejects invalid book ids", () => {
  for (const bookId of [0, -1, 1.2, "1x", [], {}]) {
    const result = run(validateCreateBorrowRequest, { body: { book_id: bookId } });
    assert.equal(result.statusCode, 400);
  }
});

test("requires a rejection reason", () => {
  const result = run(validateReviewBorrowRequest, { body: { decision: "reject", remarks: "  " } });
  assert.equal(result.statusCode, 400);
});

test("accepts review decisions and validates request ids", () => {
  const review = run(validateReviewBorrowRequest, { body: { decision: "approve" } });
  assert.equal(review.nextCalled, true);
  assert.deepEqual(review.req.reviewInput, { decision: "approve", remarks: "" });

  const requestId = run(validateRequestId, { params: { id: "23" } });
  assert.equal(requestId.nextCalled, true);
  assert.equal(requestId.req.resourceId, 23);
});
