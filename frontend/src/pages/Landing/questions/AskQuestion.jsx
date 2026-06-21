import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import QuestionForm from "../../components/QuestionForm";
import AIDraftCoach from "../../components/AIDraftCoach";
import { questionService } from "../../services/questionService";

const AskQuestion = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Please login to ask a question");
      setTimeout(() => {
        navigate("/auth");
      }, 2000);
    } else {
      setIsAuthenticated(true);
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isAuthenticated) {
      setError("Please login first");
      navigate("/auth");
      return;
    }

    setIsSubmitting(true);
    setError("");

    const questionData = {
      title: title.trim(),
      body: body.trim(),
      tags: tags,
    };

    try {
      const result = await questionService.createQuestion(questionData);
      console.log("Question posted:", result);

      // Show success message
      alert("✓ Question posted successfully!");

      // Navigate to the question detail page or dashboard
      if (result.data && result.data.hash) {
        navigate(`/questions/${result.data.hash}`);
      } else if (result.hash) {
        navigate(`/questions/${result.hash}`);
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Error posting question:", error);
      setError(error.message || "Failed to post question. Please try again.");

      // Scroll to error message
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated && error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <div className="text-red-500 text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Authentication Required
          </h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate("/auth")}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Ask a Question</h1>
          <p className="text-gray-600 mt-2">
            Get help from the community and our AI coach
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-red-500 text-lg">⚠️</span>
              <div>
                <h4 className="font-semibold text-red-800">Error</h4>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-md p-6">
              <QuestionForm
                title={title}
                setTitle={setTitle}
                body={body}
                setBody={setBody}
                tags={tags}
                setTags={setTags}
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
              />
            </div>
          </div>

          {/* AI Coach Sidebar */}
          <div className="lg:col-span-1">
            <AIDraftCoach title={title} body={body} />
          </div>
        </div>

        {/* Tips Section */}
        <div className="mt-8 bg-blue-50 rounded-lg p-4 border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2">
            💡 Tips for a Great Question
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-blue-800">
            <div>
              <span className="font-medium">1. Be Specific</span>
              <p className="text-xs mt-1">
                Include your exact problem and what you've tried
              </p>
            </div>
            <div>
              <span className="font-medium">2. Add Code</span>
              <p className="text-xs mt-1">
                Share relevant code using markdown code blocks
              </p>
            </div>
            <div>
              <span className="font-medium">3. Use Tags</span>
              <p className="text-xs mt-1">
                Add 2-5 relevant tags for better visibility
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AskQuestion;
