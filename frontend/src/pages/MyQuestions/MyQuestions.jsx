import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { questionService } from '../../services/question/question.service.js';
import styles from './MyQuestions.module.css';
import ui from '../../styles/pageStates.module.css';

export default function MyQuestions() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchQuestions = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await questionService.getQuestions({ mine: true });
        setQuestions(data);
      } catch (err) {
        setError(
          err?.response?.data?.message || err?.message || 'Failed to fetch questions.',
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestions();
  }, []);

  return (
    <div className={styles.myQuestions}>
      <section className={styles.heroCard}>
        <div className={styles.heroCard__label}>YOUR WORKSPACE</div>
        <h1 className={styles.heroCard__title}>Your topics</h1>
        <p className={styles.heroCard__description}>
          Only questions you created. Open one to read answers or add follow-ups.
          Rows use the same left accent as your threads on Home.
        </p>
        <Link className={styles.heroCard__button} to='/questions/ask'>
          + New question
        </Link>
      </section>

      <section className={styles.contentCard}>
        {isLoading ? (
          <div className={`${ui.pageStates__message} ${ui['pageStates__message--loading']}`}>
            Loading your questions...
          </div>
        ) : error ? (
          <div className={`${ui.pageStates__message} ${ui['pageStates__message--error']}`}>
            {error}
          </div>
        ) : questions.length === 0 ? (
          <div className={`${ui.pageStates__message} ${ui['pageStates__message--empty']}`}>
            You have not asked any questions yet. Use Ask a Question in the sidebar to
            start.
          </div>
        ) : (
          <div className={styles.questionList}>
            {questions.map(question => (
              <Link
                key={question.question_hash || question.questionId || question.id}
                to={`/questions/${question.questionHash || question.question_hash || question.questionId || question.id}`}
                className={styles.questionCard}
              >
                <div className={styles.questionCard__accent} aria-hidden='true' />
                <div className={styles.questionCard__body}>
                  <div className={styles.questionCard__header}>
                    <h2 className={styles.questionCard__title}>{question.title}</h2>
                    <span className={styles.questionCard__tag}>YOURS</span>
                  </div>
                  <p className={styles.questionCard__meta}>
                    {question.content?.slice(0, 140)}
                    {question.content?.length > 140 ? '…' : ''}
                  </p>
                  <div className={styles.questionCard__footer}>
                    <span>
                      {question.created_at
                        ? new Date(question.created_at).toLocaleDateString()
                        : 'Created by you'}
                    </span>
                    <span>{question.answer_count ?? question.answers_count ?? '0'} replies</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
