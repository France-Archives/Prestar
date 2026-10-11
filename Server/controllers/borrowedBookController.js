// Server/controllers/borrowedBookController.js
import {
  BorrowFlowError,
  getPickupCheck,
  listBorrowedBooksStaff,
  listMyBorrowedBooks,
  pickupBook,
} from "../services/borrowFlowService.js";

export async function listMyLoans(req, res) {
  try {
    const loans = await listMyBorrowedBooks(req.user.id, req.loanQuery);
    return res.status(200).json({ loans });
  } catch (error) {
    if (error instanceof BorrowFlowError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        error: error.message,
      });
    }
    console.error("List my borrowed books error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}

export async function listStaffLoans(req, res) {
  try {
    const result = await listBorrowedBooksStaff(req.staffLoanQuery);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof BorrowFlowError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        error: error.message,
      });
    }
    console.error("List staff loans error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}

export async function getPickupCheckDetails(req, res) {
  try {
    const result = await getPickupCheck(req.resourceId);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof BorrowFlowError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        error: error.message,
      });
    }
    console.error("Get pickup check error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}

export async function pickupLoan(req, res) {
  try {
    const result = await pickupBook({
      borrowId: req.resourceId,
      issuerId: req.user.id,
    });
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof BorrowFlowError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        error: error.message,
        ...(error.reasons?.length ? { reasons: error.reasons } : {}),
      });
    }
    console.error("Pickup book error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}
