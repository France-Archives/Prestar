// Server/tests/categoryAndDropdown.test.js
import test, { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";
import app from "../app.js";
import {
  Author,
  Book,
  BookCopy,
  Category,
  User,
  sequelize,
} from "../models/index.js";

describe("Category Management & Category-Filtered Books Test Suite", () => {
  let server;
  let baseUrl;
  let adminUser;
  let adminToken;
  let studentUser;
  let studentToken;
  let testAuthor;
  let categoryA;
  let categoryB;
  let bookInCatA;
  let bookInCatB;
  let uniqueSuffix;

  before(async () => {
    uniqueSuffix = Date.now();
    const jwtSecret = process.env.JWT_SECRET || "prestar_jwt_dev_secret_2026";

    // Start ephemeral server
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, "127.0.0.1", () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // 1. Create Admin
    adminUser = await User.create({
      first_name: "AdminCat",
      last_name: "Staff",
      email: `admin_cat_${uniqueSuffix}@prestar.edu`,
      password_hash: "hash123",
      role: "Admin",
      status: "Active",
      email_verified: true,
    });
    adminToken = jwt.sign(
      { id: adminUser.user_id, role: "Admin", email: adminUser.email },
      jwtSecret,
      { expiresIn: "1h" },
    );

    // 2. Create Student
    studentUser = await User.create({
      first_name: "StudentCat",
      last_name: "Reader",
      email: `student_cat_${uniqueSuffix}@wmsu.edu.ph`,
      password_hash: "hash123",
      role: "Student",
      status: "Active",
      email_verified: true,
    });
    studentToken = jwt.sign(
      { id: studentUser.user_id, role: "Student", email: studentUser.email },
      jwtSecret,
      { expiresIn: "1h" },
    );

    // 3. Create Author
    testAuthor = await Author.create({
      first_name: "Category",
      last_name: `Author_${uniqueSuffix}`,
    });

    // 4. Create two distinct Categories
    categoryA = await Category.create({
      category_name: `CatA_${uniqueSuffix}`,
      description: "Category Alpha",
    });
    categoryB = await Category.create({
      category_name: `CatB_${uniqueSuffix}`,
      description: "Category Beta",
    });

    // 5. Create books in each category
    bookInCatA = await Book.create({
      title: `Book Alpha ${uniqueSuffix}`,
      isbn: `978-0-1111-${String(uniqueSuffix).slice(-5)}`,
      category_id: categoryA.category_id,
      author_id: testAuthor.author_id,
      status: "Active",
    });
    await BookCopy.create({
      book_id: bookInCatA.book_id,
      accession_no: `ACC_A_${uniqueSuffix}`,
      barcode: `BC_A_${uniqueSuffix}`,
      status: "Available",
      condition_status: "Good",
    });

    bookInCatB = await Book.create({
      title: `Book Beta ${uniqueSuffix}`,
      isbn: `978-0-2222-${String(uniqueSuffix).slice(-5)}`,
      category_id: categoryB.category_id,
      author_id: testAuthor.author_id,
      status: "Active",
    });
    await BookCopy.create({
      book_id: bookInCatB.book_id,
      accession_no: `ACC_B_${uniqueSuffix}`,
      barcode: `BC_B_${uniqueSuffix}`,
      status: "Available",
      condition_status: "Good",
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    try {
      if (bookInCatA) {
        await BookCopy.destroy({ where: { book_id: bookInCatA.book_id } });
        await Book.destroy({ where: { book_id: bookInCatA.book_id } });
      }
      if (bookInCatB) {
        await BookCopy.destroy({ where: { book_id: bookInCatB.book_id } });
        await Book.destroy({ where: { book_id: bookInCatB.book_id } });
      }
      if (categoryA) await Category.destroy({ where: { category_id: categoryA.category_id } });
      if (categoryB) await Category.destroy({ where: { category_id: categoryB.category_id } });
      if (testAuthor) await Author.destroy({ where: { author_id: testAuthor.author_id } });
      if (adminUser) await User.destroy({ where: { user_id: adminUser.user_id } });
      if (studentUser) await User.destroy({ where: { user_id: studentUser.user_id } });
    } catch (err) {
      console.warn("Cleanup warning:", err.message);
    }
  });

  describe("1. GET /api/categories (Dropdown Population)", () => {
    it("returns 401 when not authenticated", async () => {
      const res = await fetch(`${baseUrl}/api/categories`);
      assert.strictEqual(res.status, 401);
    });

    it("returns category list including our test categories for authenticated users", async () => {
      const res = await fetch(`${baseUrl}/api/categories`, {
        headers: { Cookie: `auth_token=${studentToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.ok(Array.isArray(json.data));
      assert.ok(Array.isArray(json.categories));

      const found = json.data.find((c) => String(c.id) === String(categoryA.category_id));
      assert.ok(found);
      assert.strictEqual(found.name, categoryA.category_name);
      assert.strictEqual(found.category_name, categoryA.category_name);
      assert.strictEqual(found.categoryId, categoryA.category_id);
      assert.strictEqual(found.category_id, categoryA.category_id);
    });
  });

  describe("2. POST /api/categories (Add Category)", () => {
    it("rejects non-staff (Student) with 403 Forbidden", async () => {
      const res = await fetch(`${baseUrl}/api/categories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `auth_token=${studentToken}`,
        },
        body: JSON.stringify({ name: `StudentCat_${uniqueSuffix}` }),
      });
      assert.strictEqual(res.status, 403);
    });

    it("validates that category name is required", async () => {
      const res = await fetch(`${baseUrl}/api/categories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `auth_token=${adminToken}`,
        },
        body: JSON.stringify({ name: "   " }),
      });
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.ok(json.error.includes("required"));
    });

    it("allows Admin to create a new category", async () => {
      const newCatName = `NewGenre_${uniqueSuffix}`;
      const res = await fetch(`${baseUrl}/api/categories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `auth_token=${adminToken}`,
        },
        body: JSON.stringify({
          name: newCatName,
          description: "Freshly added genre via endpoint",
        }),
      });
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.ok(json.data);
      assert.strictEqual(json.data.name, newCatName);
      assert.strictEqual(json.data.category_name, newCatName);
      assert.strictEqual(json.data.description, "Freshly added genre via endpoint");
      assert.ok(json.data.id);

      // Cleanup
      await Category.destroy({ where: { category_id: json.data.categoryId } });
    });

    it("rejects duplicate category name with 409 Conflict", async () => {
      const res = await fetch(`${baseUrl}/api/categories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `auth_token=${adminToken}`,
        },
        body: JSON.stringify({ name: categoryA.category_name.toLowerCase() }),
      });
      assert.strictEqual(res.status, 409);
      const json = await res.json();
      assert.strictEqual(json.code, "CONFLICT");
    });
  });

  describe("3. Get Books Based on Dropdown Category", () => {
    it("filters books using query param ?category_id=", async () => {
      const res = await fetch(`${baseUrl}/api/books?category_id=${categoryA.category_id}`, {
        headers: { Cookie: `auth_token=${studentToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      const books = json.data || json.books;
      assert.ok(Array.isArray(books));
      assert.ok(books.some((b) => b.id === bookInCatA.book_id));
      assert.ok(!books.some((b) => b.id === bookInCatB.book_id));
    });

    it("filters books using camelCase query param ?categoryId=", async () => {
      const res = await fetch(`${baseUrl}/api/books?categoryId=${categoryB.category_id}`, {
        headers: { Cookie: `auth_token=${studentToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      const books = json.data || json.books;
      assert.ok(Array.isArray(books));
      assert.ok(books.some((b) => b.id === bookInCatB.book_id));
      assert.ok(!books.some((b) => b.id === bookInCatA.book_id));
    });

    it("filters books using direct route GET /api/books/category/:id", async () => {
      const res = await fetch(`${baseUrl}/api/books/category/${categoryA.category_id}`, {
        headers: { Cookie: `auth_token=${studentToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      const books = json.data || json.books;
      assert.ok(Array.isArray(books));
      assert.ok(books.some((b) => b.id === bookInCatA.book_id));
      assert.ok(!books.some((b) => b.id === bookInCatB.book_id));
    });

    it("filters books using nested route GET /api/categories/:id/books", async () => {
      const res = await fetch(`${baseUrl}/api/categories/${categoryB.category_id}/books`, {
        headers: { Cookie: `auth_token=${studentToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      const books = json.data || json.books;
      assert.ok(Array.isArray(books));
      assert.ok(books.some((b) => b.id === bookInCatB.book_id));
      assert.ok(!books.some((b) => b.id === bookInCatA.book_id));
    });

    it("rejects invalid non-integer category_id with 400", async () => {
      const res = await fetch(`${baseUrl}/api/books?category_id=abc`, {
        headers: { Cookie: `auth_token=${studentToken}` },
      });
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.ok(json.error.includes("category_id must be a positive integer"));
    });
  });
});
