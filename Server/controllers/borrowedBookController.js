// Server/controllers/borrowedBookController.js
import {
  BorrowFlowError,
  getPickupCheck,
  listBorrowedBooksStaff,
  listMyBorrowedBooks,
  pickupBook,
  rejectPickupBook,
} from "../services/borrowFlowService.js";
import {
  getStaffLoanDetails,
  returnBorrowedBook,
  markBorrowedBookLost,
} from "../services/returnService.js";

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

export async function rejectPickupLoan(req, res) {
  try {
    const input = req.rejectPickupInput || {};
    const remarks = input.remarks || req.body?.remarks || req.body?.reason || req.body?.notes;
    const reasonCode = input.reasonCode || req.body?.reason_code || req.body?.reasonCode;
    const result = await rejectPickupBook({
      borrowId: req.resourceId,
      staffId: req.user.id,
      remarks,
      reasonCode,
    });
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof BorrowFlowError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        error: error.message,
      });
    }
    console.error("Reject pickup loan error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}

export async function getStaffLoanDetailsHandler(req, res) {
  try {
    const loan = await getStaffLoanDetails(req.resourceId);
    return res.status(200).json({ loan });
  } catch (error) {
    if (error instanceof BorrowFlowError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        error: error.message,
      });
    }
    console.error("Get staff loan details error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}

export async function returnLoanHandler(req, res) {
  try {
    const result = await returnBorrowedBook({
      borrowId: req.resourceId,
      staffId: req.user.id,
      condition: req.returnCondition || "GOOD",
      notes: req.returnNotes,
      fineType: req.returnFineType,
      fineAmount: req.returnFineAmount,
      shelfLocation: req.returnShelfLocation,
    });
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof BorrowFlowError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        error: error.message,
      });
    }
    console.error("Return loan error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}

export async function markLoanLostHandler(req, res) {
  try {
    const result = await markBorrowedBookLost({
      borrowId: req.resourceId,
      staffId: req.user.id,
      actorId: req.user.id,
      actorRole: req.user.role,
      notes: req.lostNotes,
    });
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof BorrowFlowError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        error: error.message,
      });
    }
    console.error("Mark loan lost error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}

