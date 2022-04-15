const express = require("express");
const server = express();
const fs = require("fs");
const path = require("path");
require("dotenv/config");

const ALLOWED_ORIGINS = [
  "http://localhost:5501",
  "http://localhost:5502",
  "http://localhost:5503",
  "http://localhost:5504",
  "http://localhost:5505",
];
const ROUTES_DIR = "routes";

function setHeaders(req, res, next) {
  if (ALLOWED_ORIGINS.includes(req.headers.origin)) {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
    res.header("Access-Control-Allow-Headers", "Content-Type");
  }

  return next();
}

server.use(
  setHeaders,
  express.json({
    limit: "1mb",
  }),
  express.text({
    limit: "1mb",
  })
);

fs.readdir(ROUTES_DIR, function (error, files) {
  if (error) {
    console.error("Could not list the directory.", error);
    return;
  }

  files.forEach((file) => {
    server.use("/", require(path.join(__dirname, ROUTES_DIR, file)));
  });
});

server.listen(process.env.SERVER_PORT);
