import {
  BorrowFlowError,
  cancelBorrowRequest,
  createBorrowRequest,
  getAvailableCopiesForRequest,
  listBorrowRequestsQueue,
  listMyBorrowRequests,
  pickupBook,
  rejectPickupBook,
  reviewBorrowRequest,
} from "../services/borrowFlowService.js";

export async function cancelRequest(req, res) {
  try {
    const result = await cancelBorrowRequest({
      requestId: req.resourceId,
      userId: req.user.id,
    });
    return res.status(200).json({
      message: "Borrow request cancelled successfully.",
      data: result,
      request: result,
    });
  } catch (error) {
    if (error instanceof BorrowFlowError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        error: error.message,
      });
    }
    console.error("Cancel borrow request error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}

export async function createRequest(req, res) {
  try {
    const request = await createBorrowRequest({
      userId: req.user.id,
      bookId: req.validatedInput.book_id,
      requestedDays: req.validatedInput.requested_days,
    });
    return res.status(201).json({
      message: "Borrow request created successfully.",
      request,
    });
  } catch (error) {
    if (error instanceof BorrowFlowError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        error: error.message,
        ...(error.reasons?.length ? { reasons: error.reasons } : {}),
      });
    }
    console.error("Create borrow request error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}

export async function listMyRequests(req, res) {
  try {
    const result = await listMyBorrowRequests(req.user.id, req.pagination);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof BorrowFlowError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        error: error.message,
      });
    }
    console.error("List my requests error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}

export async function listRequestsQueue(req, res) {
  try {
    const result = await listBorrowRequestsQueue(req.pagination);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof BorrowFlowError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        error: error.message,
      });
    }
    console.error("List requests queue error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}

export async function getAvailableCopies(req, res) {
  try {
    const copies = await getAvailableCopiesForRequest(req.resourceId);
    return res.status(200).json({ copies });
  } catch (error) {
    if (error instanceof BorrowFlowError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        error: error.message,
      });
    }
    console.error("Get available copies error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}

export async function reviewRequest(req, res) {
  try {
    const result = await reviewBorrowRequest({
      requestId: req.resourceId,
      reviewerId: req.user.id,
      decision: req.reviewInput.decision,
      remarks: req.reviewInput.remarks,
      copyId: req.reviewInput.copy_id,
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
    console.error("Review borrow request error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}

export async function approveRequest(req, res) {
  try {
    const input = req.approveInput || {};
    const result = await reviewBorrowRequest({
      requestId: req.resourceId,
      reviewerId: req.user.id,
      decision: "approve",
      remarks: input.remarks || "",
      copyId: input.copy_id || input.copyId,
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
    console.error("Approve borrow request error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}

export async function rejectRequest(req, res) {
  try {
    const input = req.rejectInput || {};
    const result = await reviewBorrowRequest({
      requestId: req.resourceId,
      reviewerId: req.user.id,
      decision: "reject",
      remarks: input.remarks || "",
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
    console.error("Reject borrow request error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}

export async function confirmHandover(req, res) {
  try {
    const input = req.handoverInput || {};
    const result = await pickupBook({
      requestId: req.resourceId,
      issuerId: req.user.id,
      copyBarcode: input.copyBarcode,
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
    console.error("Confirm pickup handover error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}

export async function rejectHandover(req, res) {
  try {
    const input = req.rejectPickupInput || {};
    const result = await rejectPickupBook({
      requestId: req.resourceId,
      staffId: req.user.id,
      remarks: input.remarks,
      reasonCode: input.reasonCode,
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
    console.error("Reject pickup handover error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}

