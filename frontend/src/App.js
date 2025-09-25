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

  useEffect(() => {
    const token = getToken();
    const u = getUser();
    if (token && u) setUser(u);
  }, []);

  const [view, setView] = useState('home');

  const handleLogin = (u) => { setUser(u); setView('home'); };
  const handleLogout = () => {
    logout();
    setUser(null);
    setView('clientes');
  };

  if (!user) return <LoginPage onLogin={handleLogin} />;
  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-light bg-light mb-3">
        <div className="container-fluid">
          <span className="navbar-brand">Farmacia</span>
          <div>
            <div className="btn-group me-2" role="group">
              <button className={`btn btn-outline-primary ${view==='home'?'active':''}`} onClick={()=>setView('home')}>Inicio</button>
              <button className={`btn btn-outline-primary ${view==='pos'?'active':''}`} onClick={()=>setView('pos')}>Punto de Venta</button>
              <button className={`btn btn-outline-primary ${view==='productos'?'active':''}`} onClick={()=>setView('productos')}>Productos</button>
              <button className={`btn btn-outline-primary ${view==='clientes'?'active':''}`} onClick={()=>setView('clientes')}>Clientes</button>
              <button className={`btn btn-outline-primary ${view==='inventario'?'active':''}`} onClick={()=>setView('inventario')}>Inventario</button>
              {user?.rol === 'admin' && (
                <button className={`btn btn-outline-primary ${view==='usuarios'?'active':''}`} onClick={()=>setView('usuarios')}>Usuarios</button>
              )}
            </div>
            <span className="badge bg-secondary me-2 text-uppercase">{user?.rol}</span>
            <button className="btn btn-primary" onClick={handleLogout}><i className="bi bi-box-arrow-right"></i> Salir</button>
          </div>
        </div>
      </nav>
      {view === 'home' && <HomePage user={user} onNavigate={setView} />}
      {view === 'pos' && <PuntoVentaPage user={user} />}
      {view === 'productos' && <ProductosPage />}
      {view === 'clientes' && <ClientesPage user={user} />}
      {view === 'inventario' && <InventarioPage />}
      {view === 'usuarios' && user?.rol === 'admin' && <UsersPage />}
    </div>
  );
}

export default App;
