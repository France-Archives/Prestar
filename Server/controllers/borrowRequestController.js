// Server/controllers/borrowRequestController.js
import {
  cancelBorrowRequest,
  confirmBorrowPickup,
  createBorrowRequest,
  listBorrowRequests,
  reviewBorrowRequest,
  BorrowRequestError,
} from "../services/borrowRequestService.js";

export async function createRequest(req, res, next) {
  try {
    const request = await createBorrowRequest(req.user.id, req.validatedBookId);
    return res.status(201).json({ request });
  } catch (error) {
    if (error instanceof BorrowRequestError) return res.status(error.status).json({ error: error.message });
    return next(error);
  }
}

export async function listRequests(req, res, next) {
  try {
    const requests = await listBorrowRequests({ status: req.requestStatus });
    return res.status(200).json({ requests });
  } catch (error) {
    return next(error);
  }
}

export async function listMyRequests(req, res, next) {
  try {
    const requests = await listBorrowRequests({ status: req.requestStatus, userId: req.user.id });
    return res.status(200).json({ requests });
  } catch (error) {
    return next(error);
  }
}

export async function reviewRequest(req, res, next) {
  try {
    const request = await reviewBorrowRequest(
      req.resourceId,
      req.user.id,
      req.reviewInput.decision,
      req.reviewInput.remarks,
    );
    return res.status(200).json({ request });
  } catch (error) {
    if (error instanceof BorrowRequestError) return res.status(error.status).json({ error: error.message });
    return next(error);
  }
}

export async function confirmPickup(req, res, next) {
  try {
    const borrow = await confirmBorrowPickup(req.resourceId, req.user.id);
    return res.status(200).json({ borrow });
  } catch (error) {
    if (error instanceof BorrowRequestError) return res.status(error.status).json({ error: error.message });
    return next(error);
  }
}

export async function cancelRequest(req, res, next) {
  try {
    const request = await cancelBorrowRequest(req.resourceId, req.user.id);
    return res.status(200).json({ request });
  } catch (error) {
    if (error instanceof BorrowRequestError) return res.status(error.status).json({ error: error.message });
    return next(error);
  }
}
