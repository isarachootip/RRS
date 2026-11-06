import http from "node:http";

const GATEWAY_PORT = Number(process.env.PORT ?? 3000);
const API_PORT = Number(process.env.API_PORT ?? 4000);
const PORTAL_PORT = Number(process.env.PORTAL_PORT ?? 3001);
const WEB_PORT = Number(process.env.WEB_PORT ?? 3002);

function resolveTargetPort(req) {
  const url = req.url ?? "/";
  if (url.startsWith("/api/") || url === "/health" || url.startsWith("/docs")) {
    return API_PORT;
  }
  const rawHost = String(req.headers["x-forwarded-host"] || req.headers.host || "").toLowerCase();
  if (rawHost.startsWith("portal")) {
    return PORTAL_PORT;
  }
  return WEB_PORT;
}

const server = http.createServer((req, res) => {
  const targetPort = resolveTargetPort(req);
  const proxyReq = http.request(
    {
      hostname: "127.0.0.1",
      port: targetPort,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    },
  );

  proxyReq.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
    }
    res.end("กำลังเริ่มต้นระบบ กรุณารอสักครู่แล้วรีเฟรชหน้าเว็บ (Starting RRS services...)");
  });

  req.pipe(proxyReq, { end: true });
});

server.listen(GATEWAY_PORT, "0.0.0.0", () => {
  console.log(
    `==> [RRS Gateway] Listening on 0.0.0.0:${GATEWAY_PORT} (web->:${WEB_PORT}, portal->:${PORTAL_PORT}, api->:${API_PORT})`,
  );
});
