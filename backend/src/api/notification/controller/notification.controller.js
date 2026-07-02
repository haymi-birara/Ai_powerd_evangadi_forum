import { StatusCodes } from "http-status-codes";
import {
  getUnseenAnswerNotificationsService,
  markAnswerNotificationsSeenService,
  getRecentAnswerNotificationsService,
  getUnseenVoteNotificationsService,
  markVoteNotificationsSeenService,
  getRecentVoteNotificationsService,
  getModerationNoticesService,
} from "../service/notification.service.js";

export const getUnseenAnswerNotificationsController = async (req, res, next) => {
  try {
    const result = await getUnseenAnswerNotificationsService({ userId: req.user.id });
    return res.status(StatusCodes.OK).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const markAnswerNotificationsSeenController = async (req, res, next) => {
  try {
    const result = await markAnswerNotificationsSeenService({ userId: req.user.id });
    return res.status(StatusCodes.OK).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const getRecentAnswerNotificationsController = async (req, res, next) => {
  try {
    const result = await getRecentAnswerNotificationsService({
      userId: req.user.id,
      limit: req.query.limit,
    });
    return res.status(StatusCodes.OK).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const getUnseenVoteNotificationsController = async (req, res, next) => {
  try {
    const result = await getUnseenVoteNotificationsService({ userId: req.user.id });
    return res.status(StatusCodes.OK).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const markVoteNotificationsSeenController = async (req, res, next) => {
  try {
    const result = await markVoteNotificationsSeenService({ userId: req.user.id });
    return res.status(StatusCodes.OK).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const getRecentVoteNotificationsController = async (req, res, next) => {
  try {
    const result = await getRecentVoteNotificationsService({
      userId: req.user.id,
      limit: req.query.limit,
    });
    return res.status(StatusCodes.OK).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// Combined unseen counts (answers + upvotes) in a single request, so the
// navbar badge can poll one endpoint instead of two.
export const getUnseenNotificationCountsController = async (req, res, next) => {
  try {
    const [answers, votes] = await Promise.all([
      getUnseenAnswerNotificationsService({ userId: req.user.id }),
      getUnseenVoteNotificationsService({ userId: req.user.id }),
    ]);
    const answerCount = answers.count || 0;
    const voteCount = votes.count || 0;
    return res.status(StatusCodes.OK).json({
      success: true,
      answerCount,
      voteCount,
      totalCount: answerCount + voteCount,
    });
  } catch (error) {
    next(error);
  }
};

export const getModerationNoticesController = async (req, res, next) => {
  try {
    const result = await getModerationNoticesService({ userId: req.user.id });
    return res.status(StatusCodes.OK).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};
