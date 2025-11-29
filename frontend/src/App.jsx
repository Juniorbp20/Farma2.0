import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import ClientesPage from "./pages/ClientesPage";
import UsersPage from "./pages/UsersPage";
import HomePage from "./pages/HomePage";
import PuntoVentaPage from "./pages/PuntoVentaPage";
import InventarioPage from "./pages/InventarioPage";
import ProductosPage from "./pages/ProductosPage";
import ProveedoresPage from "./pages/ProveedoresPage";
import LoginPage from "./pages/LoginPage";
import ReportsPage from "./pages/ReportsPage";
import CustomButton from "./components/recursos/CustomButton";
import AyudaModal from "./components/AyudaModal";
import ConfigModal from "./components/ConfigModal";
import { getToken, getUser, logout } from "./services/authService";
import { getParametrosSistema } from "./services/configService";
import { resolveLogoSrc } from "./utils/logo";
import { buildPermissions } from "./utils/permissions";



function App() {
  const [user, setUser] = useState(null);
  const [userReady, setUserReady] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState(
    () => sessionStorage.getItem('currencySymbol') || 'RD$'
  );

  const [view, setView] = useState(() => {
    const savedView = sessionStorage.getItem("lastView");
    return savedView || "home";
  });

  const [orientationBlocked, setOrientationBlocked] = useState(false);
  const [ayudaAbierto, setAyudaAbierto] = useState(false);
  const [inventoryInitialTab, setInventoryInitialTab] = useState('resumen');
  const [configAbierto, setConfigAbierto] = useState(false);
  const [logoPath, setLogoPath] = useState(
    () => sessionStorage.getItem('logoPath') || ""
  );
  useEffect(() => {
    const storedTitle = sessionStorage.getItem("appTitle");
    if (storedTitle) document.title = storedTitle;
  }, []);

  useEffect(() => {
    const token = getToken();
    const u = getUser();
    if (token && u) setUser(u);
    getParametrosSistema()
      .then((data) => {
        if (data?.logoPath) {
          setLogoPath(data.logoPath);
          sessionStorage.setItem("logoPath", data.logoPath);
        }
        if (data?.monedaSimbolo) {
          setCurrencySymbol(data.monedaSimbolo);
          sessionStorage.setItem("currencySymbol", data.monedaSimbolo);
        }
        if (data?.nombreEmpresa) {
          document.title = data.nombreEmpresa;
        }
      })
      .catch(() => {
        const stored = sessionStorage.getItem("logoPath");
        if (stored) setLogoPath(stored);
        const storedSymbol = sessionStorage.getItem("currencySymbol");
        if (storedSymbol) setCurrencySymbol(storedSymbol);
        const storedTitle = sessionStorage.getItem("appTitle");
        if (storedTitle) document.title = storedTitle;
      })
      .finally(() => {
        setUserReady(true);
      });
  }, []);

  useEffect(() => {
    sessionStorage.setItem("lastView", view);
  }, [view]);

  const ORIENTATION_MARGIN_PX = 200;
  const perms = useMemo(() => buildPermissions(user || {}), [user]);
  const roleId = perms.roleId;
  const roleBadgeClass = (() => {
    switch (roleId) {
      case 1:
        return "role-nav-admin";
      case 2:
        return "role-nav-cashier";
      case 3:
        return "role-nav-pharma";
      case 4:
        return "role-nav-inventory";
      default:
        return "";
    }
  })();
  useEffect(() => {
    const checkOrientation = () => {
      const blocked = window.innerWidth < (window.innerHeight + ORIENTATION_MARGIN_PX);
      setOrientationBlocked(blocked);
      document.body.classList.toggle('orientation-locked', blocked);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
      document.body.classList.remove('orientation-locked');
    };
  }, []);

  const handleLogin = (u) => {
    setUser(u);
    setView("home");
  };
  const handleLogout = () => {
    logout();
    setUser(null);
    setInventoryInitialTab('resumen');
    setConfigAbierto(false);
    setView("clientes");
    sessionStorage.removeItem("lastView");
  };

  const isAdmin = perms.roleKey === "admin";
  const canClientes = perms.can("clientes:read");
  const canUsuarios = perms.can("usuarios:manage");
  const canProductos = perms.can("productos:read");
  const canProveedores = perms.can("proveedores:read");
  const canReportes = perms.can("reportes:read");
  const canInventario = perms.can("inventario:read");
  const canVentas = perms.can("ventas:read");

  const hasAccess = (target) => {
    switch (target) {
      case "clientes":
        return canClientes;
      case "productos":
        return canProductos;
      case "proveedores":
        return canProveedores;
      case "inventario":
        return canInventario;
      case "pos":
      case "devoluciones":
        return canVentas;
      case "usuarios":
        return canUsuarios;
      default:
        return true;
    }
  };

  const handleNavigate = (target) => {
    if (typeof target === 'string') {
      if (!hasAccess(target)) {
        setView("home");
        return;
      }
      if (target !== 'inventario') {
        setInventoryInitialTab('resumen');
      }
      setView(target);
      return;
    }
    if (target && typeof target === 'object') {
      if (target.view === 'inventario') {
        setInventoryInitialTab(target.tab || 'resumen');
        setView('inventario');
        return;
      }
      if (target.view) {
        if (!hasAccess(target.view)) {
          setView("home");
          return;
        }
        setView(target.view);
      }
    }
  };

  useEffect(() => {
    if (!userReady) return;
    if (!hasAccess(view)) {
      setView("home");
    }
  }, [view, perms, userReady]);

  const handleConfigUpdated = (data) => {
    if (data?.logoPath !== undefined) {
      setLogoPath(data.logoPath || "");
      if (data.logoPath) sessionStorage.setItem("logoPath", data.logoPath);
    }
    if (data?.monedaSimbolo) {
      setCurrencySymbol(data.monedaSimbolo);
      sessionStorage.setItem("currencySymbol", data.monedaSimbolo);
    }
    if (data?.nombreEmpresa) {
      document.title = data.nombreEmpresa;
      sessionStorage.setItem("appTitle", data.nombreEmpresa);
    }
  };

  const orientationOverlay = orientationBlocked ? (
    <div className="orientation-blocker">
      <div className="orientation-blocker__card">
        <div className="orientation-blocker__icon">
          <i className="bi bi-laptop" aria-hidden="true"></i>
        </div>
        <h2>Sistema optimizado para escritorio</h2>
        <p>Amplía la ventana para seguir usando FManager en este equipo.</p>
      </div>
    </div>
  ) : null;

  if (!user) return (
    <>
      {orientationOverlay}
      <LoginPage onLogin={handleLogin} />
    </>
  );

  return (
    <div className="main-app-container">
      {orientationOverlay}
      <nav className="navbar navbar-expand-lg navbar-light bg-light fixed-top">
        <div className="container-fluid px-4 nav-top-container">
                  <span className="navbar-brand" onClick={() => handleNavigate("home")}>
            <img
              src={resolveLogoSrc(logoPath) || "/logo-horizontal.svg"}
              alt="Farmacia Logo"
              style={{ height: "40px" }}
            />
          </span>

          <div className="nav-right-controls">
            <div className={`role-nav-block ${roleBadgeClass}`.trim()}>{user?.rol}</div>

            <div className="wrapper-btn-ayuda">
              <CustomButton
                onClick={() => setAyudaAbierto(true)}
                text=""
                icon="bi-question-lg"
              />
            </div>
            {isAdmin && (
              <div className="wrapper-btn-config">
                <CustomButton
                  onClick={() => setConfigAbierto(true)}
                  text=""
                  icon="bi-gear"
                />
              </div>
            )}
            <CustomButton
              onClick={handleLogout}
              text="Cerrar Sesion"
              icon="bi-box-arrow-right"
            />
          </div>
        </div>
      </nav>

      <div className="content-padding-top">
        <div className="app-layout">
          <div className="nav-vertical-menu" role="group">
            <button
              className={`btn nav-menu-btn ${view === "home" ? "active" : ""}`}
              onClick={() => handleNavigate("home")}
            >
              <i className="bi bi-house-door"></i>
              <span className="nav-menu-text">Inicio</span>
            </button>
            {canVentas && (
              <button
                className={`btn nav-menu-btn ${view === "pos" ? "active" : ""}`}
                onClick={() => handleNavigate("pos")}
              >
                <i className="bi bi-receipt"></i>
                <span className="nav-menu-text">Facturacion</span>
              </button>
            )}
            {canInventario && (
              <button
                className={`btn nav-menu-btn ${
                  view === "inventario" ? "active" : ""
                }`}
                onClick={() => handleNavigate("inventario")}
              >
                <i className="bi bi-clipboard-data"></i>
                <span className="nav-menu-text">Inventario</span>
              </button>
            )}
            {canReportes && (
              <button
                className={`btn nav-menu-btn ${
                  view === "reportes" ? "active" : ""
                }`}
                onClick={() => handleNavigate("reportes")}
              >
                <i className="bi bi-graph-up"></i>
                <span className="nav-menu-text">Reportes</span>
              </button>
            )}
            {canProveedores && (
              <button
                className={`btn nav-menu-btn ${
                  view === "proveedores" ? "active" : ""
                }`}
                onClick={() => handleNavigate("proveedores")}
              >
                <i className="bi bi-truck"></i>
                <span className="nav-menu-text">Proveedores</span>
              </button>
            )}
            {canProductos && (
              <button
                className={`btn nav-menu-btn ${
                  view === "productos" ? "active" : ""
                }`}
                onClick={() => handleNavigate("productos")}
              >
                <i className="bi bi-box-seam"></i>
                <span className="nav-menu-text">Productos</span>
              </button>
            )}
            {canClientes && (
              <button
                className={`btn nav-menu-btn ${
                  view === "clientes" ? "active" : ""
                }`}
                onClick={() => handleNavigate("clientes")}
              >
                <i className="bi bi-person-badge"></i>
                <span className="nav-menu-text">Clientes</span>
              </button>
            )}
            {isAdmin && (
              <button
                className={`btn nav-menu-btn ${
                  view === "usuarios" ? "active" : ""
                }`}
                onClick={() => handleNavigate("usuarios")}
              >
                <i className="bi bi-people-fill"></i>
                <span className="nav-menu-text">Usuarios</span>
              </button>
            )}
          </div>

          <div className="app-main">
            {view === "home" && (
              <HomePage
                user={user}
                onNavigate={handleNavigate}
              />
            )}
            {view === "pos" && canVentas && <PuntoVentaPage user={user} onNavigate={handleNavigate} />}
            {view === "productos" && canProductos && <ProductosPage />}
            {view === "clientes" && canClientes && <ClientesPage user={user} />}
            {view === "inventario" && canInventario && <InventarioPage initialTab={inventoryInitialTab} />}
            {view === "proveedores" && canProveedores && <ProveedoresPage />}
            {view === "reportes" && canReportes && <ReportsPage />}
            {view === "usuarios" && isAdmin && <UsersPage />}
            {view === "devoluciones" && <PuntoVentaPage user={user} onNavigate={handleNavigate} initialTab="devoluciones" />}
          </div>
        </div>
      </div>

      <AyudaModal
        isOpen={ayudaAbierto}
        onClose={() => setAyudaAbierto(false)}
      />
      {isAdmin && (
        <ConfigModal
          isOpen={configAbierto}
          onClose={() => setConfigAbierto(false)}
          user={user}
          onUpdated={handleConfigUpdated}
        />
      )}
    </div>
  );
}

export default App;