import React, { useEffect, useRef, useState } from "react";
import "./CustomYouTubePlayer.css";

let youTubeApiReadyPromise = null;
function ensureYouTubeAPI() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (!youTubeApiReadyPromise) {
    youTubeApiReadyPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev && prev();
        resolve();
      };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.async = true;
      document.body.appendChild(s);
    });
  }
  return youTubeApiReadyPromise;
}

function secondsToHMS(sec) {
  if (!Number.isFinite(sec)) return "0:00";
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  const pad = (n) => (n < 10 ? `0${n}` : String(n));
  if (h) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

export default function CustomYouTubePlayer({ videoId }) {
  const wrapperRef = useRef(null);
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [volume, setVolume] = useState(100);
  const intervalRef = useRef(null);
  const hideTimerRef = useRef(null);
  const [hovered, setHovered] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [everPlayed, setEverPlayed] = useState(false);
  const [showPoster, setShowPoster] = useState(true);
  const hoveredRef = useRef(false);

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const scheduleHide = (delay = 3000) => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      // Si estÃ¡ reproduciendo, ocultar siempre tras el delay
      // Si estÃ¡ pausado, ocultar solo cuando no hay hover
      if (playingRef.current) setShowControls(false);
      else if (!hoveredRef.current) setShowControls(false);
    }, delay);
  };

  useEffect(() => {
    let mounted = true;
    ensureYouTubeAPI().then(() => {
      if (!mounted || !containerRef.current) return;
      // eslint-disable-next-line no-undef
      const player = new YT.Player(containerRef.current, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          controls: 0,
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            playerRef.current = player;
            setReady(true);
            setDuration(player.getDuration() || 0);
            setVolume(player.getVolume());
          },
          onStateChange: (e) => {
            const YTState = window.YT?.PlayerState || {};
            if (e.data === YTState.PLAYING) {
              setPlaying(true);
              playingRef.current = true;
              setEverPlayed(true);
              setShowPoster(false);
              setShowControls(true);
              scheduleHide();
              if (!intervalRef.current) {
                intervalRef.current = setInterval(() => {
                  try { setCurrent(player.getCurrentTime() || 0); } catch {}
                }, 250);
              }
            } else if (e.data === YTState.ENDED) {
              setPlaying(false);
              playingRef.current = false;
              setShowControls(true);
              scheduleHide(2000);
              setShowPoster(true);
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
            } else {
              setPlaying(false);
              playingRef.current = false;
              // En pausa o buffer/ended: mostrar controles si el puntero estÃ¡ encima, en otro caso ocultar tras 3s
              if (hovered) setShowControls(true);
              else scheduleHide();
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
            }
          },
        },
      });
    });
    return () => {
      mounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      clearHideTimer();
      try { playerRef.current && playerRef.current.destroy && playerRef.current.destroy(); } catch {}
    };
  }, [videoId]);

  // Track hover via document mousemove to work over iframe and fullscreen
  useEffect(() => {
    const onMove = (e) => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      hoveredRef.current = inside;
      setHovered(inside);
      if (inside && !showPoster) {
        setShowControls(true);
        scheduleHide();
      }
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [showPoster]);

  const togglePlay = () => {
    const p = playerRef.current;
    if (!p) return;
    const YTState = window.YT?.PlayerState || {};
    const st = p.getPlayerState();
    if (st === YTState.PLAYING) p.pauseVideo();
    else p.playVideo();
  };

  const onSeek = (e) => {
    const p = playerRef.current;
    if (!p) return;
    const v = Number(e.target.value || 0);
    p.seekTo(v, true);
    setCurrent(v);
  };

  const onVol = (e) => {
    const p = playerRef.current;
    if (!p) return;
    const v = Number(e.target.value || 0);
    p.setVolume(v);
    setVolume(v);
  };

  const onFullscreen = () => {
    const el = wrapperRef.current; // wrapper que contiene video y controles
    if (!el) return;
    const doc = document;
    const isFs = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement;
    if (!isFs) {
      (el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen)?.call(el);
    } else {
      (doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen)?.call(doc);
    }
  };

  const posterUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  const onPosterClick = () => {
    const p = playerRef.current;
    setShowPoster(false);
    if (p) {
      try { p.playVideo(); } catch {}
    }
  };

  return (
    <div ref={wrapperRef} className="d-flex flex-column w-100 h-100">
      <div className="cyp-player" ref={containerRef} />
      {showPoster && (
        <button
          type="button"
          className="cyp-poster"
          style={{ backgroundImage: `url(${posterUrl})` }}
          onClick={onPosterClick}
          aria-label="Reproducir"
        >
          <span className="play">
            <i className="bi bi-play-fill fs-3" />
          </span>
        </button>
      )}
      <div className={`cyp-controls-overlay ${showControls ? "visible" : ""}`}>
        <button className="btn-icon" type="button" onClick={togglePlay} title={playing ? "Pausar" : "Reproducir"}>
          <i className={`bi ${playing ? "bi-pause-fill" : "bi-play-fill"}`} />
        </button>
        <div className="cyp-progress">
          <span className="text-muted" style={{ minWidth: 48, fontSize: "0.8rem" }}>{secondsToHMS(current)}</span>
          <input type="range" min={0} max={Math.max(1, duration)} step={1} value={Math.min(current, duration)} onChange={onSeek} />
          <span className="text-muted" style={{ minWidth: 48, fontSize: "0.8rem" }}>{secondsToHMS(duration)}</span>
        </div>
        <div className="cyp-vol-wrapper">
          <button className="btn-icon" type="button" title="Volumen">
            <i className="bi bi-volume-up text-primary" />
          </button>
          <div className="cyp-vol-pop">
            <input className="cyp-vol-vertical" type="range" min={0} max={100} step={1} value={volume} onChange={onVol} />
          </div>
        </div>
        <button className="btn-icon" type="button" onClick={onFullscreen} title="Pantalla completa">
          <i className="bi bi-arrows-fullscreen" />
        </button>
      </div>
    </div>
  );
}


