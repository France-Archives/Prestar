import { getBooksToReleaseList, getStaffDashboardData } from "../services/staffDashboardService.js";

export async function getStaffDashboard(req, res, next) {
  try {
    const data = await getStaffDashboardData(req.user.id);
    return res.status(200).json({ data });
  } catch (error) {
    return next(error);
  }
}

export async function getBooksToRelease(req, res, next) {
  try {
    const { search } = req.query;
    const data = await getBooksToReleaseList({ search });
    return res.status(200).json({ data });
  } catch (error) {
    return next(error);
  }
}

