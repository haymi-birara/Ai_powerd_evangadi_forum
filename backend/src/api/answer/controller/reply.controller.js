import { createReplyService } from "../service/reply.service.js";

export const createReplyController = async (req, res, next) => {
  try {
    const { answerId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    const reply = await createReplyService({ answerId, content, userId });

    return res.status(201).json({
      success: true,
      message: "Reply posted successfully",
      data: reply,
    });
  } catch (error) {
    next(error);
  }
};
