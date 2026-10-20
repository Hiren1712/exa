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
- Add `exa-edulab.page.dev` as the Cloudflare Pages custom domain for the frontend.
- Deploy `backend` as a Java 21 application or use `backend/Dockerfile`. Set `SPRING_PROFILES_ACTIVE=prod`, `MYSQLHOST`, `MYSQLPORT`, `MYSQLDATABASE`, `MYSQLUSER`, `MYSQLPASSWORD`, `JWT_SECRET`, and `CORS_ORIGINS` in the backend host's secret/environment settings. AI Import uses `EXABOT_PROVIDER_ORDER` (default `gemini,openrouter,openai,groq,deepseek`) for text extraction and question generation, automatically trying configured providers and numbered API keys in order. Configure each provider's API key and model; Gemini accepts `GEMINI_API_KEY` or numbered keys such as `gemini1`, `gemini2`, and so on. Images and scanned PDFs require Gemini for vision/OCR. If a Gemini model is unavailable, the backend discovers supported models and retries them.
- ExaBot supports provider failover. Set `EXABOT_PROVIDER_ORDER` (default: `gemini,openrouter,openai,groq,deepseek`) and add each provider's private API key and model to Railway secrets: `OPENROUTER_API_KEY`/`OPENROUTER_MODEL`, `OPENAI_API_KEY`/`OPENAI_MODEL`, `GROQ_API_KEY`/`GROQ_MODEL`, or `DEEPSEEK_API_KEY`/`DEEPSEEK_MODEL`. Providers are tried in order when an API fails or reaches quota. Availability and free-tier limits vary; paid models may incur charges. Never expose keys in the frontend.
- AI import accepts DOCX, PDF, XLSX, XLS, PNG, JPG/JPEG, and WEBP up to 20MB (images and scanned PDFs are limited to 15MB). Teachers can extract existing questions, generate questions from arbitrary source content, notes, short topics, or natural-language requests, or paste text directly; text imports use provider failover and images/scanned PDFs require Gemini vision. Generated questions do not require a preformatted exam or existing questions.
- Math notation is rendered from `$...$` or `\(...\)`; chemical formulas and reactions use KaTeX mhchem, for example `$\ce{H2O}$` and `$\ce{2H2 + O2 -> 2H2O}$`.
- To enable Google sign-in, set the Firebase Web app variables `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID` in the frontend build environment. Enable Google as a Firebase Authentication provider and add the deployed frontend domain to Firebase's authorized domains. On the backend, set `FIREBASE_PROJECT_ID` and provide Firebase Admin Application Default Credentials (or the private `FIREBASE_SERVICE_ACCOUNT_JSON` secret). These settings are optional; Google sign-in stays disabled when the frontend config is missing and the backend can still start without Firebase.
- For Railway, deploy from the repository root and use `railway.toml`; do not set the Railway service root directory to `backend`. Mount a persistent volume at `/app/uploads` to preserve uploaded import files across deploys.
- Set `CORS_ORIGINS` to the exact HTTPS origin(s) of the Cloudflare Pages site, comma-separated, with no path or trailing slash. For this deployment include `https://exa-edulab.page.dev`. Do not use `*` with credentials.
- Keep the MySQL service private to the backend network. Do not expose database passwords, JWT secrets, or Gemini keys in frontend variables.

See [docs/API.md](./docs/API.md) and [docs/deployment.md](./docs/deployment.md) for API and hosting details.