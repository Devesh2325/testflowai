/**
 * TestFlow AI — Local Browser Automation Runner (CDP & Playwright Bridge)
 * 
 * Runs a local automation HTTP bridge on port 9222.
 * Automatically discovers Google Chrome or Microsoft Edge on Windows,
 * connects via Chrome DevTools Protocol (CDP), and executes real browser actions:
 * - Real navigation & DOM parsing
 * - Real clicks and input typing
 * - Real full-page viewport screenshots
 * - Real console error & network telemetry capture
 * 
 * Usage:
 *   node scripts/browser-runner.mjs
 *   or: npm run runner
 */

import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const PORT = 9222;
const CDP_INTERNAL_PORT = 9223;

// Find Chrome or Edge executable on Windows
function findBrowserExecutable() {
  const candidates = [
    // Google Chrome
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(process.env.LOCALAPPDATA || "", "Google\\Chrome\\Application\\chrome.exe"),
    // Microsoft Edge
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    path.join(process.env.LOCALAPPDATA || "", "Microsoft\\Edge\\Application\\msedge.exe"),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const browserPath = findBrowserExecutable();
let browserProcess = null;
let activeWs = null;
let messageId = 1;
const pendingCalls = new Map();
const consoleLogs = [];
const networkLogs = [];

// Start Chrome/Edge with Remote Debugging
function launchBrowser() {
  if (!browserPath) {
    console.warn("⚠️  No Chrome or Edge found in standard Windows locations.");
    console.warn("   Please install Google Chrome or Microsoft Edge.");
    return;
  }

  const profileDir = path.join(os.tmpdir(), "testflow-browser-profile");
  console.log(`🚀 Launching browser: ${browserPath}`);
  console.log(`📁 User Data Dir: ${profileDir}`);

  browserProcess = spawn(
    browserPath,
    [
      `--remote-debugging-port=${CDP_INTERNAL_PORT}`,
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-popup-blocking",
      "--window-size=1280,800",
      "about:blank",
    ],
    { stdio: "ignore", detached: false }
  );

  browserProcess.on("error", (err) => {
    console.error("❌ Failed to spawn browser process:", err.message);
  });

  browserProcess.on("exit", (code) => {
    console.log(`ℹ️  Browser process exited with code ${code}`);
    activeWs = null;
  });
}

// Connect to Chrome DevTools Protocol via WebSocket
async function ensureCdpConnection() {
  if (activeWs && activeWs.readyState === 1) return activeWs;

  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const resp = await fetch(`http://127.0.0.1:${CDP_INTERNAL_PORT}/json/list`);
      if (resp.ok) {
        const pages = await resp.json();
        const page = pages.find((p) => p.type === "page") || pages[0];
        if (page && page.webSocketDebuggerUrl) {
          return await new Promise((resolve, reject) => {
            const ws = new WebSocket(page.webSocketDebuggerUrl);
            ws.onopen = () => {
              activeWs = ws;
              // Enable Console and Network domains
              sendCdp("Console.enable");
              sendCdp("Network.enable");
              sendCdp("Page.enable");
              console.log("✅ Connected to browser via Chrome DevTools Protocol (CDP)");
              resolve(ws);
            };
            ws.onmessage = (event) => {
              try {
                const msg = JSON.parse(event.data);
                if (msg.id && pendingCalls.has(msg.id)) {
                  const { resolve, reject } = pendingCalls.get(msg.id);
                  pendingCalls.delete(msg.id);
                  if (msg.error) reject(new Error(msg.error.message || "CDP Error"));
                  else resolve(msg.result);
                } else if (msg.method === "Console.messageAdded") {
                  consoleLogs.push({
                    level: msg.params.message.level,
                    text: msg.params.message.text,
                    timestamp: new Date().toISOString(),
                  });
                } else if (msg.method === "Network.responseReceived") {
                  networkLogs.push({
                    url: msg.params.response.url,
                    method: msg.params.response.requestMethod || "GET",
                    status: msg.params.response.status,
                    statusText: msg.params.response.statusText,
                    durationMs: 0,
                    timestamp: new Date().toISOString(),
                  });
                }
              } catch (e) {
                console.error("Error parsing CDP message:", e);
              }
            };
            ws.onerror = (e) => reject(e);
            ws.onclose = () => {
              activeWs = null;
            };
          });
        }
      }
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error("Could not connect to browser CDP internal port " + CDP_INTERNAL_PORT);
}

// Send JSON-RPC message over CDP
async function sendCdp(method, params = {}) {
  await ensureCdpConnection();
  return new Promise((resolve, reject) => {
    const id = messageId++;
    pendingCalls.set(id, { resolve, reject });
    activeWs.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (pendingCalls.has(id)) {
        pendingCalls.delete(id);
        reject(new Error(`CDP method ${method} timed out`));
      }
    }, 15000);
  });
}

// HTTP API Server for TestFlow AI frontend
const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // Health and version checks
  if (url.pathname === "/health" || url.pathname === "/json/version") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        runner: "TestFlow AI Autonomous Browser Runner",
        browser: browserPath ? path.basename(browserPath) : "Not found",
        cdpConnected: !!activeWs,
      })
    );
    return;
  }

  // Parse JSON Body
  let body = {};
  if (req.method === "POST") {
    try {
      const buffers = [];
      for await (const chunk of req) buffers.push(chunk);
      body = JSON.parse(Buffer.concat(buffers).toString() || "{}");
    } catch {}
  }

  try {
    // 1. POST /navigate
    if (url.pathname === "/navigate" && req.method === "POST") {
      const targetUrl = body.url;
      if (!targetUrl) throw new Error("Missing url parameter");

      await sendCdp("Page.navigate", { url: targetUrl });
      await new Promise((r) => setTimeout(r, 1500)); // allow initial render

      const evalRes = await sendCdp("Runtime.evaluate", { expression: "document.title" });
      const title = evalRes?.result?.value || "Loaded";

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, url: targetUrl, title }));
      return;
    }

    // 2. POST /click
    if (url.pathname === "/click" && req.method === "POST") {
      const selector = body.selector;
      if (!selector) throw new Error("Missing selector parameter");

      const js = `
        (() => {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) return { found: false };
          el.scrollIntoView({ behavior: 'instant', block: 'center' });
          el.click();
          return { found: true, tag: el.tagName, text: el.innerText || el.value || '' };
        })()
      `;
      const evalRes = await sendCdp("Runtime.evaluate", { expression: js, returnByValue: true });
      const val = evalRes?.result?.value;

      if (!val || !val.found) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: `Element not found for selector: ${selector}` }));
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, observedState: `Clicked ${selector} (${val.tag}: "${val.text.slice(0, 30)}")` }));
      return;
    }

    // 3. POST /type
    if (url.pathname === "/type" && req.method === "POST") {
      const { selector, text } = body;
      if (!selector) throw new Error("Missing selector parameter");

      const js = `
        (() => {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) return { found: false };
          el.focus();
          el.value = ${JSON.stringify(text || "")};
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return { found: true };
        })()
      `;
      const evalRes = await sendCdp("Runtime.evaluate", { expression: js, returnByValue: true });
      const val = evalRes?.result?.value;

      if (!val || !val.found) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: `Input not found for selector: ${selector}` }));
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, observedState: `Typed into ${selector}` }));
      return;
    }

    // 4. POST /screenshot
    if (url.pathname === "/screenshot" && req.method === "POST") {
      const shot = await sendCdp("Page.captureScreenshot", { format: "png", quality: 80 });
      const base64Data = shot?.data;
      const dataUrl = `data:image/png;base64,${base64Data}`;

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, screenshotUrl: dataUrl }));
      return;
    }

    // 5. GET /dom
    if (url.pathname === "/dom" && req.method === "GET") {
      const evalHtml = await sendCdp("Runtime.evaluate", { expression: "document.documentElement.outerHTML" });
      const evalText = await sendCdp("Runtime.evaluate", { expression: "document.body.innerText" });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: true,
          html: evalHtml?.result?.value || "",
          text: evalText?.result?.value || "",
        })
      );
      return;
    }

    // 6. GET /telemetry
    if (url.pathname === "/telemetry" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ consoleLogs, networkLogs }));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Endpoint not found" }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
});

// Launch Browser & Start Server
launchBrowser();

server.listen(PORT, () => {
  console.log(`
========================================================================
🌐 TESTFLOW AI — AUTONOMOUS BROWSER RUNNER
========================================================================
⚡ HTTP Bridge Endpoint:  http://localhost:${PORT}
⚡ Chrome CDP Debugger:   http://localhost:${CDP_INTERNAL_PORT}
⚡ Status:                ONLINE & LISTENING

Ready to execute real browser automation missions from TestFlow AI!
Keep this terminal window open while running autonomous QA missions.
========================================================================
`);
});

process.on("SIGINT", () => {
  console.log("\nShutting down browser runner...");
  if (browserProcess) browserProcess.kill();
  process.exit(0);
});
