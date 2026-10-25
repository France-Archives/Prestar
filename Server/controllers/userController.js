// Server/controllers/userController.js
import { User } from "../models/index.js";

/**
 * GET /api/users or GET /api/admin/users
 * Returns list of users sorted by role and status.
 * Strictly projects only: name, status, role.
 */
export async function getUsers(req, res, next) {
  try {
    const roleOrder = String(req.query.role_order || req.query.roleOrder || "ASC").toUpperCase() === "DESC" ? "DESC" : "ASC";
    const statusOrder = String(req.query.status_order || req.query.statusOrder || "ASC").toUpperCase() === "DESC" ? "DESC" : "ASC";
    const sortBy = String(req.query.sort_by || req.query.sortBy || "role").toLowerCase();

    let order;
    if (sortBy === "status") {
      order = [
        ["status", statusOrder],
        ["role", roleOrder],
        ["first_name", "ASC"],
        ["last_name", "ASC"],
      ];
    } else {
      order = [
        ["role", roleOrder],
        ["status", statusOrder],
        ["first_name", "ASC"],
        ["last_name", "ASC"],
      ];
    }

    const where = {};
    if (req.query.role) {
      where.role = req.query.role;
    }
    if (req.query.status) {
      where.status = req.query.status;
    }

    const options = {
      where,
      attributes: ["first_name", "last_name", "status", "role"],
      order,
    };

    if (req.query.limit !== undefined) {
      const limit = Math.max(1, parseInt(req.query.limit, 10) || 50);
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      options.limit = limit;
      options.offset = (page - 1) * limit;
    }

    const users = await User.findAll(options);

    const formattedUsers = users.map((user) => {
      const firstName = (user.first_name || "").trim();
      const lastName = (user.last_name || "").trim();
      const name = [firstName, lastName].filter(Boolean).join(" ");
      return {
        name,
        status: user.status,
        role: user.role,
      };
    });

    return res.status(200).json({
      data: formattedUsers,
      users: formattedUsers,
    });
  } catch (error) {
    next(error);
  }
}
