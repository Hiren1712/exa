# EXA (Exam Extra)

EXA is an online exam and classroom platform. The repository contains a React/Vite frontend and a Spring Boot API backed by MySQL.

## Local development

Requirements: Node.js, Java 21, Maven, and MySQL 8.

1. Copy `.env.example` to `.env` and replace the database passwords and JWT secret with private values. Do not commit `.env`.
2. Create the database named `exa` and configure its local connection values in `backend/src/main/resources/application-local.yml` or environment variables.
3. Start the API from `backend` with `mvn spring-boot:run -Dspring-boot.run.profiles=local`.
4. Start the frontend from `frontend` with `npm install` followed by `npm run dev`.

The Vite development server listens on port 3000 and proxies `/api` to `http://localhost:8080` by default. Set `VITE_API_PROXY_TARGET` to change that proxy target. The backend API base path is `/api`.
For local Google sign-in, copy `frontend/.env.example` to `frontend/.env.local` and fill in the Firebase Web app values. The backend also needs `FIREBASE_PROJECT_ID` and Firebase Admin credentials.

## Production deployment

- Build the frontend with `npm run build` in `frontend`.
- Deploy the generated `frontend/dist` directory to Cloudflare Pages with build command `npm run build` and build output directory `dist`.
- Set the Cloudflare Pages build variable `VITE_API_URL` to the public backend URL, including `/api` (for example `https://api.example.com/api`). Cloudflare builds require this variable to use HTTPS.
- Deploy `backend` as a Java 21 application or use `backend/Dockerfile`. Set `SPRING_PROFILES_ACTIVE=prod`, `MYSQLHOST`, `MYSQLPORT`, `MYSQLDATABASE`, `MYSQLUSER`, `MYSQLPASSWORD`, `JWT_SECRET`, and `CORS_ORIGINS` in the backend host's secret/environment settings. Set the backend secret `GEMINI_API_KEY` to enable AI import and Gemini-backed features; the default model is `gemini-2.5-flash` and can be changed with `GEMINI_MODEL`.
- AI import accepts DOCX, PDF, XLSX, and XLS up to 20MB. Text PDFs are extracted locally; scanned PDFs use Gemini OCR and must be no larger than 15MB.
- To enable Google sign-in, set the Firebase Web app variables `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID` in the frontend build environment. Enable Google as a Firebase Authentication provider and add the deployed frontend domain to Firebase's authorized domains. On the backend, set `FIREBASE_PROJECT_ID` and provide Firebase Admin Application Default Credentials (or the private `FIREBASE_SERVICE_ACCOUNT_JSON` secret). These settings are optional; Google sign-in stays disabled when the frontend config is missing and the backend can still start without Firebase.
- For Railway, deploy from the repository root and use `railway.toml`; do not set the Railway service root directory to `backend`. Mount a persistent volume at `/app/uploads` to preserve uploaded import files across deploys.
- Set `CORS_ORIGINS` to the exact HTTPS origin(s) of the Cloudflare Pages site, comma-separated, with no path or trailing slash. Do not use `*` with credentials.
- Keep the MySQL service private to the backend network. Do not expose database passwords, JWT secrets, or Gemini keys in frontend variables.

See [docs/API.md](./docs/API.md) and [docs/deployment.md](./docs/deployment.md) for API and hosting details.