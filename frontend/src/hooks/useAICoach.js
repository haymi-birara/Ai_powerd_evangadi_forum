import { useState, useEffect, useCallback } from "react";
import { questionService } from "../services/questionService";

export const useAICoach = (title, body, debounceDelay = 1000) => {
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastAnalyzed, setLastAnalyzed] = useState({ title: "", body: "" });

  const analyzeQuestion = useCallback(async () => {
    // Only analyze if content has changed
    if (lastAnalyzed.title === title && lastAnalyzed.body === body) {
      return;
    }

    // Don't analyze empty content
    if (!title && !body) {
      setFeedback(null);
      return;
    }

    // Only analyze meaningful content
    if (title.length < 5 && body.length < 10) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await questionService.getDraftCoachFeedback(title, body);
      if (result.success) {
        setFeedback(result.data);
        setLastAnalyzed({ title, body });
      } else {
        setError(result.message || "Failed to get feedback");
      }
    } catch (err) {
      setError(err.message || "AI Coach unavailable");
      console.error("AI Coach error:", err);
    } finally {
      setLoading(false);
    }
  }, [title, body, lastAnalyzed]);

  useEffect(() => {
    const timer = setTimeout(() => {
      analyzeQuestion();
    }, debounceDelay);

    return () => clearTimeout(timer);
  }, [title, body, analyzeQuestion, debounceDelay]);

  return { feedback, loading, error, analyzeQuestion };
};

export default useAICoach;
