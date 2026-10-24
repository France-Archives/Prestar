import { getStudentDashboardData } from "../services/studentDashboardService.js";

export async function getStudentDashboard(req, res, next) {
  try {
    const data = await getStudentDashboardData(req.user.id);
    return res.status(200).json({ data, ...data });
  } catch (error) {
    return next(error);
  }
}
