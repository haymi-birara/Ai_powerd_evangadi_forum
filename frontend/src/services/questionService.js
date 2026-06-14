import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3777";

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const questionService = {
  // Create new question
  async createQuestion(questionData) {
    try {
      const response = await api.post("/questions", questionData);
      return response.data;
    } catch (error) {
      console.error("Create question error:", error);
      throw error.response?.data || { message: "Failed to create question" };
    }
  },

  // AI Draft Coach - Get real-time feedback
  async getDraftCoachFeedback(title, body) {
    try {
      const response = await api.post("/questions/draft-coach", {
        title,
        body,
      });
      return response.data;
    } catch (error) {
      console.error("Draft coach error:", error);
      // Return mock feedback if backend not ready
      return this.getMockFeedback(title, body);
    }
  },

  // Mock feedback for development (remove when backend ready)
  getMockFeedback(title, body) {
    let score = 75;
    const suggestions = [];
    let isComplete = true;

    // Title validation
    if (!title || title.length === 0) {
      suggestions.push("✏️ Add a clear, descriptive title");
      score -= 25;
      isComplete = false;
    } else if (title.length < 15) {
      suggestions.push(
        "📝 Make your title more descriptive (at least 15 characters)",
      );
      score -= 15;
    } else if (title.length > 200) {
      suggestions.push(
        "🎯 Shorten your title for clarity (max 200 characters)",
      );
      score -= 5;
    }

    if (title && !title.includes("?") && title.length > 5) {
      suggestions.push('❓ Phrase your title as a question ending with "?"');
      score -= 10;
    }

    // Body validation
    if (!body || body.length === 0) {
      suggestions.push("📖 Add detailed description of your problem");
      score -= 30;
      isComplete = false;
    } else if (body.length < 30) {
      suggestions.push("💡 Provide more details (at least 30 characters)");
      score -= 20;
    }

    if (body && body.length > 0) {
      if (!body.toLowerCase().includes("?") && !title?.includes("?")) {
        suggestions.push("🤔 Clearly state what you want to know");
        score -= 10;
      }

      if (!body.toLowerCase().includes("tried") && body.length > 50) {
        suggestions.push("🔧 Mention what you have already tried");
        score -= 15;
      }

      if (body.toLowerCase().includes("error") && !body.includes("```")) {
        suggestions.push("💻 Format error messages using code blocks (```)");
        score -= 5;
      }
    }

    // Positive feedback
    if (score >= 80) {
      suggestions.unshift("🎉 Great question! You're ready to post");
    } else if (score >= 60) {
      suggestions.unshift("👍 Good start! A few improvements will help");
    }

    return {
      success: true,
      data: {
        score: Math.max(0, Math.min(100, score)),
        suggestions: suggestions.filter((s) => !s.startsWith("🎉")),
        isComplete,
        positiveFeedback: score >= 80 ? "Your question looks great!" : null,
      },
    };
  },
};

export default questionService;
