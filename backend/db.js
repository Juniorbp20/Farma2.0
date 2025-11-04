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

async function connectWithRetry(maxRetries = 5, delayMs = 3000) {
  let attempt = 0;
  while (true) {
    try {
      const pool = await new sql.ConnectionPool(dbConfig).connect();
      console.log("Conectado a SQL Server");
      return pool;
    } catch (err) {
      attempt += 1;
      console.error(`Error al conectar con DB (intento ${attempt}/${maxRetries}):`, err.message);
      if (attempt >= maxRetries) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

const poolPromise = connectWithRetry(
  parseInt(process.env.DB_RETRIES || '5', 10),
  parseInt(process.env.DB_RETRY_DELAY || '3000', 10)
);

module.exports = poolPromise;


