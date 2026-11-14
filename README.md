# EXA — Exam Extra

**English** | [Tiếng Việt](./README.vi.md)

EXA is an online assessment and classroom platform built for teaching and learning. Teachers can organize classrooms, maintain a question bank, create and publish exams, review submissions, and use AI-assisted tools to prepare learning materials. Students can join open exams, submit answers, and review their results.

Production frontend: [exa-edulab.pages.dev](https://exa-edulab.pages.dev)

## Contents

- [Highlights](#highlights)
- [Technology](#technology)
- [Repository layout](#repository-layout)
- [Requirements](#requirements)
- [Run locally](#run-locally)
- [Environment configuration](#environment-configuration)
- [Build and test](#build-and-test)
- [API overview](#api-overview)
- [Production deployment](#production-deployment)
- [Security and operational notes](#security-and-operational-notes)
- [Documentation](#documentation)

## Highlights

### Teaching and classroom management

- Separate teacher and student experiences, with role-protected features.
- Create classrooms, manage membership, and share classroom join codes.
- Build and organize a reusable question bank.
- Create, publish, and manage exams and assignments.
- Share an exam room code or invitation link with students.
- Review submissions, grade written answers, and analyze exam and question performance.
- Export supported reports for further review.

### Exams and assessment

- Support multiple-choice and written-answer questions.
- Save exam progress and submit attempts for grading.
- Render mathematical notation using `$...$` or `\(...\)` and chemistry notation with KaTeX mhchem, for example `$\ce{H2O}$`.
- Add images to a question or individual multiple-choice options. Image-backed options remain associated with their content when options are shuffled.
- Store question media in MySQL so it does not depend on a particular application server's local disk.
- Resume an active attempt when an exam is closed after the student has started.

### AI-assisted preparation and ExaBot

- Import TXT, DOCX, PDF, XLSX, XLS, PNG, JPG/JPEG, and WEBP files up to 20 MB. Images and scanned PDFs are limited to 15 MB.
- Extract questions from source materials or generate questions from notes, topics, tables, facts, or pasted text. Teachers can review and edit the generated preview before saving.
- Use Gemini or Groq for supported AI import workflows. Image and scanned-PDF processing requires a vision-capable model; the Groq scanned-PDF fallback supports up to three pages.
- Ask ExaBot for learning support. Chat requests can fail over through the configured AI providers.
- ExaBot applies account-level moderation: three warnings for detected inappropriate messages, then a five-minute chat ban for the next violation. A seven-second minimum interval is enforced between chat requests.
- Render equations and formatted text in chat and learning materials.

### Exam monitoring

- Collect browser-reported events and present a batched overview for teacher review.
- Monitoring events are indicators, not proof of misconduct. Browser visibility, focus, fullscreen, or clipboard signals can be affected by device and browser behavior.
- The monitoring feature does not claim to identify a person or establish cheating from those signals alone.

## Technology

| Area | Technologies |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Java 21, Spring Boot 3, Spring Security |
| Database | MySQL 8, Flyway migrations, Spring Data JPA |
| AI integrations | Gemini, Groq, and optional OpenAI-compatible providers |
| Production hosting | Cloudflare Pages (frontend), Railway (backend) |

## Repository layout

```text
.
├── backend/
│   ├── src/main/java/vn/exa/       # Spring Boot application
│   ├── src/main/resources/         # Configuration and Flyway migrations
│   ├── src/test/                   # Backend tests
│   └── Dockerfile
├── frontend/
│   ├── src/api/                    # API clients and types
│   ├── src/components/             # Shared UI, including ExaBot
│   ├── src/hooks/                  # Shared React hooks
│   └── src/pages/                  # Application pages
├── docs/
│   ├── API.md                      # API route overview
│   └── deployment.md               # Hosting and environment details
├── docker-compose.yml              # MySQL, backend, and Nginx deployment stack
├── railway.toml                    # Railway build and health-check configuration
├── README.md                       # English project guide
└── README.vi.md                    # Vietnamese project guide
```

## Requirements

- Node.js and npm (use a current LTS release).
- Java 21.
- Maven 3.9 or later.
- MySQL 8. For local development, Docker Desktop can run the included MySQL service.

## Run locally

### 1. Configure and start MySQL

From the repository root, copy the example environment file and replace every password and secret placeholder with private values:

```powershell
Copy-Item .env.example .env
```

Start only the database service:

```powershell
docker compose up -d mysql
```

The backend uses environment variables directly; it does not automatically load the root `.env` file. In the same PowerShell window, configure the local connection and a private JWT secret:

```powershell
$env:SPRING_PROFILES_ACTIVE = "dev"
$env:DB_HOST = "localhost"
$env:DB_PORT = "3306"
$env:DB_NAME = "exa"
$env:DB_USER = "exa"
$env:DB_PASSWORD = "replace-with-the-value-from-.env"
$env:JWT_SECRET = "replace-with-a-private-random-secret-of-at-least-32-bytes"
$env:CORS_ORIGINS = "http://localhost:3000,http://localhost:5173"
```

Flyway applies database migrations on backend startup. Hibernate validates the schema; it is not configured to create or update production tables automatically.

### 2. Start the backend

Open a terminal with the backend environment variables set:

```powershell
Set-Location backend
mvn spring-boot:run
```

The API listens on `http://localhost:8080/api`. The health endpoint is `http://localhost:8080/api/actuator/health`.

### 3. Start the frontend

In another terminal:

```powershell
Set-Location frontend
npm ci
npm run dev
```

Vite serves the frontend at `http://localhost:3000` and proxies `/api` requests to `http://localhost:8080` by default. To use a different backend origin, set `VITE_API_PROXY_TARGET` in the frontend build/dev environment.

Google sign-in is optional. For local Google sign-in, copy `frontend/.env.example` to `frontend/.env.local` and configure the Firebase Web app values. The backend also needs `FIREBASE_PROJECT_ID` and Firebase Admin credentials.

## Environment configuration

Keep secrets in your local environment or hosting-provider secret manager. Never commit `.env`, API keys, Firebase service-account credentials, database passwords, or JWT secrets.

### Backend

| Variable | Purpose |
| --- | --- |
| `SPRING_PROFILES_ACTIVE` | Selects the profile, for example `dev` or `prod`. |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Local/default-profile MySQL connection. |
| `MYSQLHOST`, `MYSQLPORT`, `MYSQLDATABASE`, `MYSQLUSER`, `MYSQLPASSWORD` | Production-profile MySQL connection; commonly provided by Railway. |
| `JWT_SECRET` | Private signing secret. Use a unique random value of at least 32 bytes. |
| `CORS_ORIGINS` | Comma-separated frontend origins, with scheme but no path. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini access and optional model selection. |
| `GROQ_API_KEY`, `GROQ_MODEL` | Groq access and optional model selection. The configured model must support vision for image/scanned-PDF tasks. |
| `EXABOT_PROVIDER_ORDER` | ExaBot provider priority; defaults to `gemini,openrouter,openai,groq,deepseek`. |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | Optional OpenRouter chat provider. |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Optional OpenAI-compatible chat provider. |
| `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL` | Optional DeepSeek chat provider. |
| `EXABOT_TIMEOUT_MS` | Timeout for compatible ExaBot providers; defaults to 25000 ms. |
| `FIREBASE_PROJECT_ID` | Firebase project used for Google sign-in verification. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Optional private Firebase Admin service-account JSON when platform credentials are unavailable. |

ExaBot only uses providers that are configured and enabled in `EXABOT_PROVIDER_ORDER`. Provider availability, quotas, and pricing are controlled by their respective services. AI import provider selection and ExaBot provider priority are separate settings.

### Frontend

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Public backend API base URL, including `/api`, for production builds. Must use HTTPS on Cloudflare Pages. |
| `VITE_API_PROXY_TARGET` | Backend origin used by Vite's local `/api` proxy; defaults to `http://localhost:8080`. |
| `VITE_FIREBASE_API_KEY` | Firebase Web app configuration for Google sign-in. |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Web app authentication domain. |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Web app project ID. |
| `VITE_FIREBASE_APP_ID` | Firebase Web app ID. |

Frontend `VITE_*` values are included in the browser bundle and are not secret storage. Never place private provider keys or service-account credentials in frontend variables.

## Build and test

Frontend:

```powershell
Set-Location frontend
npm ci
npm run build
npm run lint
```

Backend:

```powershell
Set-Location backend
mvn test
```

Build the backend container from the repository root:

```powershell
docker build -f backend/Dockerfile -t exa-backend .
```

## API overview

The backend serves JSON APIs below `/api`. Protected routes use a bearer token in the `Authorization` header. Successful responses use the common `{ success, message, data, timestamp }` envelope.

| Route group | Purpose |
| --- | --- |
| `/api/v1/auth` | Registration, login, and current-user operations |
| `/api/v1/users/me` | Profile and password settings |
| `/api/v1/classrooms` | Classrooms, membership, and join codes |
| `/api/v1/questions` | Question bank, search, import, and bulk operations |
| `/api/v1/exams` | Exam creation, publishing, and question ordering |
| `/api/v1/submissions` | Attempts, answers, grading, results, and proctor events |
| `/api/v1/reports` | Exam reports, question analysis, and exports |
| `/api/v1/imports` | Upload, AI extraction/generation, preview, and saving |
| `/api/v1/ai` | AI question generation, essay suggestions, and ExaBot chat |
| `/api/actuator/health` | Service health check |

See [docs/API.md](./docs/API.md) for the route summary. When enabled, the running application also exposes OpenAPI/Swagger documentation.

## Production deployment

### Frontend — Cloudflare Pages

1. Use `frontend` as the Pages project root.
2. Set the build command to `npm run build` and the output directory to `dist`.
3. Set `VITE_API_URL` to the Railway backend URL including `/api`, for example `https://your-service.up.railway.app/api`.
4. Configure the `VITE_FIREBASE_*` build variables if Google sign-in is enabled.
5. Add the Pages hostname to Firebase Authentication's authorized domains when using Google sign-in.

The production frontend is [exa-edulab.pages.dev](https://exa-edulab.pages.dev).

### Backend — Railway

1. Deploy from the repository root and use the checked-in `railway.toml`. Do not set the service root directory to `backend`; the Docker build context is the repository root.
2. Configure `SPRING_PROFILES_ACTIVE=prod`, the `MYSQL*` connection variables, a private `JWT_SECRET`, exact `CORS_ORIGINS`, and the AI/Firebase variables needed by the enabled features.
3. Use a persistent private MySQL database. Flyway migrations run on startup; wait for startup and the health check to succeed.
4. Attach a persistent volume at `/app/uploads` if uploaded import files must survive restarts or redeployments.

The Railway health check is `/api/actuator/health`. See [docs/deployment.md](./docs/deployment.md) for detailed provider setup, import limits, and production guidance.

### Docker Compose

The root `docker-compose.yml` describes a MySQL, backend, and Nginx deployment stack. It expects a configured root `.env`, a built frontend at `frontend/dist`, and valid deployment settings. For local frontend development, start only `mysql` as shown above rather than starting the full production-oriented stack.

## Security and operational notes

- Use strong, unique secrets and private database networking. Restrict `CORS_ORIGINS` to exact trusted HTTPS origins in production.
- Do not commit credentials or upload private learner information to AI providers unless your organization has reviewed the provider's privacy and data-retention terms.
- AI-generated questions and answers are suggestions. Teachers should review them for correctness and suitability before assigning them.
- Imported files are limited by size and format; source documents should not contain content users are not authorized to share with configured AI services.
- Proctor events are browser-reported review signals and can be inaccurate. They must not be treated as conclusive evidence by themselves.
- Monitor database backups, upload storage, provider usage, and service health as part of operating a production instance.

## Documentation

- [Vietnamese project guide](./README.vi.md)
- [API overview](./docs/API.md)
- [Deployment and environment setup](./docs/deployment.md)
