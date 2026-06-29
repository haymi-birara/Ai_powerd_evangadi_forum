import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import MarkdownToolbar from "../../components/common/MarkdownToolbars/MarkdownToolbars.jsx";
import { MessageSquare, ArrowLeft, Share2, ThumbsUp ,Check} from "lucide-react";
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

const fitLabelFromScore = (score) => {
  if (score >= 80) return "strong";
  if (score >= 55) return "partial";
  return "weak";
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
        setError(err.message || "Failed to load question details.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchQuestion();

    return () => {
      isMounted = false;
    };
  }, [questionHash]);

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
      setSubmitError(err.message || "Failed to check answer fit.");
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
    } catch (err) {
      setSubmitError(err.message || 'Could not register vote.');
    } finally {
      setVotingAnswerId(null);
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
        setSubmitError(err.message || 'Failed to post answer. Please try again.');
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
                  ? new Date(question.createdAt).toLocaleDateString()
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
                      </p>
                      <p className={styles.answerDate}>
                        {answer.createdAt
                          ? new Date(answer.createdAt).toLocaleDateString()
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
                  </div>
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
                   {fitResult.level} FIT
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
                      ? new Date(item.createdAt).toLocaleDateString()
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
