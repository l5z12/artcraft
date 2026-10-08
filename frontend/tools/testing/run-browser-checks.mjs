import { spawn } from "node:child_process";
import { createServer as createSocketServer } from "node:net";
import { fileURLToPath } from "node:url";
import { createServer, preview } from "vite";

const production = process.argv.includes("--production");
const configFile = fileURLToPath(new URL("../../apps/artcraft/vite.config.ts", import.meta.url));
// Tailwind resolves the app's config and content paths from the working directory.
process.chdir(fileURLToPath(new URL("../../apps/artcraft/", import.meta.url)));
const address = { host: "127.0.0.1", port: await availablePort(), strictPort: true };
const server = production
  ? await preview({ configFile, preview: address })
  : await createServer({ configFile, server: address });

try {
  if (!production) await server.listen();
  const port = server.httpServer.address().port;
  const url = `http://127.0.0.1:${port}`;
  console.log(`Testing ${production ? "production" : "development"} app at ${url}`);
  await runCheck("desktop-session.mjs", url);
  // The scene test also inspects the host's tab store via Vite source imports.
  if (!production) await runCheck("local-scene.mjs", url);
} finally {
  await server.close();
}

function runCheck(script, url) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL(script, import.meta.url)), url], {
      stdio: "inherit",
      timeout: 180000,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} failed (${signal || code})`));
    });
  });
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const socket = createSocketServer();
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", () => {
      const port = socket.address().port;
      socket.close((error) => error ? reject(error) : resolve(port));
    });
  });
}
