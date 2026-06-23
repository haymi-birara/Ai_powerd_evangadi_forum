
import pdf from "pdf-parse";

export const extractTextFromPDF = async (fileBuffer) => {
  const result = await pdf(fileBuffer);
  return result.text;
};

