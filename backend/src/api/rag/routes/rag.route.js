import express from "express";
import { authenticateUser } from "../../../middleware/authentication.js";
import { createDocumentController, queryDocumentController } from "../controller/rag.controller.js";
import { handlePdfUpload, createDocumentMulterErrorHandler } from "../../../middleware/rag.upload.config.js"; 
import { queryDocumentValidation } from "../validation/rag.validation.js";


const ragRoute = express.Router();

ragRoute.post(
  "/documents",
  authenticateUser, // Step 1: Ensure user is logged in
  handlePdfUpload, // Step 2: Receive and save the multipart/form-data PDF
  createDocumentMulterErrorHandler, // Step 3: Catch if file > 10MB or not a PDF
  createDocumentController, // Step 4: Pass to controller for processing
);

ragRoute.post(
  "/documents/:documentId/query",
  authenticateUser,
  queryDocumentValidation,
  queryDocumentController
);

export default ragRoute;

