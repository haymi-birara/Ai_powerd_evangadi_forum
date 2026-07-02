import { useEffect, useState } from 'react';
import { Trophy, Star, Medal, Crown } from 'lucide-react';
import { leaderboardService } from '../../services/leaderboard/leaderboard.service.js';
import styles from './Leaderboard.module.css';
import ui from '../../styles/pageStates.module.css';

// Map a recognition title to a visual tier so annual honors stand out (a purple
// crown for "Champion of the Year") while monthly ranks keep their gold/silver/
// bronze styling. Mirrors the badge shown next to answer authors.
const recognitionTier = (title = '') => {
  if (/year/i.test(title)) return 'year';
  if (/champion/i.test(title)) return 'gold';
  if (/top contributor/i.test(title)) return 'silver';
  if (/rising star/i.test(title)) return 'bronze';
  return 'gold';
};

// Icon per tier, matching the rank icons: Trophy for #1 (gold), Medal for
// #2/#3 (silver/bronze), Crown for the yearly champion.
const recognitionIcon = (tier, size = 16) => {
  if (tier === 'year') return <Crown size={size} />;
  if (tier === 'gold') return <Trophy size={size} />;
  return <Medal size={size} />;
};

const TABS = [
  { key: 'monthly', label: 'This Month' },
  { key: 'lastmonth', label: 'Last Month' },
  { key: 'alltime', label: 'All Time' },
];

const RANK_ICONS = [
  <Trophy key={1} size={18} className={styles['rank--gold']} />,
  <Medal  key={2} size={18} className={styles['rank--silver']} />,
  <Medal  key={3} size={18} className={styles['rank--bronze']} />,
];

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState('monthly');
  const [monthly, setMonthly]     = useState(null);
  const [lastmonth, setLastmonth] = useState(null);
  const [alltime, setAlltime]     = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors]       = useState({});

  useEffect(() => {
    let isMounted = true;

    const fetchBoth = async () => {
      setIsLoading(true);
      setErrors({});
      // Fetch each board independently so one failing endpoint doesn't blank
      // out the whole page — a failed tab surfaces its own error instead.
      const [m, l, a] = await Promise.allSettled([
        leaderboardService.getMonthlyLeaderboard(),
        leaderboardService.getLastMonthLeaderboard(),
        leaderboardService.getAllTimeLeaderboard(),
      ]);
      if (!isMounted) return;

      const nextErrors = {};
      if (m.status === 'fulfilled') setMonthly(m.value);
      else nextErrors.monthly = m.reason?.message || 'Failed to load leaderboard.';
      if (l.status === 'fulfilled') setLastmonth(l.value);
      else nextErrors.lastmonth = l.reason?.message || 'Failed to load leaderboard.';
      if (a.status === 'fulfilled') setAlltime(a.value);
      else nextErrors.alltime = a.reason?.message || 'Failed to load leaderboard.';

      setErrors(nextErrors);
      setIsLoading(false);
    };

    fetchBoth();
    return () => { isMounted = false; };
  }, []);

  const error = errors[activeTab] ?? null;

  const entries = activeTab === 'monthly'
    ? (monthly?.data ?? [])
    : activeTab === 'lastmonth'
      ? (lastmonth?.data ?? [])
      : (alltime?.data ?? []);

  const activePeriod = activeTab === 'monthly'
    ? monthly?.period
    : activeTab === 'lastmonth'
      ? lastmonth?.period
      : null;

  const periodLabel = activePeriod
    ? (() => {
        const [year, month] = activePeriod.split('-');
        return new Date(year, Number(month) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
      })()
    : null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.tabs}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              className={`${styles.tab} ${activeTab === tab.key ? styles['tab--active'] : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {periodLabel && <p className={styles.period}>{periodLabel}</p>}
      </div>

      {isLoading && (
        <p className={`${ui.pageStates__message} ${ui['pageStates__message--loading']}`}>
          Loading leaderboard...
        </p>
      )}

      {!isLoading && error && (
        <p className={`${ui.pageStates__message} ${ui['pageStates__message--error']}`}>{error}</p>
      )}

      {!isLoading && !error && entries.length === 0 && (
        <div className={`${ui.pageStates__message} ${ui['pageStates__message--empty']}`}>
          No activity yet for this period. Start answering questions to appear here!
        </div>
      )}

      {!isLoading && !error && entries.length > 0 && (
        <div className={styles.podium}>
          {entries.map((entry, index) => (
            <article key={entry.userId} className={`${styles.card} ${styles[`card--rank${index + 1}`]}`}>
              <div className={styles.rankIcon}>{RANK_ICONS[index]}</div>
              <div className={styles.avatar}>
                {entry.firstName?.[0]}{entry.lastName?.[0]}
              </div>
              <div className={styles.info}>
                <p className={styles.name}>
                  {entry.firstName} {entry.lastName}
                  {entry.recognition && (
                    <span
                      className={`${styles.recognition} ${styles[`recognition--${recognitionTier(entry.recognition)}`]}`}
                      title={`${entry.recognition} — community vote leader`}
                      aria-label={entry.recognition}
                    >
                      {recognitionIcon(recognitionTier(entry.recognition))}
                    </span>
                  )}
                </p>
                <p className={styles.score}>
                  {activeTab === 'alltime'
                    ? `${entry.pointsThisPeriod} trust score · ${entry.answerCount} ${entry.answerCount === 1 ? 'answer' : 'answers'}`
                    : `${entry.pointsThisPeriod} pts · ${entry.answerCount} ${entry.answerCount === 1 ? 'answer' : 'answers'}`}
                </p>
              </div>
              {entry.badges?.length > 0 && (
                <div className={styles.badges}>
                  {entry.badges.map(badge => (
                    <span key={badge} className={styles.badge}>
                      <Star size={10} />
                      {badge}
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
