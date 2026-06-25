import { apiClient } from "../core/api.client.js";

export const ragService = {
  listDocuments: async () => {
    const res = await apiClient.get("/api/rag/documents");
    return res.data.data || [];
  }
  uploadPdf: async (file, onProgress) => {
    const form = new FormData();
    form.append("file", file);
    const res = await apiClient.post("/api/rag/documents", form, {
      onUploadProgress: (e) => {
        if (!onProgress) return;
        const total = e.total || 0;
        if (!total) return;
        onProgress(Math.round((e.loaded / total) * 100));
      },
    });
    return res.data.data;
  },
  deleteDocument: async (id) => {
    await apiClient.delete(`/api/rag/documents/${id}`);
  },
  searchInDocument: async (id, q, { k } = {}) => {
    const res = await apiClient.get(`/api/rag/documents/${id}/search`, {
      params: { query: q, ...(k ? { k } : {}) },
    });
    return res.data.data;
  }
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
