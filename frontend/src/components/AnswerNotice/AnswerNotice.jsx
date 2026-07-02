import { Link } from 'react-router-dom';
import { MessageSquare, X } from 'lucide-react';
import styles from './AnswerNotice.module.css';

/**
 * Highlighted "your question was answered" message.
 *
 * Shows the question title plus a preview of the answer for each item, and
 * links through to the discussion. Used on the Dashboard (list of unseen
 * answers) and on the Question Detail page (owner viewing their own thread).
 *
 * Props:
 *  - items: [{ answerId, questionHash, questionTitle, answerPreview, answererName, createdAt }]
 *  - heading: optional title text
 *  - onDismiss: optional handler; when provided renders a dismiss (X) button
 */
export default function AnswerNotice({ items = [], heading, onDismiss }) {
  if (!items.length) return null;

  const title =
    heading ||
    (items.length === 1
      ? 'New answer to your question'
      : `${items.length} new answers to your questions`);

  return (
    <section className={styles.notice} aria-label="Answer notifications">
      <div className={styles.notice__header}>
        <span className={styles.notice__badge}>
          <MessageSquare size={16} />
        </span>
        <h3 className={styles.notice__title}>{title}</h3>
        {onDismiss && (
          <button
            type="button"
            className={styles.notice__dismiss}
            onClick={onDismiss}
            aria-label="Dismiss notifications"
            title="Dismiss"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <ul className={styles.notice__list}>
        {items.map(item => (
          <li key={item.answerId} className={styles.notice__item}>
            <Link
              to={`/questions/${item.questionHash}`}
              className={styles.notice__link}
            >
              <span className={styles.notice__question}>{item.questionTitle}</span>
              <span className={styles.notice__answer}>{item.answerPreview}</span>
              {item.answererName && (
                <span className={styles.notice__meta}>
                  Answered by {item.answererName}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
