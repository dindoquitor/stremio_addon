const { serveHTTP } = require("stremio-addon-sdk");
const addonInterface = require("./addon");

const PORT = parseInt(process.env.PORT, 10) || 7000;

serveHTTP(addonInterface, { port: PORT })
  .then(({ url }) => {
    console.log(`[SERVER] Addon active on: ${url}`);
    console.log(`[SERVER] Manifest: ${url}/manifest.json`);
  })
  .catch((error) => {
    console.error("[SERVER] Failed to start:", error.message);
    process.exit(1);
  });

const shutdown = (signal) => {
  console.log(`[SERVER] ${signal} received, shutting down`);
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
