// Server/routes/interestRoutes.js
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  getInterestsHandler,
  getMyInterestsHandler,
  getRecommendedBooksHandler,
  updateMyInterestsHandler,
} from "../controllers/interestController.js";

const router = Router();

router.use(authMiddleware);

// GET /api/interests -> list all available interests (categories)
router.get("/", getInterestsHandler);

// GET /api/interests/mine (or /me) -> get current student's interests
router.get("/mine", getMyInterestsHandler);
router.get("/me", getMyInterestsHandler);

// PUT or POST /api/interests/mine (or /me) -> update interests
router.put("/mine", updateMyInterestsHandler);
router.put("/me", updateMyInterestsHandler);
router.post("/mine", updateMyInterestsHandler);
router.post("/me", updateMyInterestsHandler);

// GET /api/interests/recommended -> get recommended books based on interests
router.get("/recommended", getRecommendedBooksHandler);

export default router;
