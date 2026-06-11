import { StatusCodes } from 'http-status-codes';
import { generateQuestionDraftCoachService } from '../service/geminiTextCoach.service.js';

/**
 * Handles AI draft coaching requests for question drafts.
 */
export const generateQuestionDraftCoachController = async (req, res, next) => {
  try {
    const { title, content } = req.body;

    const result = await generateQuestionDraftCoachService({ title, content });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Draft suggestions generated.',
      data: result,
    });
    });
  } catch (error) {
    next(error);
  }
};
