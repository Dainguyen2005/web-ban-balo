import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const p of children) p.kill("SIGTERM");
  process.exitCode = code;
}
for (const args of [
  ["--watch", "server/index.js"],
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5173",
    "--strictPort",
  ],
]) {
  const child = spawn(process.execPath, args, { cwd: root, stdio: "inherit" });
  children.push(child);
  child.on("exit", (code) => stop(code || 0));
  child.on("error", (e) => {
    console.error(e);
    stop(1);
  });
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
