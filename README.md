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

This repo is configured for Vercel serverless deployment via:

- `api/index.ts` (Vercel function entry)
- `vercel.json` (routes all requests to the function)

### Required environment variables

- `MONGODB_URI`
- `JWT_SECRET`
- `OPENAI_API_KEY`
- `GOOGLE_CLIENT_ID` (and platform client IDs if needed)
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `CORS_ORIGINS` (comma-separated frontend origins)

### Deploy

```bash
vercel
vercel --prod
```

### GitHub Actions CI/CD

Workflows are included in:

- `.github/workflows/ci.yml` (install + TypeScript build on push/PR)
- `.github/workflows/vercel-deploy.yml` (deploy to Vercel on `main`)

Configure these repository secrets before enabling deploy workflow:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
