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
- The production Cloudflare Pages URL is `https://exa-edulab.pages.dev`.
- Deploy `backend` as a Java 21 application or use `backend/Dockerfile`. Set `SPRING_PROFILES_ACTIVE=prod`, `MYSQLHOST`, `MYSQLPORT`, `MYSQLDATABASE`, `MYSQLUSER`, `MYSQLPASSWORD`, `JWT_SECRET`, and `CORS_ORIGINS` in the backend host's secret/environment settings. Set `GEMINI_API_KEY` for all AI import modes, including text, images, and scanned PDFs; AI Import uses Gemini only. The default model is `gemini-3.6-flash` and can be changed with `GEMINI_MODEL`. If a Gemini model is unavailable, the backend discovers supported Gemini models and retries them.
- ExaBot supports provider failover. Set `EXABOT_PROVIDER_ORDER` (default: `gemini,openrouter,openai,groq,deepseek`) and add each provider's private API key and model to Railway secrets: `OPENROUTER_API_KEY`/`OPENROUTER_MODEL`, `OPENAI_API_KEY`/`OPENAI_MODEL`, `GROQ_API_KEY`/`GROQ_MODEL`, or `DEEPSEEK_API_KEY`/`DEEPSEEK_MODEL`. Providers are tried in order when an API fails or reaches quota. Availability and free-tier limits vary; paid models may incur charges. Never expose keys in the frontend.
- AI import accepts TXT, DOCX, PDF, XLSX, XLS, PNG, JPG/JPEG, and WEBP up to 20MB (images and scanned PDFs are limited to 15MB). Teachers can extract existing questions or use Gemini to create questions from arbitrary source content, notes, short topics, or natural-language requests; generated questions do not require a preformatted exam or existing questions. Text can also be pasted directly.
- Teachers can open an exam's room code and invitation link from its card in **Đề thi & Bài tập**. Students can open the link or enter the code on that page; they must sign in with an EXA student account, and an invitation code only grants access while the exam is open.
- Math notation is rendered from `$...$` or `\(...\)`; chemical formulas and reactions use KaTeX mhchem, for example `$\ce{H2O}$` and `$\ce{2H2 + O2 -> 2H2O}$`.
- To enable Google sign-in, set the Firebase Web app variables `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID` in the frontend build environment. Enable Google as a Firebase Authentication provider and add the deployed frontend domain to Firebase's authorized domains. On the backend, set `FIREBASE_PROJECT_ID` and provide Firebase Admin Application Default Credentials (or the private `FIREBASE_SERVICE_ACCOUNT_JSON` secret). These settings are optional; Google sign-in stays disabled when the frontend config is missing and the backend can still start without Firebase.
- For Railway, deploy from the repository root and use `railway.toml`; do not set the Railway service root directory to `backend`. Mount a persistent volume at `/app/uploads` to preserve uploaded import files across deploys.
- Set `CORS_ORIGINS` to the exact HTTPS origin(s) of the Cloudflare Pages site, comma-separated, with no path or trailing slash. For this deployment include `https://exa-edulab.pages.dev`. Do not use `*` with credentials.
- Keep the MySQL service private to the backend network. Do not expose database passwords, JWT secrets, or Gemini keys in frontend variables.

See [docs/API.md](./docs/API.md) and [docs/deployment.md](./docs/deployment.md) for API and hosting details.