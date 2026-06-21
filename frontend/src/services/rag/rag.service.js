import { apiClient } from "../core/api.client.js";

export const ragService = {
  listDocuments: async () => {
    const res = await apiClient.get("/api/rag/documents");
    return res.data.documents || [];
  },
  uploadPdf: async (file, onProgress) => {
    const form = new FormData();
    form.append("file", file);
    const res = await apiClient.post("/api/rag/documents", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    });
    return res.data.document;
  },
  deleteDocument: async (id) => {
    await apiClient.delete(`/api/rag/documents/${id}`);
  },
  searchInDocument: async (id, q) => {
    const res = await apiClient.get(
      `/api/rag/documents/${id}/search?q=${encodeURIComponent(q)}`,
    );
    return res.data;
  },
  queryDocument: async (id, q) => {
    const res = await apiClient.post(`/api/rag/documents/${id}/query`, {
      query: q,
    });
    return res.data;
  },
  fetchPdfObjectUrl: async (id) => {
    const res = await apiClient.get(`/api/rag/documents/${id}/file`, {
      responseType: "blob",
    });
    return res.data;
  },
};
