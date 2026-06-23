import fs from "fs";
import path from "path";
import multer from "multer";
import { BadRequestError } from "../utils/errors/index.js";
const UPLOAD_DIR = "uploads";
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const safeName = path.basename(file.originalname);
    const uniqueName = `${Date.now()}-${safeName}`;
    cb(null, uniqueName);
  },
});

const uploadPdf = multer({
  storage,
  limits: {
    // Limits file size to 10MB
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    // step 3: Check that the file is an actual PDF
    const isPdf =
      file.mimetype === "application/pdf" ||
      file.originalname.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      return cb(new BadRequestError("only PDF files are allowed."));
    }
    cb(null, true);
  },
}).single("file");
// Step 4: Wrapper middleware to execute uploadPdf

export const handlePdfUpload = async (req, res, next) => {
  uploadPdf(req, res, (err) => {
    if (err) {
      return next(err); // Pass the error to the specific error handler
    }
    next();
  });
};

export const createDocumentMulterErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({
          success: false,
          error: "File too large. Maximum size is 10MB.",
        });
    }
    return res.status(400).json({ success: false, error: err.message });
  } else if (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
  next();
};