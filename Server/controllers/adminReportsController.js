import {
  getBorrowingReport,
  getFinesReport,
  getOverdueReport,
} from "../services/adminReportsService.js";

function reportHandler(load) {
  return async function handleReport(req, res, next) {
    try {
      const data = await load({ from: req.query.from, to: req.query.to });
      return res.status(200).json({ data });
    } catch (error) {
      return next(error);
    }
  };
}

export const getBorrowingReportHandler = reportHandler(getBorrowingReport);
export const getOverdueReportHandler = reportHandler(getOverdueReport);
export const getFinesReportHandler = reportHandler(getFinesReport);