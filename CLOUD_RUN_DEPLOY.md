# CLOUD_RUN_DEPLOY.md — Deployment & Infra Checklist

## 1. Container Runtime Configuration
- **Platform:** Google Cloud Run (Fully Managed Serverless Container)
- **Host Binding:** `0.0.0.0`
- **Dynamic Port:** `process.env.PORT` (automatically injected by Cloud Run, defaults to `8080`)
- **Health Check Probe:** `GET /healthz` returning HTTP `200 OK`
- **Production Build:** Vite compiles client assets to `/dist`, and esbuild bundles `server.ts` into a standalone CommonJS executable at `/dist/server.cjs`.

## 2. Dockerfile Specification (Multi-Stage Production Build)
```dockerfile
# Stage 1: Build Application
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .
RUN npm run build

# Stage 2: Production Execution Image
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/api ./api
COPY --from=builder /app/firebase-applet-config.json ./firebase-applet-config.json
EXPOSE 8080
CMD ["node", "dist/server.cjs"]
```

## 3. Step-by-Step Deployment Guide from Scratch

### Step 1: Install & Initialize Google Cloud SDK (`gcloud`)
If not already installed on your local terminal:
```bash
# Verify installation
gcloud version

# Log in to your Google Account
gcloud auth login
```

### Step 2: Set Your GCP Project
Select your active project (or create one in the Google Cloud Console):
```bash
# List your available projects
gcloud projects list

# Set your project ID (replace YOUR_PROJECT_ID)
gcloud config set project YOUR_PROJECT_ID
```

### Step 3: Enable Required Google Cloud Services
Run once to activate Cloud Run, Cloud Build, and Artifact Registry:
```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

### Step 4: Build and Push the Container Image via Cloud Build
Run this command from your project root directory (where `Dockerfile` is located):
```bash
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/currentnews-app:latest
```

### Step 5: Deploy the Service to Google Cloud Run
Deploy with serverless scaling, unauthenticated public web traffic, and 512MB RAM:
```bash
gcloud run deploy currentnews-app \
  --image gcr.io/YOUR_PROJECT_ID/currentnews-app:latest \
  --platform managed \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "NODE_ENV=production,PORT=8080,VITE_WRITERS=Current News Staff Report,mdhassan1738@gmail.com"
```
*(Tip: You can change `--region` to `us-central1`, `asia-south1` (Mumbai), or your preferred cloud region).*

### Step 6: Verify Deployment & Health Check
Cloud Run outputs your live service URL (e.g. `https://currentnews-app-xyz-as.a.run.app`). Verify:
```bash
# 1. Test health check endpoint
curl -sI https://currentnews-app-xyz-as.a.run.app/healthz
# Expected: HTTP/2 200 OK

# 2. Test robots.txt & Googlebot directives
curl -s https://currentnews-app-xyz-as.a.run.app/robots.txt

# 3. Test Google News XML Sitemap
curl -s https://currentnews-app-xyz-as.a.run.app/sitemap.xml | head -n 20
```

### Step 7: Map Custom Domain (`https://www.currentnews.blog`)
1. In the Google Cloud Console, navigate to **Cloud Run** > **Manage Custom Domains**.
2. Click **Add Mapping** and select the `currentnews-app` service.
3. Choose or enter your domain: `www.currentnews.blog`.
4. Copy the DNS records (A and AAAA or CNAME) provided by Cloud Run and add them into your DNS provider (Cloudflare, GoDaddy, Namecheap).
5. Google Cloud automatically provisions a managed SSL/TLS certificate for your domain within 15–30 minutes.

## 4. Optional Production Secrets & Environment Variables
To update environment variables at any time without rebuilding the container:
```bash
gcloud run services update currentnews-app \
  --region asia-southeast1 \
  --update-env-vars "VITE_WRITERS=Current News Staff Report,mdhassan1738@gmail.com,R2_ACCOUNT_ID=YOUR_ID,R2_ACCESS_KEY_ID=YOUR_KEY,R2_SECRET_ACCESS_KEY=YOUR_SECRET,R2_BUCKET_NAME=YOUR_BUCKET"
```

## 5. Deploy Directly from GitHub to Cloud Run (Automated CI/CD)

### Native GitHub Continuous Deployment (Zero CI/CD Files Needed)
Google Cloud Run directly connects to your GitHub repository using Google Cloud Build webhooks. No `.github/workflows` files are required (which avoids GitHub Personal Access Token `workflow` scope permission errors when pushing):

1. Push your codebase to your GitHub repository:
   ```bash
   git add .
   git commit -m "feat: resilient Dockerfile and Express server for Cloud Run"
   git push origin main
   ```
2. Go to [Google Cloud Console > Cloud Run](https://console.cloud.google.com/run).
3. Select your service (`currentnews-app`) > Click **Edit & Deploy New Revision** (or **Set Up Continuous Deployment**).
4. Select your GitHub repository (`Noor-Junior45/CurrentNews`).
5. Choose branch `^main$`.
6. Select Build Type: **Dockerfile** (location: `/Dockerfile`).
7. Click **Save**.

Every `git push origin main` will now trigger Cloud Build to run the multi-stage `Dockerfile`, execute the build, and deploy to Cloud Run automatically with zero authentication conflicts.





