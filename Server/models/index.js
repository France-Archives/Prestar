// Server/models/index.js
import { Sequelize } from "sequelize";
import config from "../config/config.js";
import defineUser from "./User.js";
import defineStudent from "./Student.js";
import defineLibrarian from "./Librarian.js";
import defineAdmin from "./Admin.js";
import defineEmailOtp from "./EmailOtp.js";
import defineAuthor from "./Author.js";
import defineCategory from "./Category.js";
import defineBook from "./Book.js";
import defineBookCopy from "./BookCopy.js";
import defineBorrowRequest from "./BorrowRequest.js";
import defineBorrowedBook from "./BorrowedBook.js";
import definePenalty from "./Penalty.js";
import definePayment from "./Payment.js";
import defineRenewal from "./Renewal.js";
import defineReturnedBook from "./ReturnedBook.js";
import defineReservation from "./Reservation.js";
import defineSuspension from "./Suspension.js";
import defineAcademicTerm from "./AcademicTerm.js";
import defineStudentVerification from "./StudentVerification.js";
import defineAuditLog from "./AuditLog.js";
import defineUserCategoryPreference from "./UserCategoryPreference.js";
import defineNotification from "./Notification.js";

export const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  config,
);

// Instantiate models
export const User = defineUser(sequelize);
export const Student = defineStudent(sequelize);
export const Librarian = defineLibrarian(sequelize);
export const Admin = defineAdmin(sequelize);
export const EmailOtp = defineEmailOtp(sequelize);
export const Author = defineAuthor(sequelize);
export const Category = defineCategory(sequelize);
export const Book = defineBook(sequelize);
export const BookCopy = defineBookCopy(sequelize);
export const BorrowRequest = defineBorrowRequest(sequelize);
export const BorrowedBook = defineBorrowedBook(sequelize);
export const Penalty = definePenalty(sequelize);
export const Payment = definePayment(sequelize);
export const Renewal = defineRenewal(sequelize);
export const ReturnedBook = defineReturnedBook(sequelize);
export const Reservation = defineReservation(sequelize);
export const Suspension = defineSuspension(sequelize);
export const AcademicTerm = defineAcademicTerm(sequelize);
export const StudentVerification = defineStudentVerification(sequelize);
export const AuditLog = defineAuditLog(sequelize);
export const UserCategoryPreference = defineUserCategoryPreference(sequelize);
export const Notification = defineNotification(sequelize);

// User 1-to-1 extensions
User.hasOne(Student, { foreignKey: "user_id", as: "student" });
Student.belongsTo(User, { foreignKey: "user_id", as: "user" });

User.hasOne(Librarian, { foreignKey: "user_id", as: "librarian" });
Librarian.belongsTo(User, { foreignKey: "user_id", as: "user" });

User.hasOne(Admin, { foreignKey: "user_id", as: "admin" });
Admin.belongsTo(User, { foreignKey: "user_id", as: "user" });

// Student Verifications
User.hasMany(StudentVerification, { foreignKey: "user_id", as: "verifications" });
StudentVerification.belongsTo(User, { foreignKey: "user_id", as: "user" });
Student.hasMany(StudentVerification, { foreignKey: "user_id", as: "verifications" });
StudentVerification.belongsTo(Student, { foreignKey: "user_id", as: "student" });
AcademicTerm.hasMany(StudentVerification, { foreignKey: "term_id", as: "verifications" });
StudentVerification.belongsTo(AcademicTerm, { foreignKey: "term_id", as: "term" });
StudentVerification.belongsTo(User, { foreignKey: "reviewed_by", as: "reviewer" });

// Book Catalog
Book.belongsTo(Author, { foreignKey: "author_id", as: "author" });
Author.hasMany(Book, { foreignKey: "author_id", as: "books" });

Book.belongsTo(Category, { foreignKey: "category_id", as: "category" });
Category.hasMany(Book, { foreignKey: "category_id", as: "books" });

Book.hasMany(BookCopy, { foreignKey: "book_id", as: "copies" });
BookCopy.belongsTo(Book, { foreignKey: "book_id", as: "book" });

// Borrow Requests
Student.hasMany(BorrowRequest, { foreignKey: "user_id", as: "borrowRequests" });
BorrowRequest.belongsTo(Student, { foreignKey: "user_id", as: "student" });
BorrowRequest.belongsTo(Book, { foreignKey: "book_id", as: "book" });
BorrowRequest.belongsTo(User, { foreignKey: "reviewed_by", as: "reviewer" });
BorrowRequest.hasOne(BorrowedBook, { foreignKey: "request_id", as: "borrowedBook" });

// Borrowed Books
BorrowedBook.belongsTo(BorrowRequest, { foreignKey: "request_id", as: "request" });
BorrowedBook.belongsTo(Book, { foreignKey: "book_id", as: "book" });
BorrowedBook.belongsTo(BookCopy, { foreignKey: "copy_id", as: "copy" });
BorrowedBook.belongsTo(User, { foreignKey: "issued_by", as: "issuer" });
BorrowedBook.belongsTo(User, { foreignKey: "assigned_by", as: "assigner" });

// Renewals
Renewal.belongsTo(BorrowedBook, { foreignKey: "borrow_id", as: "borrow" });
BorrowedBook.hasMany(Renewal, { foreignKey: "borrow_id", as: "renewals" });

// Returned Books
ReturnedBook.belongsTo(BorrowedBook, { foreignKey: "borrow_id", as: "borrow" });
BorrowedBook.hasOne(ReturnedBook, { foreignKey: "borrow_id", as: "returnRecord" });
ReturnedBook.belongsTo(User, { foreignKey: "received_by", as: "receiver" });

// Reservations
Reservation.belongsTo(User, { foreignKey: "user_id", as: "student" });
Reservation.belongsTo(Book, { foreignKey: "book_id", as: "book" });

// Penalties & Payments
Penalty.belongsTo(BorrowedBook, { foreignKey: "borrow_id", as: "borrow" });
BorrowedBook.hasMany(Penalty, { foreignKey: "borrow_id", as: "penalties" });
Penalty.hasMany(Payment, { foreignKey: "penalty_id", as: "payments" });
Payment.belongsTo(Penalty, { foreignKey: "penalty_id", as: "penalty" });

// Suspensions
Suspension.belongsTo(User, { foreignKey: "user_id", as: "student" });

// User Category Preferences
UserCategoryPreference.belongsTo(User, { foreignKey: "user_id", as: "user" });
UserCategoryPreference.belongsTo(Category, { foreignKey: "category_id", as: "category" });

// Notifications
User.hasMany(Notification, { foreignKey: "user_id", as: "notifications" });
Notification.belongsTo(User, { foreignKey: "user_id", as: "user" });

export default sequelize;