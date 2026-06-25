import pdfParse from "pdf-parse";

export const extractTextFromPDF = async (fileBuffer) => {
  const result = await pdfParse(fileBuffer);
  return result.text;
};
