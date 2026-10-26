// Server/scripts/cleanTestData.js
import { Op } from "sequelize";
import {
  AcademicTerm,
  Admin,
  AuditLog,
  Author,
  Book,
  BookCopy,
  BorrowRequest,
  BorrowedBook,
  Category,
  EmailOtp,
  Librarian,
  Notification,
  Payment,
  Penalty,
  Renewal,
  Reservation,
  ReturnedBook,
  Student,
  StudentVerification,
  Suspension,
  User,
  UserCategoryPreference,
  sequelize,
} from "../models/index.js";

const isDryRun = process.argv.includes("--dry-run");

async function runCleanup() {
  console.log(`\n🧹 Starting Database Test Data Cleanup (${isDryRun ? "DRY RUN - No changes will be saved" : "LIVE RUN"})...\n`);

  try {
    // 1. Find Test Users (emails or names generated with timestamps or test prefixes)
    const testUsers = await User.findAll({
      where: {
        [Op.or]: [
          sequelize.where(sequelize.col("email"), { [Op.regexp]: "[0-9]{10,}" }),
          { email: { [Op.like]: "%@example.com%" } },
          { email: { [Op.like]: "test_%" } },
          sequelize.where(sequelize.col("last_name"), { [Op.regexp]: "[0-9]{10,}" }),
        ],
      },
      attributes: ["user_id", "email", "role"],
    });

    const testUserIds = testUsers.map((u) => u.user_id);
    console.log(`📌 Found ${testUserIds.length} test user(s).`);

    // 2. Find Test Books
    const testBooks = await Book.findAll({
      where: {
        [Op.or]: [
          sequelize.where(sequelize.col("title"), { [Op.regexp]: "[0-9]{10,}" }),
          { title: { [Op.like]: "Test Book%" } },
          { title: { [Op.like]: "%Shelf Book Title%" } },
          sequelize.where(sequelize.col("isbn"), { [Op.regexp]: "^(978-)?(TEST|SH|AUD|FINE|TERMS)-" }),
        ],
      },
      attributes: ["book_id", "title", "isbn"],
    });

    const testBookIds = testBooks.map((b) => b.book_id);
    console.log(`📌 Found ${testBookIds.length} test book(s).`);

    // 3. Find Test Academic Terms
    const testTerms = await AcademicTerm.findAll({
      where: {
        [Op.or]: [
          sequelize.where(sequelize.col("term_name"), { [Op.regexp]: "[0-9]{10,}" }),
          { term_name: { [Op.like]: "Test Term%" } },
          { term_name: { [Op.like]: "Term Test%" } },
        ],
      },
      attributes: ["term_id", "term_name"],
    });

    const testTermIds = testTerms.map((t) => t.term_id);
    console.log(`📌 Found ${testTermIds.length} test academic term(s).`);

    // 4. Find Test Authors
    const testAuthors = await Author.findAll({
      where: {
        [Op.or]: [
          sequelize.where(sequelize.col("last_name"), { [Op.regexp]: "[0-9]{10,}" }),
          { last_name: { [Op.like]: "Test%" } },
        ],
      },
      attributes: ["author_id", "first_name", "last_name"],
    });
    const testAuthorIds = testAuthors.map((a) => a.author_id);
    console.log(`📌 Found ${testAuthorIds.length} test author(s).`);

    // 5. Find Test Categories
    const testCategories = await Category.findAll({
      where: {
        [Op.or]: [
          sequelize.where(sequelize.col("category_name"), { [Op.regexp]: "[0-9]{10,}" }),
          { category_name: { [Op.like]: "%Test%" } },
        ],
      },
      attributes: ["category_id", "category_name"],
    });
    const testCategoryIds = testCategories.map((c) => c.category_id);
    console.log(`📌 Found ${testCategoryIds.length} test category/categories.`);

    if (isDryRun) {
      console.log("\n⚠️  Dry run finished. Run without --dry-run to delete these records.\n");
      await sequelize.close();
      return;
    }

    // Execute deletion in a transaction
    await sequelize.transaction(async (transaction) => {
      // A. Delete dependent circulation records
      if (testUserIds.length > 0 || testBookIds.length > 0) {
        // Find loans for test users or test books
        const loans = await BorrowedBook.findAll({
          where: {
            [Op.or]: [
              testBookIds.length > 0 ? { book_id: { [Op.in]: testBookIds } } : null,
              testUserIds.length > 0 ? { issued_by: { [Op.in]: testUserIds } } : null,
            ].filter(Boolean),
          },
          attributes: ["borrow_id"],
          transaction,
        });
        const loanIds = loans.map((l) => l.borrow_id);

        if (loanIds.length > 0) {
          // Delete penalties & payments
          const penalties = await Penalty.findAll({
            where: { borrow_id: { [Op.in]: loanIds } },
            attributes: ["penalty_id"],
            transaction,
          });
          const penaltyIds = penalties.map((p) => p.penalty_id);
          if (penaltyIds.length > 0) {
            await Payment.destroy({ where: { penalty_id: { [Op.in]: penaltyIds } }, transaction });
            await Penalty.destroy({ where: { penalty_id: { [Op.in]: penaltyIds } }, transaction });
          }

          await ReturnedBook.destroy({ where: { borrow_id: { [Op.in]: loanIds } }, transaction });
          await Renewal.destroy({ where: { borrow_id: { [Op.in]: loanIds } }, transaction });
          await BorrowedBook.destroy({ where: { borrow_id: { [Op.in]: loanIds } }, transaction });
        }

        // Delete any remaining penalties or payments associated directly with test users
        if (testUserIds.length > 0) {
          await Payment.destroy({ where: { received_by: { [Op.in]: testUserIds } }, transaction });
          await Penalty.destroy({
            where: {
              [Op.or]: [
                { created_by: { [Op.in]: testUserIds } },
                { waived_by: { [Op.in]: testUserIds } },
              ],
            },
            transaction,
          });
        }

        // Delete borrow requests & reservations
        await BorrowRequest.destroy({
          where: {
            [Op.or]: [
              testUserIds.length > 0 ? { user_id: { [Op.in]: testUserIds } } : null,
              testBookIds.length > 0 ? { book_id: { [Op.in]: testBookIds } } : null,
            ].filter(Boolean),
          },
          transaction,
        });

        await Reservation.destroy({
          where: {
            [Op.or]: [
              testUserIds.length > 0 ? { user_id: { [Op.in]: testUserIds } } : null,
              testBookIds.length > 0 ? { book_id: { [Op.in]: testBookIds } } : null,
            ].filter(Boolean),
          },
          transaction,
        });
      }

      // B. Delete student verifications
      if (testUserIds.length > 0 || testTermIds.length > 0) {
        await StudentVerification.destroy({
          where: {
            [Op.or]: [
              testUserIds.length > 0 ? { user_id: { [Op.in]: testUserIds } } : null,
              testUserIds.length > 0 ? { reviewed_by: { [Op.in]: testUserIds } } : null,
              testTermIds.length > 0 ? { term_id: { [Op.in]: testTermIds } } : null,
            ].filter(Boolean),
          },
          transaction,
        });
      }

      // C. Delete user profile relations & logs
      if (testUserIds.length > 0) {
        await AuditLog.destroy({ where: { actor_user_id: { [Op.in]: testUserIds } }, transaction });
        await Notification.destroy({ where: { user_id: { [Op.in]: testUserIds } }, transaction });
        await Suspension.destroy({ where: { user_id: { [Op.in]: testUserIds } }, transaction });
        await UserCategoryPreference.destroy({ where: { user_id: { [Op.in]: testUserIds } }, transaction });
        await Student.destroy({ where: { user_id: { [Op.in]: testUserIds } }, transaction });
        await Librarian.destroy({ where: { user_id: { [Op.in]: testUserIds } }, transaction });
        await Admin.destroy({ where: { user_id: { [Op.in]: testUserIds } }, transaction });
        await User.destroy({ where: { user_id: { [Op.in]: testUserIds } }, transaction });
      }

      // D. Delete test book copies & books
      if (testBookIds.length > 0) {
        await BookCopy.destroy({ where: { book_id: { [Op.in]: testBookIds } }, transaction });
        await Book.destroy({ where: { book_id: { [Op.in]: testBookIds } }, transaction });
      }

      // E. Delete test academic terms
      if (testTermIds.length > 0) {
        await AcademicTerm.destroy({ where: { term_id: { [Op.in]: testTermIds } }, transaction });
      }

      // F. Delete test authors & categories
      if (testAuthorIds.length > 0) {
        await Author.destroy({ where: { author_id: { [Op.in]: testAuthorIds } }, transaction });
      }
      if (testCategoryIds.length > 0) {
        await Category.destroy({ where: { category_id: { [Op.in]: testCategoryIds } }, transaction });
      }

      // G. Delete test OTPs
      await EmailOtp.destroy({
        where: {
          [Op.or]: [
            sequelize.where(sequelize.col("email"), { [Op.regexp]: "[0-9]{10,}" }),
            { email: { [Op.like]: "%@example.com%" } },
            { email: { [Op.like]: "test_%" } },
          ],
        },
        transaction,
      });
    });

    console.log("\n✅ Test data successfully cleaned from the database!\n");
  } catch (error) {
    console.error("\n❌ Error during cleanup:", error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

runCleanup();
