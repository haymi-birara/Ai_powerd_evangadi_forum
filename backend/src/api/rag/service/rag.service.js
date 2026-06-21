import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { safeExecute } from "../../../../db/config.js";
import { NotFoundError } from "../../../utils/errors/index.js";

// Backend root directory (.../backend), used to resolve relative storage paths.
// service dir = .../backend/src/api/rag/service → four levels up is backend/.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, "../../../../");

// Removes the PDF from disk. A missing file (ENOENT) is treated as success
// since the end state — file gone — is what we want. Other errors (e.g.
// permission denied) are surfaced so we don't drop the DB record while the
// file lingers on disk.
const removeFileFromDisk = async (storagePath) => {
  if (!storagePath) {
    return;
  }
  const absolutePath = path.isAbsolute(storagePath)
    ? storagePath
    : path.resolve(BACKEND_ROOT, storagePath);
  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return; // Already gone — nothing to do.
    }
    throw error;
  }
};

export const deleteDocumentService = async ({ documentId, userId }) => {
  // Look up the document first so we can return a clean 404 when the id
  // doesn't exist, rather than silently deleting nothing.
  const documents = await safeExecute(
    `
      SELECT document_id, user_id, storage_path
      FROM documents
      WHERE document_id = ?
      LIMIT 1
    `,
    [documentId],
  );

  if (!documents || documents.length === 0) {
    throw new NotFoundError("Document not found");
  }

  const document = documents[0];

  // A document may only be deleted by its owner. Respond with 404 (not 403)
  // for someone else's document so the endpoint doesn't reveal that an id
  // belonging to another user exists.
  if (Number(document.user_id) !== Number(userId)) {
    throw new NotFoundError("Document not found");
  }

  // Remove the PDF from disk before deleting the DB row, so a failure here
  // doesn't leave an orphaned file with no record pointing at it.
  await removeFileFromDisk(document.storage_path);

  // Delete the record. ON DELETE CASCADE on document_chunks (and in turn
  // document_chunk_vectors) removes all chunks and embeddings automatically.
  await safeExecute(
    `
      DELETE FROM documents
      WHERE document_id = ?
      LIMIT 1
    `,
    [documentId],
  );

  return { id: documentId };
};
