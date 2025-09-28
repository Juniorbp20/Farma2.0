// db.js
const sql = require("mssql");
require("dotenv").config();

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT, 10) || 1433,
  options: {
    encrypt: process.env.NODE_ENV === "production",
    trustServerCertificate: process.env.NODE_ENV !== "production",
  },
};

const poolPromise = new sql.ConnectionPool(dbConfig)
  .connect()
  .then((pool) => {
    console.log("Conectado a SQL Server ✅");
    return pool;
  })
  .catch((err) => {
    console.error("Error al conectar con DB:", err.message);
    process.exit(1);
  });

module.exports = poolPromise;

