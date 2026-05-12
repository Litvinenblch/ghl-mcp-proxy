# GHL MCP Proxy

A thin Node.js proxy that wraps the official GoHighLevel MCP at https://services.leadconnectorhq.com/mcp/ with token-in-URL authentication (Firecrawl pattern).

## URL format

https://<host>/<PIT>/<LOCATION_ID>/mcp

The proxy strips the prefix and forwards to the official GHL MCP with proper Authorization and locationId headers.

## Deploy

1. Connect this repo to Railway.
2. Railway auto-detects the Dockerfile and deploys.
3. Generate a public domain.
4. Use the URL above in Claude → Settings → Connectors → Add Custom Connector.

See server.js for full source.
