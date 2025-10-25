// index.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const clientesRoutes = require("./routes/clientesRoutes");
const tiposDocumentosRoutes = require("./routes/tiposDocumentosRoutes");
const usuariosRoutes = require("./routes/usuariosRoutes");
const rolesRoutes = require("./routes/rolesRoutes");
const authRoutes = require("./routes/authRoutes");
const productosRoutes = require("./routes/productosRoutes");
const unidadesMedidaRoutes = require("./routes/unidadesMedidaRoutes");
const categoriasProductosRoutes = require("./routes/categoriasProductosRoutes");
const ventasRoutes = require("./routes/ventasRoutes");
const inventarioRoutes = require("./routes/inventarioRoutes");
const proveedoresRoutes = require("./routes/proveedoresRoutes");
const errorHandler = require("./middleware/errorHandler");
const { authenticate } = require("./middleware/authz");
// const { seedAdmin } = require("./seed");

const app = express();
app.use(express.json());

// CORS con configuración por entorno
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== "production") return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("No permitido por CORS"));
  },
  credentials: true,
};
app.use(cors(corsOptions));

// Rutas públicas
app.get("/", (req, res) => {
  res.send("Backend funcionando");
});
app.use("/auth", authRoutes);

// Rutas protegidas
const { authorizePermissions } = require("./middleware/authz");
app.use("/clientes", authenticate, clientesRoutes);
app.use("/tiposdocumentos", authenticate, tiposDocumentosRoutes);
app.use("/usuarios", authenticate, authorizePermissions('usuarios:manage'), usuariosRoutes);
app.use("/roles", authenticate, authorizePermissions('usuarios:manage'), rolesRoutes);
app.use("/productos", authenticate, productosRoutes);
app.use("/unidadesmedida", authenticate, unidadesMedidaRoutes);
app.use("/categoriasproductos", authenticate, categoriasProductosRoutes);
app.use("/ventas", authenticate, ventasRoutes);
app.use("/inventario", authenticate, inventarioRoutes);
app.use("/proveedores", authenticate, proveedoresRoutes);

// Manejo de errores global
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

// Seed deshabilitado por defecto; habilita con SEED_ENABLED=true
// if (process.env.SEED_ENABLED === 'true') seedAdmin();
