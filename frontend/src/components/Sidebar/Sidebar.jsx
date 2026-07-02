import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, FileText, Trophy, Settings, X, Plus, Menu, Pin, PinOff, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import styles from './Sidebar.module.css';

const ROLE_LABELS = { admin: 'Admin', evaluator: 'Evaluator', user: 'Learner' };
const roleLabel = (role) => ROLE_LABELS[role] ?? 'Learner';

const BASE_NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Home',           path: '/dashboard' },
  { icon: MessageSquare,   label: 'Your Topics',    path: '/my-questions' },
  { icon: FileText,        label: 'Knowledge Base', path: '/rag-documents' },
  { icon: Trophy,          label: 'Leaderboard',    path: '/leaderboard' },
];

export default function Sidebar({ isOpen = false, onClose, collapsed = false, pinned = false, onExpand, onCollapse, onTogglePin }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const navItems = ['admin', 'evaluator'].includes(user?.role)
    ? [...BASE_NAV_ITEMS, { icon: Settings, label: 'Admin', path: '/admin' }]
    : BASE_NAV_ITEMS;

  return (
    <aside
      className={`${styles.sidebar} ${isOpen ? styles['sidebar--open'] : ''} ${
        collapsed ? styles['sidebar--collapsed'] : ''
      }`}
    >
      <div className={styles.sidebar__header}>
        {onClose && (
          <button
            type='button'
            className={styles.sidebar__close}
            onClick={onClose}
            aria-label='Close menu'
          >
            <X size={20} />
          </button>
        )}
        {collapsed && onExpand && (
          <button
            type='button'
            className={styles.sidebar__expandToggle}
            onClick={onExpand}
            aria-label='Expand sidebar'
            title='Expand sidebar'
          >
            <Menu size={20} />
          </button>
        )}
        {!collapsed && (onTogglePin || onCollapse) && (
          <div className={styles.sidebar__headerControls}>
            {onTogglePin && (
              <button
                type='button'
                className={`${styles.sidebar__iconBtn} ${
                  pinned ? styles['sidebar__iconBtn--active'] : ''
                }`}
                onClick={onTogglePin}
                aria-label={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
                title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
              >
                {pinned ? <Pin size={16} /> : <PinOff size={16} />}
              </button>
            )}
            {onCollapse && (
              <button
                type='button'
                className={styles.sidebar__iconBtn}
                onClick={onCollapse}
                aria-label='Collapse sidebar'
                title='Collapse sidebar'
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}
        <div
          className={styles.sidebar__branding}
          onClick={() => navigate('/')}
          title='Go to Home'
          role='button'
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigate('/');
            }
          }}
        >
          <div className={styles.sidebar__logo} aria-hidden>
            <MessageSquare className={styles['sidebar__logo-icon']} size={20} />
          </div>
          <div className={styles.sidebar__brandCopy}>
            <p className={styles.sidebar__title}>Evangadi Forum</p>
            <p className={styles.sidebar__tagline}>
              Learn together. Ask with context.
            </p>
          </div>
        </div>
      </div>

      <nav className={styles.sidebar__nav} aria-label='Main navigation'>
        <p className={styles.sidebar__navLabel}>Navigate</p>
        {navItems.map(item => (
          <div key={item.path} className={styles['sidebar__nav-item-wrapper']}>
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                `${styles.sidebar__link} ${
                  isActive
                    ? styles['sidebar__link--active']
                    : styles['sidebar__link--inactive']
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    size={18}
                    className={`${styles.sidebar__icon} ${
                      isActive
                        ? styles['sidebar__icon--active']
                        : styles['sidebar__icon--inactive']
                    }`}
                  />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          </div>
        ))}
      </nav>

      <div className={styles.sidebar__footer}>
        <button
          type='button'
          onClick={() => navigate('/questions/ask')}
          className={styles.sidebar__button}
          title='New Question'
        >
          <Plus size={18} className={styles.sidebar__buttonIcon} />
          <span className={styles.sidebar__buttonText}>New Question</span>
        </button>

        <div className={styles.sidebar__user}>
          <div className={styles.sidebar__profile}>
            <div className={styles.sidebar__avatar}>
              <img
                src={
                  user?.avatar ||
                  `https://ui-avatars.com/api/?name=${
                    user?.firstName || 'User'
                  }+${user?.lastName || ''}&background=random`
                }
                alt={`${user?.firstName} ${user?.lastName}`}
                className={styles['sidebar__avatar-image']}
                referrerPolicy='no-referrer'
              />
            </div>
            <div className={styles.sidebar__info}>
              <p className={styles.sidebar__name}>
                {user?.firstName} {user?.lastName}
              </p>
              <p className={styles.sidebar__role}>{roleLabel(user?.role)}</p>
            </div>
          </div>

          <button
            type='button'
            onClick={logout}
            className={styles.sidebar__logout}
            title='Sign out'
            aria-label='Sign out'
          >
            <LogOut size={18} className={styles.sidebar__logoutIcon} />
            <span className={styles.sidebar__logoutText}>Sign out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
