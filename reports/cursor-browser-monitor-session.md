# Cursor IDE browser — monitoring workflow & session log

This file documents how we measure performance using Cursor’s **built-in browser** (MCP `cursor-ide-browser`) while you drive navigation manually.

## How monitoring works (important)

The IDE browser does **not** stream logs to disk by itself. The assistant pulls snapshots with tools:

| Tool | What it captures |
|------|------------------|
| `browser_tabs` | Open tabs, titles, URLs, **`viewId`** (needed per tab) |
| `browser_console_messages` | Console log/warn/error/debug (with URL + stack hints) |
| `browser_network_requests` | Requests since load: URL, method, type, status (no response bodies) |
| `browser_snapshot` | Accessibility tree + current URL/title |
| `browser_profile_start` / `browser_profile_stop` | CPU profile → summary under `~/.cursor/browser-logs/` |

**Cadence:** After you explore (or hit slow routes), send a short message such as **“capture”** or **“done”**. The assistant will call the tools again for the tab(s) you care about and **append a new round** below.

**Tip:** Prefer **one focused tab** (e.g. `http://localhost:3000` only) while profiling so network logs map cleanly to your clicks.

---

## Round 1 — 2026-05-01 (initial snapshot)

### Tabs observed

| # | Title | URL | `viewId` |
|---|--------|-----|----------|
| 0 | Dashboard · Proxima | `https://proximacursor.vercel.app/` | `bc4687` |
| 1 | Projects · Proxima | `http://localhost:3000/projects` | `ba37fa` |

### Local tab (`ba37fa`) — console signals worth fixing

1. **Recharts** — repeated errors: chart container width/height `-1` (layout not measured yet). Seen on `/` and `/sites/.../home`. Fix: explicit min height / `ResponsiveContainer` parent size / defer chart until layout (`ResizeObserver` or CSS `min-h`).
2. **`SitesTable`** — React warning: list children need stable **`key`** props (projects/sites table).
3. **Softgen Visual Editor** — `[Visual Editor] Platform not responding after 15s` (third-party script noise / retries in dev).
4. **Next.js HMR** — `[HMR] Invalid message ... isrManifest` (dev-only; noisy, may be Turbopack/HMR edge case).

### Local tab — network

- **~220** request rows captured (includes duplicates/prefetch; cumulative since navigation history in tab).
- Heavy **Fast Refresh** + dev bundles expected on localhost.

### Production tab (`bc4687`) — console

- Same **Recharts** dimension errors on dashboard chunks (`508.*.js`).
- **Softgen** monitoring script warnings.

### Production tab — network (high level)

- Typical shell: `_app`, many **`pages/*.js`** prefetches, **8× `/api/i18n/en/*`**, Supabase **profiles/stores/sync_runs** repeated, **Realtime WebSocket**, optional third-party scripts (`cdn.softgen.ai`, Quill CSS from jsDelivr, Google Fonts).

---

## Round 2 — *(paste after next capture)*

*(Waiting for your navigation + “capture” message.)*
