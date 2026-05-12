// GHL MCP Proxy — Firecrawl-pattern auth wrapper for the official GoHighLevel MCP.
//
// Usage:
//   POST/GET https://<host>/<PIT>/<LOCATION_ID>/mcp
//
// The proxy extracts the Private Integration Token and Location ID from the URL path
// and forwards the request to the official GHL MCP at https://services.leadconnectorhq.com/mcp/
// with the proper Authorization and locationId headers.
//
// This bypasses Anthropic's broken OAuth flow (Dec 2025 bug) and Cowork's lack of
// custom-header support by embedding auth credentials directly in the URL path,
// the same pattern Firecrawl uses (mcp.firecrawl.dev/fc-XXXXX/v2/mcp).

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 8000;
const UPSTREAM = 'https://services.leadconnectorhq.com';

// Trust proxy headers from Railway
app.set('trust proxy', true);

// Health check — no auth required
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ghl-mcp-proxy',
    upstream: UPSTREAM,
    timestamp: new Date().toISOString(),
  });
});

// Root — show usage
app.get('/', (req, res) => {
  res.type('text/plain').send(
    'GHL MCP Proxy\n' +
    '=============\n\n' +
    'Usage: POST/GET ' + req.protocol + '://' + req.get('host') + '/<PIT>/<LOCATION_ID>/mcp\n\n' +
    '  <PIT>         = your GHL Private Integration Token (pit-XXXXX-...)\n' +
    '  <LOCATION_ID> = your GHL sub-account location ID\n\n' +
    'Health: /health\n'
  );
});

// Main proxy route — captures PIT + locationId from the URL path
app.all('/:pit/:locationId/mcp*', (req, res, next) => {
  const { pit, locationId } = req.params;

  // Basic sanity checks
  if (!pit || pit.length < 10) {
    return res.status(400).json({ error: 'Invalid or missing PIT token in URL' });
  }
  if (!locationId || locationId.length < 4) {
    return res.status(400).json({ error: 'Invalid or missing locationId in URL' });
  }

  // Build the upstream path: /mcp/ + anything after /mcp in the original URL
  // Original: /:pit/:locationId/mcp/sse  ->  upstream: /mcp/sse
  // Original: /:pit/:locationId/mcp      ->  upstream: /mcp/
  const tail = req.params[0] || '';        // anything after /mcp
  const upstreamPath = '/mcp' + tail + (tail === '' && !req.originalUrl.endsWith('/') ? '/' : '');

  // Create a one-shot proxy middleware bound to this request's credentials
  const proxy = createProxyMiddleware({
    target: UPSTREAM,
    changeOrigin: true,
    ws: false,
    selfHandleResponse: false,
    // Rewrite path: strip /:pit/:locationId prefix
    pathRewrite: () => upstreamPath,
    // Inject auth headers
    onProxyReq: (proxyReq) => {
      proxyReq.setHeader('Authorization', 'Bearer ' + pit);
      proxyReq.setHeader('locationId', locationId);
      proxyReq.setHeader('Version', '2021-07-28');
      // Remove anything that might conflict
      proxyReq.removeHeader('cookie');
    },
    onProxyRes: (proxyRes) => {
      // Open CORS so Claude (any origin) can connect
      proxyRes.headers['access-control-allow-origin'] = '*';
      proxyRes.headers['access-control-allow-headers'] = '*';
      proxyRes.headers['access-control-allow-methods'] = 'GET,POST,OPTIONS,DELETE';
      proxyRes.headers['access-control-expose-headers'] = '*';
    },
    onError: (err, req, res) => {
      console.error('[proxy error]', err.message);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Upstream proxy error', detail: err.message });
      }
    },
    logLevel: 'warn',
  });

  return proxy(req, res, next);
});

// CORS preflight — handle OPTIONS for the MCP route
app.options('/:pit/:locationId/mcp*', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS,DELETE',
    'Access-Control-Max-Age': '86400',
  });
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log('[ghl-mcp-proxy] listening on port ' + PORT);
  console.log('[ghl-mcp-proxy] forwarding to ' + UPSTREAM + '/mcp/');
});
