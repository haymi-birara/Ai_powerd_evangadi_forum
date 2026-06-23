import { safeExecute } from "../../../../db/config.js";
import { NotFoundError } from "../../../utils/errors/index.js";

export const getDocumentMetaService = async (documentId, userId) => {
  const sql = `
    SELECT
      d.document_id AS documentId,
      d.title,
      d.mime_type AS mimeType,
      d.byte_size AS byteSize,
      d.status,
      d.error_message AS errorMessage,
      d.created_at AS createdAt,
      d.updated_at AS updatedAt
    FROM documents d
    WHERE d.document_id = ? AND d.user_id = ?
    LIMIT 1
  `;

  const rows = await safeExecute(sql, [documentId, userId]);

  if (!rows || rows.length === 0) {
    throw new NotFoundError(`Document with id ${documentId} not found.`);
  }

  return rows[0];
};