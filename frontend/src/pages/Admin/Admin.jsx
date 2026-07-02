import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle, XCircle, AlertTriangle,
  ShieldCheck, User, Trash2,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Info, Send, BarChart2, Eye, RefreshCw,
} from 'lucide-react';
import { adminService } from '../../services/admin/admin.service.js';
import { useAuth } from '../../contexts/AuthContext';
import styles from './Admin.module.css';
import ui from '../../styles/pageStates.module.css';

// Tabs visible to each role
const ADMIN_TABS = [
  { key: 'metrics', label: 'Metrics'         },
  { key: 'queue',   label: 'Mod Queue'       },
  { key: 'flags',   label: 'Flag Activity'   },
  { key: 'users',   label: 'User Management' },
];
const EVALUATOR_TABS = [
  { key: 'queue', label: 'Mod Queue'     },
  { key: 'flags', label: 'Flag Activity' },
];

const ROLE_OPTIONS  = ['user', 'evaluator', 'admin'];
const USER_STATUSES = ['all', 'active', 'pending', 'blocked', 'removed'];

// Escalation levels definition shown via tooltip
const ESCALATION_LEVELS = [
  { label: '1st incident',  consequence: 'Active — no restriction, admin review only' },
  { label: '2nd incident',  consequence: 'Limited — posting restricted until reviewed' },
  { label: '3rd incident',  consequence: '1-day block' },
  { label: '4th incident',  consequence: '7-day block' },
  { label: '5th incident',  consequence: '14-day block' },
  { label: '6th incident',  consequence: '30-day block' },
  { label: '7th+ incident', consequence: 'Account permanently removed' },
];

const CATEGORY_LABELS = {
  spam: 'Spam', harassment: 'Harassment', off_topic: 'Off-topic', low_quality: 'Low quality',
};

const FLAG_FILTERS = ['all', 'pending', 'approved', 'removed'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function Avatar({ firstName, lastName, size = 'md' }) {
  return (
    <div className={`${styles.avatar} ${styles[`avatar--${size}`]}`}>
      {firstName?.[0]}{lastName?.[0]}
    </div>
  );
}

function RolePill({ role }) {
  const icons = { admin: <ShieldCheck size={11} />, evaluator: <Eye size={11} />, user: <User size={11} /> };
  return (
    <span className={`${styles.rolePill} ${styles[`rolePill--${role}`]}`}>
      {icons[role] ?? <User size={11} />} {role}
    </span>
  );
}

function EscalationTooltip() {
  const [open, setOpen] = useState(false);
  return (
    <span className={styles.escalationHelper}>
      <button type="button" className={styles.infoBtn}
        onClick={() => setOpen(v => !v)} aria-expanded={open}
        title="What does Escalate do?">
        <Info size={14} /> What does Escalate mean?
      </button>
      {open && (
        <div className={styles.escalationTooltip} role="tooltip">
          <p className={styles.escalationTooltipTitle}>Consequence by incident count</p>
          <table className={styles.escalationTable}>
            <tbody>
              {ESCALATION_LEVELS.map(l => (
                <tr key={l.label}>
                  <td className={styles.escalationLevel}>{l.label}</td>
                  <td className={styles.escalationConsequence}>{l.consequence}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={styles.escalationNote}>
            <strong>Escalate</strong> manually advances the user one incident level — use when AI scoring underestimates severity.
          </p>
        </div>
      )}
    </span>
  );
}

function Pagination({ meta, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  return (
    <div className={styles.pagination}>
      <button type="button" className={styles.pageBtn}
        onClick={() => onPage(meta.page - 1)} disabled={meta.page <= 1}>
        <ChevronLeft size={16} />
      </button>
      <span className={styles.pageLabel}>Page {meta.page} of {totalPages}</span>
      <button type="button" className={styles.pageBtn}
        onClick={() => onPage(meta.page + 1)} disabled={meta.page >= totalPages}>
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

// ── Metrics tab ───────────────────────────────────────────────────────────────
function MetricsTab({ refreshKey = 0 }) {
  const [metrics, setMetrics]     = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);

  useEffect(() => {
    (async () => {
      setIsLoading(true); setError(null);
      try { setMetrics(await adminService.getMetrics()); }
      catch (err) { setError(err.message || 'Failed to load metrics.'); }
      finally { setIsLoading(false); }
    })();
  }, [refreshKey]);

  if (isLoading) return <p className={`${ui.pageStates__message} ${ui['pageStates__message--loading']}`}>Loading metrics…</p>;
  if (error)     return <p className={`${ui.pageStates__message} ${ui['pageStates__message--error']}`}>{error}</p>;
  if (!metrics)  return null;

  const { infrastructure: infra, users } = metrics;

  return (
    <div className={styles.tabContent}>
      <section className={styles.metricsSection}>
        <h3 className={styles.metricsHeading}><BarChart2 size={16} /> User Overview</h3>
        <div className={styles.metricsGrid}>
          {[
            { value: users.total,       label: 'Total users'            },
            { value: users.active,      label: 'Active (verified)',      color: 'green'  },
            { value: users.pending,     label: 'Pending confirmation',   color: users.pending > 0 ? 'orange' : undefined },
            { value: users.newThisWeek, label: 'New this week'           },
          ].map(({ value, label, color }) => (
            <div key={label} className={`${styles.metricCard} ${color === 'orange' && value > 0 ? styles['metricCard--warn'] : ''}`}>
              <span className={`${styles.metricValue} ${color ? styles[`metricValue--${color}`] : ''}`}>{value}</span>
              <span className={styles.metricLabel}>{label}</span>
            </div>
          ))}
        </div>
        <h3 className={`${styles.metricsHeading} ${styles['metricsHeading--mt']}`}><User size={16} /> By Role</h3>
        <div className={styles.metricsGrid}>
          {[['user', 'Users'], ['evaluator', 'Evaluators'], ['admin', 'Admins']].map(([key, lbl]) => (
            <div key={key} className={styles.metricCard}>
              <span className={styles.metricValue}>{users.byRole[key] ?? 0}</span>
              <span className={styles.metricLabel}>{lbl}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={`${styles.metricsSection} ${styles['metricsSection--mt']}`}>
        <h3 className={styles.metricsHeading}><ShieldCheck size={16} /> Infrastructure</h3>
        <div className={styles.infraGrid}>
          {[
            { label: 'Gemini API key', value: infra.geminiConfigured ? '✓ Configured' : '✗ Not configured', ok: infra.geminiConfigured },
            { label: 'Active model',   value: infra.geminiModel,                                             ok: true },
            { label: 'Resend (email)', value: infra.resendConfigured ? '✓ Configured' : '✗ Not configured', ok: infra.resendConfigured },
            { label: 'Environment',    value: infra.nodeEnv,                                                  ok: true },
          ].map(({ label, value, ok }) => (
            <div key={label} className={styles.infraRow}>
              <span className={styles.infraLabel}>{label}</span>
              <span className={`${styles.infraValue} ${ok ? styles['infraValue--ok'] : styles['infraValue--warn']}`}>{value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── Mod Queue tab ─────────────────────────────────────────────────────────────
function QueueTab() {
  const [posts, setPosts]             = useState([]);
  const [meta, setMeta]               = useState({ total: 0, page: 1, limit: 20 });
  const [isLoading, setIsLoading]     = useState(true);
  const [error, setError]             = useState(null);
  const [actioningId, setActioningId] = useState(null);
  const [actionMsg, setActionMsg]     = useState(null);
  const [expandedIds, setExpandedIds] = useState(new Set());

  const fetchQueue = useCallback(async (page = 1) => {
    setIsLoading(true); setError(null);
    try {
      const result = await adminService.getQueue({ page, limit: 20 });
      setPosts(result.data || []);
      setMeta(result.meta || { total: 0, page, limit: 20 });
    } catch (err) { setError(err.message || 'Failed to load moderation queue.'); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchQueue(1); }, [fetchQueue]);

  const toggleExpand = id => setExpandedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleAction = async (flagId, action) => {
    if (actioningId === flagId) return;
    setActioningId(flagId); setActionMsg(null);
    try {
      const fn = action === 'approve' ? adminService.approvePost
               : action === 'remove'  ? adminService.removePost
               : adminService.escalatePost;
      const result = await fn(flagId);
      setActionMsg(result.message || 'Done.');
      setPosts(prev => prev.filter(p => p.flagId !== flagId));
    } catch (err) { setActionMsg(err.message || 'Action failed.'); }
    finally { setActioningId(null); }
  };

  const totalPages = Math.ceil(meta.total / meta.limit);

  return (
    <div className={styles.tabContent}>
      {actionMsg && <div className={styles.banner}>{actionMsg}</div>}
      <div className={styles.escalationHelperRow}><EscalationTooltip /></div>

      {isLoading && (
        <p className={`${ui.pageStates__message} ${ui['pageStates__message--loading']}`}>
          Loading moderation queue...
        </p>
      )}
      {!isLoading && error && (
        <p className={`${ui.pageStates__message} ${ui['pageStates__message--error']}`}>{error}</p>
      )}
      {!isLoading && !error && posts.length === 0 && (
        <div className={`${ui.pageStates__message} ${ui['pageStates__message--empty']}`}>
          No posts pending review. The queue is clear.
        </div>
      )}
      {!isLoading && !error && posts.length > 0 && (
        <>
          <p className={styles.count}>{meta.total} post{meta.total !== 1 ? 's' : ''} pending review</p>
          <div className={styles.list}>
            {posts.map(post => {
              const isExpanded = expandedIds.has(post.flagId);
              const preview  = (post.content || '').slice(0, 160);
              const hasMore  = (post.content || '').length > 160;
              return (
              <article key={post.flagId} className={styles.card} data-category={post.moderationCategory}>
                <div className={styles.cardBody}>
                  <div className={styles.cardMeta}>
                    <span className={`${styles.categoryPill} ${styles[`categoryPill--${post.moderationCategory}`]}`}>
                      {CATEGORY_LABELS[post.moderationCategory] || post.moderationCategory}
                    </span>
                    <span className={styles.postTypePill}>{post.postType}</span>
                    <span className={`${styles.metaText} ${styles['metaText--right']}`}>
                      AI score: {(post.moderationScore * 100).toFixed(0)}%
                    </span>
                    <span className={styles.metaText}>
                      {post.flaggedAt ? new Date(post.flaggedAt).toLocaleDateString() : ''}
                    </span>
                  </div>

                  <div className={styles.contentBlock}>
                    <p className={styles.content}>
                      {isExpanded ? post.content : preview}{!isExpanded && hasMore ? '…' : ''}
                    </p>
                    {hasMore && (
                      <button type="button" className={styles.expandBtn} onClick={() => toggleExpand(post.flagId)}>
                        {isExpanded ? <><ChevronUp size={13}/> Show less</> : <><ChevronDown size={13}/> Show full content</>}
                      </button>
                    )}
                  </div>
                  <p className={styles.aiReason}>{post.aiReason}</p>

                  <div className={styles.authorRow}>
                    <Avatar firstName={post.author?.firstName} lastName={post.author?.lastName} size="sm" />
                    <div>
                      <span className={styles.authorName}>
                        {post.author?.firstName} {post.author?.lastName}
                      </span>
                      <span className={styles.metaText}>
                        {' · '}{post.author?.incidentCount ?? 0} prior incident{post.author?.incidentCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={styles.cardFooter}>
                  <div className={styles.actions}>
                    <button type="button"
                      className={`${styles.actionBtn} ${styles['actionBtn--approve']}`}
                      onClick={() => handleAction(post.flagId, 'approve')}
                      disabled={actioningId === post.flagId}
                      title="Post is fine — restore it and clear this incident">
                      <CheckCircle size={14} /> Approve
                    </button>
                    <button type="button"
                      className={`${styles.actionBtn} ${styles['actionBtn--remove']}`}
                      onClick={() => handleAction(post.flagId, 'remove')}
                      disabled={actioningId === post.flagId}
                      title="Confirm removal — incident stands, consequence applied">
                      <XCircle size={14} /> Remove
                    </button>
                    <button type="button"
                      className={`${styles.actionBtn} ${styles['actionBtn--escalate']}`}
                      onClick={() => handleAction(post.flagId, 'escalate')}
                      disabled={actioningId === post.flagId}
                      title="Push user one consequence level beyond their current count">
                      <AlertTriangle size={14} /> Escalate
                    </button>
                  </div>
                </div>
              </article>
              );
            })}
          </div>
          <Pagination meta={meta} totalPages={totalPages} onPage={fetchQueue} />
        </>
      )}
    </div>
  );
}

// ── User Management tab ───────────────────────────────────────────────────────
const ROLE_DISPLAY = { user: 'Learner', evaluator: 'Evaluator', admin: 'Admin' };

function UsersTab({ onChanged }) {
  const { user: currentUser } = useAuth();
  const [users, setUsers]             = useState([]);
  const [meta, setMeta]               = useState({ total: 0, page: 1, limit: 20 });
  const [isLoading, setIsLoading]     = useState(true);
  const [error, setError]             = useState(null);
  const [togglingId, setTogglingId]   = useState(null);
  const [deletingId, setDeletingId]   = useState(null);
  const [resendingId, setResendingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [actionMsg, setActionMsg]     = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchUsers = useCallback(async (page = 1, status = statusFilter) => {
    setIsLoading(true); setError(null);
    try {
      const result = await adminService.getUsers({ page, limit: 20, status });
      setUsers(result.data || []);
      setMeta(result.meta || { total: 0, page, limit: 20 });
    } catch (err) { setError(err.message || 'Failed to load users.'); }
    finally { setIsLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchUsers(1, statusFilter); }, [statusFilter, fetchUsers]);

  const handleRoleChange = async (user, newRole) => {
    if (togglingId === user.userId) return;
    setTogglingId(user.userId); setActionMsg(null);
    try {
      await adminService.updateUserRole(user.userId, newRole);
      setUsers(prev => prev.map(u => u.userId === user.userId ? { ...u, role: newRole } : u));
      setActionMsg(`${user.firstName} ${user.lastName} role changed to "${newRole}".`);
    } catch (err) { setActionMsg(err.message || 'Role update failed.'); }
    finally { setTogglingId(null); }
  };

  const handleDelete = async (user) => {
    if (deletingId === user.userId) return;
    setDeletingId(user.userId); setConfirmDeleteId(null); setActionMsg(null);
    try {
      const result = await adminService.deleteUser(user.userId);
      setUsers(prev => prev.filter(u => u.userId !== user.userId));
      setMeta(prev => ({ ...prev, total: Math.max(0, prev.total - 1) }));
      setActionMsg(result.message || 'User removed.');
      onChanged?.();
    } catch (err) { setActionMsg(err.message || 'Delete failed.'); }
    finally { setDeletingId(null); }
  };

  const handleResend = async (user) => {
    if (resendingId === user.userId) return;
    setResendingId(user.userId); setActionMsg(null);
    try {
      const result = await adminService.resendUserConfirmation(user.userId);
      setActionMsg(result.message || `Confirmation email resent to ${user.email}.`);
    } catch (err) { setActionMsg(err.message || 'Resend failed.'); }
    finally { setResendingId(null); }
  };

  // removed always takes priority regardless of email verification state.
  const displayStatus = user =>
    user.moderationStatus === 'removed'
      ? 'removed'
      : !user.emailVerified
      ? 'pending'
      : user.moderationStatus;

  const totalPages = Math.ceil(meta.total / meta.limit);

  return (
    <div className={styles.tabContent}>
      {actionMsg && <div className={styles.banner}>{actionMsg}</div>}

      <div className={styles.filterRow}>
        {USER_STATUSES.map(s => (
          <button key={s} type="button"
            className={`${styles.filterBtn} ${statusFilter === s ? styles['filterBtn--active'] : ''}`}
            onClick={() => setStatusFilter(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {isLoading && <p className={`${ui.pageStates__message} ${ui['pageStates__message--loading']}`}>Loading users…</p>}
      {!isLoading && error && <p className={`${ui.pageStates__message} ${ui['pageStates__message--error']}`}>{error}</p>}
      {!isLoading && !error && (
        <>
          <p className={styles.count}>{meta.total} user{meta.total !== 1 ? 's' : ''}</p>
          <table className={styles.userTable}>
            <thead>
              <tr>
                <th>User</th><th>Role</th><th>Status</th>
                <th>Trust</th><th>Answers</th><th>Incidents</th>
                <th>Joined</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => {
                const status    = displayStatus(user);
                const isPending = !user.emailVerified;
                return (
                  <tr key={user.userId}
                    className={status === 'removed' ? styles.rowRemoved : isPending ? styles.rowPending : ''}>
                    <td>
                      <div className={styles.colIdentity}>
                        <Avatar firstName={user.firstName} lastName={user.lastName} size="sm" />
                        <div className={styles.identityText}>
                          <p className={styles.userName}>{user.firstName} {user.lastName}</p>
                          <p className={styles.userEmail}>{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td><RolePill role={user.role} /></td>
                    <td>
                      <span className={`${styles.statusPill} ${styles[`status--${status}`]}`}>{status}</span>
                    </td>
                    <td className={styles.statCell}>{user.trustScore}</td>
                    <td className={styles.statCell}>{user.totalAnswers}</td>
                    <td className={styles.statCell}>
                      {user.incidentCount > 0
                        ? <span className={styles.incidentChip}>{user.incidentCount}</span>
                        : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                    </td>
                    <td className={styles.statCell}>
                      {user.joinedAt ? new Date(user.joinedAt).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <div className={styles.actionCell}>
                        <select className={styles.roleSelect} value={user.role}
                          disabled={togglingId === user.userId || status === 'removed' || user.userId === currentUser?.id}
                          onChange={e => handleRoleChange(user, e.target.value)}
                          title={user.userId === currentUser?.id ? 'You cannot change your own role' : ''}
                          aria-label={`Change role for ${user.firstName}`}>
                          {ROLE_OPTIONS.map(r => <option key={r} value={r}>{ROLE_DISPLAY[r] ?? r}</option>)}
                        </select>

                        {isPending && (
                          <button type="button" className={styles.resendBtn}
                            onClick={() => handleResend(user)}
                            disabled={resendingId === user.userId}
                            title="Resend confirmation email">
                            {resendingId === user.userId
                              ? <><RefreshCw size={13} className={styles.spinning}/> Sending…</>
                              : <><Send size={13}/> Resend</>}
                          </button>
                        )}

                        {confirmDeleteId === user.userId ? (
                          <div className={styles.confirmRow}>
                            <span className={styles.confirmText}>Sure?</span>
                            <button type="button" className={`${styles.confirmBtn} ${styles['confirmBtn--yes']}`}
                              onClick={() => handleDelete(user)} disabled={deletingId === user.userId}>Yes</button>
                            <button type="button" className={`${styles.confirmBtn} ${styles['confirmBtn--no']}`}
                              onClick={() => setConfirmDeleteId(null)}>No</button>
                          </div>
                        ) : (
                          <button type="button" className={styles.deleteBtn}
                            onClick={() => setConfirmDeleteId(user.userId)}
                            disabled={status === 'removed' || user.userId === currentUser?.id}
                            title={user.userId === currentUser?.id ? 'You cannot remove your own account' : 'Remove user'}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination meta={meta} totalPages={totalPages} onPage={p => fetchUsers(p, statusFilter)} />
        </>
      )}
    </div>
  );
}

// ── Flag Activity tab ─────────────────────────────────────────────────────────
function FlagsTab() {
  const [flags, setFlags]         = useState([]);
  const [meta, setMeta]           = useState({ total: 0, page: 1, limit: 20 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);
  const [filter, setFilter]       = useState('all');
  const [expandedIds, setExpandedIds] = useState(new Set());

  const fetchFlags = useCallback(async (page = 1, status = filter) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await adminService.getFlagHistory({ page, limit: 20, status });
      setFlags(result.data || []);
      setMeta(result.meta || { total: 0, page, limit: 20 });
    } catch (err) {
      setError(err.message || 'Failed to load flag history.');
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchFlags(1, filter); }, [filter, fetchFlags]);

  const toggleExpand = id => setExpandedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const totalPages = Math.ceil(meta.total / meta.limit);

  return (
    <div className={styles.tabContent}>
      <div className={styles.filterRow}>
        {FLAG_FILTERS.map(f => (
          <button key={f} type="button"
            className={`${styles.filterBtn} ${filter === f ? styles['filterBtn--active'] : ''}`}
            onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {isLoading && (
        <p className={`${ui.pageStates__message} ${ui['pageStates__message--loading']}`}>
          Loading flag history...
        </p>
      )}
      {!isLoading && error && (
        <p className={`${ui.pageStates__message} ${ui['pageStates__message--error']}`}>{error}</p>
      )}
      {!isLoading && !error && flags.length === 0 && (
        <div className={`${ui.pageStates__message} ${ui['pageStates__message--empty']}`}>
          No flag records for this filter.
        </div>
      )}
      {!isLoading && !error && flags.length > 0 && (
        <>
          <p className={styles.count}>{meta.total} record{meta.total !== 1 ? 's' : ''}</p>
          <div className={styles.list}>
            {flags.map(flag => {
              const isExpanded = expandedIds.has(flag.flagId);
              const preview    = (flag.content || '').slice(0, 160);
              const hasMore    = (flag.content || '').length > 160;
              return (
              <div key={flag.flagId} className={styles.flagCard} data-category={flag.category} data-status={flag.status}>
                <div className={styles.cardBody}>
                  <div className={styles.cardMeta}>
                    <span className={`${styles.categoryPill} ${styles[`categoryPill--${flag.category}`]}`}>
                      {CATEGORY_LABELS[flag.category] || flag.category}
                    </span>
                    <span className={styles.postTypePill}>{flag.postType}</span>
                    <span className={`${styles.flagStatusPill} ${styles[`flagStatus--${flag.status}`]}`}>
                      {flag.status}
                    </span>
                    <span className={`${styles.metaText} ${styles['metaText--right']}`}>
                      AI: {(flag.moderationScore * 100).toFixed(0)}%
                    </span>
                    <span className={styles.metaText}>
                      {flag.flaggedAt ? new Date(flag.flaggedAt).toLocaleDateString() : ''}
                    </span>
                  </div>

                  <div className={styles.contentBlock}>
                    <p className={styles.content}>
                      {isExpanded ? flag.content : preview}{!isExpanded && hasMore ? '…' : ''}
                    </p>
                    {hasMore && (
                      <button type="button" className={styles.expandBtn} onClick={() => toggleExpand(flag.flagId)}>
                        {isExpanded ? <><ChevronUp size={13}/> Show less</> : <><ChevronDown size={13}/> Show full content</>}
                      </button>
                    )}
                  </div>
                  <p className={styles.aiReason}>{flag.aiReason}</p>
                </div>

                <div className={styles.cardFooter}>
                  <div className={styles.flagFooter}>
                    <div className={styles.authorRow}>
                      <Avatar firstName={flag.author?.firstName} lastName={flag.author?.lastName} size="sm" />
                      <span className={styles.authorName}>
                        {flag.author?.firstName} {flag.author?.lastName}
                      </span>
                      {flag.author?.incidentCount > 0 && (
                        <span className={styles.incidentChip}>
                          {flag.author.incidentCount} incident{flag.author.incidentCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {flag.reviewedBy && (
                      <span className={styles.metaText}>
                        Reviewed by {flag.reviewedBy}
                        {flag.reviewedAt
                          ? ` · ${new Date(flag.reviewedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`
                          : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
          <Pagination meta={meta} totalPages={totalPages} onPage={p => fetchFlags(p, filter)} />
        </>
      )}
    </div>
  );
}

// ── Page shell ────────────────────────────────────────────────────────────────
export default function Admin() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [metricsKey, setMetricsKey] = useState(0);
  const refreshMetrics = () => setMetricsKey(k => k + 1);

  const isAdmin     = user?.role === 'admin';
  const isEvaluator = user?.role === 'evaluator';
  const canAccess   = isAdmin || isEvaluator;

  const TABS = isAdmin ? ADMIN_TABS : EVALUATOR_TABS;
  const VALID_TABS = TABS.map(t => t.key);
  const tabParam  = searchParams.get('tab');
  const activeTab = VALID_TABS.includes(tabParam) ? tabParam : TABS[0].key;

  const setActiveTab = (key) => {
    setSearchParams({ tab: key }, { replace: true });
  };

  // Client-side role gate. The API already blocks non-admins, but without this a
  // non-admin who navigates straight to /admin would just hit repeated 403s.
  if (user && !canAccess) {
    return (
      <div className={styles.page} style={{ padding: '3rem', textAlign: 'center' }}>
        <ShieldCheck size={28} aria-hidden />
        <h2>Access required</h2>
        <p>You need admin or evaluator privileges to view this page.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.tabBar}>
        {TABS.map(tab => (
          <button key={tab.key} type="button"
            className={`${styles.tab} ${activeTab === tab.key ? styles['tab--active'] : ''}`}
            onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'metrics' && isAdmin && <MetricsTab refreshKey={metricsKey} />}
      {activeTab === 'queue'   && <QueueTab />}
      {activeTab === 'flags'   && <FlagsTab />}
      {activeTab === 'users'   && isAdmin && <UsersTab onChanged={refreshMetrics} />}
    </div>
  );
}
