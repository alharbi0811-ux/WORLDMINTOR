import { useState, useRef, useEffect, useCallback } from 'react';
import type { Lang } from '../services/i18n';

interface LiveChannel {
  id: string;
  name: string;
  nameAr: string;
  url: string;
  logo?: string;
  category: 'news' | 'military' | 'political';
}

// Free public HLS streams for news channels
const LIVE_CHANNELS: LiveChannel[] = [
  {
    id: 'aljazeera-ar',
    name: 'Al Jazeera Arabic',
    nameAr: 'الجزيرة العربية',
    url: 'https://live-hls-web-aja.getaj.net/AJA/index.m3u8',
    category: 'news',
  },
  {
    id: 'aljazeera-en',
    name: 'Al Jazeera English',
    nameAr: 'الجزيرة الإنجليزية',
    url: 'https://live-hls-web-aje.getaj.net/AJE/index.m3u8',
    category: 'news',
  },
  {
    id: 'france24-en',
    name: 'France 24 English',
    nameAr: 'فرانس 24 إنجليزي',
    url: 'https://stream.france24.com/f24_livefr_en/stream_chq.m3u8',
    category: 'news',
  },
  {
    id: 'france24-ar',
    name: 'France 24 Arabic',
    nameAr: 'فرانس 24 عربي',
    url: 'https://stream.france24.com/f24_livefr_ar/stream_chq.m3u8',
    category: 'news',
  },
  {
    id: 'dw-en',
    name: 'DW English',
    nameAr: 'DW إنجليزي',
    url: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8',
    category: 'news',
  },
  {
    id: 'dw-ar',
    name: 'DW Arabic',
    nameAr: 'DW عربي',
    url: 'https://dwamdstream104.akamaized.net/hls/live/2015530/dwstream104/index.m3u8',
    category: 'news',
  },
  {
    id: 'rt-en',
    name: 'RT English',
    nameAr: 'RT إنجليزي',
    url: 'https://rt-glb.rttv.com/live/rtnews/playlist.m3u8',
    category: 'news',
  },
  {
    id: 'cgtn',
    name: 'CGTN',
    nameAr: 'CGTN',
    url: 'https://news.cgtn.com/resource/live/english/cgtn-news.m3u8',
    category: 'news',
  },
  {
    id: 'nhk-world',
    name: 'NHK World',
    nameAr: 'NHK وورلد',
    url: 'https://nhkworld.webcdn.stream.ne.jp/www11/nhkworld-tv/domestic/263942/live.m3u8',
    category: 'news',
  },
  {
    id: 'trt-world',
    name: 'TRT World',
    nameAr: 'TRT وورلد',
    url: 'https://tv-trtworld.medya.trt.com.tr/master.m3u8',
    category: 'news',
  },
  {
    id: 'sky-news-ar',
    name: 'Sky News Arabia',
    nameAr: 'سكاي نيوز عربية',
    url: 'https://stream.skynewsarabia.com/sna/sna.m3u8',
    category: 'news',
  },
];

interface Props {
  lang: Lang;
  visible: boolean;
  onClose: () => void;
}

export default function LiveTV({ lang, visible, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const [activeChannel, setActiveChannel] = useState<LiveChannel>(LIVE_CHANNELS[0]);
  const [status, setStatus] = useState<'loading' | 'playing' | 'error'>('loading');
  const [hlsLoaded, setHlsLoaded] = useState(false);

  // Dynamically load hls.js from CDN
  useEffect(() => {
    if ((window as any).Hls) {
      setHlsLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js';
    script.onload = () => setHlsLoaded(true);
    script.onerror = () => console.error('Failed to load HLS.js');
    document.head.appendChild(script);
  }, []);

  const loadChannel = useCallback((channel: LiveChannel) => {
    const video = videoRef.current;
    if (!video || !hlsLoaded) return;

    // Cleanup previous
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setStatus('loading');
    setActiveChannel(channel);

    const Hls = (window as any).Hls;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        maxBufferLength: 10,
        maxMaxBufferLength: 30,
      });

      hls.loadSource(channel.url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
        setStatus('playing');
      });

      hls.on(Hls.Events.ERROR, (_: any, data: any) => {
        if (data.fatal) {
          setStatus('error');
          hls.destroy();
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari)
      video.src = channel.url;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(() => {});
        setStatus('playing');
      });
      video.addEventListener('error', () => setStatus('error'));
    } else {
      setStatus('error');
    }
  }, [hlsLoaded]);

  useEffect(() => {
    if (visible && hlsLoaded) {
      loadChannel(activeChannel);
    }
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [visible, hlsLoaded]);

  if (!visible) return null;

  const isAr = lang === 'ar';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 44, padding: '0 16px',
        background: '#111611', borderBottom: '1px solid #2a352a',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#ef4444', boxShadow: '0 0 8px #ef4444',
            animation: 'pulse-dot 1.5s infinite',
          }} />
          <span style={{
            fontSize: 13, fontWeight: 700, color: '#f0f4f0',
            fontFamily: "'SF Mono', monospace",
          }}>
            {isAr ? 'البث المباشر' : 'LIVE BROADCAST'}
          </span>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: '1px solid #2a352a',
          color: '#9ca89c', fontSize: 18, padding: '2px 10px',
          cursor: 'pointer', fontFamily: 'monospace',
        }}>✕</button>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Channel list */}
        <div style={{
          width: 220, flexShrink: 0,
          background: '#0d120d', borderInlineEnd: '1px solid #2a352a',
          overflowY: 'auto',
        }}>
          <div style={{
            padding: '10px 12px', fontSize: 10, fontWeight: 700,
            color: '#6b786b', textTransform: 'uppercase',
            letterSpacing: 1, fontFamily: "'SF Mono', monospace",
          }}>
            {isAr ? 'القنوات' : 'CHANNELS'} ({LIVE_CHANNELS.length})
          </div>
          {LIVE_CHANNELS.map(ch => (
            <button
              key={ch.id}
              onClick={() => loadChannel(ch)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '10px 12px',
                background: ch.id === activeChannel.id ? '#1a221a' : 'transparent',
                border: 'none',
                borderInlineStart: ch.id === activeChannel.id ? '2px solid #4ade80' : '2px solid transparent',
                color: ch.id === activeChannel.id ? '#f0f4f0' : '#9ca89c',
                fontSize: 12, fontWeight: 600,
                cursor: 'pointer', textAlign: isAr ? 'right' : 'left',
                fontFamily: isAr ? "'IBM Plex Sans Arabic', sans-serif" : 'Inter, sans-serif',
                transition: 'all 150ms',
              }}
            >
              <span style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: ch.id === activeChannel.id ? '#4ade80' : '#2a352a',
              }} />
              {isAr ? ch.nameAr : ch.name}
            </button>
          ))}
        </div>

        {/* Video player */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#000', position: 'relative',
        }}>
          <video
            ref={videoRef}
            controls
            autoPlay
            playsInline
            style={{
              width: '100%', height: '100%',
              maxHeight: '100%', objectFit: 'contain',
              background: '#000',
            }}
          />

          {status === 'loading' && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 12,
              background: 'rgba(0,0,0,0.7)',
            }}>
              <div style={{
                width: 32, height: 32,
                border: '2px solid #2a352a', borderTopColor: '#4ade80',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <span style={{ fontSize: 12, color: '#9ca89c', fontFamily: 'monospace' }}>
                {isAr ? 'جاري التحميل...' : 'Loading stream...'}
              </span>
            </div>
          )}

          {status === 'error' && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 12,
              background: 'rgba(0,0,0,0.7)',
            }}>
              <span style={{ fontSize: 13, color: '#ef4444' }}>
                {isAr ? 'البث غير متاح حالياً' : 'Stream unavailable'}
              </span>
              <button
                onClick={() => loadChannel(activeChannel)}
                style={{
                  padding: '6px 16px', background: '#166534',
                  border: '1px solid #4ade80', color: '#4ade80',
                  fontSize: 12, cursor: 'pointer', fontFamily: 'monospace',
                }}
              >
                {isAr ? 'إعادة المحاولة' : 'Retry'}
              </button>
            </div>
          )}

          {/* Channel name overlay */}
          <div style={{
            position: 'absolute', top: 12,
            ...(isAr ? { right: 12 } : { left: 12 }),
            padding: '4px 10px',
            background: 'rgba(10,15,10,0.85)',
            border: '1px solid #2a352a',
            fontSize: 11, fontWeight: 700, color: '#f0f4f0',
            fontFamily: "'SF Mono', monospace",
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: status === 'playing' ? '#ef4444' : '#eab308',
              boxShadow: status === 'playing' ? '0 0 6px #ef4444' : 'none',
            }} />
            {isAr ? activeChannel.nameAr : activeChannel.name}
          </div>
        </div>
      </div>
    </div>
  );
}
