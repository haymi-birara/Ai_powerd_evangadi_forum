import path from "path";
import { StatusCodes } from "http-status-codes";
import {
  listDocumentsForUser,
  addDocument,
  deleteDocumentById,
  getDocumentById,
} from "../service/rag.storage.js";

export const listDocuments = async (req, res, next) => {
  try {
    const docs = await listDocumentsForUser(req.user.id);
    res.status(StatusCodes.OK).json({ documents: docs });
  } catch (err) {
    next(err);
  }
};

export const uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: "A PDF file is required" });
    }
    const saved = await addDocument({
      user_id: req.user.id,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      filePath: req.file.path,
    });
    res.status(StatusCodes.CREATED).json({ document: saved });
  } catch (err) {
    next(err);
  }
};

export const deleteDocument = async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    // Ownership check: ensure the doc belongs to the authenticated user
    const doc = await getDocumentById(id);
    if (!doc) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "Document not found" });
    }
    if (doc.user_id !== req.user.id) {
      return res
        .status(StatusCodes.FORBIDDEN)
        .json({ message: "Access denied" });
    }

    const ok = await deleteDocumentById(id);
    if (!ok) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "Document not found" });
    }
    res.status(StatusCodes.NO_CONTENT).send();
  } catch (err) {
    next(err);
  }
};

export const searchDocument = async (req, res, next) => {
  try {
    // Stub: full semantic search can be wired in later
    res.status(StatusCodes.OK).json({ chunks: [] });
  } catch (err) {
    next(err);
  }
};

export const queryDocument = async (req, res, next) => {
  try {
    // Stub: RAG query pipeline can be wired in later
    res
      .status(StatusCodes.OK)
      .json({ answer: "AI answer feature coming soon." });
  } catch (err) {
    next(err);
  }
};

export const getDocumentFile = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const doc = await getDocumentById(id);

    if (!doc) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ msg: "Document not found" });
    }
    if (doc.user_id !== req.user.id) {
      return res
        .status(StatusCodes.FORBIDDEN)
        .json({ msg: "Access denied" });
    }

    // storage_path is the absolute disk path saved by multer
    const filePath = path.resolve(doc.storage_path);
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
};
