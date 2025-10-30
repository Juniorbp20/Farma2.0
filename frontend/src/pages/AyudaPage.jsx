import React, { useEffect, useMemo, useRef, useState } from "react";
import { getUser } from "../services/authService";
import { tutorials } from "./tutorialsData";
import CustomYouTubePlayer from "../components/recursos/CustomYouTubePlayer";
import { gsap } from "gsap";
import "./AyudaPage.css";

function HelpMenu({ options = [], active, onSelect }) {
  return (
    <div className="help-menu d-flex justify-content-center border-bottom pb-2 mb-3">
      <div className="btn-group" role="group" aria-label="Help sections">
        {options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            className={`btn ${active === opt.key ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => onSelect(opt.key)}
          >
            {opt.icon ? <i className={`${opt.icon} me-2`} aria-hidden="true"></i> : null}
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TutorialsGrid({ items = [] }) {
  if (!items.length) {
    return <div className="text-center text-muted py-4">No hay tutoriales disponibles.</div>;
  }
  return (
    <div className="px-2 mt-2">
      <div className="row g-2">
        {items.map((item) => (
          <div key={item.id} className="col-12 col-md-6 col-lg-4">
            <div className="card h-100">
              <div className="card-body tutorial-card-body">
                <div className="ratio ratio-16x9 custom-yt-wrapper">
                  <CustomYouTubePlayer videoId={item.videoId} />
                </div>
              </div>
              <div className="px-3 pb-3">
                <div className="fw-semibold" style={{ fontSize: "0.95rem" }}>{item.title}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocsAccordion({ items = [] }) {
  if (!items.length) {
    return <div className="text-center text-muted py-4">No hay documentación disponible.</div>;
  }
  const accId = `docs-accordion`;
  return (
    <div className="accordion" id={accId}>
      {items.map((item, idx) => {
        const headerId = `${accId}-h-${item.id}`;
        const collapseId = `${accId}-c-${item.id}`;
        return (
          <div className="accordion-item" key={item.id}>
            <h2 className="accordion-header" id={headerId}>
              <button
                className={`accordion-button ${idx === 0 ? "" : "collapsed"}`}
                type="button"
                data-bs-toggle="collapse"
                data-bs-target={`#${collapseId}`}
                aria-expanded={idx === 0 ? "true" : "false"}
                aria-controls={collapseId}
              >
                {item.title}
                {item.section ? <span className="badge doc-badge ms-2">{item.section}</span> : null}
              </button>
            </h2>
            <div id={collapseId} className={`accordion-collapse collapse ${idx === 0 ? "show" : ""}`} aria-labelledby={headerId} data-bs-parent={`#${accId}`}>
              <div className="accordion-body">
                <p className="mb-0">{item.text}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SupportPanel() {
  const boxRef = useRef(null);
  useEffect(() => {
    const ctx = gsap.context(() => {
      const items = gsap.utils.toArray(".support-reason");
      gsap.from(items, { opacity: 0, y: 18, duration: 0.35, stagger: 0.06, ease: "power1.out" });
    }, boxRef);
    return () => ctx.revert();
  }, []);

  const reasons = [
    { icon: "bi-life-preserver", title: "Abrir ticket de incidencias" },
    { icon: "bi-bug", title: "Reportar errores" },
    { icon: "bi-receipt", title: "Consultas de facturación" },
    { icon: "bi-box-seam", title: "Ayuda con inventario" },
    { icon: "bi-people", title: "Gestión de usuarios y roles" },
    { icon: "bi-unlock", title: "Recuperar acceso" },
    { icon: "bi-graph-up", title: "Reportes y estadísticas" },
    { icon: "bi-lightbulb", title: "Sugerencias de mejora" },
  ];

  const whatsappHref = "https://wa.me/18296407836?text=Hola,+necesito+ayuda+con...";

  return (
    <div ref={boxRef} className="support-panel card border-0">
      <div className="card-body p-3 p-md-4 support-card-body">
        <div className="mb-3 support-heading">
          <div className="title">Centro de Soporte</div>
          <div className="tag">Estamos para ayudarte</div>
          <div className="subtitle">Motivos frecuentes de contacto y vías de asistencia.</div>
        </div>

        <div className="support-grid-wrap">
          <div className="support-reasons mb-3">
            {reasons.map((r, idx) => (
              <div key={idx} className="support-reason-col support-reason">
                <div className="reason-card gap-2">
                  <i className={`bi ${r.icon} text-primary fs-5`}></i>
                  <span className="reason-text">{r.title}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <a href={whatsappHref} target="_blank" rel="noreferrer" className="support-whatsapp-btn">
            <i className="bi bi-whatsapp" />
            Contactar por WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

function AyudaPage() {
  const [userRoleId, setUserRoleId] = useState(1);
  const [activeTab, setActiveTab] = useState("support");
  const data = tutorials;

  useEffect(() => {
    const u = getUser();
    const rid = Number(u?.rolId ?? u?.rolID ?? 1) || 1;
    setUserRoleId(rid);
  }, []);

  const roleFiltered = useMemo(() => data.filter((t) => Array.isArray(t.roleAccess) && t.roleAccess.includes(Number(userRoleId))), [data, userRoleId]);
  const videoItems = useMemo(() => roleFiltered.filter((t) => t.contentType === "video"), [roleFiltered]);
  const textItems = useMemo(() => roleFiltered.filter((t) => t.contentType === "text"), [roleFiltered]);

  const tabs = [
    { key: "video", label: "Tutoriales", icon: "bi bi-play-circle" },
    { key: "docs", label: "Documentacion", icon: "bi bi-journal-text" },
    { key: "support", label: "Soporte", icon: "bi bi-wrench-adjustable-circle" },
  ];

  return (
    <div className="container-fluid p-0">
      <HelpMenu options={tabs} active={activeTab} onSelect={setActiveTab} />
      <div className="mb-4">
        {activeTab === "video" && <TutorialsGrid items={videoItems} />}
        {activeTab === "docs" && <DocsAccordion items={textItems} />}
        {activeTab === "support" && <SupportPanel />}
      </div>
    </div>
  );
}

export default AyudaPage;

