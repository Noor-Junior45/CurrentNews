# CLOUD_RUN_DEPLOY.md — Deployment & Infra Checklist

## 1. Container Runtime Configuration
- **Platform:** Google Cloud Run (Fully Managed Serverless Container)
- **Host Binding:** `0.0.0.0`
- **Dynamic Port:** `process.env.PORT` (automatically injected by Cloud Run, defaults to `8080`)
- **Health Check Probe:** `GET /healthz` returning HTTP `200 OK`
- **Vercel Removal:** `vercel.json` and `@vercel/node` completely removed; server runs pure standalone Express.

## 2. Dockerfile Specification (Multi-Stage Production Build)
```dockerfile
# Stage 1: Build Application
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production Execution Image
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/api ./api
EXPOSE 8080
CMD ["node", "dist/server.cjs"]
```

## 3. Cloud Run Deploy Commands
```bash
# 1. Build and push container to Google Artifact Registry
gcloud builds submit --tag gcr.io/PROJECT_ID/currentnews-app:latest

# 2. Deploy to Cloud Run
gcloud run deploy currentnews-app \
  --image gcr.io/PROJECT_ID/currentnews-app:latest \
  --platform managed \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "NODE_ENV=production,PORT=8080"
```

## 4. Required Production Environment Variables
- `PORT=8080`
- `VITE_WRITERS` (Comma-separated list of editorial bylines and authorized writer emails, e.g. "Staff Report,mdhassan1738@gmail.com,...")
- `RESEND_API_KEY`, `RESEND_SENDER_EMAIL` (Optional, for subscriber email notifications)
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` (For Cloudflare media uploads)


