import { StatusCodes } from "http-status-codes";
import { BadRequestError } from "../../../utils/errors/index.js";
import { createDocumentFromUploadService, queryDocumentService } from "../service/rag.service.js";

export const createDocumentController = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new BadRequestError("PDF file required");
    }

    const result = await createDocumentFromUploadService(req.file, req.user.id);

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Document uploaded and processed.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const queryDocumentController = async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const { query } = req.body;
    const userId = req.user.id;

    const result = await queryDocumentService({ documentId, query, userId });

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Answer and citations",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

