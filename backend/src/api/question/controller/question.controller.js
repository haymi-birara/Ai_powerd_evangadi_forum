import { StatusCodes } from "http-status-codes";
import { createQuestionWithVectorService } from "../Service/question.service.js";
import {
  getQuestionsService,
  getSingleQuestionService,
} from "../service/question.service.js";

/**
 * Handles listing questions with optional search filtering. Max 100 records.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const getQuestionsController = async (req, res, next) => {
  try {
    const filters = {
      search: req.query.search,
      mine: req.query.mine === "true",
      userId: req.user?.id, // safe access
    };

    const result = await getQuestionsService(filters);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Questions fetched successfully.",
      questions: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handles fetching a single question with answers.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const getSingleQuestionController = async (req, res, next) => {
  try {
    const { questionHash } = req.params;

    const result = await getSingleQuestionService({
      questionHash,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Question fetched successfully.",
      question: result,

export const createQuestionController = async (req, res, next) => {
  try {
    const { title, content } = req.body;
    const result = await createQuestionWithVectorService({
      // authenticate.js user lay attach argenal
      userId: req.user.id,
      title,
      content,
    });
    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Question created successfully",
      data: result.question,
    });
  } catch (error) {
    next(error);
  }
};
