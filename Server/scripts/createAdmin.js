// Server/scripts/createAdmin.js
// Usage:
//   node scripts/createAdmin.js [email] [password] [firstName] [lastName] [employeeNumber]
//   node scripts/createAdmin.js --role librarian [email] [password] [firstName] [lastName] [employeeNumber]
import "dotenv/config";
import bcrypt from "bcrypt";
import { Admin, Librarian, User, sequelize } from "../models/index.js";

const BCRYPT_SALT_ROUNDS = 10;

/**
 * Creates (or updates) an Admin account.
 */
async function createAdmin() {
  const args = stripRoleFlag(process.argv.slice(2));
  const email = (args[0] || "admin@prestar.edu").trim().toLowerCase();
  const password = args[1] || "admin123";
  const firstName = (args[2] || "System").trim();
  const lastName = (args[3] || "Administrator").trim();
  const requestedEmployeeNumber = args[4]?.trim();

  try {
    console.log("Connecting to database...");
    await sequelize.authenticate();

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    await sequelize.transaction(async (transaction) => {
      let user = await User.unscoped().findOne({
        where: { email },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      // Find a unique employee number if not provided or if duplicate
      let finalEmployeeNumber = requestedEmployeeNumber;
      if (!finalEmployeeNumber) {
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        finalEmployeeNumber = `EMP-ADM-${Date.now().toString().slice(-4)}${randomSuffix}`;
      } else {
        const conflict = await Admin.findOne({
          where: { employee_number: finalEmployeeNumber },
          transaction,
        });
        if (conflict && (!user || conflict.user_id !== user.user_id)) {
          finalEmployeeNumber = `${finalEmployeeNumber}-${Math.floor(100 + Math.random() * 900)}`;
        }
      }

      if (user) {
        console.log(`User with email "${email}" already exists. Updating credentials to Admin...`);
        await user.update(
          {
            password_hash: passwordHash,
            role: "Admin",
            status: "Active",
            email_verified: true,
            first_name: firstName,
            last_name: lastName,
          },
          { transaction },
        );

        const existingAdmin = await Admin.findOne({
          where: { user_id: user.user_id },
          transaction,
        });

        if (!existingAdmin) {
          await Admin.create(
            {
              user_id: user.user_id,
              employee_number: finalEmployeeNumber,
            },
            { transaction },
          );
        } else {
          finalEmployeeNumber = existingAdmin.employee_number;
        }
      } else {
        console.log(`Creating new Admin user "${email}"...`);
        user = await User.create(
          {
            email,
            password_hash: passwordHash,
            role: "Admin",
            status: "Active",
            email_verified: true,
            first_name: firstName,
            last_name: lastName,
          },
          { transaction },
        );

        await Admin.create(
          {
            user_id: user.user_id,
            employee_number: finalEmployeeNumber,
          },
          { transaction },
        );
      }

      console.log("\n==============================================");
      console.log("  ADMIN ACCOUNT READY");
      console.log("==============================================");
      console.log(`  User ID:         ${user.user_id}`);
      console.log(`  Email:           ${email}`);
      console.log(`  Password:        ${password}`);
      console.log(`  Role:            Admin`);
      console.log(`  Status:          Active`);
      console.log(`  Email Verified:  true`);
      console.log(`  Employee Number: ${finalEmployeeNumber}`);
      console.log("==============================================\n");
    });

    process.exit(0);
  } catch (error) {
    console.error("Failed to create admin account:", error);
    process.exit(1);
  }
}

/**
 * Creates (or updates) a Librarian account.
 */
async function createLibrarian() {
  const args = stripRoleFlag(process.argv.slice(2));
  const email = (args[0] || "librarian@prestar.edu").trim().toLowerCase();
  const password = args[1] || "librarian123";
  const firstName = (args[2] || "Library").trim();
  const lastName = (args[3] || "Staff").trim();
  const requestedEmployeeNumber = args[4]?.trim();

  try {
    console.log("Connecting to database...");
    await sequelize.authenticate();

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    await sequelize.transaction(async (transaction) => {
      let user = await User.unscoped().findOne({
        where: { email },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      // Find a unique employee number if not provided or if duplicate
      let finalEmployeeNumber = requestedEmployeeNumber;
      if (!finalEmployeeNumber) {
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        finalEmployeeNumber = `EMP-LIB-${Date.now().toString().slice(-4)}${randomSuffix}`;
      } else {
        const conflict = await Librarian.findOne({
          where: { employee_number: finalEmployeeNumber },
          transaction,
        });
        if (conflict && (!user || conflict.user_id !== user.user_id)) {
          finalEmployeeNumber = `${finalEmployeeNumber}-${Math.floor(100 + Math.random() * 900)}`;
        }
      }

      if (user) {
        console.log(`User with email "${email}" already exists. Updating credentials to Librarian...`);
        await user.update(
          {
            password_hash: passwordHash,
            role: "Librarian",
            status: "Active",
            email_verified: true,
            first_name: firstName,
            last_name: lastName,
          },
          { transaction },
        );

        const existingLibrarian = await Librarian.findOne({
          where: { user_id: user.user_id },
          transaction,
        });

        if (!existingLibrarian) {
          await Librarian.create(
            {
              user_id: user.user_id,
              employee_number: finalEmployeeNumber,
            },
            { transaction },
          );
        } else {
          finalEmployeeNumber = existingLibrarian.employee_number;
        }
      } else {
        console.log(`Creating new Librarian user "${email}"...`);
        user = await User.create(
          {
            email,
            password_hash: passwordHash,
            role: "Librarian",
            status: "Active",
            email_verified: true,
            first_name: firstName,
            last_name: lastName,
          },
          { transaction },
        );

        await Librarian.create(
          {
            user_id: user.user_id,
            employee_number: finalEmployeeNumber,
          },
          { transaction },
        );
      }

      console.log("\n==============================================");
      console.log("  LIBRARIAN ACCOUNT READY");
      console.log("==============================================");
      console.log(`  User ID:         ${user.user_id}`);
      console.log(`  Email:           ${email}`);
      console.log(`  Password:        ${password}`);
      console.log(`  Role:            Librarian`);
      console.log(`  Status:          Active`);
      console.log(`  Email Verified:  true`);
      console.log(`  Employee Number: ${finalEmployeeNumber}`);
      console.log("==============================================\n");
    });

    process.exit(0);
  } catch (error) {
    console.error("Failed to create librarian account:", error);
    process.exit(1);
  }
}

// ── Helpers & Entry Point ──────────────────────────────────────────────

/** Strips --role and its value from the args array so positional args stay clean. */
function stripRoleFlag(args) {
  const idx = args.indexOf("--role");
  if (idx === -1) return args;
  // Remove --role and the value after it
  return [...args.slice(0, idx), ...args.slice(idx + 2)];
}

/** Reads --role <admin|librarian> from process.argv. Defaults to "admin". */
function detectRole() {
  const idx = process.argv.indexOf("--role");
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1].toLowerCase();
  }
  return "admin";
}

const role = detectRole();

if (role === "librarian") {
  createLibrarian();
} else if (role === "admin") {
  createAdmin();
} else {
  console.error(`Unknown role "${role}". Use --role admin or --role librarian.`);
  process.exit(1);
}
