import React, { useEffect, useState } from "react";
import "./App.css";
import ClientesPage from "./pages/ClientesPage";
import UsersPage from "./pages/UsersPage";
import HomePage from "./pages/HomePage";
import PuntoVentaPage from "./pages/PuntoVentaPage";
import DevolucionesPage from "./pages/DevolucionesPage";
import InventarioPage from "./pages/InventarioPage";
import ProductosPage from "./pages/ProductosPage";
import ProveedoresPage from "./pages/ProveedoresPage";
import LoginPage from "./pages/LoginPage";
import CustomButton from "./components/recursos/CustomButton";
import AyudaModal from "./components/AyudaModal";
import ConfigModal from "./components/ConfigModal";
import { getToken, getUser, logout } from "./services/authService";
import { getParametrosSistema } from "./services/configService";
import { resolveLogoSrc } from "./utils/logo";

function App() {
  const [user, setUser] = useState(null);
  const [currencySymbol, setCurrencySymbol] = useState(
    () => sessionStorage.getItem('currencySymbol') || 'RD$'
  );

  const [view, setView] = useState(() => {
    const savedView = sessionStorage.getItem("lastView");
    return savedView || "home";
  });

  const [ayudaAbierto, setAyudaAbierto] = useState(false);
  const [inventoryInitialTab, setInventoryInitialTab] = useState('resumen');
  const [configAbierto, setConfigAbierto] = useState(false);
  const [logoPath, setLogoPath] = useState(
    () => sessionStorage.getItem('logoPath') || ""
  );

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
      })
      .catch(() => {
        const stored = sessionStorage.getItem("logoPath");
        if (stored) setLogoPath(stored);
        const storedSymbol = sessionStorage.getItem("currencySymbol");
        if (storedSymbol) setCurrencySymbol(storedSymbol);
      });
  }, []);

  useEffect(() => {
    sessionStorage.setItem("lastView", view);
  }, [view]);

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

  const isAdmin = user?.rol === "admin" || String(user?.rolId) === "1";

  const handleNavigate = (target) => {
    if (typeof target === 'string') {
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
        setView(target.view);
      }
    }
  };

  const handleConfigUpdated = (data) => {
    if (data?.logoPath !== undefined) {
      setLogoPath(data.logoPath || "");
      if (data.logoPath) sessionStorage.setItem("logoPath", data.logoPath);
    }
    if (data?.monedaSimbolo) {
      setCurrencySymbol(data.monedaSimbolo);
      sessionStorage.setItem("currencySymbol", data.monedaSimbolo);
    }
  };

  if (!user) return <LoginPage onLogin={handleLogin} />;

  return (
    <div className="main-app-container">
      {/* Navbar superior fijo */}
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
            <div className="role-nav-block">{user?.rol}</div>

            {/* Botón de ayuda */}
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

      {/* Contenido principal con menú lateral y vista principal */}
      <div className="content-padding-top">
        <div className="app-layout">
          {/* Menú vertical a la izquierda */}
          <div className="nav-vertical-menu" role="group">
            <button
              className={`btn nav-menu-btn ${view === "home" ? "active" : ""}`}
              onClick={() => handleNavigate("home")}
            >
              <i className="bi bi-house-door"></i>
              <span className="nav-menu-text">Inicio</span>
            </button>
            <button
              className={`btn nav-menu-btn ${view === "pos" ? "active" : ""}`}
              onClick={() => handleNavigate("pos")}
            >
              <i className="bi bi-receipt"></i>
              <span className="nav-menu-text">Facturación</span>
            </button>
            <button
              className={`btn nav-menu-btn ${
                view === "productos" ? "active" : ""
              }`}
              onClick={() => handleNavigate("productos")}
            >
              <i className="bi bi-box-seam"></i>
              <span className="nav-menu-text">Productos</span>
            </button>
            <button
              className={`btn nav-menu-btn ${
                view === "inventario" ? "active" : ""
              }`}
              onClick={() => handleNavigate("inventario")}
            >
              <i className="bi bi-clipboard-data"></i>
              <span className="nav-menu-text">Inventario</span>
            </button>
            <button
              className={`btn nav-menu-btn ${
                view === "proveedores" ? "active" : ""
              }`}
              onClick={() => handleNavigate("proveedores")}
            >
              <i className="bi bi-truck"></i>
              <span className="nav-menu-text">Proveedores</span>
            </button>
            <button
              className={`btn nav-menu-btn ${
                view === "clientes" ? "active" : ""
              }`}
              onClick={() => handleNavigate("clientes")}
            >
              <i className="bi bi-person-badge"></i>
              <span className="nav-menu-text">Clientes</span>
            </button>
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

          {/* Contenido principal a la derecha */}
          <div className="app-main">
            {view === "home" && (
              <HomePage
                user={user}
                onNavigate={handleNavigate}
              />
            )}
            {view === "pos" && <PuntoVentaPage user={user} onNavigate={handleNavigate} />}
            {view === "productos" && <ProductosPage />}
            {view === "clientes" && <ClientesPage user={user} />}
            {view === "inventario" && <InventarioPage initialTab={inventoryInitialTab} />}
            {view === "proveedores" && <ProveedoresPage />}
            {view === "usuarios" && isAdmin && <UsersPage />}
            {view === "devoluciones" && <DevolucionesPage user={user} onNavigate={handleNavigate} />}
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
