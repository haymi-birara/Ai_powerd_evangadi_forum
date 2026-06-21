/**
 * Dashboard: forum home after login, matching the compact feed layout in the task mock.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Edit3, MessageSquareText } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getQuestions,
  searchQuestionsSemantic,
} from '../../services/question/question.service.js';
import { timeAgo } from '../../lib/utils.js';
import ui from '../../styles/pageStates.module.css';
import styles from './Dashboard.module.css';

const SEARCH_MODES = {
  KEYWORD: 'keyword',
  SEMANTIC: 'semantic',
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const semanticQuery = searchParams.get('semantic') || '';

  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const firstName = user?.firstName?.trim();
  const welcomeLine = firstName
    ? `Good to see you, ${firstName}.`
    : 'Good to see you.';

  const stats = useMemo(() => {
    const replyTotal = questions.reduce(
      (sum, question) => sum + (Number(question.answerCount) || 0),
      0,
    );
    const unansweredTotal = questions.filter(
      question => !Number(question.answerCount),
    ).length;
    const yoursTotal = questions.filter(
      question => String(question.author?.id) === String(user?.id),
    ).length;

    return [
      { label: 'Questions', value: questions.length },
      { label: 'Replies', value: replyTotal },
      { label: 'Unanswered', value: unansweredTotal },
      { label: 'Yours', value: yoursTotal },
    ];
  }, [questions, user?.id]);

  const fetchQuestions = useCallback(async (query, mode) => {
    setIsLoading(true);
    setError(null);

    try {
      if (query.trim() && mode === SEARCH_MODES.SEMANTIC) {
        const result = await searchQuestionsSemantic(query.trim());
        setQuestions(result.data);
      } else if (query.trim()) {
        const data = await getQuestions({ search: query.trim() });
        setQuestions(data);
      } else {
        const data = await getQuestions();
        setQuestions(data);
      }
    } catch (err) {
      setError(err.message);
      setQuestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const keywordQuery = searchParams.get('q') || '';
    const semanticQuery = searchParams.get('semantic') || '';
    const activeQuery = semanticQuery || keywordQuery;
    const mode = semanticQuery ? SEARCH_MODES.SEMANTIC : SEARCH_MODES.KEYWORD;

    fetchQuestions(activeQuery, mode);
  }, [searchParams, fetchQuestions]);

  const initialsFor = question => {
    const first = (question.author?.firstName || question.firstName)?.[0] || '';
    const last = (question.author?.lastName || question.lastName)?.[0] || '';
    return `${first}${last}`.trim().toUpperCase() || 'AK';
  };

  const authorNameFor = question => {
    const first = question.author?.firstName || question.firstName || '';
    const last = question.author?.lastName || question.lastName || '';
    return `${first} ${last}`.trim();
  };

  const previewFor = question => {
    const text = question.content || '';
    return text.length > 190 ? `${text.slice(0, 190)}...` : text;
  };

  const isSearchActive = Boolean(
    (searchParams.get('q') || semanticQuery).trim(),
  );
  const isAiSearchActive = Boolean(semanticQuery.trim());
  const isCompactSearchActive = isSearchActive;

  return (
    <div
      className={`${styles.dashboard} ${
        isCompactSearchActive ? styles['dashboard--aiSearch'] : ''
      }`}
    >
      {!isSearchActive && (
      <section className={styles.dashboard__homeCard}>
        <header className={styles.dashboard__intro}>
          <p className={styles.dashboard__eyebrow}>Forum home</p>
          <h2 className={styles.dashboard__welcome}>{welcomeLine}</h2>
          <p className={styles.dashboard__subtitle}>
            Start a topic, revisit your own threads, or skim the live feed.
            Search above works from any page once you are back on Home.
          </p>
        </header>

        <div className={styles.dashboard__quickLinks}>
          <button
            type='button'
            className={styles.dashboard__quickLink}
            onClick={() => navigate('/questions/ask')}
          >
            <span className={styles.dashboard__quickIcon}>
              <Edit3 size={20} aria-hidden />
            </span>
            <span>
              <strong>New question</strong>
              <small>Share context, errors, and what you already tried</small>
            </span>
          </button>

          <button
            type='button'
            className={styles.dashboard__quickLink}
            onClick={() => navigate('/my-questions')}
          >
            <span className={styles.dashboard__quickIcon}>
              <MessageSquareText size={20} aria-hidden />
            </span>
            <span>
              <strong>Your topics</strong>
              <small>Filtered list of threads you authored</small>
            </span>
          </button>

          <button
            type='button'
            className={styles.dashboard__quickLink}
            onClick={() => navigate('/rag-documents')}
          >
            <span className={styles.dashboard__quickIcon}>
              <BookOpen size={20} aria-hidden />
            </span>
            <span>
              <strong>Knowledge base</strong>
              <small>Course library, uploads, and retrieval-backed context</small>
            </span>
          </button>
        </div>

        <p className={styles.dashboard__statIntro}>
          Figures below describe the newest threads in this feed.
        </p>

        <div className={styles.dashboard__stats}>
          {stats.map(stat => (
            <article className={styles.dashboard__stat} key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </article>
          ))}
        </div>
      </section>
      )}

      <section
        className={`${styles.dashboard__feedCard} ${
          isCompactSearchActive ? styles['dashboard__feedCard--aiSearch'] : ''
        }`}
      >
        <header className={styles.dashboard__feedHeader}>
          <div>
            <h3>Discussion feed</h3>
            <p>Your threads use a slim left accent in this list.</p>
          </div>
          <button type='button' onClick={() => setSearchParams(new URLSearchParams())}>
            Newest threads
          </button>
        </header>

        {isLoading && (
          <p className={`${ui.pageStates__message} ${ui['pageStates__message--loading']}`}>
            Loading questions...
          </p>
        )}

        {!isLoading && error && (
          <p className={`${ui.pageStates__message} ${ui['pageStates__message--error']}`}>
            {error}
          </p>
        )}

        {!isLoading && !error && questions.length === 0 && (
          <p className={`${ui.pageStates__message} ${ui['pageStates__message--empty']}`}>
            No questions found. Try a different search or ask the first one.
          </p>
        )}

        {!isLoading && !error && questions.length > 0 && (
          <ul className={styles.dashboard__feed}>
            {questions.map(question => (
              <li key={question.id}>
                <article
                  className={styles.dashboard__thread}
                  onClick={() => navigate(`/questions/${question.questionHash}`)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/questions/${question.questionHash}`);
                    }
                  }}
                  role='button'
                  tabIndex={0}
                >
                  <div className={styles.dashboard__avatar}>
                    {initialsFor(question)}
                  </div>
                  <div className={styles.dashboard__threadBody}>
                    <h4>{question.title}</h4>
                    <p>{previewFor(question)}</p>
                    <div className={styles.dashboard__threadMeta}>
                      <span>{question.answerCount ?? 0} replies</span>
                      <span>{timeAgo(question.createdAt)}</span>
                      {isCompactSearchActive && authorNameFor(question) && (
                        <span>by {authorNameFor(question)}</span>
                      )}
                      {!isCompactSearchActive && typeof question.score === 'number' && (
                        <span>{Math.round(question.score * 100)}% match</span>
                      )}
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
