import { useState, useEffect, useCallback } from 'react';
import MapView from './components/MapView';
import NewsCard from './components/NewsCard';
import LiveTV from './components/LiveTV';
import { startIngestion, invalidateCache, type MergedArticle } from './services/news';
import { t, isRTL, type Lang } from './services/i18n';

type Category = 'all' | 'military' | 'political' | 'conflicts';
type Region = 'all' | 'middleEast' | 'europe' | 'asia' | 'africa' | 'americas';

export default function App() {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem('wm-lang');
    return (saved === 'ar' || saved === 'en') ? saved : 'en';
  });
  const [articles, setArticles] = useState<MergedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [category, setCategory] = useState<Category>('all');
  const [region, setRegion] = useState<Region>('all');
  const [showLiveTV, setShowLiveTV] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // High-speed ingestion engine
  useEffect(() => {
    setLoading(true);
    setError(false);

    const stop = startIngestion(lang, (data) => {
      setArticles(data);
      setLoading(false);
      setLastUpdate(new Date());
      if (data.length === 0) setError(true);
    });

    return stop;
  }, [lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRTL(lang) ? 'rtl' : 'ltr';
    localStorage.setItem('wm-lang', lang);
  }, [lang]);

  const toggleLang = () => {
    invalidateCache();
    setLang(l => l === 'en' ? 'ar' : 'en');
  };

  const handleRetry = () => {
    invalidateCache();
    setLoading(true);
    setError(false);
    // Trigger re-mount of ingestion
    setLang(l => l);
  };

  const filtered = articles.filter(a => {
    if (category !== 'all' && a.category !== category) return false;
    if (region !== 'all' && a.region !== region) return false;
    return true;
  });

  const stats = {
    conflicts: articles.filter(a => a.category === 'conflicts').length,
    military: articles.filter(a => a.category === 'military').length,
    political: articles.filter(a => a.category === 'political').length,
    countries: new Set(articles.map(a => a.region)).size,
  };

  const categories: { key: Category; label: string }[] = [
    { key: 'all', label: t(lang, 'nav.all') },
    { key: 'military', label: t(lang, 'nav.military') },
    { key: 'political', label: t(lang, 'nav.political') },
    { key: 'conflicts', label: t(lang, 'nav.conflicts') },
  ];

  const isAr = lang === 'ar';

  return (
    <>
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="brand">
            <span className="brand-mark">W</span>
            <span className="brand-name">{t(lang, 'app.title')}</span>
          </div>
          <span className="brand-sub">{t(lang, 'app.subtitle')}</span>
        </div>
        <div className="header-right">
          {/* Live TV Button */}
          <button
            onClick={() => setShowLiveTV(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '3px 10px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444', fontSize: 11, fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'SF Mono', monospace",
              transition: 'all 150ms',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)')}
          >
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#ef4444', boxShadow: '0 0 6px #ef4444',
              animation: 'pulse-dot 1.5s infinite',
            }} />
            {isAr ? 'بث مباشر' : 'LIVE TV'}
          </button>

          <div className="live-badge">
            <span className="live-dot" />
            {t(lang, 'app.live')}
          </div>
          <button className="lang-btn" onClick={toggleLang}>
            {isAr ? 'English' : 'العربية'}
          </button>
        </div>
      </header>

      {/* Category Tabs */}
      <nav className="tabs">
        {categories.map(c => (
          <button
            key={c.key}
            className={`tab ${category === c.key ? 'active' : ''}`}
            onClick={() => setCategory(c.key)}
          >
            {c.label}
          </button>
        ))}
        <div className="tabs-right">
          <select
            className="region-select"
            value={region}
            onChange={e => setRegion(e.target.value as Region)}
          >
            <option value="all">{t(lang, 'filters.allRegions')}</option>
            <option value="middleEast">{t(lang, 'filters.middleEast')}</option>
            <option value="europe">{t(lang, 'filters.europe')}</option>
            <option value="asia">{t(lang, 'filters.asia')}</option>
            <option value="africa">{t(lang, 'filters.africa')}</option>
            <option value="americas">{t(lang, 'filters.americas')}</option>
          </select>
        </div>
      </nav>

      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-number" style={{ color: '#ef4444' }}>{stats.conflicts}</span>
          <span className="stat-label">{t(lang, 'stats.activeConflicts')}</span>
        </div>
        <div className="stat-item">
          <span className="stat-number" style={{ color: '#3b82f6' }}>{stats.military}</span>
          <span className="stat-label">{t(lang, 'stats.militaryOps')}</span>
        </div>
        <div className="stat-item">
          <span className="stat-number" style={{ color: '#a855f7' }}>{stats.political}</span>
          <span className="stat-label">{t(lang, 'stats.politicalEvents')}</span>
        </div>
        <div className="stat-item">
          <span className="stat-number" style={{ color: '#4ade80' }}>{stats.countries}</span>
          <span className="stat-label">{t(lang, 'stats.countriesTracked')}</span>
        </div>
        {lastUpdate && (
          <div className="stat-item" style={{ justifyContent: 'flex-end' }}>
            <span className="stat-label" style={{ textTransform: 'none', fontSize: 9 }}>
              {t(lang, 'app.lastUpdated')}: {lastUpdate.toLocaleTimeString(isAr ? 'ar-KW' : 'en-US')}
            </span>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="main">
        <div className="content">
          <MapView articles={filtered} lang={lang} />

          <div className="feed-panel">
            <div className="feed-header">
              <span className="feed-title">
                {category === 'all' ? t(lang, 'app.subtitle') : t(lang, `nav.${category}`)}
              </span>
              <span className="feed-count">
                {filtered.length} {isAr ? 'خبر' : 'articles'}
                {articles.length !== filtered.length && (
                  <span style={{ color: '#6b786b' }}> / {articles.length}</span>
                )}
              </span>
            </div>

            {loading ? (
              <div className="loading-container">
                <div className="loading-spinner" />
                <span className="loading-text">{t(lang, 'app.loading')}</span>
                <span style={{ fontSize: 10, color: '#6b786b', fontFamily: "'SF Mono', monospace", marginTop: 4 }}>
                  GDELT + RSS + ACLED + NewsData
                </span>
              </div>
            ) : error ? (
              <div className="error-container">
                <span className="error-text">{t(lang, 'app.error')}</span>
                <button className="retry-btn" onClick={handleRetry}>
                  {t(lang, 'app.retry')}
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="loading-container">
                <span className="loading-text">{t(lang, 'app.noResults')}</span>
              </div>
            ) : (
              <div className="feed-list">
                {filtered.map(article => (
                  <NewsCard key={article.id} article={article} lang={lang} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live TV Overlay */}
      <LiveTV lang={lang} visible={showLiveTV} onClose={() => setShowLiveTV(false)} />
    </>
  );
}
