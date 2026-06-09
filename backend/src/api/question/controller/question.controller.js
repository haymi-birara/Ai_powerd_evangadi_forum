import { StatusCodes } from "http-status-codes";
import { createQuestionWithVectorService } from "../Service/question.service.js";

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
