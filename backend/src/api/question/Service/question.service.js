import crypto from "crypto";
import { safeExecute } from "../../../../db/config.js";
import {
  BadRequestError,
  NotFoundError,
} from "../../../utils/errors/index.js";

import { storeQuestionVector } from "../Service/vector.service.js"
import {
  normalizeQuestionText,
  generateQuestionEmbedding,
} from "./vector.service.js";


const generateQuestionHash = () => {
  return crypto.randomBytes(8).toString("hex");
};


export const createQuestionWithVectorService = async ({
 
  userId,
  title,
  content,
}) => {
 
  const inserQuestionSql =
    "INSERT INTO questions (question_hash,user_id,title,content) VALUES (?, ?, ?, ?)";
  // unique question hash for Url purpose
  const questionHash = generateQuestionHash();
  let questionResult;

  try {
  
    questionResult = await safeExecute(inserQuestionSql, [
      questionHash,
      userId,
      title,
      content,
    ]);
  } catch (err) {
    
    if (err?.code === "ER_NO_REFERENCED_ROW_2") {
      throw new BadRequestError("User does not exist");
    }
    throw err;
  }

  
  const questionId = questionResult.insertId;



  const creationResult = {
    id: questionId,
    questionHash,
    userId,
    title,
    content,
  };



  const sourceText = normalizeQuestionText({ title });


  try {
   
    const embeddingResult = await generateQuestionEmbedding(sourceText, {
      questionId: creationResult.id,
    });

   
    await storeQuestionVector({
      questionId: creationResult.id,
      sourceText,
      embedding: embeddingResult.embedding,
      status: `ready`,
    });
  } catch (err) {
   
    await storeQuestionVector({
      questionId: creationResult.id,
      sourceText,
      embedding: [],
      status: `failed`,
    }).catch((err) => console.log("failed to save status", err));
  }

  return {
    question: creationResult,
  };
};
