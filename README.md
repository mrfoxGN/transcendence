# transcendence

From the repository root, start DevUP with Docker Compose v2.24 or newer:

```sh
docker compose up --build
```

Open [DevUP](http://localhost:8080) when the services are ready. Compose starts MySQL, applies database migrations, starts the API, and serves the frontend. The frontend serves page links and proxies API and chat requests on the same origin.

The command works on a fresh checkout with local development defaults. An optional `.env` can override `FRONTEND_PORT`, database credentials, and `JWT_SECRET`. For an existing `.env`, set `AUTH_PUBLIC_URL` and `GITHUB_OAUTH_FRONTEND_URL` to the frontend URL so account and GitHub links return there. Configure your own secrets before deploying outside local development.
