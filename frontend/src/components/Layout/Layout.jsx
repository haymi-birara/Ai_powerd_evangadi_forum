import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { releasesService } from '../../services/releases/releases.service.js';
import { notificationsService } from '../../services/notifications/notifications.service.js';
import Navbar from '../Navbar/Navbar.jsx';
import Sidebar from '../Sidebar/Sidebar.jsx';
import WhatsNewModal from '../WhatsNewModal/WhatsNewModal.jsx';
import NotificationsModal from '../NotificationsModal/NotificationsModal.jsx';
import styles from './Layout.module.css';

/**
 * Authenticated shell: fixed sidebar + scrollable main column + footer.
 * Add new `pathname` branches below when you introduce more protected routes.
 */
export default function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();

  /* ── Changelog / "What's New" state ── */
  const [releases, setReleases] = useState([]);      // releases shown in the modal
  const [showModal, setShowModal] = useState(false);
  const [hasUnseen, setHasUnseen] = useState(false); // drives the navbar bell badge
  const checkedUserRef = useRef(null);               // id of the user we last ran the unseen check for

  /* ── Answer notifications state (navbar envelope) ── */
  const [answerNotices, setAnswerNotices] = useState([]);
  const [moderationNotices, setModerationNotices] = useState({ data: [], standing: null });
  const [hasUnseenAnswers, setHasUnseenAnswers] = useState(false);
  const [showAnswersModal, setShowAnswersModal] = useState(false);

  /* ── Mobile sidebar drawer ── */
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Desktop icon-rail collapse + pin. "Pinned" persists the expanded rail across
  // reloads; when unpinned the sidebar defaults to the collapsed icon rail. The
  // hamburger expands the rail for the current session (not persisted).
  const [pinned, setPinned] = useState(
    () => localStorage.getItem('sidebar-pinned') !== '0'
  );
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar-pinned') === '0'
  );

  // Hamburger (collapsed rail → expanded), session-only.
  const handleExpand = () => setCollapsed(false);

  // Close button (expanded → collapsed rail); also unpins so it stays collapsed.
  const handleCollapse = () => {
    setCollapsed(true);
    setPinned(false);
    localStorage.setItem('sidebar-pinned', '0');
  };

  // Pin toggle: locks the sidebar open (persisted). Pinning also expands it.
  const handleTogglePin = () => {
    setPinned((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar-pinned', next ? '1' : '0');
      if (next) setCollapsed(false);
      return next;
    });
  };

  // Close the mobile sidebar whenever the route changes (e.g. a nav link tap).
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Poll for unseen releases (drives the navbar bell badge) so a freshly
  // published changelog surfaces without a manual refresh. The modal auto-opens
  // only the first time unseen releases are detected for this user; later polls
  // just keep the badge in sync. Best-effort; failures are silent.
  useEffect(() => {
    if (!user) { checkedUserRef.current = null; return; }

    let active = true;
    const check = () => {
      releasesService
        .getUnseen()
        .then(({ data, count }) => {
          if (!active) return;
          if (count > 0) {
            setReleases(data);
            setHasUnseen(true);
            if (checkedUserRef.current !== user.id) {
              checkedUserRef.current = user.id;
              setShowModal(true);
            }
          } else {
            setHasUnseen(false);
          }
        })
        .catch(() => {/* non-fatal: changelog is best-effort */});
    };

    check();
    const intervalId = setInterval(check, 30000); // 30s
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [user]);

  // Poll for unseen answers to the user's questions. This only drives the navbar
  // envelope badge (the "new answers" indicator) — it does NOT touch the list
  // shown in the modal, so the list never disappears out from under the user.
  // Best-effort; failures are silent. Re-runs when the logged-in user changes.
  useEffect(() => {
    if (!user) { return; }

    let active = true;
    const check = () => {
      notificationsService
        .getUnseenCounts()
        .then(({ totalCount }) => {
          if (!active) return;
          setHasUnseenAnswers(totalCount > 0);
        })
        .catch(() => {/* non-fatal: notifications are best-effort */});
    };

    check();
    const intervalId = setInterval(check, 30000); // 30s

    // Re-check immediately when the tab regains focus / becomes visible, so a
    // notification surfaces without waiting for the next poll (no manual refresh).
    const onFocus = () => check();
    const onVisible = () => { if (!document.hidden) check(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      active = false;
      clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user]);

  // Envelope click: open the notifications modal with the recent answers + upvote
  // notices (persistent — ignores seen state). Opening clears the badge and marks
  // everything seen, but the list stays visible so the user can click through.
  const handleEnvelopeClick = async () => {
    try {
      const [answers, votes, moderation] = await Promise.allSettled([
        notificationsService.getRecentAnswers(),
        notificationsService.getRecentVotes(),
        notificationsService.getModerationNotices(),
      ]);
      const recentAnswers = answers.status === 'fulfilled' ? answers.value : [];
      const recentVotes = votes.status === 'fulfilled' ? votes.value : [];
      const merged = [...recentAnswers, ...recentVotes].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      setAnswerNotices(merged);
      if (moderation.status === 'fulfilled') setModerationNotices(moderation.value);
    } catch {/* keep whatever we have */}
    setShowAnswersModal(true);
    if (hasUnseenAnswers) {
      setHasUnseenAnswers(false);
      notificationsService.markAnswersSeen().catch(() => {});
      notificationsService.markVotesSeen().catch(() => {});
    }
  };

  const handleCloseAnswersModal = () => setShowAnswersModal(false);

  // Dismissing the auto-shown modal marks everything seen and clears the badge.
  const handleCloseModal = () => {
    setShowModal(false);
    if (hasUnseen) {
      setHasUnseen(false);
      releasesService.markSeen().catch(() => {});
    }
  };

  // Bell click: always fetch the recent-releases view (even if already seen), so
  // it doesn't reopen the narrower unseen subset that may be in state from login.
  const handleBellClick = async () => {
    try {
      const recent = await releasesService.getRecent();
      setReleases(recent);
    } catch {/* keep whatever we have */}
    setShowModal(true);
  };

  /** Navbar title: keep in sync with routes in `App.jsx`. */
  const getTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'Home';
    if (path === '/my-questions') return 'Your topics';
    if (path === '/questions/ask') return 'Ask a question';
    if (path.startsWith('/questions/')) return 'Discussion';
    if (path === '/rag-documents') return 'Knowledge base';
    if (path === '/leaderboard') return 'Leaderboard';
    if (path.startsWith('/users/') && path.endsWith('/profile')) return 'Profile';
    if (path === '/admin') return 'Admin';
    return 'Forum';
  };

  /** One-line context under the title (helps students orient on each screen). */
  const getSubtitle = () => {
    const path = location.pathname;
    if (path === '/dashboard')
      return 'Browse the feed, search by keyword, or run AI similarity search.';
    if (path === '/my-questions')
      return 'Questions you have posted. Open any thread to read replies or edit context.';
    if (path === '/questions/ask')
      return 'A clear title and reproducible steps get faster, more accurate answers.';
    if (path.startsWith('/questions/'))
      return 'Read the thread, review related topics, and reply with markdown if you can help.';
    if (path === '/rag-documents')
      return 'Private PDF library: reader, semantic search, and AI answers with citations per document.';
    if (path === '/leaderboard')
      return 'Top contributors ranked by votes received this month and all time.';
    if (path.startsWith('/users/') && path.endsWith('/profile'))
      return 'Trust score, badges, and contribution stats for this member.';
    if (path === '/admin')
      return 'Manage the moderation queue, user roles, and flag history.';
    return '';
  };

  return (
    <div className={styles.layout}>
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        pinned={pinned}
        onExpand={handleExpand}
        onCollapse={handleCollapse}
        onTogglePin={handleTogglePin}
      />
      {sidebarOpen && (
        <div
          className={styles.layout__backdrop}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <div
        className={`${styles.layout__content} ${
          collapsed ? styles['layout__content--collapsed'] : ''
        }`}
      >
        <Navbar
          title={getTitle()}
          subtitle={getSubtitle()}
          user={user}
          showSearch={location.pathname === '/dashboard'}
          hasUnseenReleases={hasUnseen}
          onBellClick={handleBellClick}
          hasUnseenAnswers={hasUnseenAnswers}
          onEnvelopeClick={handleEnvelopeClick}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className={styles.layout__main}>
          <div className={styles.layout__mainInner}>
            <Outlet />
          </div>
        </main>

        <footer className={styles.layout__footer}>
          <div className={styles['layout__footer-content']}>
            <div className={styles['layout__footer-branding']}>
              <h4 className={styles['layout__footer-title']}>Evangadi Forum</h4>
              <p className={styles['layout__footer-tagline']}>
                A practice space for technical Q&A, peer feedback, and
                AI-assisted search, built for Evangadi learners and mentors.
              </p>
              <p className={styles['layout__footer-copyright']}>
                © 2026 Evangadi Forum. For educational use.
              </p>
            </div>
            <nav className={styles['layout__footer-nav']}>
              <a href='#' className={styles['layout__footer-link']}>
                About
              </a>
              <a href='#' className={styles['layout__footer-link']}>
                Privacy
              </a>
              <a href='#' className={styles['layout__footer-link']}>
                Terms
              </a>
              <a href='#' className={styles['layout__footer-link']}>
                Contact
              </a>
            </nav>
          </div>
        </footer>
      </div>

      {showModal && (
        <WhatsNewModal releases={releases} onClose={handleCloseModal} />
      )}

      {showAnswersModal && (
        <NotificationsModal
          items={answerNotices}
          moderation={moderationNotices}
          onClose={handleCloseAnswersModal}
        />
      )}
    </div>
  );
}
