import express from "express";

import { authenticateUser as authenticate } from "../../../middleware/authentication.js";

import { createAnswerController } from "../controller/answer.controller.js";
import { createAnswerValidation } from "../validations/answer.validation.js";

const router = express.Router();

router.use(authenticate);

router.post("/", createAnswerValidation, createAnswerController);

export default router;
