// Server/tests/shelfLocatorFlow.test.js
import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import {
  Author,
  Book,
  BookCopy,
  BorrowRequest,
  BorrowedBook,
  Category,
  Librarian,
  Student,
  StudentVerification,
  User,
  AcademicTerm,
  sequelize,
} from "../models/index.js";
import generateToken from "../utils/generateToken.js";
import app from "../app.js";

async function mockRequest(expressApp, { method, url, headers = {}, body = null }) {
  const reqHeaders = { ...headers };
  let payloadStr = "";

  if (body && typeof body === "object") {
    payloadStr = JSON.stringify(body);
    reqHeaders["content-type"] = "application/json";
    reqHeaders["content-length"] = Buffer.byteLength(payloadStr);
  }

  return new Promise((resolve, reject) => {
    const server = expressApp.listen(0, async () => {
      const port = server.address().port;
      try {
        const fetchOptions = {
          method,
          headers: reqHeaders,
        };
        if (body) {
          fetchOptions.body = payloadStr;
        }
        const res = await fetch(`http://127.0.0.1:${port}${url}`, fetchOptions);
        const text = await res.text();
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {}
        server.close();
        resolve({
          status: res.status,
          headers: Object.fromEntries(res.headers.entries()),
          text,
          json,
        });
      } catch (err) {
        server.close();
        reject(err);
      }
    });
  });
}

test("Shelf Locator, Pickup Release Response, and Return Shelf Update Suite", async (t) => {
  const stamp = Date.now();
  const passwordHash = await bcrypt.hash("Password123!", 10);

  // 1. Resolve Active Academic Term
  let activeTerm = await AcademicTerm.findOne({ where: { status: "Active" } });
  if (!activeTerm) {
    activeTerm = await AcademicTerm.create({
      term_name: `Test Term Shelf ${stamp}`,
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      cor_deadline: "2026-12-31",
      status: "Active",
    });
  }

  // 2. Create Librarian
  const libUser = await User.create({
    first_name: "Librarian",
    last_name: `ShelfLib_${stamp}`,
    email: `lib_shelf_${stamp}@prestar.edu`,
    password_hash: passwordHash,
    role: "Librarian",
    status: "Active",
    email_verified: true,
  });
  await Librarian.create({
    user_id: libUser.user_id,
    employee_id: `LIB-${stamp.toString().slice(-6)}`,
  });
  const libToken = generateToken(libUser);

  // 3. Create Student with Approved Verification
  const studentUser = await User.create({
    first_name: "Student",
    last_name: `ShelfStu_${stamp}`,
    email: `stu_shelf_${stamp}@prestar.edu`,
    password_hash: passwordHash,
    role: "Student",
    status: "Active",
    email_verified: true,
  });
  await Student.create({
    user_id: studentUser.user_id,
    student_number: `STU-SH-${stamp.toString().slice(-6)}`,
    course: "BSCS",
    year_level: 3,
  });
  await StudentVerification.create({
    user_id: studentUser.user_id,
    term_id: activeTerm.term_id,
    status: "Approved",
    proof_file: "https://example.com/proof.pdf",
    valid_from: "2026-01-01",
    valid_until: "2026-12-31",
    reviewed_by: libUser.user_id,
    reviewed_at: new Date(),
  });
  const studentToken = generateToken(studentUser);

  // 4. Create Category and Author
  const category = await Category.create({
    category_name: `Category Shelf ${stamp}`,
    description: "Shelf testing category",
  });
  const author = await Author.create({
    first_name: "Author",
    last_name: `Shelf_${stamp}`,
  });

  // 5. Create Book and Copies
  const book = await Book.create({
    title: `Shelf Book Title ${stamp}`,
    isbn: `978-SH-${stamp.toString().slice(-7)}`,
    category_id: category.category_id,
    author_id: author.author_id,
    status: "Active",
  });

  const copyA = await BookCopy.create({
    book_id: book.book_id,
    accession_no: `ACC-SH-A-${stamp}`,
    condition_status: "Good",
    status: "Available",
    shelf_location: "Shelf-099",
  });

  const copyB = await BookCopy.create({
    book_id: book.book_id,
    accession_no: `ACC-SH-B-${stamp}`,
    condition_status: "Good",
    status: "Available",
    shelf_location: "Shelf-100",
  });

  let createdRequestId = null;
  let createdBorrowId = null;

  await t.test("1. Student creates borrow request and staff approves assigning copyA", async () => {
    // Student requests book
    const reqRes = await mockRequest(app, {
      method: "POST",
      url: "/api/borrow-requests",
      headers: { authorization: `Bearer ${studentToken}` },
      body: {
        bookId: book.book_id,
        requestedDurationDays: 7,
      },
    });
    assert.equal(reqRes.status, 201, `Expected 201, got ${reqRes.status}: ${reqRes.text}`);
    const reqData = reqRes.json.request || reqRes.json.data || reqRes.json;
    createdRequestId = reqData.id || reqData.requestId;
    createdBorrowId = reqData.borrowId || reqData.loanId;

    if (!createdBorrowId) {
      // Staff approves request assigning copyA
      const approveRes = await mockRequest(app, {
        method: "POST",
        url: `/api/borrow-requests/${createdRequestId}/approve`,
        headers: { authorization: `Bearer ${libToken}` },
        body: {
          copyId: copyA.copy_id,
        },
      });
      assert.equal(approveRes.status, 200, `Expected 200, got ${approveRes.status}: ${approveRes.text}`);
      createdBorrowId = approveRes.json.borrowedBook?.borrowId || approveRes.json.borrowId;
    }
    assert.ok(createdBorrowId, "Should return borrowId");
  });

  await t.test("2. GET /api/borrow-requests/:id/pickup-check includes copy details and shelf location", async () => {
    const checkRes = await mockRequest(app, {
      method: "GET",
      url: `/api/borrow-requests/${createdRequestId}/pickup-check`,
      headers: { authorization: `Bearer ${libToken}` },
    });

    assert.equal(checkRes.status, 200, `Expected 200, got ${checkRes.status}`);
    assert.equal(checkRes.json.can_release, true);
    assert.equal(checkRes.json.shelfLocation, "Shelf-099");
    assert.equal(checkRes.json.accessionNo, copyA.accession_no);
    assert.ok(checkRes.json.copy, "Should include copy object");
    assert.equal(checkRes.json.copy.shelfLocation, "Shelf-099");
  });

  await t.test("3. Book release handover response returns copyId, accessionNo, and shelfLocation", async () => {
    const handoverRes = await mockRequest(app, {
      method: "POST",
      url: `/api/borrow-requests/${createdRequestId}/confirm-handover`,
      headers: { authorization: `Bearer ${libToken}` },
      body: {},
    });

    assert.equal(handoverRes.status, 200, `Expected 200, got ${handoverRes.status}: ${handoverRes.text}`);
    assert.equal(handoverRes.json.status, "Borrowed");
    assert.equal(handoverRes.json.copyId, copyA.copy_id);
    assert.equal(handoverRes.json.accessionNo, copyA.accession_no);
    assert.equal(handoverRes.json.shelfLocation, "Shelf-099");
    assert.ok(handoverRes.json.copy, "Response should have copy object");
    assert.equal(handoverRes.json.copy.shelfLocation, "Shelf-099");
  });

  await t.test("4. Return endpoint accepts shelfLocation and updates the book copy's shelf", async () => {
    const newShelf = "Shelf-NEW-202";
    const returnRes = await mockRequest(app, {
      method: "POST",
      url: `/api/borrowed-books/${createdBorrowId}/return`,
      headers: { authorization: `Bearer ${libToken}` },
      body: {
        condition: "GOOD",
        shelfLocation: newShelf,
        notes: "Returned on newly arranged shelf",
      },
    });

    assert.equal(returnRes.status, 200, `Expected 200, got ${returnRes.status}: ${returnRes.text}`);
    assert.equal(returnRes.json.copyStatus, "AVAILABLE");
    assert.equal(returnRes.json.shelfLocation, newShelf);
    assert.equal(returnRes.json.loan.copy.shelfLocation, newShelf);

    // Verify copy record in DB
    const refreshedCopy = await BookCopy.findByPk(copyA.copy_id);
    assert.equal(refreshedCopy.shelf_location, newShelf);
    assert.equal(refreshedCopy.status, "Available");
  });

  await t.test("5. GET /api/shelf-locator searches copies by keyword and shelf location", async () => {
    // Search by accession number
    const resAcc = await mockRequest(app, {
      method: "GET",
      url: `/api/shelf-locator?search=${copyA.accession_no}`,
      headers: { authorization: `Bearer ${libToken}` },
    });
    assert.equal(resAcc.status, 200);
    assert.ok(resAcc.json.copies.length >= 1);
    assert.equal(Number(resAcc.json.copies[0].copyId), Number(copyA.copy_id));
    assert.equal(resAcc.json.copies[0].shelfLocation, "Shelf-NEW-202");
    assert.equal(resAcc.json.copies[0].book.title, book.title);

    // Search by shelf location
    const resShelf = await mockRequest(app, {
      method: "GET",
      url: `/api/shelf-locator?shelfLocation=Shelf-100`,
      headers: { authorization: `Bearer ${libToken}` },
    });
    assert.equal(resShelf.status, 200);
    const foundCopyB = resShelf.json.copies.find((c) => Number(c.copyId) === Number(copyB.copy_id));
    assert.ok(foundCopyB, "Should find copyB on Shelf-100");
  });

  await t.test("6. GET /api/shelf-locator/books searches books with grouped copies", async () => {
    const resBooks = await mockRequest(app, {
      method: "GET",
      url: `/api/shelf-locator/books?search=${encodeURIComponent(book.title)}`,
      headers: { authorization: `Bearer ${studentToken}` },
    });
    assert.equal(resBooks.status, 200);
    assert.ok(resBooks.json.books.length >= 1);
    const targetBook = resBooks.json.books.find((b) => Number(b.bookId) === Number(book.book_id));
    assert.ok(targetBook, "Should return the searched book");
    assert.equal(targetBook.copiesCount, 2);
    assert.ok(targetBook.shelfLocations.includes("Shelf-NEW-202"));
    assert.ok(targetBook.shelfLocations.includes("Shelf-100"));
  });

  await t.test("7. GET /api/shelf-locator/shelves returns distinct shelves stats", async () => {
    const shelvesRes = await mockRequest(app, {
      method: "GET",
      url: "/api/shelf-locator/shelves",
      headers: { authorization: `Bearer ${studentToken}` },
    });
    assert.equal(shelvesRes.status, 200);
    assert.ok(Array.isArray(shelvesRes.json.shelves));
    const shelf202 = shelvesRes.json.shelves.find((s) => s.shelfLocation === "Shelf-NEW-202");
    assert.ok(shelf202, "Shelf-NEW-202 should be in distinct shelves list");
    assert.ok(shelf202.totalCopies >= 1);
  });

  await t.test("8. GET /api/books/:id/copies returns copies of the book with shelf locations", async () => {
    const bookCopiesRes = await mockRequest(app, {
      method: "GET",
      url: `/api/books/${book.book_id}/copies`,
      headers: { authorization: `Bearer ${studentToken}` },
    });
    assert.equal(bookCopiesRes.status, 200);
    assert.equal(bookCopiesRes.json.totalCopies, 2);
    assert.equal(bookCopiesRes.json.book.title, book.title);
  });

  await t.test("9. PATCH /api/shelf-locator/copies/:copyId updates shelf location (Staff only)", async () => {
    // Non-staff gets 403
    const forbiddenRes = await mockRequest(app, {
      method: "PATCH",
      url: `/api/shelf-locator/copies/${copyB.copy_id}`,
      headers: { authorization: `Bearer ${studentToken}` },
      body: { shelfLocation: "Shelf-FORBIDDEN" },
    });
    assert.equal(forbiddenRes.status, 403);

    // Staff succeeds
    const updateRes = await mockRequest(app, {
      method: "PATCH",
      url: `/api/shelf-locator/copies/${copyB.copy_id}`,
      headers: { authorization: `Bearer ${libToken}` },
      body: { shelfLocation: "Shelf-UPDATED-303" },
    });
    assert.equal(updateRes.status, 200, `Expected 200, got: ${updateRes.text}`);
    assert.equal(updateRes.json.copy.shelfLocation, "Shelf-UPDATED-303");

    // Verify DB
    const refreshed = await BookCopy.findByPk(copyB.copy_id);
    assert.equal(refreshed.shelf_location, "Shelf-UPDATED-303");
  });

  await t.test("10. PATCH /api/shelf-locator/bulk updates multiple copies", async () => {
    const bulkRes = await mockRequest(app, {
      method: "PATCH",
      url: "/api/shelf-locator/bulk",
      headers: { authorization: `Bearer ${libToken}` },
      body: {
        copyIds: [copyA.copy_id, copyB.copy_id],
        shelfLocation: "Shelf-SECTION-9",
      },
    });
    assert.equal(bulkRes.status, 200, `Expected 200, got: ${bulkRes.text}`);
    assert.equal(bulkRes.json.updatedCount, 2);

    const refreshedA = await BookCopy.findByPk(copyA.copy_id);
    const refreshedB = await BookCopy.findByPk(copyB.copy_id);
    assert.equal(refreshedA.shelf_location, "Shelf-SECTION-9");
    assert.equal(refreshedB.shelf_location, "Shelf-SECTION-9");
  });
});
