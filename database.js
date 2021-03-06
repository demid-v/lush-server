const mysql2 = require("mysql2");

const connection = mysql2
  .createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  })
  .on("connect", lushConnectionSuccess)
  .on("error", lushConnectionError);

function lushConnectionSuccess() {
  console.info("Lush database connected.");
}

function lushConnectionError() {
  throw new Error("Failed to connect to the Lush database.");
}

module.exports = connection;
