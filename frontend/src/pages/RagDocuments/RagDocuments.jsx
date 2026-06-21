import React, { useEffect, useState, useRef } from "react";
import styles from "./RagDocuments.module.css";
import { ragService } from "../../services/rag/rag.service.js";
import RagAnswerBody from "../../components/RagAnswerBody/RagAnswerBody";

export default function RagDocuments() {
  // Document list state
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docsError, setDocsError] = useState("");

  // Upload state
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  // Selected document and view state
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState("preview"); // preview | ask | search
  const fileInputRef = useRef(null);
  const pollingTimerRef = useRef(null);

  // Ask AI state
  const [askQuery, setAskQuery] = useState("");
  const [askLoading, setAskLoading] = useState(false);
  const [askAnswer, setAskAnswer] = useState("");
  const [askError, setAskError] = useState("");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState("");
  const [searchSubmitted, setSearchSubmitted] = useState(false);

  // Preview state
  const [pdfUrl, setPdfUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const formatBytes = (bytes) => {
    if (bytes === 0) return "0 B";
    if (!bytes) return "";
    const sizes = ["B", "KB", "MB", "GB"];
    let i = 0;
    let value = bytes;
    while (value >= 1024 && i < sizes.length - 1) {
      value /= 1024;
      i += 1;
    }
    return `${value.toFixed(2)} ${sizes[i]}`;
  };

  // Load documents on mount
  useEffect(() => {
    loadDocuments();
  }, []);

  // Load PDF when document is selected
  useEffect(() => {
    if (selected && activeTab === "preview") {
      loadPdf();
    }
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [selected, activeTab]);

  useEffect(() => {
    if (
      selected?.status === "processing" ||
      documents.some((doc) => doc.status === "processing")
    ) {
      scheduleDocumentPolling();
    }

    return () => {
      if (pollingTimerRef.current) {
        clearTimeout(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [selected?.document_id, selected?.status, documents.length]);

  useEffect(() => {
    setAskQuery("");
    setAskAnswer("");
    setAskError("");
    setSearchQuery("");
    setSearchResults([]);
    setSearchError("");
    setSearchSubmitted(false);
    setPreviewError("");
    setPdfUrl("");
    setPreviewLoading(false);
  }, [selected?.document_id]);

  const scheduleDocumentPolling = () => {
    if (pollingTimerRef.current) return;

    const shouldContinuePolling =
      selected?.status === "processing" ||
      documents.some((doc) => doc.status === "processing");

    pollingTimerRef.current = setTimeout(async () => {
      pollingTimerRef.current = null;
      try {
        const list = await ragService.listDocuments();
        setDocuments(list);
        setSelected((prevSelected) => {
          if (prevSelected) {
            const updated = list.find(
              (doc) => doc.document_id === prevSelected.document_id,
            );
            if (updated) {
              if (updated.status !== prevSelected.status) {
                // Return a fresh reference only when status changes
                if (updated.status === "ready" || updated.status === "failed") {
                  setUploading(false);
                  setUploadProgress(100);
                }
                return updated;
              }
              return prevSelected;
            }
          }
          return prevSelected;
        });

        if (list.some((doc) => doc.status === "processing")) {
          scheduleDocumentPolling();
        }
      } catch (err) {
        if (shouldContinuePolling) {
          scheduleDocumentPolling();
        }
      }
    }, 2000);
  };

  const loadDocuments = async () => {
    setDocsLoading(true);
    setDocsError("");
    try {
      const list = await ragService.listDocuments();
      setDocuments(list);
    } catch (err) {
      setDocsError(err.response?.data?.message || "Could not load documents.");
    } finally {
      setDocsLoading(false);
    }
  };

  const handleChooseFile = (e) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    setUploadError("");
    setUploadProgress(0);
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadError("Please choose a file first");
      return;
    }

    setUploading(true);
    setUploadError("");
    setDocsError("");
    setUploadProgress(0);

    try {
      const created = await ragService.uploadPdf(file, (progress) => {
        setUploadProgress(progress);
      });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setDocuments((prev) => [created, ...prev]);
      setSelected(created);
      setActiveTab("preview");
      scheduleDocumentPolling();
    } catch (err) {
      setUploadError(
        err.response?.data?.message || err.message || "Upload failed",
      );
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this document?")) return;
    try {
      await ragService.deleteDocument(id);
      setDocuments((docs) => docs.filter((d) => d.document_id !== id));
      setDocsError("");
      if (selected?.document_id === id) {
        setSelected(null);
        setPdfUrl("");
      }
    } catch (err) {
      setDocsError(err.message || "Delete failed");
    }
  };

  const selectDocument = (doc) => {
    setSelected(doc);
    setActiveTab("preview");
  };

  const handleAskQuery = async () => {
    if (!askQuery.trim() || !selected) return;
    setAskLoading(true);
    setAskError("");
    setAskAnswer("");
    try {
      const result = await ragService.queryDocument(
        selected.document_id,
        askQuery,
      );
      setAskAnswer(result.answer || "");
    } catch (err) {
      setAskError(err.response?.data?.message || "Could not get an answer.");
    } finally {
      setAskLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !selected) return;
    setSearchLoading(true);
    setSearchError("");
    setSearchResults([]);
    setSearchSubmitted(true);
    try {
      const result = await ragService.searchInDocument(
        selected.document_id,
        searchQuery,
      );
      setSearchResults(result.chunks || []);
    } catch (err) {
      setSearchError(err.response?.data?.message || "Search failed.");
    } finally {
      setSearchLoading(false);
    }
  };

  const loadPdf = async () => {
    if (!selected || selected.status !== "ready") return;
    const currentUrl = pdfUrl;
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
      setPdfUrl("");
    }

    setPreviewLoading(true);
    setPreviewError("");
    try {
      const blob = await ragService.fetchPdfObjectUrl(selected.document_id);
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (err) {
      setPreviewError(
        err.response?.data?.message || err.message || "Failed to load PDF",
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h2>Private PDF library</h2>
        <p className={styles.lead}>
          Upload study or reference PDFs to your own workspace. Each file is
          indexed for semantic search and optional AI answers that cite that
          document only. File size limits apply on the server; other users never
          see your uploads.
        </p>
      </header>

      {docsError && <div className={styles.topError}>{docsError}</div>}

      <div className={styles.columns}>
        {/* LEFT COLUMN: UPLOAD & LIST */}
        <aside className={styles.left}>
          <div className={styles.uploadCard}>
            <p className={styles.uploadLabel}>Library</p>
            <p className={styles.uploadHint}>
              Add PDFs here. Processing runs once per upload.
            </p>

            <div className={styles.uploadControls}>
              <input
                ref={fileInputRef}
                id="pdf-input"
                type="file"
                accept="application/pdf"
                onChange={handleChooseFile}
                className={styles.fileInput}
              />
              <label htmlFor="pdf-input" className={styles.chooseBtn}>
                Choose file
              </label>
              <button
                className={styles.uploadBtn}
                onClick={handleUpload}
                disabled={!file || uploading}
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
            <div className={styles.fileRow}>
              <div className={styles.uploadFileInfo}>
                <span className={styles.uploadFileName}>
                  {file ? file.name : "No file selected."}
                </span>
                {file && (
                  <span className={styles.fileSize}>
                    {formatBytes(file.size)}
                  </span>
                )}
              </div>
              {uploading ? (
                <>
                  <div className={styles.uploadPill}>
                    <span className={styles.uploadingDot} /> Uploading...
                  </div>
                  {uploadProgress > 0 && (
                    <div className={styles.progressBar}>
                      <div
                        className={styles.progressFill}
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </>
              ) : null}
            </div>
            {uploadError && (
              <div className={styles.errorMsg}>{uploadError}</div>
            )}
          </div>

          {/* DOCUMENT LIST */}
          <div className={styles.listContainer}>
            {docsLoading ? (
              <div className={styles.loadingMsg}>Loading documents...</div>
            ) : docsError ? (
              <div className={styles.errorMsg}>{docsError}</div>
            ) : documents.length === 0 ? (
              <div className={styles.emptyMsg}>
                Your library is empty. Upload a PDF to index it for search and
                Q&A.
              </div>
            ) : (
              <ul className={styles.list}>
                {documents.map((doc) => (
                  <li
                    key={doc.document_id}
                    className={`${styles.listItem} ${
                      selected?.document_id === doc.document_id
                        ? styles.selected
                        : ""
                    }`}
                  >
                    <button
                      className={styles.listItemBtn}
                      onClick={() => selectDocument(doc)}
                    >
                      <div className={styles.listItemContent}>
                        <span className={styles.listTitle}>
                          {doc.title || `Document ${doc.document_id}`}
                        </span>
                        <span className={styles.listMeta}>
                          {formatBytes(doc.byte_size)}
                        </span>
                      </div>
                      <span
                        className={`${styles.listBadge} ${styles[`badge${doc.status}`]}`}
                      >
                        {doc.status?.toUpperCase()}
                      </span>
                    </button>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => handleDelete(doc.document_id)}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* RIGHT COLUMN: DOCUMENT VIEW */}
        <main className={styles.right}>
          {!selected ? (
            <div className={styles.placeholderMsg}>
              Choose a document from the library to open the reader, run
              semantic search over its text, and ask questions with AI-assisted
              answers grounded in that file.
            </div>
          ) : selected.status === "processing" ? (
            <div className={styles.readerBox}>
              <p>
                This document is not ready for preview or AI tools. Current
                status: <strong>{selected.status}</strong>.
              </p>
            </div>
          ) : selected.status === "failed" ? (
            <div className={styles.failedMsg}>
              <p>❌ Processing failed</p>
              <p className={styles.small}>
                {selected.error_message || "Unknown error"}
              </p>
            </div>
          ) : (
            <div className={styles.docContainer}>
              {/* DOC HEADER */}
              <div className={styles.docHeader}>
                <h3 className={styles.docTitle}>Reader</h3>
                <div className={styles.docMeta}>
                  Ready • {formatBytes(selected.byte_size)}
                </div>
              </div>
              {/* READER + SEARCH + ASK layout (show preview and tools together) */}
              <div className={styles.readerLayout}>
                <div className={styles.previewArea}>
                  {previewLoading ? (
                    <div className={styles.loadingMsg}>
                      Loading document preview...
                    </div>
                  ) : previewError ? (
                    <div className={styles.errorMsg}>{previewError}</div>
                  ) : pdfUrl ? (
                    <iframe
                      src={pdfUrl}
                      title="PDF Preview"
                      className={styles.pdfFrame}
                    />
                  ) : (
                    <div className={styles.readerBox}>
                      Choose a document from the library to open the reader and
                      preview the file.
                    </div>
                  )}
                </div>

                <div className={styles.toolsArea}>
                  <section className={styles.section}>
                    <h4 className={styles.sectionTitle}>Semantic search</h4>
                    <p className={styles.small}>
                      Finds passages by meaning (embeddings), not only exact
                      keywords.
                    </p>
                    <label className={styles.inputLabel}>Search query</label>
                    <div className={styles.searchRow}>
                      <input
                        className={styles.searchInput}
                        placeholder="Describe the topic or phrase you are looking for"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <button
                      className={styles.searchBtn}
                      onClick={handleSearch}
                      disabled={
                        !selected || searchLoading || !searchQuery.trim()
                      }
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden
                      >
                        <path
                          d="M21 21l-4.35-4.35"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle
                          cx="11"
                          cy="11"
                          r="6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {searchLoading ? "Searching..." : "Search"}
                    </button>
                    {searchError && (
                      <div className={styles.errorMsg}>{searchError}</div>
                    )}
                    {!searchLoading &&
                      searchSubmitted &&
                      searchResults.length === 0 && (
                        <div className={styles.emptyMsg}>
                          No matching passages were found.
                        </div>
                      )}
                    {searchResults.length > 0 && (
                      <div className={styles.resultsList}>
                        {searchResults.map((chunk, idx) => (
                          <div
                            key={idx}
                            className={`${styles.resultItem} ${styles.resultItemAnimated}`}
                            style={{ animationDelay: `${idx * 80}ms` }}
                          >
                            <p className={styles.resultScore}>
                              Relevance: {(chunk.similarity || 0).toFixed(2)}
                            </p>
                            <p className={styles.resultText}>{chunk.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className={styles.section}>
                    <h4 className={styles.sectionTitle}>Ask with AI</h4>
                    <p className={styles.small}>
                      Answers use only retrieved excerpts from this PDF, with
                      citations where possible. When the document includes code,
                      the reply may show it in formatted blocks you can copy.
                    </p>
                    <label className={styles.inputLabel}>Question</label>
                    <div className={styles.queryBox}>
                      <div className={styles.queryField}>
                        <textarea
                          className={styles.queryInput}
                          placeholder="Ask a clear question in plain language. If the document does not cover it, the model should say so."
                          value={askQuery}
                          onChange={(e) => setAskQuery(e.target.value)}
                        />
                        <button
                          className={styles.queryBtn}
                          onClick={handleAskQuery}
                          // disabled={!selected || askLoading || !askQuery.trim()}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            aria-hidden
                          >
                            <path
                              d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          {askLoading ? "Asking..." : "Ask"}
                        </button>
                      </div>
                    </div>
                    {askError && (
                      <div className={styles.errorMsg}>{askError}</div>
                    )}
                    {askAnswer && (
                      <div className={styles.answerBox}>
                        <RagAnswerBody>{askAnswer}</RagAnswerBody>
                      </div>
                    )}
                  </section>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
