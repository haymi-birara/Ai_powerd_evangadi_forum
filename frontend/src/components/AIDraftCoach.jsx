import React from "react";
import useAICoach from "../hooks/useAICoach";

const AIDraftCoach = ({ title, body }) => {
  const { feedback, loading, error } = useAICoach(title, body, 1000);

  const getScoreColor = (score) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBgColor = (score) => {
    if (score >= 80) return "bg-green-600";
    if (score >= 60) return "bg-yellow-600";
    return "bg-red-600";
  };

  return (
    <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl p-6 sticky top-6 shadow-lg border border-gray-200">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-blue-600 rounded-full p-2">
          <svg
            className="w-5 h-5 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-800">AI Draft Coach</h3>
          <p className="text-xs text-gray-500">Real-time writing feedback</p>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-sm text-gray-600">Analyzing your question...</p>
          <p className="text-xs text-gray-400 mt-1">Getting AI suggestions</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">{error}</p>
          <p className="text-xs text-yellow-600 mt-1">Using offline mode</p>
        </div>
      )}

      {/* Feedback Display */}
      {feedback && !loading && (
        <div className="space-y-5">
          {/* Quality Score */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">
                Question Quality
              </span>
              <span
                className={`text-2xl font-bold ${getScoreColor(feedback.score)}`}
              >
                {feedback.score}/100
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={`rounded-full h-2.5 transition-all duration-500 ${getScoreBgColor(feedback.score)}`}
                style={{ width: `${feedback.score}%` }}
              ></div>
            </div>
            {feedback.positiveFeedback && (
              <p className="text-xs text-green-600 mt-2">
                ✨ {feedback.positiveFeedback}
              </p>
            )}
          </div>

          {/* Suggestions */}
          {feedback.suggestions && feedback.suggestions.length > 0 && (
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <span className="text-green-600 text-lg">✓</span>
                Improvement Suggestions
              </h4>
              <ul className="space-y-2">
                {feedback.suggestions.map((suggestion, idx) => (
                  <li key={idx} className="text-sm text-gray-600 flex gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Status Messages */}
          {feedback.isComplete === false && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-sm text-orange-800 flex items-center gap-2">
                <span>⚠️</span>
                Your question needs more detail before posting
              </p>
            </div>
          )}

          {feedback.isComplete === true && feedback.score >= 80 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800 flex items-center gap-2">
                <span>🎉</span>
                Excellent! Your question is ready to be posted
              </p>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!title && !body && !loading && !feedback && (
        <div className="text-center py-8">
          <div className="text-5xl mb-3">✍️</div>
          <p className="text-gray-600 text-sm">
            Start writing your question and I'll provide real-time feedback to
            help you get better answers.
          </p>
          <div className="mt-4 text-xs text-gray-400">
            <p>✓ Title clarity check</p>
            <p>✓ Detail completeness</p>
            <p>✓ Code formatting tips</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIDraftCoach;
