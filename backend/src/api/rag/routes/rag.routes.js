import express from 'express';
import { authenticateUser } from '../../../middleware/authentication.js';
import { listDocumentsController } from '../controller/rag.controller.js';

const router = express.Router();

router.get('/documents', authenticateUser, listDocumentsController);

export default router;
import express from "express";
import { authenticateUser } from "../../../middleware/authentication.js";
import { searchInDocumentValidation } from "../validations/rag.validation.js";
import { searchInDocumentController } from "../controller/rag.controller.js";

const ragRoute = express.Router();

ragRoute.get(
  "/documents/:documentId/search",
  authenticateUser,
  searchInDocumentValidation,
  searchInDocumentController,
);

export default ragRoute;
