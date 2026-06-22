export const toNumberOrFallback = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const parseEmbedding = (rawEmbedding) => {
  if (Array.isArray(rawEmbedding)) return rawEmbedding;

  if (Buffer.isBuffer(rawEmbedding)) {
    try {
      return JSON.parse(rawEmbedding.toString("utf-8"));
    } catch {
      return null;
    }
  }

  if (typeof rawEmbedding === "string") {
    try {
      return JSON.parse(rawEmbedding);
    } catch {
      return null;
    }
  }

  return null;
};

const dotProduct = (a, b) => {
  let sum = 0;
  const limit = Math.min(a.length, b.length);
  for (let i = 0; i < limit; i += 1) {
    sum += a[i] * b[i];
  }
  return sum;
};

const magnitude = (arr) =>
  Math.sqrt(arr.reduce((sum, value) => sum + value * value, 0));

export const cosineSimilarity = (a, b) => {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
};
