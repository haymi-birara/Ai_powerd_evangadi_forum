import { GoogleGenAI } from '@google/genai';
import { safeExecute } from '../../../../db/config.js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const getQuestionByHash = async (questionHash) => {
  const sql = `
    SELECT title, content
    FROM questions
    WHERE question_hash = ?
  `;
  const rows = await safeExecute(sql, [questionHash]);
  return rows[0] || null;
};

export const evaluateAnswerFit = async (questionTitle, questionBody, draftAnswer) => {
  const prompt = `
You are an expert evaluator for a community Q&A forum.
A user has written a draft answer to the following question:

QUESTION TITLE: ${questionTitle}
QUESTION BODY: ${questionBody || 'No additional description provided.'}

DRAFT ANSWER:
${draftAnswer}

Evaluate how well the draft answer addresses the question. Respond ONLY in this exact JSON format with no extra text:
{
  "score": <number between 0 and 100>,
  "feedback": "<2-3 sentences of constructive feedback explaining the score>"
}

Scoring guide:
- 90-100: Directly and completely answers the question with clarity
- 70-89: Mostly answers the question but missing some details
- 50-69: Partially relevant but incomplete or slightly off-topic
- 30-49: Loosely related but does not clearly answer the question
- 0-29: Off-topic, unclear, or does not address the question at all
`;

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash-lite',
    contents: prompt,
  });

  const rawText = response.text.trim();
  const cleaned = rawText.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(cleaned);

  return {
    score: parsed.score,
    feedback: parsed.feedback,
  };
};