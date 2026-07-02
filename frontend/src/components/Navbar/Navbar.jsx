import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Sparkles, Bell, Mail, Menu } from 'lucide-react';
import styles from './Navbar.module.css';

/**
 * Top bar: page title, debounced text search → `/dashboard?q=…`, optional AI semantic search.
 * Search state is driven by the URL on the dashboard so bookmarks and refresh keep context.
 */
export default function Navbar({
  title,
  subtitle,
  user,
  showSearch = false,
  hasUnseenReleases = false,
  onBellClick,
  hasUnseenAnswers = false,
  onEnvelopeClick,
  onMenuClick,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const isSemanticActive =
    location.pathname === '/dashboard' && Boolean(urlParams.get('semantic')?.trim());

  // Initialize searchTerm from URL if we are already on the dashboard
  const [searchTerm, setSearchTerm] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('q') || params.get('semantic') || '';
  });

  // Keep input in sync with URL if it changes externally
  useEffect(() => {
    if (location.pathname === '/dashboard') {
      const params = new URLSearchParams(location.search);
      setSearchTerm(params.get('q') || params.get('semantic') || '');
    } else {
      setSearchTerm('');
    }
  }, [location.search, location.pathname]);

  // Debounced keyword search: updates `?q=` on the dashboard (500ms quiet period).
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      const currentParams = new URLSearchParams(location.search);
      const currentSemantic = currentParams.get('semantic') || '';

      if (currentSemantic && currentSemantic === searchTerm.trim()) {
        return;
      }

      if (searchTerm.trim() !== '') {
        navigate(`/dashboard?q=${encodeURIComponent(searchTerm)}`);
      } else if (
        location.pathname === '/dashboard' &&
        !currentParams.get('semantic')
      ) {
        navigate('/dashboard');
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, navigate, location.pathname, location.search]);

  const handleSemanticSearch = e => {
    e.preventDefault();
    if (searchTerm.trim().length >= 3) {
      navigate(`/dashboard?semantic=${encodeURIComponent(searchTerm)}`);
    }
  };

  const handleSearchSubmit = e => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/dashboard?q=${encodeURIComponent(searchTerm)}`);
    }
  };

  return (
    <header className={styles.navbar}>
      {onMenuClick && (
        <button
          type='button'
          className={styles.navbar__menu}
          onClick={onMenuClick}
          aria-label='Open menu'
        >
          <Menu size={22} />
        </button>
      )}
      <div className={styles.navbar__titleBlock}>
        <h2 className={styles.navbar__pageTitle}>{title}</h2>
        {subtitle ? (
          <p className={styles.navbar__pageSubtitle}>{subtitle}</p>
        ) : null}
      </div>

      {showSearch && <form
        className={`${styles.navbar__search} ${
          isSemanticActive ? styles['navbar__search--semantic'] : ''
        }`}
        onSubmit={handleSearchSubmit}
      >
        <div className={styles['navbar__search-icon']}>
          <Search size={16} />
        </div>
        <input
          id='search'
          type='text'
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder='Search questions by keyword…'
          className={styles['navbar__search-input']}
          aria-label='Search questions by keyword'
        />
        {searchTerm.length >= 3 && (
          <button
            type='button'
            onClick={handleSemanticSearch}
            className={styles['navbar__semantic-button']}
            title='Use AI Semantic Search'
          >
            <Sparkles size={14} />
            <span className={styles['navbar__semantic-text']}>AI Search</span>
          </button>
        )}
      </form>}

      <div className={styles.navbar__actions}>
        {user && onEnvelopeClick && (
          <button
            type='button'
            className={styles.navbar__notification}
            onClick={onEnvelopeClick}
            aria-label='Answers to your questions'
            title='Answers to your questions'
          >
            <Mail size={20} />
            {hasUnseenAnswers && <span className={styles.navbar__badge} aria-hidden="true" />}
          </button>
        )}
        {user && onBellClick && (
          <button
            type='button'
            className={styles.navbar__notification}
            onClick={onBellClick}
            aria-label="What's new"
            title="What's new"
          >
            <Bell size={20} />
            {hasUnseenReleases && <span className={styles.navbar__badge} aria-hidden="true" />}
          </button>
        )}
      </div>
    </header>
  );
}
