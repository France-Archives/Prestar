// Server/controllers/shelfLocatorController.js
import {
  bulkUpdateShelfLocation,
  getBookCopies,
  getBooksWithShelfCopies,
  listDistinctShelves,
  searchShelfCopies,
  updateCopyShelfLocation,
} from "../services/shelfLocatorService.js";
import { BorrowFlowError } from "../services/borrowFlowService.js";

export async function searchCopiesHandler(req, res, next) {
  try {
    const result = await searchShelfCopies(req.shelfQuery);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof BorrowFlowError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        error: error.message,
      });
    }
    return next(error);
  }
}

export async function searchBooksHandler(req, res, next) {
  try {
    const result = await getBooksWithShelfCopies(req.shelfQuery);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof BorrowFlowError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        error: error.message,
      });
    }
    return next(error);
  }
}

export async function listDistinctShelvesHandler(_req, res, next) {
  try {
    const result = await listDistinctShelves();
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof BorrowFlowError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        error: error.message,
      });
    }
    return next(error);
  }
}

export async function getBookCopiesHandler(req, res, next) {
  try {
    const bookId = req.bookId || req.resourceId || req.params.bookId || req.params.id;
    const result = await getBookCopies(bookId);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof BorrowFlowError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        error: error.message,
      });
    }
    return next(error);
  }
}

export async function updateCopyShelfHandler(req, res, next) {
  try {
    const result = await updateCopyShelfLocation(
      req.copyId,
      req.shelfLocationValue,
      req.user.id,
    );
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof BorrowFlowError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        error: error.message,
      });
    }
    return next(error);
  }
}

export async function bulkUpdateShelfHandler(req, res, next) {
  try {
    const result = await bulkUpdateShelfLocation(
      req.bulkShelfPayload,
      req.user.id,
    );
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof BorrowFlowError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        error: error.message,
      });
    }
    return next(error);
  }
}

export async function updateBookShelfHandler(req, res, next) {
  try {
    const bookId = req.bookId || req.resourceId || req.params.bookId || req.params.id;
    const result = await bulkUpdateShelfLocation(
      {
        bookId,
        shelfLocation: req.shelfLocationValue,
      },
      req.user.id,
    );
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof BorrowFlowError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        error: error.message,
      });
    }
    return next(error);
  }
}
