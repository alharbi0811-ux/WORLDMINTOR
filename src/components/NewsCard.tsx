import type { MergedArticle } from '../services/news';
import type { Lang } from '../services/i18n';
import { t } from '../services/i18n';
import { useState } from 'react';

interface Props {
  article: MergedArticle;
  lang: Lang;
}

export default function NewsCard({ article, lang }: Props) {
  const [expanded, setExpanded] = useState(false);
  const timeAgo = getTimeAgo(article.publishedAt, lang);
  const isAr = lang === 'ar';

  return (
    <div className="news-card" style={{ flexDirection: 'column', cursor: 'default' }}>
      <div style={{ display: 'flex', gap: 12 }}>
        {article.imageUrl && (
          <img
            className="news-card-image"
            src={article.imageUrl}
            alt=""
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        <div className="news-card-body">
          <div className="news-card-meta">
            <span className={`severity-badge severity-${article.severity}`}>
              {t(lang, `card.${article.severity}`)}
            </span>
            <span className={`category-badge category-${article.category}`}>
              {t(lang, `nav.${article.category}`)}
            </span>
            {article.mergedCount > 1 && (
              <span style={{
                padding: '1px 6px', fontSize: 9, fontWeight: 700,
                background: 'rgba(74,222,128,0.1)', color: '#4ade80',
                border: '1px solid rgba(74,222,128,0.2)',
                fontFamily: "'SF Mono', monospace",
              }}>
                {article.mergedCount} {isAr ? 'مصادر' : 'sources'}
              </span>
            )}
          </div>

          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="news-card-title"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            {article.title}
          </a>

          {article.description && article.description !== article.title && (
            <div className="news-card-desc">{article.description}</div>
          )}

          <div className="news-card-footer">
            <span className="news-source">{article.source}</span>
            <span className="news-time">{timeAgo}</span>
            {article.relatedSources.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                style={{
                  background: 'none', border: 'none', color: '#4ade80',
                  fontSize: 10, cursor: 'pointer', fontFamily: "'SF Mono', monospace",
                  padding: 0, marginInlineStart: 'auto',
                }}
              >
                {expanded
                  ? (isAr ? '▲ إخفاء' : '▲ Hide')
                  : (isAr ? `▼ ${article.relatedSources.length} مصدر آخر` : `▼ ${article.relatedSources.length} more`)
                }
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded related sources */}
      {expanded && article.relatedSources.length > 0 && (
        <div style={{
          marginTop: 8, paddingTop: 8,
          borderTop: '1px solid #1e281e',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <span style={{ fontSize: 9, color: '#6b786b', fontFamily: "'SF Mono', monospace", textTransform: 'uppercase' }}>
            {isAr ? 'تغطية من مصادر أخرى' : 'Also covered by'}
          </span>
          {article.relatedSources.map((src, i) => (
            <a
              key={i}
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 11, color: '#4ade80',
                textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#2a352a', flexShrink: 0 }} />
              {src.name}
              <span style={{ fontSize: 9, color: '#6b786b' }}>↗</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function getTimeAgo(dateStr: string, lang: Lang): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);

  if (lang === 'ar') {
    if (mins < 1) return 'الآن';
    if (mins < 60) return `${mins} د`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} س`;
    return `${Math.floor(hours / 24)} ي`;
  }

  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
