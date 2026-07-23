# Things‑Bear MCP Server

A minimal Model Context Protocol (MCP) server written in **Node.js** / **TypeScript** that provides integration with:

- **Things 3** – read data from the local SQLite database and create tasks/projects via the `things:///` URL scheme.
- **Bear** – read notes from its SQLite store and create/edit notes via the `bear://x‑callback‑url/` scheme.

The server exposes a simple HTTP API (Express) and also registers a Model Context server on port **3000** (you can switch to SSE by changing the transport config).

## Prerequisites

- macOS machine (e.g., a Mac Mini) with **Things** and **Bear** installed.
- Node.js **>=18** and npm.
- A GitHub account (the repo is already created under `SideMatter`).
- Tailscale Funnel or Cloudflare Tunnel if you want to expose the server outside your LAN.

## Setup

```bash
# Clone the repo
git clone https://github.com/SideMatter/things-bear-mcp.git
cd things-bear-mcp

# Install dependencies
npm install

# Build
npm run build
```

## Running locally

```bash
# Start the Express API (listening on 8080) and the Model Context server (port 3000)
npm start
```

You should see:
```
Express server listening on port 8080
ModelContext server started on http://localhost:3000
```

## Exposing via Tailscale Funnel

1. Install Tailscale and log in.
2. Run the funnel command:
   ```bash
   sudo tailscale funnel 8080
   ```
3. Tailscale will provide a public URL like `https://<unique>.ts.net`. Use that URL to call the API from anywhere.

## Exposing via Cloudflare Tunnel

1. Install `cloudflared` and authenticate with your Cloudflare account.
2. Create a tunnel:
   ```bash
   cloudflared tunnel create things-bear-mcp
   ```
3. Run the tunnel:
   ```bash
   cloudflared tunnel run things-bear-mcp --url http://localhost:8080
   ```
4. Cloudflare will give you a URL like `https://things-bear-mcp.<your-subdomain>.trycloudflare.com`.

## API Endpoints

- `GET /things/projects` – returns raw SQLite rows for Things projects.
- `POST /things/add` – body `{ "title": "Task", "project": "Project Name" }` creates a new task.
- `GET /bear/notes` – returns raw SQLite rows for Bear notes.
- `POST /bear/create` – body `{ "title": "Note", "text": "Content" }` creates a new Bear note.

## Development

Edit `src/index.ts` to add more routes or improve the Model Context models. After changes run:

```bash
npm run build
npm start
```

## License

MIT – feel free to fork and extend.
