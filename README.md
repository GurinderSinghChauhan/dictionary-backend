# Dictionary Backend

Express and MongoDB backend for GrabVocab.

## Run

```bash
npm install
npm run dev
```

## CORS

The backend allows these development origins by default:

- `http://localhost:5173`
- `http://localhost:8081`
- `http://localhost:8082`
- `http://localhost:19006`
- `http://127.0.0.1` on the same ports

Add additional frontend origins with:

```bash
CORS_ORIGINS=https://your-web-app.com,https://preview.example.com
```

## Frontend Pairing

For the Expo frontend in `dictionary-frontend/frontend-app`, set:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:5000
```

## Deploy To Vercel

This repo is configured for Vercel deployment via:

- `src/app.ts` (Express app entry)
- `vercel.json` (Vercel Express framework config)

### Required environment variables

- `MONGODB_URI`
- `JWT_SECRET`
- `OPENAI_API_KEY`
- `GOOGLE_CLIENT_ID` (and platform client IDs if needed)
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `COMFYUI_BASE_URL` (required if image generation routes are used on Vercel)
- `CORS_ORIGINS` (comma-separated frontend origins)

### Deploy

```bash
vercel
vercel --prod
```

## API Documentation

- OpenAPI spec: `/openapi.json`
- Swagger UI: `/docs`

## Deployment Safety (Recommended)

Since Vercel auto-deploys on push to `main`, protect `main` with required checks:

1. GitHub -> Settings -> Branches -> Add branch protection rule for `main`
2. Enable:
   - Require a pull request before merging
   - Require status checks to pass before merging
3. Select required check:
   - `build` (from `.github/workflows/ci.yml`)

This ensures failed CI never reaches `main`, so Vercel only deploys validated commits.

### GitHub Actions CI/CD

Workflows are included in:

- `.github/workflows/ci.yml` (install + TypeScript build on push/PR)

Deployment is handled through Vercel Git Integration (recommended), so no
GitHub repository deploy secrets are required for this backend repo.
