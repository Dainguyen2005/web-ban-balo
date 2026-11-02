import express from "express";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
const dbPath =
  process.env.DB_PATH ||
  fileURLToPath(new URL("../data/may.sqlite", import.meta.url));
const { app, db } = createApp(dbPath);
app.use(express.static(fileURLToPath(new URL("../dist", import.meta.url))));
const port = Number(process.env.PORT || 3001);
const server = app.listen(port, "127.0.0.1", () =>
  console.log(`Mây API + website: http://localhost:${port}`),
);
function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
