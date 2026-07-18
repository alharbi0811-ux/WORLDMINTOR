import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { MergedArticle } from '../services/news';
import type { Lang } from '../services/i18n';
import { t } from '../services/i18n';

interface Props {
  articles: MergedArticle[];
  lang: Lang;
}

const categoryColors: Record<string, string> = {
  conflicts: '#ef4444',
  military: '#3b82f6',
  political: '#a855f7',
};

export default function MapView({ articles, lang }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [25, 45],
      zoom: 3,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
      maxZoom: 18,
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!markersRef.current) return;
    markersRef.current.clearLayers();

    const geoArticles = articles.filter(a => a.lat && a.lng);

    for (const article of geoArticles) {
      const color = categoryColors[article.category] || '#4ade80';
      const size = article.severity === 'critical' ? 14 : article.severity === 'high' ? 11 : 9;

      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:${size}px;height:${size}px;
          background:${color};
          border:2px solid ${color}40;
          border-radius:50%;
          box-shadow:0 0 ${size}px ${color}80;
        "></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([article.lat!, article.lng!], { icon });
      marker.bindPopup(`
        <div style="font-family:Inter,sans-serif;font-size:12px;max-width:220px;color:#e5e5e5;background:#141a14;padding:8px;border:1px solid #2a352a;">
          <div style="font-weight:700;margin-bottom:4px;line-height:1.3;">${article.title}</div>
          <div style="font-size:10px;color:#9ca89c;">${article.source} — ${timeAgo(article.publishedAt)}</div>
        </div>
      `, {
        className: 'wm-popup',
        closeButton: false,
      });

      markersRef.current!.addLayer(marker);
    }
  }, [articles]);

  return (
    <div className="map-container">
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <div className="map-label">
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
        <span className="map-label-text">{t(lang, 'map.title')}</span>
      </div>
      <div className="map-legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#ef4444' }} />
          <span>{t(lang, 'map.conflicts')}</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#3b82f6' }} />
          <span>{t(lang, 'map.military')}</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#a855f7' }} />
          <span>{t(lang, 'map.political')}</span>
        </div>
      </div>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
