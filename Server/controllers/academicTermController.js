// Server/controllers/academicTermController.js
import {
  createAcademicTerm,
  getAcademicTermById,
  listAcademicTerms,
  updateAcademicTerm,
} from "../services/academicTermService.js";

function handleServiceError(error, res, next) {
  if (error && error.status && Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
    return res.status(error.status).json({
      code: error.code || "VALIDATION_ERROR",
      message: error.message,
      error: error.message,
    });
  }
  return next(error);
}

/**
 * GET /api/admin/academic-terms or GET /api/academic-terms
 */
export async function getAcademicTermsHandler(req, res, next) {
  try {
    const terms = await listAcademicTerms();
    return res.status(200).json(terms);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

/**
 * GET /api/admin/academic-terms/:id or GET /api/academic-terms/:id
 */
export async function getAcademicTermDetailsHandler(req, res, next) {
  try {
    const termId = req.params.id || req.params.termId;
    const term = await getAcademicTermById(termId);
    return res.status(200).json(term);
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

/**
 * POST /api/admin/academic-terms or POST /api/academic-terms
 * Admin-only
 */
export async function createAcademicTermHandler(req, res, next) {
  try {
    const actorUserId = req.user?.id;
    const term = await createAcademicTerm(req.body, actorUserId);
    return res.status(201).json({
      message: "Academic term created successfully.",
      term,
      data: term,
      id: term.id,
      name: term.name,
      startDate: term.startDate,
      endDate: term.endDate,
      corDeadline: term.corDeadline,
      status: term.status,
    });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

/**
 * PATCH /api/admin/academic-terms/:id or PUT /api/admin/academic-terms/:id
 * Admin-only
 */
export async function updateAcademicTermHandler(req, res, next) {
  try {
    const termId = req.params.id || req.params.termId;
    const actorUserId = req.user?.id;
    const term = await updateAcademicTerm(termId, req.body, actorUserId);
    return res.status(200).json({
      message: "Academic term updated successfully.",
      term,
      data: term,
      id: term.id,
      name: term.name,
      startDate: term.startDate,
      endDate: term.endDate,
      corDeadline: term.corDeadline,
      status: term.status,
    });
  } catch (error) {
    return handleServiceError(error, res, next);
  }
}

export default {
  getAcademicTermsHandler,
  getAcademicTermDetailsHandler,
  createAcademicTermHandler,
  updateAcademicTermHandler,
};
