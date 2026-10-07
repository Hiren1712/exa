# EXA API

The Spring Boot API is served below `/api`. JSON endpoints use the common response envelope:

```json
{
  "success": true,
  "message": "OK",
  "data": {},
  "timestamp": "2026-01-01T00:00:00"
}
```

Authenticate with `POST /api/v1/auth/login` or `POST /api/v1/auth/register`. Send the returned access token as `Authorization: Bearer <token>` to protected routes. CORS origins are configured with the backend environment variable `CORS_ORIGINS`; provide comma-separated full origins, not URL paths.

## Main route groups

| Route | Purpose |
| --- | --- |
| `/api/v1/auth` | Login, registration, and current user |
| `/api/v1/users/me` | Profile and password settings |
| `/api/v1/classrooms` | Classroom CRUD, membership, and join codes |
| `/api/v1/questions` | Question bank, search, import, and bulk delete |
| `/api/v1/exams` | Exam management, question ordering, and publishing |
| `/api/v1/submissions` | Start, save, submit, results, proctor logs, and grading |
| `/api/v1/reports` | Exam reports, question analysis, and Excel export |
| `/api/v1/imports` | Document upload, preview, and question-bank save |
| `/api/v1/ai` | Pro-gated Gemini question generation and essay suggestions |
| `/api/actuator/health` | Health endpoint |

Use the application OpenAPI/Swagger endpoint when enabled to inspect request and response schemas for the running backend.