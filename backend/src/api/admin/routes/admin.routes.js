import express from "express";
import { param } from "express-validator";
import { authenticateUser as authenticate } from "../../../middleware/authentication.js";
import { requireAdmin, requireAdminOrEvaluator } from "../../../middleware/admin.js";
import { validationErrorHandler } from "../../../middleware/validation-handler.js";
import {
  getAdminQueueController,
  approvePostController,
  removePostController,
  escalatePostController,
  getUsersController,
  updateUserRoleController,
  deleteUserController,
  getFlagHistoryController,
  getAdminMetricsController,
  adminResendConfirmationController,
} from "../controller/admin.controller.js";

const router = express.Router();

// All routes require a valid JWT.
router.use(authenticate);

const flagIdValidation = [
  param("flagId")
    .isInt({ min: 1 })
    .withMessage("flagId must be a positive integer")
    .toInt(),
  validationErrorHandler,
];

const userIdValidation = [
  param("userId").isInt({ min: 1 }).toInt(),
  validationErrorHandler,
];

// ── Admin-only routes ────────────────────────────────────────────────────────
router.get("/metrics",         requireAdmin, getAdminMetricsController);
router.get("/users",           requireAdmin, getUsersController);
router.patch("/users/:userId/role",    requireAdmin, userIdValidation, updateUserRoleController);
router.delete("/users/:userId",        requireAdmin, userIdValidation, deleteUserController);
router.post("/users/:userId/resend-confirmation", requireAdmin, userIdValidation, adminResendConfirmationController);

// ── Admin or Evaluator routes ────────────────────────────────────────────────
router.get("/queue",                        requireAdminOrEvaluator, getAdminQueueController);
router.post("/queue/:flagId/approve",       requireAdminOrEvaluator, flagIdValidation, approvePostController);
router.post("/queue/:flagId/remove",        requireAdminOrEvaluator, flagIdValidation, removePostController);
router.post("/queue/:flagId/escalate",      requireAdminOrEvaluator, flagIdValidation, escalatePostController);
router.get("/flags",                        requireAdminOrEvaluator, getFlagHistoryController);

export default router;
