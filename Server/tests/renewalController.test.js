import test from "node:test";
import assert from "node:assert/strict";
import { Renewal } from "../models/index.js";
import { handleListMyRenewals } from "../controllers/renewalController.js";

test("student renewal history uses the authenticated user id and returns an empty list", async (context) => {
  let query;
  context.mock.method(Renewal, "findAll", async (options) => {
    query = options;
    return [];
  });

  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await handleListMyRenewals(
    { user: { id: 284, email: "student@example.com", role: "Student" } },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, []);
  assert.deepEqual(query.include[0].include[0].where, { user_id: 284 });
});
