import { safeExecute } from '../../../../db/config.js';
import { BadRequestError } from '../../../utils/errors/index.js';

export const listDocumentsForUserService = async ({ userId }) => {
  if (!userId) {
    throw new BadRequestError('User is required');
  }

  const normalizedLimit = 100;

  const sql = `
    SELECT
      document_id AS documentId,
      title,
      mime_type AS mimeType,
      byte_size AS byteSize,
      status,
      error_message AS errorMessage,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM documents
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ${normalizedLimit}
  `;

  const rows = await safeExecute(sql, [userId]);

  return rows.map(document => ({
    documentId: document.documentId,
    title: document.title,
    mimeType: document.mimeType,
    byteSize: document.byteSize,
    status: document.status,
    errorMessage: document.errorMessage,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  }));
};
