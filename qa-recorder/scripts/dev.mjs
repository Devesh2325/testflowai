import { spawn } from "node:child_process";
import http from "node:http";

// Wait for a URL to respond
function waitForUrl(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http.get(url, (res) => {
        if (res.statusCode && res.statusCode < 500) {
          resolve(true);
        } else {
          retry();
        }
      }).on("error", retry);
    };

    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timeout waiting for ${url}`));
      } else {
        setTimeout(check, 300);
      }
    };

    check();
  });
}

console.log("⚡ Building Electron Main and Preload scripts...");
const buildMain = spawn("npm", ["run", "build:main"], { shell: true, stdio: "inherit" });
buildMain.on("close", (code) => {
  if (code !== 0) {
    console.error("Main build failed");
    process.exit(code);
  }

  const buildPreload = spawn("npm", ["run", "build:preload"], { shell: true, stdio: "inherit" });
  buildPreload.on("close", async (pCode) => {
    if (pCode !== 0) {
      console.error("Preload build failed");
      process.exit(pCode);
    }

    console.log("🚀 Starting Vite dev server for React UI...");
    const viteProcess = spawn("npx", ["vite"], { shell: true, stdio: "inherit" });

    try {
      await waitForUrl("http://localhost:5173", 20000);
      console.log("✅ Vite dev server is ready! Launching Electron...");

      const electronProcess = spawn("npx", ["electron", "dist/main/index.js"], {
        shell: true,
        stdio: "inherit",
        env: {
          ...process.env,
          MAIN_WINDOW_VITE_DEV_SERVER_URL: "http://localhost:5173",
        },
      });

      electronProcess.on("close", (eCode) => {
        viteProcess.kill();
        process.exit(eCode || 0);
      });
    } catch (err) {
      console.error("Error starting dev environment:", err);
      viteProcess.kill();
      process.exit(1);
    }
  });
});
