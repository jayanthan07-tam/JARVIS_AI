# Secure J.A.R.V.I.S. backend deployment

## Current hosting model

The existing app is a Next.js server with API routes and a SQLite database. It needs a Node.js host with persistent storage; a static export or a serverless filesystem that resets between requests is not suitable for the current database. The API uses SQLite's existing tables and does not change their schema.

Production API routes require the owner password and signing secret described below. Requests are limited by size and rate, unsafe browser requests are checked against their origin, and failures avoid returning filesystem paths, provider responses, or local service addresses. Rate limits are process-local; use one Next.js instance behind a reverse proxy unless a shared rate-limit store is added later.

## Local Windows host with HTTPS

This setup keeps Next.js and the existing Ollama service on the same laptop. Next.js listens on loopback port 3000; Caddy handles public HTTPS on ports 80 and 443. The Ollama service should stay on loopback port 11434 and must not be exposed through router forwarding or a public firewall rule.

1. Copy `.env.example` to `.env.production.local` and set a strong `JARVIS_ACCESS_PASSWORD` (at least 16 characters) and a private `JARVIS_AUTH_SECRET` (at least 32 characters). Generate a secret with:

   ```powershell
   node -p "require('node:crypto').randomBytes(48).toString('base64url')"
   ```

   Keep `.env.production.local` outside source control and backups that are shared publicly. Add provider keys there only if you want those server-side providers.

2. Build the existing project with `npm ci` and `npm run build`.

3. Start the Next.js service on loopback:

   ```powershell
   .\deploy\Start-JarvisServer.ps1
   ```

   Keep that process running. The script does not bind Next.js to the LAN.

4. Install Caddy on the host, copy `deploy/Caddyfile.example` to the Caddy configuration location, and replace `jarvis.example.com` with a domain you control. Point its DNS records to the laptop's public address and allow inbound ports 80 and 443 to Caddy only. Caddy obtains HTTPS certificates after DNS and ports are reachable.

5. Open the HTTPS domain on the phone and enter it in the Android app. The app then displays the sign-in screen. Enter the server's `JARVIS_ACCESS_PASSWORD`; the server sets a seven-day, HTTP-only, SameSite Strict session cookie.

If using host Ollama, leave `OLLAMA_HOST` at `http://127.0.0.1:11434`. A phone reaches the J.A.R.V.I.S. HTTPS server; Ollama remains on the laptop. The laptop must be on and the Next.js process running for local AI. Cloud AI can respond when configured even if Ollama is offline.

## Data and backups

SQLite remains at `data/jarvis.db` by default. Set `JARVIS_DATA_DIR` to a persistent directory when moving the service. Back up the data directory while the application is stopped, and keep backups private because they contain conversation history, memories, and reminders. No automatic hosted-database migration has been made.

## Deployment limits

This environment has no domain, DNS control, public-host credentials, or running Caddy service, so no public deployment or HTTPS URL has been created. The Caddy and PowerShell deployment files are setup guidance and have not been tested against a public domain. Do not enter an Android backend URL until the required server credentials are configured and HTTPS is reachable.
