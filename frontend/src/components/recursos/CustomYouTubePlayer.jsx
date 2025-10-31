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
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
  const [duration, setDuration] = useState(0);
  const durationRef = useRef(0);
  const [current, setCurrent] = useState(0);
  const [volume, setVolume] = useState(100);
  const intervalRef = useRef(null);
  const hideTimerRef = useRef(null);
  const [hovered, setHovered] = useState(false);
  const [showControls, setShowControls] = useState(false);
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
          fs: 0,
          disablekb: 1,
        },
        events: {
          onReady: () => {
            playerRef.current = player;
            const d = player.getDuration() || 0;
            durationRef.current = d;
            setDuration(d);
            setVolume(player.getVolume());
          },
          onStateChange: (e) => {
            const YTState = window.YT?.PlayerState || {};
            const scheduleHideLocal = (delay = 3000) => {
              if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
              hideTimerRef.current = setTimeout(() => {
                if (playingRef.current) setShowControls(false);
                else if (!hoveredRef.current) setShowControls(false);
              }, delay);
            };
            if (e.data === YTState.PLAYING) {
              setPlaying(true);
              playingRef.current = true;
              setShowPoster(false);
              setShowControls(true);
              scheduleHideLocal();
              if (!intervalRef.current) {
                intervalRef.current = setInterval(() => {
                  try {
                    const d = player.getDuration() || 0;
                    const t = player.getCurrentTime() || 0;
                    // Evitar pantalla de recomendaciones: pausar y volver al inicio
                    if (d && t >= d - 0.35) {
                      try {
                        player.pauseVideo();
                        player.seekTo(0, true);
                      } catch {}
                      setPlaying(false);
                      playingRef.current = false;
                      setShowControls(true);
                      scheduleHideLocal(2000);
                      setShowPoster(true);
                      clearInterval(intervalRef.current);
                      intervalRef.current = null;
                      return;
                    }
                    setCurrent(t);
                    // Refrescar duración si cambia en runtime
                    if (d && d !== durationRef.current) {
                      durationRef.current = d;
                      setDuration(d);
                    }
                  } catch {}
                }, 250);
              }
            } else if (e.data === YTState.ENDED) {
              setPlaying(false);
              playingRef.current = false;
              setShowControls(true);
              scheduleHideLocal(2000);
              setShowPoster(true);
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
            } else {
              setPlaying(false);
              playingRef.current = false;
              // En pausa o buffer/ended: mostrar controles si el puntero estÃ¡ encima, en otro caso ocultar tras 3s
              if (hoveredRef.current) setShowControls(true);
              else scheduleHideLocal();
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

  // Detectar movimiento del mouse sobre el área del reproductor, incluso en fullscreen,
  // usando una capa transparente superpuesta en lugar de depender de eventos sobre el iframe.
  const onHoverMove = () => {
    hoveredRef.current = true;
    setHovered(true);
    if (!showPoster) {
      setShowControls(true);
      scheduleHide();
    }
  };
  const onHoverLeave = () => {
    hoveredRef.current = false;
    setHovered(false);
  };

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

  // Al entrar/salir de fullscreen, mostrar controles inicialmente
  useEffect(() => {
    const onFs = () => {
      setShowControls(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        if (playingRef.current) setShowControls(false);
        else if (!hoveredRef.current) setShowControls(false);
      }, 3000);
    };
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
    document.addEventListener('mozfullscreenchange', onFs);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('webkitfullscreenchange', onFs);
      document.removeEventListener('mozfullscreenchange', onFs);
    };
  }, []);

  return (
    <div ref={wrapperRef} className="d-flex flex-column w-100 h-100">
      <div className="cyp-player" ref={containerRef} />
      {/* Superficie transparente para capturar movimiento del mouse (incluye fullscreen) */}
      <div
        className="cyp-hover-surface"
        onMouseMove={onHoverMove}
        onMouseEnter={onHoverMove}
        onMouseLeave={onHoverLeave}
      />
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
      <div
        className={`cyp-controls-overlay ${showControls ? "visible" : ""}`}
        onMouseMove={onHoverMove}
        onMouseEnter={onHoverMove}
      >
        <button className="btn-icon" type="button" onClick={togglePlay} title={playing ? "Pausar" : "Reproducir"}>
          <i className={`bi ${playing ? "bi-pause-fill" : "bi-play-fill"}`} />
        </button>
        <div className="cyp-progress">
          <span className="text-muted" style={{ minWidth: 110, fontSize: "0.8rem" }}>
            {secondsToHMS(current)} / {secondsToHMS(duration)}
          </span>
          <input type="range" min={0} max={Math.max(1, duration)} step={1} value={Math.min(current, duration)} onChange={onSeek} />
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


