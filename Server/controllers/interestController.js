// Server/controllers/interestController.js
import {
  InterestError,
  getRecommendedBooksForUser,
  getUserInterests,
  listAvailableInterests,
  setUserInterests,
} from "../services/interestService.js";

export async function getInterestsHandler(req, res, next) {
  try {
    const list = await listAvailableInterests();
    return res.status(200).json({
      data: list,
      interests: list,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getMyInterestsHandler(req, res, next) {
  try {
    const userId = req.user?.id ?? req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const list = await getUserInterests(userId);
    return res.status(200).json({
      data: list,
      interests: list,
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateMyInterestsHandler(req, res, next) {
  try {
    const userId = req.user?.id ?? req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const rawIds =
      req.body?.interestIds ??
      req.body?.interest_ids ??
      req.body?.category_ids ??
      req.body?.categoryIds ??
      req.body?.interests;

    const updated = await setUserInterests(userId, rawIds);
    return res.status(200).json({
      message: "Interests updated successfully.",
      data: updated,
      interests: updated,
    });
  } catch (error) {
    if (error instanceof InterestError) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
        error: error.message,
      });
    }
    return next(error);
  }
}

export async function getRecommendedBooksHandler(req, res, next) {
  try {
    const userId = req.user?.id ?? req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const limit = Number(req.query.limit) || 8;
    const books = await getRecommendedBooksForUser(userId, limit);
    return res.status(200).json({
      data: books,
      books,
    });
  } catch (error) {
    return next(error);
  }
}
