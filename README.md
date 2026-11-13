# transcendence

From the repository root, start DevUP with Docker Compose v2.24 or newer:

```sh
docker compose up --build
```

Open [DevUP](https://localhost) when the services are ready. Compose starts MySQL, applies database migrations, starts the API, and serves the frontend. Requests to port 8080 redirect to HTTPS on port 443. Nginx serves the UI, API, and chat on the same HTTPS origin. The backend has no published HTTP port.

On first launch, the frontend generates a self-signed localhost certificate and keeps it in the `frontend_tls` volume. For warning-free local use, export only the public certificate with `docker compose cp frontend:/etc/nginx/tls/cert.pem ./devup-local-cert.pem` and trust it in the test browser or OS. Keep the private key in the volume.

Set `HTTPS_PORT` in `.env` if port 443 is occupied, and `FRONTEND_PORT` to change the HTTP redirect port. For a custom hostname, set `PUBLIC_ORIGIN` to the full HTTPS origin and use a Compose override to mount a trusted certificate chain and private key as `/etc/nginx/tls/cert.pem` and `/etc/nginx/tls/key.pem`. Compose derives account email links and the GitHub redirect URLs from that origin. Register the HTTPS callback at `/api/github/callback` in your GitHub OAuth app. Configure your own secrets before deploying outside local development.
