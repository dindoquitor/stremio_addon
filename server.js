const express = require("express");
const { getRouter } = require("stremio-addon-sdk");
const addonInterface = require("./addon");
const getLandingPage = require("./landing");

const PORT = parseInt(process.env.PORT, 10) || 7000;
const app = express();

app.get("/", (_req, res) => {
  const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(getLandingPage(baseUrl));
});

app.use(getRouter(addonInterface));

const server = app.listen(PORT, () => {
  const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
  console.log(`[SERVER] Addon active on: ${baseUrl}`);
  console.log(`[SERVER] Manifest: ${baseUrl}/manifest.json`);
  console.log(`[SERVER] Landing: ${baseUrl}`);
});

const shutdown = (signal) => {
  console.log(`[SERVER] ${signal} received, shutting down`);
  server.close(() => process.exit(0));
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
