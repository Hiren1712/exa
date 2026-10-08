# Deployment configuration

## Cloudflare Pages frontend

Use the `frontend` directory as the Pages project root, `npm run build` as the build command, and `dist` as the build output directory. Configure `VITE_API_URL` as a Pages build-time variable, including the backend context path, e.g. `https://api.example.com/api`. Cloudflare builds fail if this variable is missing or does not use HTTPS. This value is public and must never contain a secret.

If testing the frontend locally against a remote API, set `VITE_API_URL` in the frontend build environment. For the Vite development proxy, use `VITE_API_PROXY_TARGET` for the backend origin, e.g. `https://api.example.com`; local default is `http://localhost:8080`.

To enable Google sign-in, set the public Firebase Web app build variables `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID` in Cloudflare Pages. Enable Google under Firebase Authentication providers and add the Pages hostname to Firebase Authentication's authorized domains. On the backend, set `FIREBASE_PROJECT_ID` and provide Firebase Admin credentials using the hosting platform's Application Default Credentials or the private `FIREBASE_SERVICE_ACCOUNT_JSON` secret. Never put a service-account JSON file or secret in the frontend or repository. Firebase settings are optional; without them Google sign-in is unavailable.

## Spring Boot backend

Deploy the repository root to Railway and use the checked-in `railway.toml`; it builds with `backend/Dockerfile` and probes `/api/actuator/health`. Do not set a Railway service root directory to `backend`, because the Dockerfile build context is the repository root. Configure:

- `SPRING_PROFILES_ACTIVE=prod`
- `MYSQLHOST`, `MYSQLPORT`, `MYSQLDATABASE`, `MYSQLUSER`, `MYSQLPASSWORD`
- `JWT_SECRET` (generate a unique random value of at least 32 bytes)
- `CORS_ORIGINS` (exact Cloudflare Pages origin(s), comma-separated)
- Optional `GEMINI_API_KEY`

Attach a Railway persistent volume at `/app/uploads` if uploaded import files must survive service restarts or redeployments.

The backend uses Flyway migrations and `ddl-auto: validate` by default. Allow the service to complete migrations at startup and use a persistent, private MySQL database. Railway supplies `PORT` at runtime; the app binds to that port and its health check is `/api/actuator/health`.

Never add real credentials to `.env.example`, frontend variables, source code, or deployment manifests committed to the repository. Rotate any credential that has been exposed.
