/**
 * Dashboard: Default home area after user login.
 * Manages stats blocks, quick-navigation cards, and real-time thread summary displays.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { questionService } from '../../services/question/question.service.js';
import { User, Clock, AlertCircle, Loader2, PenSquare, BarChart2, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const { user } = useAuth();
  const firstName = user?.firstName?.trim() || 'Learner';
  const navigate = useNavigate();
  const location = useLocation();

  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchMode, setSearchMode] = useState(null);
  const [activeQuery, setActiveQuery] = useState('');
  const [aiAnswer, setAiAnswer] = useState(null);
  const [stats, setStats] = useState({
    totalQuestions: 0,
    totalReplies: 0,
    unanswered: 0,
    userQuestions: 0
  });

  const computeStats = (list) => {
    setStats({
      totalQuestions: list.length,
      totalReplies: list.reduce((acc, q) => acc + (q.answerCount || 0), 0),
      unanswered: list.filter(q => !q.answerCount || q.answerCount === 0).length,
      userQuestions: list.filter(q => q.userId === user?.id || q.isUserOwned).length,
    });
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const semanticQuery = params.get('semantic');
    const keywordQuery = params.get('q');

    if (semanticQuery) {
      setSearchMode('semantic');
      setActiveQuery(semanticQuery);
      runSemanticSearch(semanticQuery);
    } else if (keywordQuery) {
      setSearchMode('keyword');
      setActiveQuery(keywordQuery);
      runKeywordSearch(keywordQuery);
    } else {
      setSearchMode(null);
      setActiveQuery('');
      fetchAll();
    }
  }, [location.search]);

  const fetchAll = async () => {
    setIsLoading(true);
    setError(null);
    setAiAnswer(null);
    try {
      const list = await questionService.getQuestions();
      setQuestions(list);
      computeStats(list);
    } catch (err) {
      setError(err.message || 'Failed to fetch questions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const runKeywordSearch = async (query) => {
    setIsLoading(true);
    setError(null);
    setAiAnswer(null);
    try {
      const params = new URLSearchParams(location.search);
      const keyword = (params.get('q') || '').trim();
      const semantic = (params.get('semantic') || '').trim();

      let extractedQuestions = [];

      if (semantic.length >= 3) {
        const semanticResponse = await questionService.searchQuestionsSemantic({
          query: semantic,
          k: 20,
          threshold: 0.2,
        });
        extractedQuestions = semanticResponse.data;
      } else if (keyword.length > 0) {
        extractedQuestions = await questionService.getQuestions({ search: keyword });
      } else {
        extractedQuestions = await questionService.getQuestions();
      }

      setQuestions(extractedQuestions);
      const totalQ = extractedQuestions.length;
      const totalR = extractedQuestions.reduce((acc, curr) => acc + (curr.answerCount || 0), 0);
      const unansweredQ = extractedQuestions.filter(q => !q.answerCount || q.answerCount === 0).length;
      const userQ = extractedQuestions.filter(q => q.userId === user?.id || q.isUserOwned).length;

      setStats({
        totalQuestions: totalQ,
        totalReplies: totalR,
        unanswered: unansweredQ,
        userQuestions: userQ,
      });
    } catch (err) {
      setError(err.message || 'Failed to fetch questions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [user?.id, location.search]);

  const formatTimestamp = (dateString) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Recently';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className={styles.dashboardContainer}>

      {/* BOX 1: UPPER DASHBOARD SECTION CONTAINER */}
      <div className={styles.upperDashboardCard}>
        <header className={styles.welcomeBannerContainer}>
          <span className={styles.orangeLabel}>FORUM HOME</span>
          <h1 className={styles.welcomeHeadingTitle}>Good to see you, {firstName}.</h1>
          <p className={styles.welcomeSubtitleDescription}>
            Start a topic, revisit your own threads, or skim the live feed. Search above works from any page once you are back on Home.
          </p>
        </header>

        {/* FIXED: Unified Orange Branding Matrix Icons Applied Explicitly Here */}
        <section className={styles.quickNavigationActionGrid}>
                  <button
             type="button"
             onClick={() => navigate('/questions/ask')}
             className={styles.actionNavCard}
           >
            <div className={styles.iconCircleWrapper}>
              <PenSquare size={20} />
            </div>
            <div className={styles.cardNavContentBlock}>
              <h4>New question</h4>
              <p>Share context, errors, and what you already tried</p>
            </div>
                </button>

                     <button
             type="button"
             onClick={() => navigate('/my-questions')}
             className={styles.actionNavCard}
           >
            <div className={styles.iconCircleWrapper}>
              <BarChart2 size={20} />
            </div>
            <div className={styles.cardNavContentBlock}>
              <h4>Your topics</h4>
              <p>Filtered list of threads you authored</p>
            </div>
                    </button>

                    <button
             type="button"
             onClick={() => navigate('/rag-documents')}
             className={styles.actionNavCard}
           >
            <div className={styles.iconCircleWrapper}>
              <BookOpen size={20} />
            </div>
            <div className={styles.cardNavContentBlock}>
              <h4>Knowledge base</h4>
              <p>Course library, uploads, and retrieval-backed context for threads</p>
            </div>
                  </button>
        </section>

        <section className={styles.analyticsSectionDataGroup}>
          <p className={styles.metricsMetadataDisclaimer}>
            Figures below describe the newest threads in this feed (up to 100 from the API).
          </p>
          <div className={styles.metricsLayoutRowGrid}>
            <div className={styles.metricSingleCardContainer}>
              <span className={styles.metricLabelTitleText}>Questions</span>
              <span className={styles.metricCounterValueDigit}>{stats.totalQuestions}</span>
            </div>
            <div className={styles.metricSingleCardContainer}>
              <span className={styles.metricLabelTitleText}>Replies</span>
              <span className={styles.metricCounterValueDigit}>{stats.totalReplies}</span>
            </div>
            <div className={styles.metricSingleCardContainer}>
              <span className={styles.metricLabelTitleText}>Unanswered</span>
              <span className={styles.metricCounterValueDigit}>{stats.unanswered}</span>
            </div>
            <div className={styles.metricSingleCardContainer}>
              <span className={styles.metricLabelTitleText}>Yours</span>
              <span className={styles.metricCounterValueDigit}>{stats.userQuestions}</span>
            </div>
          </div>
        </section>
      </div>

      {/* BOX 2: LOWER SECTION SPLIT INTO TWO HOOKED BOXES WITH NO GAP IN BETWEEN */}
      <div className={styles.lowerFeedContainerWrapper}>

        {/* BOX A: Header Block */}
        <div className={styles.feedHeaderBox}>
          <div className={styles.feedTitleAreaGroup}>
            <h3>Discussion feed</h3>
            <p>Your threads use a slim left accent in this list.</p>
          </div>
          <div className={styles.newestThreadsPillBadgeTag}>
            NEWEST THREADS
          </div>
        </div>

        {/* Search mode banner */}
        {searchMode && (
          <div className={styles.searchBanner}>
            {searchMode === 'semantic' ? (
              <Sparkles size={14} />
            ) : null}
            <span>
              {searchMode === 'semantic' ? 'AI Search' : 'Keyword search'} results for:{' '}
              <strong>"{activeQuery}"</strong>
            </span>
            <button type="button" className={styles.clearSearchBtn} onClick={clearSearch}>
              <X size={14} /> Clear
            </button>
          </div>
        )}

        {/* AI Answer card — shown when semantic search finds no matching questions */}
        {aiAnswer && (
          <div className={styles.aiAnswerCard}>
            <div className={styles.aiAnswerHeader}>
              <Sparkles size={16} />
              <span>AI Answer</span>
            </div>
            <p className={styles.aiAnswerText}>{aiAnswer}</p>
            <p className={styles.aiAnswerDisclaimer}>
              No related questions found. This answer was generated by AI — verify before relying on it.
            </p>
          </div>
        )}

        {/* BOX B: Content Container Block */}
        <div className={styles.feedContentContainerBox}>
          {isLoading ? (
            <div className={styles.loadingBox}>
              <Loader2 className={styles.spinner} />
              <p>{searchMode === 'semantic' ? 'Running AI search...' : 'loading recent question'}</p>
            </div>
          ) : error ? (
            <div className={styles.errorBox}>
              <AlertCircle className={styles.errorIcon} />
              <div>
                <strong>Failed to load question</strong>
                <p>{error}</p>
              </div>
            </div>
          ) : questions.length === 0 ? (
            <div className={styles.preciseEmptyDottedStateCardBox}>
              <p>
                {searchMode
                  ? `No results found for "${activeQuery}".`
                  : 'No question found.'
                }{' '}
                {!searchMode && (
                  <button
                    type="button"
                    className={styles.emptyLink}
                    onClick={() => navigate('/questions/ask')}
                  >
                    Be the first to ask!
                  </button>
                )}
              </p>
            </div>
          ) : (
            <div className={styles.questionsWrapper}>
              {questions.map((question, index) => {
                const isUserOwnedThread = question.userId === user?.id || question.isUserOwned;
                return (
                  <motion.div
                    key={question.id || index}
                    role="button"
                     tabIndex={0}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: Math.min(index * 0.03, 0.25) }}
                    onClick={() => navigate(`/questions/${question.questionHash || question.id}`)}
                     onKeyDown={e => {
                       if (e.key === 'Enter' || e.key === ' ') {
                         e.preventDefault();
                         navigate(`/questions/${question.questionHash || question.id}`);
                       }
                     }}
                    className={`${styles.card} ${isUserOwnedThread ? styles.userOwnedAccentBorderCard : ''}`}
                  >
                    <div className={styles.cardLayout}>
                      <div className={styles.mainInfo}>
                        <div className={styles.titleRowFlexGroup}>
                          <h4 className={styles.cardTitle}>{question.title}</h4>
                          {isUserOwnedThread && <span className={styles.yoursAccentPillBadgeTag}>YOURS</span>}
                          {searchMode === 'semantic' && question.score != null && (
                            <span className={styles.scoreTag}>
                              {Math.round(question.score * 100)}% match
                            </span>
                          )}
                        </div>
                        <p className={styles.cardContent}>{question.content}</p>

                        <div className={styles.metaRow}>
                          <div className={styles.authorTag}>
                            <User size={12} />
                            <span className={styles.authorName}>
                              {question.firstName || question.author?.firstName}{' '}
                              {question.lastName || question.author?.lastName}
                            </span>
                          </div>
                          <div className={styles.timeTag}>
                            <Clock size={12} />
                            <span>{formatTimestamp(question.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      <div className={styles.statBadge}>
                        <span className={styles.statNum}>{question.answerCount || 0}</span>
                        <span className={styles.statLabel}>
                          {question.answerCount === 1 ? 'answer' : 'answers'}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
