# Deployment configuration

## Cloudflare Pages frontend

Use the `frontend` directory as the Pages project root, `npm run build` as the build command, and `dist` as the build output directory. Configure `VITE_API_URL` as a Pages build-time variable, including the backend context path, e.g. `https://api.example.com/api`. This value is public and must never contain a secret.

If testing the frontend locally against a remote API, set `VITE_API_URL` in the frontend build environment. For the Vite development proxy, use `VITE_API_PROXY_TARGET` for the backend origin, e.g. `https://api.example.com`; local default is `http://localhost:8080`.

## Spring Boot backend

Deploy from `backend` using Java 21/Maven or the provided Dockerfile. Configure:

- `SPRING_PROFILES_ACTIVE=prod`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET` (generate a unique random value of at least 32 bytes)
- `CORS_ORIGINS` (exact Cloudflare Pages origin(s), comma-separated)
- Optional `GEMINI_API_KEY`

The backend uses Flyway migrations and `ddl-auto: validate` by default. Allow the service to complete migrations at startup and use a persistent, private MySQL database. Expose port 8080 and configure the platform health check as `/api/actuator/health`.

Never add real credentials to `.env.example`, frontend variables, source code, or deployment manifests committed to the repository. Rotate any credential that has been exposed.
