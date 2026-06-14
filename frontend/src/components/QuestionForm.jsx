import React, { useState } from "react";

const QuestionForm = ({
  title,
  setTitle,
  body,
  setBody,
  tags,
  setTags,
  onSubmit,
  isSubmitting,
}) => {
  const [tagInput, setTagInput] = useState("");
  const [errors, setErrors] = useState({});

  const validateField = (field, value) => {
    const newErrors = { ...errors };

    if (field === "title") {
      if (!value.trim()) {
        newErrors.title = "Title is required";
      } else if (value.length < 15) {
        newErrors.title = "Title must be at least 15 characters";
      } else if (value.length > 200) {
        newErrors.title = "Title must be less than 200 characters";
      } else {
        delete newErrors.title;
      }
    }

    if (field === "body") {
      if (!value.trim()) {
        newErrors.body = "Question body is required";
      } else if (value.length < 30) {
        newErrors.body = "Please provide more details (at least 30 characters)";
      } else {
        delete newErrors.body;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleTitleChange = (e) => {
    const value = e.target.value;
    setTitle(value);
    validateField("title", value);
  };

  const handleBodyChange = (e) => {
    const value = e.target.value;
    setBody(value);
    validateField("body", value);
  };

  const handleAddTag = () => {
    if (tagInput && !tags.includes(tagInput) && tags.length < 5) {
      setTags([...tags, tagInput.toLowerCase()]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate all fields
    const isTitleValid = validateField("title", title);
    const isBodyValid = validateField("body", body);

    if (isTitleValid && isBodyValid && tags.length > 0) {
      onSubmit(e);
    } else if (tags.length === 0) {
      setErrors({ ...errors, tags: "Please add at least one tag" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title Field */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Question Title
          <span className="text-red-500 ml-1">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="e.g., How do I fix 'Cannot read property' error in React?"
          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition
            ${errors.title ? "border-red-500 bg-red-50" : "border-gray-300"}`}
          maxLength={200}
          disabled={isSubmitting}
        />
        <div className="flex justify-between items-center mt-1">
          <p
            className={`text-sm ${errors.title ? "text-red-500" : "text-gray-500"}`}
          >
            {errors.title ||
              "Be specific and imagine you're asking a question to another person"}
          </p>
          <p
            className={`text-sm ${title.length > 180 ? "text-orange-500" : "text-gray-400"}`}
          >
            {title.length}/200
          </p>
        </div>
      </div>

      {/* Body Field */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Question Details
          <span className="text-red-500 ml-1">*</span>
        </label>
        <textarea
          value={body}
          onChange={handleBodyChange}
          placeholder="## What I'm trying to achieve
## What I've tried
## The error I'm getting
## My code (if applicable)"
          rows={12}
          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition font-mono text-sm
            ${errors.body ? "border-red-500 bg-red-50" : "border-gray-300"}`}
          disabled={isSubmitting}
        />
        <div className="flex justify-between items-center mt-1">
          <p
            className={`text-sm ${errors.body ? "text-red-500" : "text-gray-500"}`}
          >
            {errors.body ||
              "Provide as much detail as possible. Include code, error messages, and what you've tried."}
          </p>
          <p className="text-sm text-gray-400">{body.length} characters</p>
        </div>
      </div>

      {/* Tags Field */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Tags
          <span className="text-red-500 ml-1">*</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="e.g., react, javascript, css"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isSubmitting || tags.length >= 5}
          />
          <button
            type="button"
            onClick={handleAddTag}
            disabled={!tagInput || tags.length >= 5}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Add Tag
          </button>
        </div>

        {/* Tags Display */}
        <div className="flex flex-wrap gap-2 mt-3">
          {tags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-2"
            >
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="text-blue-500 hover:text-blue-700 font-bold"
                disabled={isSubmitting}
              >
                ×
              </button>
            </span>
          ))}
        </div>

        {errors.tags && (
          <p className="text-sm text-red-500 mt-1">{errors.tags}</p>
        )}

        <p className="text-sm text-gray-500 mt-2">
          Add up to 5 tags to help others find your question ({tags.length}/5
          used)
        </p>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting || !title || !body || tags.length === 0}
        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition font-semibold"
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="animate-spin h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Posting Your Question...
          </span>
        ) : (
          "Post Your Question"
        )}
      </button>
    </form>
  );
};

export default QuestionForm;
