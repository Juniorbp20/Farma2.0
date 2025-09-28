import React, { useEffect, useState } from "react";
import "./App.css";
import ClientesPage from "./pages/ClientesPage";
import UsersPage from "./pages/UsersPage";
import HomePage from "./pages/HomePage";
import PuntoVentaPage from "./pages/PuntoVentaPage";
import InventarioPage from "./pages/InventarioPage";
import ProductosPage from "./pages/ProductosPage";
import LoginPage from "./pages/LoginPage";
import { getToken, getUser, logout } from "./services/authService";

function App() {
  const [user, setUser] = useState(null);

   // Modificar para leer la última vista de localStorage
  const [view, setView] = useState(() => {
    const savedView = localStorage.getItem('lastView');
    return savedView || 'home';
  });

  useEffect(() => {
    const token = getToken();
    const u = getUser();
    if (token && u) setUser(u);
  }, []);

  //const [view, setView] = useState('home');

  // Guardar la vista actual en localStorage cada vez que cambie
  useEffect(() => {
    localStorage.setItem('lastView', view);
  }, [view]);

  const handleLogin = (u) => { setUser(u); setView('home'); };
  const handleLogout = () => {
    logout();
    setUser(null);
    setView('clientes');
    localStorage.removeItem('lastView'); // Limpiar el estado guardado
  };

  if (!user) return <LoginPage onLogin={handleLogin} />;
  return (
    <div className="main-app-container">
      {/* 1. Navbar Fijo: se cambió 'mb-3' por 'fixed-top' */}
      <nav className="navbar navbar-expand-lg navbar-light bg-light fixed-top">
        <div className="container-fluid px-4">

          <span className="navbar-brand" onClick={() => setView('home')}>
            <img 
              src="/logo-horizontal.svg"
              alt="Farmacia Logo" 
              style={{ height: '40px'}}
            />
          </span>

            <div style={{ display: "flex", justifyContent: "center", alignItems: "center"}}>
            <div className="role-nav-block me-2"> 
                {user?.rol}
            </div>
            
            <div className="btn-group me-2 nav-btn-group" role="group">
              <button className={`btn btn-outline-primary nav-btn-group ${view==='home'?'active':''}`} onClick={()=>setView('home')}>Inicio</button>
              <button className={`btn btn-outline-primary nav-btn-group ${view==='pos'?'active':''}`} onClick={()=>setView('pos')}>Punto de Venta</button>
              <button className={`btn btn-outline-primary nav-btn-group ${view==='productos'?'active':''}`} onClick={()=>setView('productos')}>Productos</button>
              <button className={`btn btn-outline-primary nav-btn-group ${view==='clientes'?'active':''}`} onClick={()=>setView('clientes')}>Clientes</button>
              <button className={`btn btn-outline-primary nav-btn-group ${view==='inventario'?'active':''}`} onClick={()=>setView('inventario')}>Inventario</button>
              {user?.rol === 'admin' && (
                <button className={`btn btn-outline-primary nav-btn-group ${view==='usuarios'?'active':''}`} onClick={()=>setView('usuarios')}>Usuarios</button>
              )}
            </div>
            <button className="btn btn-salir btn-primary" onClick={handleLogout}><i className="bi bi-box-arrow-right"></i> Salir</button>
          </div>
        </div>
      </nav>
      {/* 2. Contenedor de Vistas: se añadió la clase de compensación */}
      <div className="content-padding-top"> 
        {view === 'home' && <HomePage user={user} onNavigate={setView} />}
        {view === 'pos' && <PuntoVentaPage user={user} />}
        {view === 'productos' && <ProductosPage />}
        {view === 'clientes' && <ClientesPage user={user} />}
        {view === 'inventario' && <InventarioPage />}
        {view === 'usuarios' && user?.rol === 'admin' && <UsersPage />}
      </div>
    </div>
  );
}

export default App;
