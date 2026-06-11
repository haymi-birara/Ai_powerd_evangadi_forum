import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { questionService } from "../../services/question/question.service.js";
import styles from "./PostQuestion.module.css";

/**
 * PostQuestion page – allows authenticated users to draft and submit a forum question.
 * Integrates the AI Draft Coach via `generateQuestionDraftCoach`.
 *
 * Route: /questions/ask
 */
export default function PostQuestion() {
  const navigate = useNavigate();

  /* ── Form state ── */
  const [formData, setFormData] = useState({ title: "", content: "" });
  const [validationErrors, setValidationErrors] = useState({});

  /* ── Async states ── */
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCoaching, setIsCoaching] = useState(false);
  const [error, setError] = useState(null);

  /* ── AI Coach state ── */
  const [coachFeedback, setCoachFeedback] = useState(null);

  /* ── Success state ── */
  const [successData, setSuccessData] = useState(null); // { questionId, questionHash }

  /* ────────────────────────── Helpers ────────────────────────── */

  /** Validate form inputs; returns an errors object (empty = valid). */
  function validate(data) {
    const errors = {};
    if (!data.title || data.title.trim().length < 5) {
      errors.title = "Question title must be at least 5 characters";
    } else if (data.title.length > 255) {
      errors.title = "Question title cannot exceed 255 characters";
    }

    if (!data.content || data.content.trim().length < 10) {
      errors.content = "Question content must be at least 10 characters";
    }
    return errors;
  }

  /* ────────────────────────── Handlers ───────────────────────── */

  /** Track input changes and clear field-specific validation errors. */
  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (validationErrors[name]) {
      setValidationErrors((prev) => ({ ...prev, [name]: undefined }));
    }

    // Add this line to clear out stale AI feedback when the user updates fields
    if (coachFeedback) {
      setCoachFeedback(null);
    }
  }

  async function handleGetCoachFeedback() {
    const errors = validate(formData);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setIsCoaching(true);
    setCoachFeedback(null);
    setError(null);

    try {
      const data = await questionService.generateQuestionDraftCoach(formData);
      setCoachFeedback(data);
    } catch (err) {
      setError(err.message || "Failed to get AI feedback. Please try again.");
    } finally {
      setIsCoaching(false);
    }
  }

 async function handleSubmit(e) {
   e.preventDefault();

   // 1. Prevent double submissions if already running
   if (isSubmitting || isCoaching) return;

   // 2. CLEAR THE ERROR NOW so an old AI Coach error doesn't block the post form
   setError(null);

   // 3. Run frontend validation rules
   const errors = validate(formData);
   if (Object.keys(errors).length > 0) {
     setValidationErrors(errors);
     return;
   }

   // 4. Set loading states and submit
   setIsSubmitting(true);

   try {
     const data = await questionService.createQuestion(formData);
     setSuccessData(data);
   } catch (err) {
     // Catch and display database or network errors
     setError(err.message || "Failed to post question. Please try again.");
   } finally {
     setIsSubmitting(false);
   }
 }

  /* ────────────────────────── Success screen ─────────────────── */
  if (successData) {
    const questionId = successData?.question?.id || successData?.question_id;
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <span className={styles.pageLabel}>Ask the cohort</span>
          <h1 className={styles.pageTitle}>Publish to the forum</h1>
          <p className={styles.pageSubtitle}>
            Public threads help the whole cohort. Write as if a classmate will
            debug your issue tomorrow. They only know what you put on the page.
          </p>
        </div>

        <div className={styles.successCard}>
          <div className={styles.successIcon}>✓</div>
          <h2 className={styles.successTitle}>Thread published</h2>
          <p className={styles.successSubtitle}>
            Your post is indexed for keyword search and embedding-based
            similarity. Share the link in study groups, or stay on the thread to
            answer follow-up questions from peers.
          </p>
          <div className={styles.successActions}>
            <button
              id="back-to-dashboard-btn"
              className={styles.successBackBtn}
              onClick={() => navigate("/dashboard")}
            >
              Back to Dashboard
            </button>
            {questionId && (
              <button
                id="view-question-btn"
                className={styles.successViewBtn}
                onClick={() => navigate(`/question/${questionId}`)}
              >
                View Question
              </button>
            )}
            <button
              id="ask-another-btn"
              className={styles.successAskBtn}
              onClick={() => {
                setSuccessData(null);
                setFormData({ title: "", content: "" });
                setCoachFeedback(null);
                setError(null);
                setValidationErrors({});
              }}
            >
              Ask Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ────────────────────────── Main form ──────────────────────── */
  return (
    <div className={styles.page}>
      {/* Page header */}
      <div className={styles.pageHeader}>
        <span className={styles.pageLabel}>Ask the cohort</span>
        <h1 className={styles.pageTitle}>Publish to the forum</h1>
        <p className={styles.pageSubtitle}>
          Public threads help the whole cohort. Write as if a classmate will
          debug your issue tomorrow. They only know what you put on the page.
        </p>
      </div>

      {/* Guidelines card */}
      <div className={styles.guidelines}>
        <h2 className={styles.guidelinesTitle}>
          Write questions people can answer in one pass
        </h2>
        <p className={styles.guidelinesIntro}>
          Mentors volunteer their time. Give them runnable context, expected vs
          actual behavior, and a tight scope so they can reproduce the issue
          without guessing your setup.
        </p>

        <div className={styles.guidelinesSection}>
          <h3 className={styles.guidelinesSectionTitle}>
            Checklist before you post
          </h3>
          <ul className={styles.guidelinesList}>
            <li>
              <strong>Title as a headline</strong> that states the symptom and
              tech stack (e.g., "React 19: state resets after navigation").
            </li>
            <li>
              <strong>Repro steps</strong> numbered, with environment (OS,
              browser, Node version) when it matters.
            </li>
            <li>
              <strong>Minimal code</strong> in fenced markdown blocks; trim
              unrelated lines so readers scan faster.
            </li>
            <li>
              <strong>Exact errors</strong> copied verbatim, including stack
              trace snippets when debugging backend routes.
            </li>
          </ul>
        </div>

        <div className={styles.guidelinesSection}>
          <h3 className={styles.guidelinesSectionTitle}>
            Validation rules (enforced by the form)
          </h3>
          <ul className={styles.guidelinesList}>
            <li>
              <strong>Title length:</strong> Must be between 5 and 255
              characters.
            </li>
            <li>
              <strong>Body length:</strong> Must contain a minimum of 10
              characters detailing your problem.
            </li>
            <li>
              <strong>Single topic:</strong> Split unrelated bugs into separate
              threads so search and embeddings stay precise.
            </li>
          </ul>
        </div>
      </div>

      {/* Global error banner */}
      {error && (
        <div
          id="post-question-error"
          className={styles.errorBanner}
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Form card */}
      <form
        id="post-question-form"
        className={styles.formCard}
        onSubmit={handleSubmit}
        noValidate
      >
        {/* Title field */}
        <div className={styles.field}>
          <label htmlFor="question-title" className={styles.fieldLabel}>
            Title
          </label>
          <p className={styles.fieldHint}>
            Be specific and imagine you&apos;re asking a question to another
            person.
          </p>
          <input
            id="question-title"
            name="title"
            type="text"
            className={`${styles.titleInput}${validationErrors.title ? ` ${styles.inputError}` : ""}`}
            placeholder="e.g. How do I handle state management using Context API in React?"
            value={formData.title}
            onChange={handleChange}
            disabled={isSubmitting}
            maxLength={255}
          />
          {validationErrors.title && (
            <span className={styles.fieldError} role="alert">
              {validationErrors.title}
            </span>
          )}
        </div>

        {/* Content field */}
        <div className={styles.field}>
          <label htmlFor="question-content" className={styles.fieldLabel}>
            What are the details of your problem?
          </label>
          <p className={styles.fieldHint}>
            Introduce the problem and expand on what you put in the title.
            Minimum 10 characters.
          </p>

          <div
            className={`${styles.editorWrapper}${validationErrors.content ? ` ${styles.inputError}` : ""}`}
          >
            {/* Minimal rich-text toolbar (cosmetic; real markdown entered by user) */}
            <div className={styles.toolbar}>
              <div className={styles.toolbarButtons}>
                <button
                  type="button"
                  className={styles.toolbarBtn}
                  title="Bold"
                  aria-label="Bold"
                >
                  B
                </button>
                <button
                  type="button"
                  className={`${styles.toolbarBtn} ${styles.toolbarBtnItalic}`}
                  title="Italic"
                  aria-label="Italic"
                >
                  I
                </button>
                <button
                  type="button"
                  className={`${styles.toolbarBtn} ${styles.toolbarBtnCode}`}
                  title="Code"
                  aria-label="Code"
                >
                  {"</>"}
                </button>
                <button
                  type="button"
                  className={`${styles.toolbarBtn} ${styles.toolbarBtnLink}`}
                  title="Link"
                  aria-label="Link"
                >
                  🔗
                </button>
              </div>
              <span className={styles.charCount}>
                {formData.content.length} characters
              </span>
            </div>

            <textarea
              id="question-content"
              name="content"
              className={styles.contentTextarea}
              placeholder="Include all the information someone would need to answer your question... You can use Markdown to format your code!"
              value={formData.content}
              onChange={handleChange}
              disabled={isSubmitting}
            />
          </div>

          {validationErrors.content && (
            <span className={styles.fieldError} role="alert">
              {validationErrors.content}
            </span>
          )}
        </div>

        {/* AI Coach row */}
        <div>
          <div className={styles.aiCoachRow}>
            <button
              id="ai-suggestions-btn"
              type="button"
              className={styles.aiCoachBtn}
              onClick={handleGetCoachFeedback}
              disabled={isCoaching || isSubmitting}
            >
              {isCoaching ? (
                <>
                  <span className={`${styles.spinner} ${styles.spinnerDark}`} />
                  Analyzing…
                </>
              ) : (
                <>
                  <span className={styles.aiCoachBtnIcon}>✦</span>
                  AI suggestions
                </>
              )}
            </button>
            <span className={styles.aiCoachHint}>
              Suggestions only. You still choose what to post.
            </span>
          </div>

          {/* AI Feedback panel */}
          {coachFeedback && (
            <div id="ai-coach-panel" className={styles.coachPanel}>
              <div className={styles.coachPanelHeader}>
                <span className={styles.coachPanelIcon}>✦</span>
                AI Draft Coach
              </div>
              {coachFeedback.feedback && (
                <p className={styles.coachFeedbackText}>
                  {coachFeedback.feedback}
                </p>
              )}
              {Array.isArray(coachFeedback.tips) &&
                coachFeedback.tips.length > 0 && (
                  <ul className={styles.coachSuggestionsList}>
                    {coachFeedback.tips.map((tip, i) => (
                      <li key={i} className={styles.coachSuggestionItem}>
                        {tip}
                      </li>
                    ))}
                  </ul>
                )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className={styles.formActions}>
          <button
            id="cancel-question-btn"
            type="button"
            className={styles.cancelBtn}
            onClick={() => navigate(-1)}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            id="submit-question-btn"
            type="submit"
            className={styles.submitBtn}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className={styles.spinner} />
                Posting…
              </>
            ) : (
              <>
                Post Question
                <span>↗</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
