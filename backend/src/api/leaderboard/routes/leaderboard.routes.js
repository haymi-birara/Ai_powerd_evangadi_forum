import express from "express";
import { authenticateUser as authenticate } from "../../../middleware/authentication.js";
import {
  getMonthlyLeaderboardController,
  getAllTimeLeaderboardController,
  getLastMonthLeaderboardController,
} from "../controller/leaderboard.controller.js";

const router = express.Router();

router.use(authenticate);

// GET /api/leaderboard/monthly
router.get("/monthly", getMonthlyLeaderboardController);

// GET /api/leaderboard/last-month
router.get("/last-month", getLastMonthLeaderboardController);

// GET /api/leaderboard/alltime
router.get("/alltime", getAllTimeLeaderboardController);

export default router;
