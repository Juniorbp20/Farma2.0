import React, { useEffect, useState } from "react";
import "./App.css";
import ClientesPage from "./pages/ClientesPage";
import UsersPage from "./pages/UsersPage";
import HomePage from "./pages/HomePage";
import PuntoVentaPage from "./pages/PuntoVentaPage";
import InventarioPage from "./pages/InventarioPage";
import ProductosPage from "./pages/ProductosPage";
import LoginPage from "./pages/LoginPage";
import CustomButton from "./components/recursos/CustomButton";
import AyudaModal from "./components/AyudaModal";
import { getToken, getUser, logout } from "./services/authService";

function App() {
  const [user, setUser] = useState(null);

  const [view, setView] = useState(() => {
    const savedView = sessionStorage.getItem("lastView");
    return savedView || "home";
  });

  const [ayudaAbierto, setAyudaAbierto] = useState(false);

  useEffect(() => {
    const token = getToken();
    const u = getUser();
    if (token && u) setUser(u);
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
    setView("clientes");
    sessionStorage.removeItem("lastView");
  };

  if (!user) return <LoginPage onLogin={handleLogin} />;

  return (
    <div className="main-app-container">
      {/* Navbar superior fijo */}
      <nav className="navbar navbar-expand-lg navbar-light bg-light fixed-top">
        <div className="container-fluid px-4 nav-top-container">
          <span className="navbar-brand" onClick={() => setView("home")}>
            <img
              src="/logo-horizontal.svg"
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
              onClick={() => setView("home")}
            >
              <i className="bi bi-house-door"></i>
              <span className="nav-menu-text">Inicio</span>
            </button>
            <button
              className={`btn nav-menu-btn ${view === "pos" ? "active" : ""}`}
              onClick={() => setView("pos")}
            >
              <i className="bi bi-receipt"></i>
              <span className="nav-menu-text">Facturación</span>
            </button>
            <button
              className={`btn nav-menu-btn ${
                view === "productos" ? "active" : ""
              }`}
              onClick={() => setView("productos")}
            >
              <i className="bi bi-box-seam"></i>
              <span className="nav-menu-text">Productos</span>
            </button>
            <button
              className={`btn nav-menu-btn ${
                view === "inventario" ? "active" : ""
              }`}
              onClick={() => setView("inventario")}
            >
              <i className="bi bi-clipboard-data"></i>
              <span className="nav-menu-text">Inventario</span>
            </button>
            <button
              className={`btn nav-menu-btn ${
                view === "clientes" ? "active" : ""
              }`}
              onClick={() => setView("clientes")}
            >
              <i className="bi bi-person-badge"></i>
              <span className="nav-menu-text">Clientes</span>
            </button>
            {user?.rol === "admin" && (
              <button
                className={`btn nav-menu-btn ${
                  view === "usuarios" ? "active" : ""
                }`}
                onClick={() => setView("usuarios")}
              >
                <i className="bi bi-people-fill"></i>
                <span className="nav-menu-text">Usuarios</span>
              </button>
            )}
          </div>

          {/* Contenido principal a la derecha */}
          <div className="app-main">
            {view === "home" && <HomePage user={user} onNavigate={setView} />}
            {view === "pos" && <PuntoVentaPage user={user} />}
            {view === "productos" && <ProductosPage />}
            {view === "clientes" && <ClientesPage user={user} />}
            {view === "inventario" && <InventarioPage />}
            {view === "usuarios" && user?.rol === "admin" && <UsersPage />}
          </div>
        </div>
      </div>

      <AyudaModal
        isOpen={ayudaAbierto}
        onClose={() => setAyudaAbierto(false)}
      />
    </div>
  );
}

export default App;
