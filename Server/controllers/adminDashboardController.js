// Server/controllers/adminDashboardController.js
import { getAdminDashboardData } from "../services/adminDashboardService.js";

export async function getAdminDashboard(req, res, next) {
  try {
    const data = await getAdminDashboardData(req.user.id);
    return res.status(200).json({ data });
  } catch (error) {
    return next(error);
  }
}
