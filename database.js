const mysql2 = require("mysql2");

let connection;
function createLushConnection() {
  connection = mysql2
    .createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
    })
    .on("connect", lushConnectionSuccess)
    .on("error", lushConnectionError);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function lushConnectionError() {
  console.error("Connection to the Lush database lost.");
}

function lushConnectionSuccess() {
  console.info("Lush database connected.");
}

createLushConnection();

module.exports = connection;
