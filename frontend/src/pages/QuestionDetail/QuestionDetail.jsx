import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import MarkdownToolbar from "../../components/common/MarkdownToolbars/MarkdownToolbars.jsx";
import { MessageSquare, ArrowLeft, Share2, ThumbsUp ,Check, X, Trophy, Crown, Medal} from "lucide-react";
import { questionService } from "../../services/question/question.service.js";
import { answerService } from "../../services/answer/answer.service.js";
import styles from "./QuestionDetail.module.css";
import ui from "../../styles/pageStates.module.css";
import { useAuth } from "../../contexts/AuthContext.jsx";

const markdownComponents = {
  a: ({ node: _n, ...props }) => (
    <a target="_blank" rel="noopener noreferrer" {...props} />
  ),
};

// Map a community-recognition title to a badge tier (drives icon + colour), so
// the badge visibly reflects the member's current standing.
const recognitionTier = (title = "") => {
  if (/year/i.test(title)) return "year";        // Champion of the Year
  if (/champion/i.test(title)) return "gold";    // Community Champion / N× Champion
  if (/top contributor/i.test(title)) return "silver";
  if (/rising star/i.test(title)) return "bronze";
  return "gold";
};

// Icon per tier, matching the leaderboard rank icons: Trophy for #1 (gold),
// Medal for #2/#3 (silver/bronze), Crown for the yearly champion.
const recognitionIcon = (tier, size = 16) => {
  if (tier === "year") return <Crown size={size} />;
  if (tier === "gold") return <Trophy size={size} />;
  return <Medal size={size} />;
};

const fitLabelFromScore = (score) => {
  if (score >= 80) return "strong";
  if (score >= 55) return "partial";
  return "weak";
};

const buildActionErrorMessage = (actionLabel, err, fallbackMessage) => {
  const raw = (err?.message || "").trim();
  if (!raw) return fallbackMessage;

  if (/cannot reach the server|unable to connect|network/i.test(raw)) {
    return `${actionLabel} failed because the app could not reach the server. Please check your connection or try again shortly.`;
  }

  if (/timed out/i.test(raw)) {
    return `${actionLabel} failed because the request timed out. Please try again.`;
  }

  if (/internal error|server failed|status 5\d\d/i.test(raw)) {
    return `${actionLabel} failed due to a server error. Please try again in a moment.`;
  }

  return `${actionLabel} failed: ${raw}`;
};

export default function QuestionDetail() {
  const { questionHash } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [question, setQuestion] = useState(null);
  const [relatedQuestions, setRelatedQuestions] = useState([]);
  const [answerText, setAnswerText] = useState("");
  const [fitResult, setFitResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const textareaRef = useRef(null);
  const [isPosting, setIsPosting] = useState(false);
  const [isCheckingFit, setIsCheckingFit] = useState(false);
  const [votingAnswerId, setVotingAnswerId] = useState(null);
  const [error, setError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [toastMessage, setToastMessage] = useState(''); // Toast state
  const [answerUnderReview, setAnswerUnderReview] = useState(false);
  const [answerRejection, setAnswerRejection] = useState(null); // { reason, guidance }
  const [isCopied, setIsCopied] = useState(false);
  const [showAnsweredBanner, setShowAnsweredBanner] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replyPosting, setReplyPosting] = useState(false);
  const [replyError, setReplyError] = useState(null);
  const isOwnQuestion =
    question && user ? Number(question.userId) === Number(user.id) : false;

  useEffect(() => {
    let isMounted = true;

    const fetchQuestion = async () => {
      setIsLoading(true);
      setError(null);

    try {
        const [questionData, similarResult] = await Promise.all([
          questionService.getSingleQuestion(questionHash),
          questionService.getSimilarQuestions(questionHash, {
            k: 5,
            threshold: 0.75,
          }),
        ]);

        if (!isMounted) return;

        setQuestion(questionData);
        setRelatedQuestions(similarResult || []);
      } catch (err) {
        if (!isMounted) return;
        setError(
          buildActionErrorMessage(
            "Loading question details",
            err,
            "Could not load question details. Please refresh and try again.",
          ),
        );
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchQuestion();

    return () => {
      isMounted = false;
    };
  }, [questionHash]);

  // Show a one-time "answered" banner to the owner: appears the first time they
  // open their answered question, then is remembered (per question) so it
  // disappears on subsequent visits.
  useEffect(() => {
    if (!question || !isOwnQuestion) return;
    if (!(question.answers || []).length) return;
    const key = `answered-banner-seen:${question.questionHash}`;
    if (localStorage.getItem(key)) return;
    setShowAnsweredBanner(true);
    localStorage.setItem(key, "1");
  }, [question, isOwnQuestion]);

// const triggerToast = msg => {
//   setToastMessage(prev => (prev === msg ? `${msg} ` : msg));
// };
//   useEffect(() => {
//      if (!toastMessage) return undefined;
//      const id = setTimeout(() => setToastMessage(''), 3000);
//      return () => clearTimeout(id);
//    }, [toastMessage]);

  const handleCheckFit = async () => {
    if (answerText.trim().length < 20) {
      setSubmitError("You need at least 20 characters before checking fit.");
      return;
    }

    setSubmitError(null);
    setIsCheckingFit(true);
    setFitResult(null);

    try {
      const result = await questionService.assessAnswerFit(
        questionHash,
        answerText.trim(),
      );

      setFitResult({
        score: result.score,
        note: result.feedback,
        level: fitLabelFromScore(result.score),
      });
    } catch (err) {
      setSubmitError(
        buildActionErrorMessage(
          "Checking draft fit",
          err,
          "Could not check draft fit. Please try again.",
        ),
      );
    } finally {
      setIsCheckingFit(false);
    }
  };

  const handleVote = async (answer) => {
    if (votingAnswerId === answer.id) return;
    setVotingAnswerId(answer.id);
    try {
      const result = answer.userHasVoted
        ? await answerService.removeVote(answer.id)
        : await answerService.addVote(answer.id);

      setQuestion(prev => ({
        ...prev,
        answers: prev.answers.map(a =>
          a.id === answer.id
            ? { ...a, voteCount: result.voteCount, userHasVoted: !a.userHasVoted }
            : a
        ),
      }));

      // A vote can change the community standings, so refresh recognition badges
      // live (without disrupting inline reply editors or other local state).
      try {
        const fresh = await questionService.getSingleQuestion(questionHash);
        const recognitionById = new Map(
          (fresh.answers || []).map((a) => [a.id, a.user?.recognition ?? null])
        );
        setQuestion((prev) => ({
          ...prev,
          answers: prev.answers.map((a) =>
            a.user
              ? { ...a, user: { ...a.user, recognition: recognitionById.get(a.id) ?? null } }
              : a
          ),
        }));
      } catch {/* badge refresh is best-effort */}
    } catch (err) {
      setSubmitError(err.message || 'Could not register vote.');
    } finally {
      setVotingAnswerId(null);
    }
  };

  // Toggle the inline reply editor for a given answer (any logged-in user).
  const handleToggleReply = (answerId) => {
    setReplyError(null);
    setReplyText("");
    setReplyingTo((prev) => (prev === answerId ? null : answerId));
  };

  const handlePostReply = async (answerId) => {
    const content = replyText.trim();
    if (content.length < 2) {
      setReplyError("Reply must be at least 2 characters.");
      return;
    }
    setReplyPosting(true);
    setReplyError(null);
    try {
      const reply = await answerService.postReply(answerId, content);
      setQuestion((prev) => ({
        ...prev,
        answers: prev.answers.map((a) =>
          a.id === answerId
            ? { ...a, replies: [...(a.replies || []), reply] }
            : a
        ),
      }));
      setReplyText("");
      setReplyingTo(null);
    } catch (err) {
      setReplyError(err.message || "Failed to post reply. Please try again.");
    } finally {
      setReplyPosting(false);
    }
  };

  const handlePostAnswer = async () => {
    if (!question) return;

    if (answerText.trim().length < 20) {
      setSubmitError("Answer content must be at least 20 characters.");
      return;
    }

    setSubmitError(null);
    setAnswerRejection(null);
    setAnswerUnderReview(false);
    setIsPosting(true);

    try {
      const createdAnswer = await questionService.postAnswer(question.id, answerText.trim());

      if (createdAnswer.flagged) {
        setAnswerUnderReview(true);
        setAnswerText('');
        setFitResult(null);
        return;
      }

      setQuestion((prev) => ({
        ...prev,
        answerCount: (prev.answerCount || 0) + 1,
        answers: [createdAnswer, ...(prev.answers || [])],
      }));
      setAnswerText("");
      setFitResult(null);
    } catch (err) {
      if (err.code === 'CONTENT_MODERATION_REJECTED') {
        setAnswerRejection({ reason: err.message, guidance: err.guidance });
      } else {
        setSubmitError(
          buildActionErrorMessage(
            "Posting your answer",
            err,
            "Could not post your answer. Please try again.",
          ),
        );
      }
    } finally {
      setIsPosting(false);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      // triggerToast("Link copied to clipboard!");
      setIsCopied(true);
    } catch (err) {
      console.error("Failed to copy link: ", err);

      try {
        const textArea = document.createElement("textarea");
        textArea.value = window.location.href;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        // triggerToast("Link copied to clipboard!");
        setIsCopied(true);
      } catch {
        // triggerToast("Could not copy link automatically.");
        console.error("Could not copy link automatically.");
      }
    }
  };
  useEffect(() => {
    if (!isCopied) return;
    const timeoutId = setTimeout(() => setIsCopied(false), 3000);
    return () => clearTimeout(timeoutId);
  }, [isCopied]);

  if (isLoading) {
    return (
      <div
        className={`${ui.pageStates__message} ${ui["pageStates__message--loading"]}`}
      >
        Loading question details...
      </div>
    );
  }

  if (error || !question) {
    return (
      <div
        className={`${ui.pageStates__message} ${ui["pageStates__message--error"]}`}
      >
        <p>{error || "Failed to load question details."}</p>
        <button
          className={styles.returnButton}
          onClick={() => navigate("/dashboard")}
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const answers = question.answers || [];

  return (
    <div className={styles.page}>
     {toastMessage && (<div className={styles.toast} role="status" aria-live="polite">{toastMessage}</div>)}
      
      <div className={styles.contentColumn}>
        <button
          className={styles.backLink}
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft size={14} />
          Back to feed
        </button>

        <section className={styles.questionCard}>
          <div className={styles.questionMeta}>
            <div className={styles.avatar}>
              {question.firstName?.[0] || "U"}
            </div>
            <div>
              <p className={styles.authorName}>
                {question.firstName} {question.lastName}
              </p>
              <p className={styles.postedAt}>
                Posted{" "}
                {question.createdAt
                  ? new Date(question.createdAt).toLocaleString([], {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : "recently"}
              </p>
            </div>
          </div>

          <h1 className={styles.questionTitle}>{question.title}</h1>
          <div className={styles.questionBody}>
            <ReactMarkdown components={markdownComponents}>{question.content}</ReactMarkdown>
          </div>
<div className={styles.questionActions}>
            <button 
              className={`${styles.secondaryAction} ${isCopied ? styles.copiedAction : ""}`} 
              onClick={handleShare}
              title="Copy the page link to share this question"
              disabled={isCopied}
            >
              {isCopied ? (
                <>
                  <Check size={14} />
                  Copied!
                </>
              ) : (
                <>
                  <Share2 size={14} />
                  Share
                </>
              )}
            </button>
            <span className={styles.answerCountPill} title="How many answers this question has">
              <MessageSquare size={14} />
              {answers.length} Answers
            </span>
          </div>
        </section>

        {showAnsweredBanner && (
          <div className={styles.answeredBanner} role="status">
            <Check size={16} />
            <span>Your question has been answered — see the replies below.</span>
            <button
              type="button"
              className={styles.answeredBannerClose}
              onClick={() => setShowAnsweredBanner(false)}
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <section className={styles.answersSection}>
          <h2 className={styles.sectionTitle}>
            Community Answers ({answers.length})
          </h2>

          {answers.length === 0 ? (
            <div className={styles.emptyAnswers}>
              <div className={styles.emptyIcon}>
                <MessageSquare size={18} />
              </div>
              <h3>Be the first to help!</h3>
              <p>
                This question is waiting for an expert like you. Share your
                knowledge and earn reputation points.
              </p>
            </div>
          ) : (
            <div className={styles.answerList}>
              {answers.map((answer) => (
                <article key={answer.id} className={styles.answerCard}>
                  <div className={styles.answerHeader}>
                    <div className={styles.answerAvatar}>
                      {(answer.user?.firstName ||
                        answer.author?.firstName)?.[0] || "U"}
                    </div>
                    <div>
                      <p className={styles.answerAuthor}>
                        {answer.user?.firstName || answer.author?.firstName}{" "}
                        {answer.user?.lastName || answer.author?.lastName}
                        {answer.user?.recognition && (
                          <span
                            className={`${styles.answerRecognition} ${styles[`answerRecognition--${recognitionTier(answer.user.recognition)}`]}`}
                            title={`${answer.user.recognition} — community vote leader`}
                            aria-label={answer.user.recognition}
                          >
                            {recognitionIcon(recognitionTier(answer.user.recognition))}
                          </span>
                        )}
                      </p>
                      <p className={styles.answerDate}>
                        {answer.createdAt
                          ? new Date(answer.createdAt).toLocaleString([], {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "Recently"}
                      </p>
                    </div>
                  </div>
                  <div className={styles.answerBody}>
                    <ReactMarkdown components={markdownComponents}>{answer.content}</ReactMarkdown>
                  </div>
                  <div className={styles.answerFooter}>
                    <button
                      type="button"
                      className={`${styles.voteButton} ${answer.userHasVoted ? styles['voteButton--active'] : ''}`}
                      onClick={() => handleVote(answer)}
                      disabled={votingAnswerId === answer.id || Number(answer.user?.id) === Number(user?.id)}
                      aria-pressed={Boolean(answer.userHasVoted)}
                      aria-label={`${answer.userHasVoted ? 'Remove upvote from' : 'Upvote'} this answer (${answer.voteCount ?? 0} ${(answer.voteCount ?? 0) === 1 ? 'vote' : 'votes'})`}
                      title={Number(answer.user?.id) === Number(user?.id) ? 'You cannot vote on your own answer' : answer.userHasVoted ? 'Remove upvote' : 'Upvote this answer'}
                    >
                      <ThumbsUp size={14} />
                      <span>{answer.voteCount ?? 0}</span>
                    </button>
                    {user && (
                      <button
                        type="button"
                        className={styles.replyToggle}
                        onClick={() => handleToggleReply(answer.id)}
                      >
                        <MessageSquare size={14} />
                        <span>Reply</span>
                      </button>
                    )}
                  </div>

                  {(answer.replies?.length > 0 || replyingTo === answer.id) && (
                    <div className={styles.replySection}>
                      {answer.replies?.length > 0 && (
                        <ul className={styles.replyList}>
                          {answer.replies.map((reply) => (
                            <li key={reply.id} className={styles.replyItem}>
                              <div className={styles.replyHeader}>
                                <span className={styles.replyAuthor}>
                                  {reply.user?.firstName} {reply.user?.lastName}
                                </span>
                                {Number(reply.user?.id) === Number(question?.userId) && (
                                  <span className={styles.replyBadge}>Author</span>
                                )}
                                <span className={styles.replyDate}>
                                  {reply.createdAt
                                    ? new Date(reply.createdAt).toLocaleDateString()
                                    : "Recently"}
                                </span>
                              </div>
                              <div className={styles.replyBody}>
                                <ReactMarkdown components={markdownComponents}>
                                  {reply.content}
                                </ReactMarkdown>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}

                      {user && replyingTo === answer.id && (
                        <div className={styles.replyForm}>
                          <textarea
                            className={styles.replyTextarea}
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Write a reply to this answer…"
                            rows={3}
                          />
                          {replyError && (
                            <p className={styles.replyError}>{replyError}</p>
                          )}
                          <div className={styles.replyActions}>
                            <button
                              type="button"
                              className={styles.replyCancel}
                              onClick={() => handleToggleReply(answer.id)}
                              disabled={replyPosting}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className={styles.replySubmit}
                              onClick={() => handlePostReply(answer.id)}
                              disabled={replyPosting}
                            >
                              {replyPosting ? "Posting…" : "Post reply"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className={styles.answerFormCard}>
          <h2 className={styles.formTitle}>Contribute an answer</h2>

          {isOwnQuestion ? (
            <div
              className={`${ui.pageStates__message} ${ui["pageStates__message--empty"]}`}
            >
              You cannot answer your own question.
            </div>
          ) : (
            <>
              {submitError && <div className={styles.errorBanner}>{submitError}</div>}

              {answerUnderReview && (
                <div className={styles.reviewBanner}>
                  <strong>Your answer is under review.</strong> It will appear here once approved by our moderation team.
                </div>
              )}

              {answerRejection && (
                <div className={styles.moderationBanner}>
                  <strong>Answer not posted.</strong> {answerRejection.reason}
                  {answerRejection.guidance && (
                    <p className={styles.moderationGuidance}>{answerRejection.guidance}</p>
                  )}
                </div>
              )}

              <div className={styles.editorShell}>
                <MarkdownToolbar
                  textareaRef={textareaRef}
                  value={answerText}
                  onChange={setAnswerText}
                  disabled={isPosting}
                >
                  <textarea
                    ref={textareaRef}
                    className={styles.textarea}
                    placeholder="Type your answer here... Use Markdown like **bold**, _italic_, `code`, [link](url)"
                    value={answerText}
                    onChange={(event) => setAnswerText(event.target.value)}
                    disabled={isPosting}
                  />
                </MarkdownToolbar>
              </div>

              <div className={styles.formFooter}>
                <div className={styles.fitArea}>
                  <button
                    type="button"
                    className={styles.fitButton}
                    onClick={handleCheckFit}
                    disabled={isCheckingFit || isPosting}
                  >
                    {isCheckingFit ? "Checking fit..." : "Check draft fit"}
                  </button>
                  <span className={styles.helperText}>
                    Relevance only. Not grading correctness. You need at least
                    20 characters.
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.postButton}
                  onClick={handlePostAnswer}
                  disabled={isPosting}
                >
                  {isPosting ? "Posting..." : "Post Your Answer"}
                </button>
              </div>

              {fitResult ? (
                <div
                  className={`${styles.fitPanel} ${styles[`fitPanel--${fitResult.level}`]}`}
                >
                  <p className={styles.fitHeading}>
                    
                   {fitResult.level.toUpperCase()} FIT
                  </p>
                  <p className={styles.fitNote}>{fitResult.note}</p>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>

      <aside className={styles.sidebar}>
        <h2 className={styles.sidebarTitle}>Related Questions</h2>
        <div className={styles.relatedList}>
          {relatedQuestions.length === 0 ? (
            <div className={styles.relatedEmpty}>No related questions yet.</div>
          ) : (
            relatedQuestions.map((item) => (
              <Link
                key={item.questionHash || item.id}
                to={`/questions/${item.questionHash || item.id}`}
                className={styles.relatedCard}
              >
                <p className={styles.relatedTitle}>{item.title}</p>
                <div className={styles.relatedMeta}>
                  <span>{item.author?.firstName || item.firstName} {item.author?.lastName || item.lastName}</span>
                  <span>
                    {item.firstName} {item.lastName}
                  </span>
                  <span>
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleString([], {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : ""}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
