import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { MessageSquare, ArrowLeft, Share2, Link2, Bold, Italic, Code2 } from 'lucide-react';
import { questionService } from '../../services/question/question.service.js';
import styles from './QuestionDetail.module.css';
import ui from '../../styles/pageStates.module.css';
import { useAuth } from '../../contexts/AuthContext.jsx';

const fitLabelFromScore = score => {
  if (score >= 80) return 'strong';
  if (score >= 55) return 'partial';
  return 'weak';
};

export default function QuestionDetail() {
  const { questionHash } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [question, setQuestion] = useState(null);
  const [relatedQuestions, setRelatedQuestions] = useState([]);
  const [answerText, setAnswerText] = useState('');
  const [fitResult, setFitResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [isCheckingFit, setIsCheckingFit] = useState(false);
  const [error, setError] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  const isOwnQuestion =
    question && user ? Number(question.userId) === Number(user.id) : false;

  useEffect(() => {
    let isMounted = true;

    const fetchQuestion = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [questionData, allQuestions] = await Promise.all([
          questionService.getSingleQuestion(questionHash),
          questionService.getQuestions(),
        ]);

        if (!isMounted) return;

        setQuestion(questionData);
        setRelatedQuestions(
          (allQuestions || [])
            .filter(item => item.questionHash !== questionHash)
            .slice(0, 5),
        );
      } catch (err) {
        if (!isMounted) return;
        setError(err.message || 'Failed to load question details.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchQuestion();

    return () => {
      isMounted = false;
    };
  }, [questionHash]);

  const handleCheckFit = async () => {
    if (answerText.trim().length < 20) {
      setSubmitError('You need at least 20 characters before checking fit.');
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
      setSubmitError(err.message || 'Failed to check answer fit.');
    } finally {
      setIsCheckingFit(false);
    }
  };

  const handlePostAnswer = async () => {
    if (!question) return;

    if (answerText.trim().length < 20) {
      setSubmitError('Answer content must be at least 20 characters.');
      return;
    }

    setSubmitError(null);
    setIsPosting(true);

    try {
      const createdAnswer = await questionService.postAnswer(
        question.id,
        answerText.trim(),
      );

      setQuestion(prev => ({
        ...prev,
        answerCount: (prev.answerCount || 0) + 1,
        answers: [createdAnswer, ...(prev.answers || [])],
      }));
      setAnswerText('');
      setFitResult(null);
    } catch (err) {
      setSubmitError(err.message || 'Failed to post answer. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // Ignore clipboard failures.
    }
  };

  if (isLoading) {
    return (
      <div className={`${ui.pageStates__message} ${ui['pageStates__message--loading']}`}>
        Loading question details...
      </div>
    );
  }

  if (error || !question) {
    return (
      <div className={`${ui.pageStates__message} ${ui['pageStates__message--error']}`}>
        <p>{error || 'Failed to load question details.'}</p>
        <button className={styles.returnButton} onClick={() => navigate('/dashboard')}>
          Return to Dashboard
        </button>
      </div>
    );
  }

  const answers = question.answers || [];

  return (
    <div className={styles.page}>
      <div className={styles.contentColumn}>
        <button className={styles.backLink} onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={14} />
          Back to feed
        </button>

        <section className={styles.questionCard}>
          <div className={styles.questionMeta}>
            <div className={styles.avatar}>{question.firstName?.[0] || 'U'}</div>
            <div>
              <p className={styles.authorName}>
                {question.firstName} {question.lastName}
              </p>
              <p className={styles.postedAt}>
                Posted {question.createdAt ? new Date(question.createdAt).toLocaleDateString() : 'recently'}
              </p>
            </div>
          </div>

          <h1 className={styles.questionTitle}>{question.title}</h1>
          <div className={styles.questionBody}>
            <ReactMarkdown>{question.content}</ReactMarkdown>
          </div>

          <div className={styles.questionActions}>
            <button className={styles.secondaryAction} onClick={handleShare}>
              <Share2 size={14} />
              Share
            </button>
            <span className={styles.answerCountPill}>
              <MessageSquare size={14} />
              {answers.length} Answers
            </span>
          </div>
        </section>

        <section className={styles.answersSection}>
          <h2 className={styles.sectionTitle}>Community Answers ({answers.length})</h2>

          {answers.length === 0 ? (
            <div className={styles.emptyAnswers}>
              <div className={styles.emptyIcon}>
                <MessageSquare size={18} />
              </div>
              <h3>Be the first to help!</h3>
              <p>
                This question is waiting for an expert like you. Share your knowledge and earn reputation points.
              </p>
            </div>
          ) : (
            <div className={styles.answerList}>
              {answers.map(answer => (
                <article key={answer.id} className={styles.answerCard}>
                  <div className={styles.answerHeader}>
                    <div className={styles.answerAvatar}>
                      {answer.author?.firstName?.[0] || 'U'}
                    </div>
                    <div>
                      <p className={styles.answerAuthor}>
                        {answer.author?.firstName} {answer.author?.lastName}
                      </p>
                      <p className={styles.answerDate}>
                        {answer.createdAt
                          ? new Date(answer.createdAt).toLocaleDateString()
                          : 'Recently'}
                      </p>
                    </div>
                  </div>
                  <div className={styles.answerBody}>
                    <ReactMarkdown>{answer.content}</ReactMarkdown>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className={styles.answerFormCard}>
          <h2 className={styles.formTitle}>Contribute an answer</h2>

          {isOwnQuestion ? (
            <div className={`${ui.pageStates__message} ${ui['pageStates__message--empty']}`}>
              You cannot answer your own question.
            </div>
          ) : (
            <>
              {submitError ? <div className={styles.errorBanner}>{submitError}</div> : null}

              <div className={styles.editorShell}>
                <div className={styles.toolbar}>
                  <div className={styles.toolbarButtons}>
                    <button type="button" className={styles.toolbarBtn} aria-label="Bold">
                      <Bold size={14} />
                    </button>
                    <button type="button" className={styles.toolbarBtn} aria-label="Italic">
                      <Italic size={14} />
                    </button>
                    <button type="button" className={styles.toolbarBtn} aria-label="Code">
                      <Code2 size={14} />
                    </button>
                    <button type="button" className={styles.toolbarBtn} aria-label="Link">
                      <Link2 size={14} />
                    </button>
                  </div>
                  <span className={styles.charCount}>{answerText.length} characters</span>
                </div>
                <textarea
                  className={styles.textarea}
                  placeholder="Type your answer here... You can use Markdown to format your code!"
                  value={answerText}
                  onChange={event => setAnswerText(event.target.value)}
                  disabled={isPosting}
                />
              </div>

              <div className={styles.formFooter}>
                <div className={styles.fitArea}>
                  <button
                    type="button"
                    className={styles.fitButton}
                    onClick={handleCheckFit}
                    disabled={isCheckingFit || isPosting}
                  >
                    {isCheckingFit ? 'Checking fit...' : 'Check draft fit'}
                  </button>
                  <span className={styles.helperText}>
                    Relevance only. Not grading correctness. You need at least 20 characters.
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.postButton}
                  onClick={handlePostAnswer}
                  disabled={isPosting}
                >
                  {isPosting ? 'Posting...' : 'Post Your Answer'}
                </button>
              </div>

              {fitResult ? (
                <div className={`${styles.fitPanel} ${styles[`fitPanel--${fitResult.level}`]}`}>
                  <p className={styles.fitHeading}>
                    Answer fit: {fitResult.level} ({fitResult.score}/100)
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
            relatedQuestions.map(item => (
              <Link
                key={item.questionHash || item.id}
                to={`/questions/${item.questionHash || item.id}`}
                className={styles.relatedCard}
              >
                <p className={styles.relatedTitle}>{item.title}</p>
                <div className={styles.relatedMeta}>
                  <span>{item.firstName} {item.lastName}</span>
                  <span>
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
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