// Server/tests/interestEndpoints.test.js
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
  Student,
  User,
  UserCategoryPreference,
} from "../models/index.js";

describe("Reading Interests & Personalized Recommendations Test Suite", () => {
  let server;
  let baseUrl;
  let studentUser;
  let studentToken;
  let otherStudent;
  let otherToken;
  let testAuthor;
  let catScience;
  let catHistory;
  let catMath;
  let bookScience;
  let bookHistory;
  let bookMath;
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

    // 1. Create Student 1
    studentUser = await User.create({
      first_name: "Interest",
      last_name: `Reader_${uniqueSuffix}`,
      email: `interest_student_${uniqueSuffix}@wmsu.edu.ph`,
      password_hash: "dummyhash123",
      role: "Student",
      status: "Active",
      email_verified: true,
    });
    await Student.create({
      user_id: studentUser.user_id,
      student_number: `INT-${String(uniqueSuffix).slice(-6)}`,
      college: "CS",
      program: "BSCS",
      year_level: 2,
    });
    studentToken = jwt.sign(
      { id: studentUser.user_id, role: "Student", email: studentUser.email },
      jwtSecret,
      { expiresIn: "1h" },
    );

    // 2. Create Student 2
    otherStudent = await User.create({
      first_name: "Other",
      last_name: `Reader_${uniqueSuffix}`,
      email: `other_student_${uniqueSuffix}@wmsu.edu.ph`,
      password_hash: "dummyhash123",
      role: "Student",
      status: "Active",
      email_verified: true,
    });
    await Student.create({
      user_id: otherStudent.user_id,
      student_number: `OTH-${String(uniqueSuffix).slice(-6)}`,
      college: "CS",
      program: "BSCS",
      year_level: 2,
    });
    otherToken = jwt.sign(
      { id: otherStudent.user_id, role: "Student", email: otherStudent.email },
      jwtSecret,
      { expiresIn: "1h" },
    );

    // 3. Create Author
    testAuthor = await Author.create({
      first_name: "Isaac",
      last_name: `Asimov_${uniqueSuffix}`,
    });

    // 4. Create 3 distinct Categories
    catScience = await Category.create({
      category_name: `Science_${uniqueSuffix}`,
      description: "Science & Technology",
    });
    catHistory = await Category.create({
      category_name: `History_${uniqueSuffix}`,
      description: "World History",
    });
    catMath = await Category.create({
      category_name: `Math_${uniqueSuffix}`,
      description: "Pure Mathematics",
    });

    // 5. Create books in categories
    bookScience = await Book.create({
      title: `The Science of Everything ${uniqueSuffix}`,
      isbn: `978-0-3333-${String(uniqueSuffix).slice(-5)}`,
      category_id: catScience.category_id,
      author_id: testAuthor.author_id,
      status: "Active",
    });
    await BookCopy.create({
      book_id: bookScience.book_id,
      accession_no: `ACC_SCI_${uniqueSuffix}`,
      barcode: `BC_SCI_${uniqueSuffix}`,
      status: "Available",
      condition_status: "Good",
    });

    bookHistory = await Book.create({
      title: `Chronicles of Time ${uniqueSuffix}`,
      isbn: `978-0-4444-${String(uniqueSuffix).slice(-5)}`,
      category_id: catHistory.category_id,
      author_id: testAuthor.author_id,
      status: "Active",
    });
    await BookCopy.create({
      book_id: bookHistory.book_id,
      accession_no: `ACC_HIS_${uniqueSuffix}`,
      barcode: `BC_HIS_${uniqueSuffix}`,
      status: "Available",
      condition_status: "Good",
    });

    bookMath = await Book.create({
      title: `Calculus Foundations ${uniqueSuffix}`,
      isbn: `978-0-5555-${String(uniqueSuffix).slice(-5)}`,
      category_id: catMath.category_id,
      author_id: testAuthor.author_id,
      status: "Active",
    });
    await BookCopy.create({
      book_id: bookMath.book_id,
      accession_no: `ACC_MAT_${uniqueSuffix}`,
      barcode: `BC_MAT_${uniqueSuffix}`,
      status: "Available",
      condition_status: "Good",
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    try {
      if (studentUser) {
        await UserCategoryPreference.destroy({ where: { user_id: studentUser.user_id } });
        await Student.destroy({ where: { user_id: studentUser.user_id } });
        await User.destroy({ where: { user_id: studentUser.user_id } });
      }
      if (otherStudent) {
        await UserCategoryPreference.destroy({ where: { user_id: otherStudent.user_id } });
        await Student.destroy({ where: { user_id: otherStudent.user_id } });
        await User.destroy({ where: { user_id: otherStudent.user_id } });
      }
      if (bookScience) {
        await BookCopy.destroy({ where: { book_id: bookScience.book_id } });
        await Book.destroy({ where: { book_id: bookScience.book_id } });
      }
      if (bookHistory) {
        await BookCopy.destroy({ where: { book_id: bookHistory.book_id } });
        await Book.destroy({ where: { book_id: bookHistory.book_id } });
      }
      if (bookMath) {
        await BookCopy.destroy({ where: { book_id: bookMath.book_id } });
        await Book.destroy({ where: { book_id: bookMath.book_id } });
      }
      if (catScience) await Category.destroy({ where: { category_id: catScience.category_id } });
      if (catHistory) await Category.destroy({ where: { category_id: catHistory.category_id } });
      if (catMath) await Category.destroy({ where: { category_id: catMath.category_id } });
      if (testAuthor) await Author.destroy({ where: { author_id: testAuthor.author_id } });
    } catch (err) {
      console.warn("Cleanup warning:", err.message);
    }
  });

  it("1. GET /api/interests lists all available interests (categories)", async () => {
    const res = await fetch(`${baseUrl}/api/interests`, {
      headers: { Cookie: `auth_token=${studentToken}` },
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json.data));
    const found = json.data.find((c) => String(c.id) === String(catScience.category_id));
    assert.ok(found);
    assert.strictEqual(found.name, catScience.category_name);
  });

  it("2. GET /api/me/interests returns empty array initially", async () => {
    const res = await fetch(`${baseUrl}/api/me/interests`, {
      headers: { Cookie: `auth_token=${studentToken}` },
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json.data));
    assert.strictEqual(json.data.length, 0);
  });

  it("3. PUT /api/me/interests enforces choosing at least 1 interest", async () => {
    const res = await fetch(`${baseUrl}/api/me/interests`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `auth_token=${studentToken}`,
      },
      body: JSON.stringify({ interestIds: [] }),
    });
    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.ok(json.error.includes("at least 1 interest"));
  });

  it("4. PUT /api/me/interests rejects non-existent category IDs", async () => {
    const res = await fetch(`${baseUrl}/api/me/interests`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `auth_token=${studentToken}`,
      },
      body: JSON.stringify({ interestIds: [9999999] }),
    });
    assert.strictEqual(res.status, 422);
    const json = await res.json();
    assert.strictEqual(json.code, "VALIDATION_ERROR");
  });

  it("5. PUT /api/me/interests saves chosen interests (at least 1)", async () => {
    const res = await fetch(`${baseUrl}/api/me/interests`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `auth_token=${studentToken}`,
      },
      body: JSON.stringify({
        interestIds: [catScience.category_id, catHistory.category_id],
      }),
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.data.length, 2);
    const ids = json.data.map((i) => String(i.id));
    assert.ok(ids.includes(String(catScience.category_id)));
    assert.ok(ids.includes(String(catHistory.category_id)));
    assert.ok(!ids.includes(String(catMath.category_id)));

    // Verify stored in DB
    const dbCount = await UserCategoryPreference.count({
      where: { user_id: studentUser.user_id },
    });
    assert.strictEqual(dbCount, 2);
  });

  it("6. GET /api/me/recommended-books returns books matching chosen categories", async () => {
    const res = await fetch(`${baseUrl}/api/me/recommended-books`, {
      headers: { Cookie: `auth_token=${studentToken}` },
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    const books = json.data || json.books;
    assert.ok(Array.isArray(books));
    assert.ok(books.length >= 2);

    const bookIds = books.map((b) => b.id);
    assert.ok(bookIds.includes(bookScience.book_id));
    assert.ok(bookIds.includes(bookHistory.book_id));
    // Math was not in the chosen interests, so it must not be recommended
    assert.ok(!bookIds.includes(bookMath.book_id));
  });

  it("7. GET /api/student-dashboard includes recommended books based on user interests", async () => {
    const res = await fetch(`${baseUrl}/api/student-dashboard`, {
      headers: { Cookie: `auth_token=${studentToken}` },
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json.recommended));
    const recIds = json.recommended.map((b) => b.id);
    assert.ok(recIds.includes(bookScience.book_id));
    assert.ok(recIds.includes(bookHistory.book_id));
    assert.ok(!recIds.includes(bookMath.book_id));
  });

  it("8. GET /api/auth/me includes interests in student profile", async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: `auth_token=${studentToken}` },
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    const user = json.user || json.data;
    assert.ok(Array.isArray(user.interests));
    assert.strictEqual(user.interests.length, 2);
    assert.ok(Array.isArray(user.student.interests));
    assert.strictEqual(user.student.interests.length, 2);
  });
});
