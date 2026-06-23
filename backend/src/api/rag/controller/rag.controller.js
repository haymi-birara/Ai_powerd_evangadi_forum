import { StatusCodes } from 'http-status-codes';
import { listDocumentsForUserService } from '../service/rag.service.js';

export const listDocumentsController = async (req, res, next) => {
  try {
    const documents = await listDocumentsForUserService({
      userId: req.user.id,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Documents fetched successfully.',
      data: documents,
    });
  } catch (error) {
    next(error);
  }
};
