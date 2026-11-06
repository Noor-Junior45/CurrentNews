# Cloud Run & Neon Production Setup Checklist

Follow these exact verification and provisioning commands once to connect your Neon PostgreSQL editorial database, assign server-side admin privileges via Firebase Custom Claims, and route traffic to `admin.currentnews.blog`:

---

### Step 1: Run Neon Database Migrations
Initialize the `staff`, `articles`, indexes, and `audit_log` tables in your Neon PostgreSQL database.

```bash
# In your local shell or Cloud Shell with NEON_DATABASE_URL exported:
export NEON_DATABASE_URL="postgres://currentnews_app:<password>@<ep-xyz>.us-east-2.aws.neon.tech/currentnews?sslmode=require"
node scripts/migrate-neon.mjs
```

---

### Step 2: Assign Admin Role via Firebase Custom Claims
Authenticate with Google Cloud Application Default Credentials (ADC) and grant the `admin` custom claim to your Google account. This revokes refresh tokens to ensure the new role is minted immediately on next sign-in.

```bash
# Authenticate with your GCP project
gcloud auth application-default login

# Assign admin role (run from Cloud Shell or local terminal)
node scripts/set-role.mjs mdhassan1738@gmail.com admin
```

*(Note: To grant writer permissions to another reporter later: `node scripts/set-role.mjs reporter@currentnews.blog writer`)*

---

### Step 3: Add `NEON_DATABASE_URL` as a Cloud Run Secret & Redeploy
Store the database credentials securely in Google Cloud Secret Manager so the server reads it at runtime without exposing it to client bundles.

```bash
# Create the secret in Secret Manager
echo -n "postgres://currentnews_app:<password>@<ep-xyz>.us-east-2.aws.neon.tech/currentnews?sslmode=require" | \
  gcloud secrets create NEON_DATABASE_URL --data-file=-

# Grant Cloud Run service account access to the secret
gcloud secrets add-iam-policy-binding NEON_DATABASE_URL \
  --member="serviceAccount:<service-account-number>-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Update Cloud Run service with the secret and project id
gcloud run deploy currentnews \
  --set-secrets="NEON_DATABASE_URL=NEON_DATABASE_URL:latest" \
  --set-env-vars="FIREBASE_PROJECT_ID=gen-lang-client-0638643565" \
  --region="us-central1"
```

---

### Step 4: Add `admin.currentnews.blog` to Firebase Authorized Domains
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Select project **`gen-lang-client-0638643565`**.
3. Navigate to **Authentication** > **Settings** > **Authorized domains**.
4. Click **Add domain** and enter:
   ```
   admin.currentnews.blog
   ```
5. Click **Save**.

---

### Step 5: Sign Out & Sign In Again on Admin Host
1. Visit `https://admin.currentnews.blog/admin`.
2. Sign out if already signed in.
3. Sign in using `mdhassan1738@gmail.com` via Google Sign-In.
4. Firebase Auth will mint a fresh ID token containing `claims: { role: 'admin' }`.
5. The admin dashboard, draft composer, publication manager, and audience registry will load seamlessly with full server-side authorization.

---

### Verification Endpoints & Commands
- **Check Role via CLI:**
  ```bash
  node scripts/set-role.mjs mdhassan1738@gmail.com
  ```
- **Test Admin Identity API (with Bearer Token):**
  ```bash
  curl -i -H "Authorization: Bearer <ID_TOKEN>" https://admin.currentnews.blog/api/admin/me
  ```
- **Verify Public Domain Redirection:**
  ```bash
  curl -I https://currentnews.blog/admin
  # Expected: HTTP/1.1 301 Moved Permanently -> Location: https://admin.currentnews.blog/admin
  ```
- **Verify Admin API Block on Reader Host:**
  ```bash
  curl -i https://currentnews.blog/api/admin/articles
  # Expected: HTTP/1.1 404 Not Found
  ```
- **Verify Robots Directive on Admin Host:**
  ```bash
  curl -I https://admin.currentnews.blog/admin
  # Expected: X-Robots-Tag: noindex, nofollow
  ```

---

### Step 6: Deploy Cloudflare Worker & Run D1 Migrations
Deploy the hardened edge worker (`worker/src/index.ts`) with Firebase role-based authorization, rate limits, Durable Object persistent stat aggregation, and strict origin allowlist.

```bash
# 1. Switch to worker directory
cd worker

# 2. Run D1 database migration (creates missing tables and idx_reactions_user_id index)
npx wrangler d1 execute currentnews-db --remote --file=schema.sql

# 3. Deploy the worker to production
npx wrangler deploy
```

---

### Cloudflare Worker Verification Endpoints & Commands
Run these adversarial verification checks against `https://api.currentnews.blog`:

1. **Verify Edge Worker Health Check:**
   ```bash
   curl -i https://api.currentnews.blog/health
   # Expected: HTTP/1.1 200 OK
   # {"status":"operational","service":"currentnews-worker"}
   ```

2. **Verify Admin Route Block without Authentication (401 Unauthorized):**
   ```bash
   curl -i https://api.currentnews.blog/subscribers
   # Expected: HTTP/1.1 401 Unauthorized
   # {"error":"Missing or invalid authorization token"}
   ```

3. **Verify Admin Route Block with Non-Admin Token (403 Forbidden):**
   ```bash
   curl -i -H "Authorization: Bearer <REGULAR_READER_OR_WRITER_TOKEN>" https://api.currentnews.blog/subscribers
   # Expected: HTTP/1.1 403 Forbidden
   # {"error":"Admin role required"}
   ```

4. **Verify Input Fuzzing Defense on Reactions (400 Bad Request on invalid postId):**
   ```bash
   curl -i -X POST https://api.currentnews.blog/reaction/invalid--postId--with--bad--chars\$\$\$ -H "Content-Type: application/json" -d '{"action":"like"}'
   # Expected: HTTP/1.1 400 Bad Request
   # {"error":"Invalid postId format"}
   ```

5. **Verify Request Body Size Cap (413 Payload Too Large on oversized payload):**
   ```bash
   # Any body exceeding 16KB on standard endpoints is rejected before parsing
   curl -i -X POST https://api.currentnews.blog/subscribe -H "Content-Type: application/json" -d "{\"email\":\"$(head -c 20000 < /dev/zero | tr '\0' 'a')@example.com\"}"
   # Expected: HTTP/1.1 413 Payload Too Large
   ```
