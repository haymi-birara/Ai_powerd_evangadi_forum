import express from "express";
import { authenticateUser } from "../../../middleware/authentication.js";
import {
  getUnseenAnswerNotificationsController,
  markAnswerNotificationsSeenController,
  getRecentAnswerNotificationsController,
  getUnseenVoteNotificationsController,
  markVoteNotificationsSeenController,
  getRecentVoteNotificationsController,
  getUnseenNotificationCountsController,
  getModerationNoticesController,
} from "../controller/notification.controller.js";

const router = express.Router();

// All notification routes require a valid JWT.
router.use(authenticateUser);

// GET  /api/notifications/answers/unseen
router.get("/answers/unseen", getUnseenAnswerNotificationsController);
// POST /api/notifications/answers/seen
router.post("/answers/seen", markAnswerNotificationsSeenController);
// GET  /api/notifications/answers
router.get("/answers", getRecentAnswerNotificationsController);
// GET  /api/notifications/votes/unseen
router.get("/votes/unseen", getUnseenVoteNotificationsController);
// POST /api/notifications/votes/seen
router.post("/votes/seen", markVoteNotificationsSeenController);
// GET  /api/notifications/votes
router.get("/votes", getRecentVoteNotificationsController);
// GET  /api/notifications/unseen
router.get("/unseen", getUnseenNotificationCountsController);
// GET  /api/notifications/moderation — user's own flag history + standing
router.get("/moderation", getModerationNoticesController);

export default router;
