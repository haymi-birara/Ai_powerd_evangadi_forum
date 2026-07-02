import { X, Mail, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import styles from '../WhatsNewModal/WhatsNewModal.module.css';
import noticeStyles from '../AnswerNotice/AnswerNotice.module.css';
import modStyles from './NotificationsModal.module.css';

const DECISION_LABELS = {
  pending:  { text: 'Under review', color: '#92400e', bg: '#fef9c3' },
  approved: { text: 'Approved',      color: '#15803d', bg: '#dcfce7' },
  removed:  { text: 'Removed',       color: '#991b1b', bg: '#fee2e2' },
};
const STATUS_LABELS = {
  limited: { text: 'Your posting is limited pending review.',   color: '#92400e', bg: '#fef9c3' },
  blocked: { text: 'Your account is temporarily blocked.',      color: '#991b1b', bg: '#fee2e2' },
  removed: { text: 'Your account has been removed.',            color: '#991b1b', bg: '#fee2e2' },
};

/**
 * Notifications modal opened from the navbar envelope icon.
 *
 * Lists answers to the current user's questions. Each item links through to the
 * discussion. Closing the modal is the caller's responsibility (it marks the
 * answers as seen and clears the badge).
 *
 * @param {{ items: Array, moderation: { data: Array, standing: object|null }, onClose: () => void }} props
 */
export default function NotificationsModal({ items = [], moderation = { data: [], standing: null }, onClose }) {
  const modItems  = moderation.data     || [];
  const standing  = moderation.standing || null;
  const statusBanner = standing ? STATUS_LABELS[standing.status] : null;
  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Answers to your questions"
      onClick={onClose}
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <Mail size={20} className={styles.headerIcon} />
            <h2 className={styles.title}>Notifications</h2>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className={styles.body}>
          {/* ── Moderation standing banner (limited / blocked / removed) ── */}
          {statusBanner && (
            <div className={modStyles.standingBanner} style={{ background: statusBanner.bg, color: statusBanner.color }}>
              <ShieldAlert size={15} />
              <span>{statusBanner.text}</span>
              {standing.incidentCount > 0 && (
                <span className={modStyles.incidentBadge}>
                  {standing.incidentCount} incident{standing.incidentCount !== 1 ? 's' : ''}
                </span>
              )}
              {standing.blockedUntil && (
                <span> · Unblocked {new Date(standing.blockedUntil).toLocaleDateString()}</span>
              )}
            </div>
          )}

          {/* ── Moderation history ── */}
          {modItems.length > 0 && (
            <section className={modStyles.section}>
              <p className={modStyles.sectionTitle}>
                <ShieldAlert size={13} /> Moderation notices
                {standing && standing.incidentCount > 0 && !statusBanner && (
                  <span className={modStyles.incidentBadge} style={{ marginLeft: '0.4rem' }}>
                    {standing.incidentCount} incident{standing.incidentCount !== 1 ? 's' : ''}
                  </span>
                )}
              </p>
              <ul className={modStyles.modList}>
                {modItems.map(item => {
                  const dl = DECISION_LABELS[item.decision] || DECISION_LABELS.pending;
                  return (
                    <li key={item.flagId} className={modStyles.modItem}>
                      <div className={modStyles.modRow}>
                        <span className={modStyles.modType}>{item.postType}</span>
                        <span className={modStyles.modDecision} style={{ background: dl.bg, color: dl.color }}>
                          {dl.text}
                        </span>
                        {item.category && (
                          <span className={modStyles.modCategory}>{item.category}</span>
                        )}
                      </div>
                      {item.questionHash ? (
                        <Link to={`/questions/${item.questionHash}`} className={modStyles.modTitle} onClick={onClose}>
                          {item.contentTitle}
                        </Link>
                      ) : (
                        <p className={modStyles.modTitle}>{item.contentTitle}</p>
                      )}
                      {item.contentPreview && (
                        <p className={modStyles.modPreview}>{item.contentPreview}…</p>
                      )}
                      <p className={modStyles.modMeta}>
                        Flagged {item.flaggedAt ? new Date(item.flaggedAt).toLocaleDateString() : ''}
                        {item.reviewedAt && item.decision !== 'pending'
                          ? ` · Reviewed ${new Date(item.reviewedAt).toLocaleDateString()}`
                          : ''}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* ── Answers + votes ── */}
          {items.length === 0 && modItems.length === 0 ? (
            <p className={noticeStyles.notice__empty}>No new answers, upvotes, or moderation notices.</p>
          ) : items.length > 0 ? (
            <>
              <p className={modStyles.sectionTitle}><Mail size={13} /> Answers &amp; upvotes</p>
              <ul className={noticeStyles.notice__list}>
              {items.map((item) => (
                <li
                  key={`${item.type || 'answer'}-${item.answerId}-${item.createdAt}`}
                  className={noticeStyles.notice__item}
                >
                  <Link
                    to={`/questions/${item.questionHash}`}
                    className={noticeStyles.notice__link}
                    onClick={onClose}
                  >
                    <span className={noticeStyles.notice__question}>
                      {item.type === 'vote' ? '👍 ' : ''}
                      {item.questionTitle}
                    </span>
                    <span className={noticeStyles.notice__answer}>
                      {item.answerPreview}
                    </span>
                    {item.type === 'vote' ? (
                      <span className={noticeStyles.notice__meta}>
                        {item.voterName} upvoted your answer
                      </span>
                    ) : (
                      item.answererName && (
                        <span className={noticeStyles.notice__meta}>
                          Answered by {item.answererName}
                        </span>
                      )
                    )}
                  </Link>
                </li>
              ))}
            </ul>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
