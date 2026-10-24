// Server/controllers/penaltyController.js
import {
  listStaffFines,
  recordCashPayment,
  listStaffPayments,
  waivePenalty,
  getStudentFines,
} from "../services/penaltyPaymentService.js";
import { BorrowFlowError } from "../services/borrowFlowService.js";

function handleServiceError(error, res, next) {
  if (error instanceof BorrowFlowError) {
    return res.status(error.status).json({
      code: error.code,
      message: error.message,
      error: error.message,
    });
  }
  if (error?.name === "SequelizeUniqueConstraintError") {
    return res.status(409).json({
      code: "CONFLICT",
      message: "A payment with this receipt number already exists.",
      error: "A payment with this receipt number already exists.",
    });
  }
  return next(error);
}

export async function getFinesHandler(req, res, next) {
  try {
    const result = await listStaffFines(req.query);
    return res.status(200).json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

export async function recordPaymentHandler(req, res, next) {
  try {
    const penaltyId = req.params.id || req.params.penaltyId;
    const result = await recordCashPayment(penaltyId, req.body, req.user?.id);
    return res.status(201).json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

export async function waiveFineHandler(req, res, next) {
  try {
    const penaltyId = req.params.id || req.params.penaltyId;
    const result = await waivePenalty(penaltyId, req.body, req.user?.id);
    return res.status(200).json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

export async function getPaymentsHandler(req, res, next) {
  try {
    const result = await listStaffPayments(req.query);
    return res.status(200).json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

export async function getMyFinesHandler(req, res, next) {
  try {
    const result = await getStudentFines(req.user?.id);
    return res.status(200).json(result);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}
