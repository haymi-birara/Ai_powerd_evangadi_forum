import { validationResult } from 'express-validator';
import { getQuestionByHash, evaluateAnswerFit } from '../survice/answer-fit.service.js';

const answerFitController = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { questionHash } = req.params;
  const { draftAnswer } = req.body;

  const question = await getQuestionByHash(questionHash);
  if (!question) {
    return res.status(404).json({ success: false, message: 'Question not found' });
  }

  const { score, feedback } = await evaluateAnswerFit(
    question.title,
    question.content,
    draftAnswer
  );

  return res.status(200).json({ success: true, data: { score, feedback } });
};

export default answerFitController;