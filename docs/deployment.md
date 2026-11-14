# Deployment configuration

## Cloudflare Pages frontend

Use the `frontend` directory as the Pages project root, `npm run build` as the build command, and `dist` as the build output directory. Configure `VITE_API_URL` as a Pages build-time variable, including the backend context path, e.g. `https://api.example.com/api`. Cloudflare builds fail if this variable is missing or does not use HTTPS. This value is public and must never contain a secret.
The production Pages hostname is `exa-edulab.pages.dev`. Add any other hostname as a custom domain in the Cloudflare Pages project before using it. Keep `VITE_API_URL` pointed at the existing Railway backend URL; do not use the frontend domain for the API unless Railway is explicitly configured to serve the API there.

If testing the frontend locally against a remote API, set `VITE_API_URL` in the frontend build environment. For the Vite development proxy, use `VITE_API_PROXY_TARGET` for the backend origin, e.g. `https://api.example.com`; local default is `http://localhost:8080`.

To enable Google sign-in, set the public Firebase Web app build variables `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID` in Cloudflare Pages. Enable Google under Firebase Authentication providers and add the Pages hostname to Firebase Authentication's authorized domains. On the backend, set `FIREBASE_PROJECT_ID` and provide Firebase Admin credentials using the hosting platform's Application Default Credentials or the private `FIREBASE_SERVICE_ACCOUNT_JSON` secret. Railway does not provide Google Application Default Credentials automatically, so configure the JSON as a Railway secret there. Never put a service-account JSON file or secret in the frontend or repository. Firebase settings are optional; without them Google sign-in is unavailable.

## Spring Boot backend

Deploy the repository root to Railway and use the checked-in `railway.toml`; it builds with `backend/Dockerfile` and probes `/api/actuator/health`. Do not set a Railway service root directory to `backend`, because the Dockerfile build context is the repository root. Configure:

- `SPRING_PROFILES_ACTIVE=prod`
- `MYSQLHOST`, `MYSQLPORT`, `MYSQLDATABASE`, `MYSQLUSER`, `MYSQLPASSWORD`
- `JWT_SECRET` (generate a unique random value of at least 32 bytes)
- `CORS_ORIGINS` (exact Cloudflare Pages origin(s), comma-separated; include `https://exa-edulab.pages.dev`)
- AI Import lets teachers choose Groq or Gemini; the selected provider is tried first and the other is used automatically if it fails. Gemini model discovery/retries happen before its fallback to Groq. `GROQ_API_KEY` and `GROQ_MODEL` configure Groq; the configured model must support vision to process images or scanned PDFs. Groq scanned-PDF processing supports up to 3 pages; larger scans require Gemini or splitting the PDF. This task selection is independent of `EXABOT_PROVIDER_ORDER`.
- ExaBot can fail over across multiple providers. Set `EXABOT_PROVIDER_ORDER` to a comma-separated priority list using `gemini`, `openrouter`, `openai`, `groq`, or `deepseek` (default: `gemini,openrouter,openai,groq,deepseek`). Configure a provider's private API key and model to enable it:
  - `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` (OpenRouter model ID, such as `provider/model`)
  - `OPENAI_API_KEY` and `OPENAI_MODEL`
  - `GROQ_API_KEY` and optionally `GROQ_MODEL` (used by ExaBot and as the AI task fallback; defaults to `qwen/qwen3.8-27b`)
  - `DEEPSEEK_API_KEY` and `DEEPSEEK_MODEL`
  - `GEMINI_API_KEY` and `GEMINI_MODEL` (used by question extraction, image/scanned-PDF import, and AI Studio)
  For ExaBot, additional same-provider API keys can be set as numbered Railway variables, for example `gemini1`, `gemini2`, `deep1`, `deep2` (or `deepseek1`, `deepseek2`). The standard provider key is tried first, followed by numbered keys in numeric order; a failed key advances to the next key before ExaBot moves to the next provider in `EXABOT_PROVIDER_ORDER`. Numbered keys share that provider's configured model (`GEMINI_MODEL` or `DEEPSEEK_MODEL`).
  Optional endpoint overrides are `OPENROUTER_BASE_URL`, `OPENAI_BASE_URL`, `GROQ_BASE_URL`, and `DEEPSEEK_BASE_URL`; request timeout is configurable with `EXABOT_TIMEOUT_MS` (default 25000ms per compatible provider).
  Only enabled providers in the priority list are tried. When one fails (including rate limits or quota errors), ExaBot tries the next configured provider.   This does not increase any provider's own quota; free-tier limits and availability vary, and a configured model may incur charges. Keep all provider keys in Railway secrets, never in frontend variables or source code.
  In chat, users can choose Groq for concise responses or Gemini for step-by-step explanations. The selected provider is tried first; if it is unavailable or fails, ExaBot falls back through the configured provider order.
  ExaBot's built-in system prompt also contains a curated overview of EduLab and its user-provided project roster, distinguishes ExaBot from ChemAI, avoids presenting roadmap items or placeholder module names as live features, and refuses vulgar or sexually explicit requests. Update `ChatbotService.systemPrompt` and its tests when these product facts change. This is prompt context, not model fine-tuning. The backend gives three warnings for detected profanity or explicit pornographic terms, then applies a persistent five-minute chat ban on the next violation. It enforces a seven-second minimum between requests per account; Flyway creates the required state table.
  Proctor monitoring polls one batched overview every 10 seconds instead of requesting each student's event summary separately. Browser-reported events are review signals, not proof of misconduct; tab visibility, fullscreen, and clipboard behavior can be unreliable on some devices. Active attempts remain resumable if an exam is closed after the student starts.

Attach a Railway persistent volume at `/app/uploads` if uploaded import files must survive service restarts or redeployments.
AI import accepts TXT, DOCX, PDF, XLSX, XLS, PNG, JPG/JPEG, and WEBP files up to 20MB; images and scanned PDFs are limited to 15MB. The import flow supports extracting existing questions and generating questions from arbitrary source content, notes, short topics, tables, facts, or natural-language requests. Teachers can select Groq or Gemini, and the other configured provider is used as fallback. For images and scanned PDFs, the selected Groq model must support vision; Groq processing supports scanned PDFs of up to 3 pages. During extraction, AI preserves any marked answer and solves questions when the source has no answer key, filling the answer and a brief explanation when the available text/image is sufficient. Unclear or under-specified answers remain blank rather than being guessed; teachers review and edit the preview before saving. Generated questions do not require a preformatted exam or existing questions; teachers can paste plain text directly.
Gemini can transcribe and interpret image text, formulas, tables, charts, and diagrams; when a question depends on a visual, it describes visible details in the question text. It does not automatically crop separate images. During review, teachers can attach an image to a question or to each MCQ option, or reuse the uploaded source image. Saved question-media images are limited to 5MB and may be removed before saving.
Question formulas render in previews, the question bank, and exams using `$...$` or `\(...\)` for mathematics and KaTeX mhchem syntax such as `$\ce{H2O}$` for chemistry.

The backend uses Flyway migrations and `ddl-auto: validate` by default. Allow the service to complete migrations at startup and use a persistent, private MySQL database. Railway supplies `PORT` at runtime; the app binds to that port and its health check is `/api/actuator/health`.

Never add real credentials to `.env.example`, frontend variables, source code, or deployment manifests committed to the repository. Rotate any credential that has been exposed.
