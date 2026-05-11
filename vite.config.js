import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function responsiveLayoutDebuggerProxy() {
  const attachMiddleware = (server) => {
    server.middlewares.use("/__rld/fetch", async (req, res) => {
      const requestUrl = new URL(req.url || "/", "http://localhost");
      const target = requestUrl.searchParams.get("url");

      if (!target) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Missing url query parameter." }));
        return;
      }

      let parsedTarget;
      try {
        parsedTarget = new URL(target);
      } catch {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "URL must be a valid absolute address." }));
        return;
      }

      if (!["http:", "https:"].includes(parsedTarget.protocol)) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Only http and https URLs are supported." }));
        return;
      }

      try {
        const response = await fetch(parsedTarget, {
          redirect: "follow",
          headers: {
            "user-agent": "Responsive Layout Debugger",
            accept: "text/html,application/xhtml+xml",
          },
        });

        if (!response.ok) {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: `Upstream request failed with ${response.status}.` }));
          return;
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
          res.statusCode = 415;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "The remote resource did not return HTML." }));
          return;
        }

        const finalUrl = response.url || parsedTarget.toString();
        const rawHtml = await response.text();
        const sanitizedHtml = sanitizeRemoteHtml(rawHtml, finalUrl);
        const warning = inferWarning(rawHtml);

        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            html: sanitizedHtml,
            finalUrl,
            warning,
          }),
        );
      } catch (error) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            error:
              error instanceof Error ? error.message : "Unable to fetch the remote page for analysis.",
          }),
        );
      }
    });
  };

  return {
    name: "responsive-layout-debugger-proxy",
    configureServer: attachMiddleware,
    configurePreviewServer: attachMiddleware,
  };
}

function sanitizeRemoteHtml(value, baseUrl) {
  const withoutScripts = value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
    .replace(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi, "");

  const baseTag = `<base href="${baseUrl}">`;

  if (/<head[^>]*>/i.test(withoutScripts)) {
    return withoutScripts.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
  }

  return `<!doctype html><html><head>${baseTag}</head><body>${withoutScripts}</body></html>`;
}

function inferWarning(value) {
  if (/<script[\s\S]*?>/i.test(value)) {
    return "Remote scripts were removed for safe inspection, so highly interactive pages may render differently here.";
  }
  return "";
}

export default defineConfig({
  plugins: [react(), responsiveLayoutDebuggerProxy()],
});
