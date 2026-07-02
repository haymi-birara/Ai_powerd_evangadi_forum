/**
 * Dashboard: forum home after login, matching the compact feed layout in the task mock.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Edit3, MessageSquareText, Sparkles, X } from 'lucide-react';
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

// Topic filters — questions carry no category column, so each thread is
// classified client-side from its title/content keywords.
//
// Balance: every topic is SCORED rather than first-match-wins. A keyword hit
// in the title counts 3 (the title states what the question is about), a hit
// in the body counts 1 (bodies ramble — "I asked AI", "semantic HTML"). The
// highest score wins; ties go to the earlier (more specific) topic. A score
// below 2 stays General, so one passing body mention never claims a thread.
// The labels mirror what people actually ask on this forum (SharePoint,
// career/training, database, AI, and hands-on web-dev questions) rather than
// the app's own tech stack. Order = specific → broad; ties go to the earlier.
const TOPIC_FILTERS = [
  { label: 'SharePoint', pattern: /sharepoint|microsoft 365|\bm365\b|power (?:apps|automate|bi)|onedrive/gi },
  { label: 'AI & RAG', pattern: /\bai\b|gemini|embeddings?\b|\brag\b|semantic search|\bvectors?\b|chatbot|\bllm\b|prompt engineering/gi },
  { label: 'Database', pattern: /\bmysql\b|\bsql\b|\bdba\b|database|\bqueries\b|\bquery\b|\bschema\b|mongodb/gi },
  { label: 'Careers & Training', pattern: /training|career|\bprograms?\b|course|bootcamp|certificat\w*|internship|interview|entry.?(?:level|position)|\bbecome\b|mentor\w*/gi },
  { label: 'Web Dev & Full-Stack', pattern: /\breact\b|\bjsx\b|useeffect|usestate|\bnode(?:\.?js)?\b|\bexpress\b|\bapi\b|\bcors\b|backend|frontend|full.?stack|web dev\w*|javascript|\bjs\b|\bhtml\b|\bcss\b|\bnpm\b|middleware|endpoint|responsive|deploy\w*|\bauth\w*|\bjwt\b|\blogin\b|password/gi },
];

const TITLE_WEIGHT = 3;
const MIN_TOPIC_SCORE = 2;

const countMatches = (text, pattern) => (text.match(pattern) || []).length;

const topicFor = question => {
  const title = question.title || '';
  const body = question.content || '';
  let bestLabel = 'General';
  let bestScore = 0;
  for (const topic of TOPIC_FILTERS) {
    const score =
      countMatches(title, topic.pattern) * TITLE_WEIGHT +
      countMatches(body, topic.pattern);
    // Strict > keeps ties on the earlier, more specific topic.
    if (score >= MIN_TOPIC_SCORE && score > bestScore) {
      bestLabel = topic.label;
      bestScore = score;
    }
  }
  return bestLabel;
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const semanticQuery = searchParams.get('semantic') || '';

  const [questions, setQuestions] = useState([]);
  const [aiAnswer, setAiAnswer] = useState(null);
  const [semanticFallback, setSemanticFallback] = useState(false);
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
    // Guard on a hydrated user first — otherwise String(user?.id) is 'undefined'
    // and would match questions whose author is also missing. Mirrors isOwnThread.
    const yoursTotal = !user?.id
      ? 0
      : questions.filter(
          // Feed list returns the author as flat `userId`; semantic search nests
          // it under `author`. Handle both shapes.
          question => String(question.author?.id ?? question.userId) === String(user.id),
        ).length;

    return [
      { label: 'Questions', value: questions.length },
      { label: 'Replies', value: replyTotal },
      { label: 'Unanswered', value: unansweredTotal },
      { label: 'Yours', value: yoursTotal },
    ];
  }, [questions, user]);

  const [activeTopic, setActiveTopic] = useState('All');

  const topicCounts = useMemo(() => {
    const counts = new Map();
    for (const question of questions) {
      const topic = topicFor(question);
      counts.set(topic, (counts.get(topic) || 0) + 1);
    }
    return counts;
  }, [questions]);

  // When the feed changes (new search, refresh) and the selected topic no
  // longer exists in it, fall back to All so the list never strands empty.
  const effectiveTopic =
    activeTopic !== 'All' && !topicCounts.has(activeTopic) ? 'All' : activeTopic;

  const visibleQuestions = useMemo(
    () =>
      effectiveTopic === 'All'
        ? questions
        : questions.filter(question => topicFor(question) === effectiveTopic),
    [questions, effectiveTopic],
  );

  const fetchQuestions = useCallback(async (query, mode) => {
    setIsLoading(true);
    setError(null);
    setAiAnswer(null);
    setSemanticFallback(false);

    try {
      if (query.trim() && mode === SEARCH_MODES.SEMANTIC) {
        const result = await searchQuestionsSemantic(query.trim());
        setQuestions(result.data);
        setAiAnswer(result.aiAnswer || null);
        setSemanticFallback(result.meta?.fallback === 'lexical');
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

  // Feed list returns the author as flat `userId`; semantic search nests it
  // under `author`. Handle both shapes.
  const isOwnThread = question => {
    if (!user?.id) return false;
    const authorId = question.author?.id ?? question.userId;
    return authorId != null && String(authorId) === String(user.id);
  };

  const isSearchActive = Boolean(
    (searchParams.get('q') || semanticQuery).trim(),
  );
  const isAiSearchActive = Boolean(semanticQuery.trim());
  const keywordQuery = searchParams.get('q') || '';
  const activeQuery = semanticQuery || keywordQuery;
  const isCompactSearchActive = isSearchActive;
  const clearSearch = () => setSearchParams(new URLSearchParams());

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
          <button
            type='button'
            onClick={() => {
              setActiveTopic('All');
              setSearchParams(new URLSearchParams());
            }}
          >
            Newest threads
          </button>
        </header>

        {!isLoading && !error && questions.length > 0 && (
          <div className={styles.topicBar}>
            {['All', ...TOPIC_FILTERS.map(topic => topic.label), 'General']
              .filter(label => label === 'All' || topicCounts.has(label))
              .map(label => (
                <button
                  key={label}
                  type='button'
                  className={`${styles.topicChip} ${
                    effectiveTopic === label ? styles['topicChip--active'] : ''
                  }`}
                  onClick={() => setActiveTopic(label)}
                >
                  {label}
                  {label !== 'All' && (
                    <span className={styles.chipCount}>{topicCounts.get(label)}</span>
                  )}
                </button>
              ))}
          </div>
        )}

        {isSearchActive && (
          <div className={styles.searchBanner}>
            {isAiSearchActive && <Sparkles size={14} />}
            <span>
              {isAiSearchActive ? 'AI Search' : 'Keyword search'} results for{' '}
              <strong>"{activeQuery}"</strong>
            </span>
            <button type='button' className={styles.clearSearchBtn} onClick={clearSearch}>
              <X size={14} /> Clear
            </button>
          </div>
        )}

        {isAiSearchActive && semanticFallback && (
          <div className={styles.fallbackNotice}>
            No exact matches found based on the Threshold — showing keyword results instead.
          </div>
        )}

        {isAiSearchActive && aiAnswer && (
          <div className={styles.aiAnswerCard}>
            <div className={styles.aiAnswerHeader}>
              <Sparkles size={16} />
              <span>AI Answer</span>
            </div>
            <p className={styles.aiAnswerText}>{aiAnswer}</p>
            <p className={styles.aiAnswerDisclaimer}>
              Generated by AI, verify details before relying on it.
            </p>
          </div>
        )}

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

        {!isLoading && !error && visibleQuestions.length > 0 && (
          <ul className={styles.dashboard__feed}>
            {visibleQuestions.map(question => (
              <li key={question.id}>
                <article
                  className={`${styles.dashboard__thread} ${
                    isOwnThread(question) ? styles.userOwnedAccentBorderCard : ''
                  }`}
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
                      <span className={styles.topicTag}>{topicFor(question)}</span>
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
