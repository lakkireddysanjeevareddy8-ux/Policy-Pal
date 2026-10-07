# PolicyPal Deployment Guide

This guide details the step-by-step production deployment workflow for **PolicyPal** across **Supabase** (Managed PostgreSQL), **Render** (Express API Server), and **Vercel** (Vite + React SPA).

Follow the steps in the exact sequence outlined below.

---

## Architecture Topology

```mermaid
flowchart LR
    Citizen((Indian Citizen)) -->|HTTPS| Vercel[Vercel Frontend\nReact + Vite SPA]
    Vercel -->|REST API with JWT| Render[Render Backend\nExpress Server Node.js]
    Render -->|Pooled SSL Query| Supabase[(Supabase\nPostgreSQL 15+)]
    Render -->|AI Prompts & Extraction| Gemini[Google Gemini 2.5 Flash]
```

---

## Deployment Step-by-Step Sequence

### 1. Provision Supabase Database
1. Navigate to [Supabase](https://supabase.com/) and click **New Project**.
2. Set your **Database Password** securely and select the nearest AWS region (e.g. `ap-south-1` Mumbai).
3. Under **Project Settings -> Database -> Connection string**, copy the URI under **URI (Pooled or Direct)**.
4. Format:
   ```text
   postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require
   ```

---

### 2. Run Database Migrations
Run the database migrations against the Supabase database. You can run this locally from your terminal before deploying:

```bash
# In the repository root
export DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require"

# Execute migration script
npm run server:migrate
```

This applies:
- `001_initial_schema.sql` (Tables: `users`, `profiles`, `schemes`, `document_types`, `user_documents`, `assessments`, `scheme_matches`)
- `002_add_updated_at_triggers.sql` (Automated timestamp triggers on all tables)

---

### 3. Run Database Seed (Idempotent)
Seed the curated scheme catalog, document types, and prefilled demo user account:

```bash
# Execute idempotent seed script
npm run server:seed
```

**Seed Verification:**
- 16 Document types seeded.
- 20 Government welfare schemes seeded across Central and State jurisdictions.
- Demo user created:
  - **Email**: `demo@policypal.app`
  - **Password**: `Demo@12345`
  - **State**: Telangana, 2.5 acres farmland, cotton/maize cultivation.
  - Prefilled assessment with matched schemes (PM-KISAN, Rythu Bandhu, KCC, Aarogyasri).
  - Aadhaar and Bank Passbook marked as ready to demonstrate the Cross-Scheme Readiness Tracker.

---

### 4. Deploy Express Server on Render
Deploy the backend on [Render](https://render.com).

#### Option A: Using the Blueprint (`render.yaml`)
1. In Render, select **Blueprints** -> **New Blueprint Instance**.
2. Connect your Git repository. Render will automatically parse [render.yaml](file:///c:/Users/Sanjeeva%20Reddy/OneDrive/Attachments/Desktop/Policy_Pal/render.yaml).
3. Fill in the required environment variables:
   - `DATABASE_URL`: Your Supabase connection string.
   - `GEMINI_API_KEY`: Your Google AI Studio API key.
   - `JWT_SECRET`: Random 64-character secret.
   - `CLIENT_ORIGIN`: Your temporary or expected Vercel URL (e.g. `https://policypal.vercel.app`).

#### Option B: Manual Web Service Creation
- **Name**: `policypal-backend`
- **Root Directory**: `server`
- **Runtime**: `Node`
- **Build Command**: `npm install && npm run migrate && npm run seed`
- **Start Command**: `npm start`
- **Health Check Path**: `/health`
- **Environment Variables**:
  | Variable | Value / Notes |
  |---|---|
  | `NODE_ENV` | `production` |
  | `PORT` | `10000` |
  | `DATABASE_URL` | `postgresql://...` (Supabase connection string) |
  | `JWT_SECRET` | Strong 64-character cryptographic string |
  | `JWT_EXPIRES_IN` | `7d` |
  | `GEMINI_API_KEY` | Google Gemini API key |
  | `GEMINI_MODEL` | `gemini-2.5-flash` |
  | `CLIENT_ORIGIN` | `https://<your-app>.vercel.app` |

Once deployed, test the health check endpoint:
```bash
curl https://policypal-backend.onrender.com/health
# Response: {"success":true,"data":{"status":"ok","service":"PolicyPal API",...}}
```

---

### 5. Deploy Frontend Client on Vercel
Deploy the React frontend on [Vercel](https://vercel.com):

1. Click **Add New Project** and import the GitHub repository.
2. Configure project settings:
   - **Root Directory**: `client`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Add Environment Variable:
   - `VITE_API_URL`: `https://policypal-backend.onrender.com/api` (URL of your Render service)
4. Click **Deploy**.
5. Once complete, copy your production domain (e.g., `https://policypal-citizen.vercel.app`).
6. Single Page Application (SPA) routing is handled by [client/vercel.json](file:///c:/Users/Sanjeeva%20Reddy/OneDrive/Attachments/Desktop/Policy_Pal/client/vercel.json), preventing 404 errors on browser page reloads.

---

### 6. Set `CLIENT_ORIGIN` on Render
Lock down the API CORS policy to allow only your production Vercel frontend:

1. In Render, go to your `policypal-backend` service -> **Environment**.
2. Set or update `CLIENT_ORIGIN` to:
   ```text
   https://policypal-citizen.vercel.app
   ```
3. Save changes. Render will perform a zero-downtime rolling restart.
4. With this in place, browser requests from other domains will be rejected by CORS policy, while legitimate citizen requests from Vercel and local development (`localhost:5173`) are permitted.

---

### 7. Test the Live Login and Application Flow
Perform an end-to-end smoke test on the live production URL:

1. **Open Live App**: Open `https://policypal-citizen.vercel.app` in a browser.
2. **Cold Start Verification**: If the Render free-tier container is waking up, confirm the banner appears:
   > *"Waking up the server (Render free-tier cold start)... Please hold on for a moment!"*
3. **Demo Login**:
   - Email: `demo@policypal.app`
   - Password: `Demo@12345`
   - Verify dashboard loads with the readiness ring, status funnel, and category distribution charts.
4. **Cross-Scheme Readiness**:
   - Navigate to **Document Tracker** (`/documents`).
   - Toggle **Pattadar Passbook / Land Record** to "Ready".
   - Notice the readiness percentage immediately updates across PM-KISAN, Rythu Bandhu, and Kisan Credit Card.
5. **AI Scheme Discovery**:
   - Click **New Scheme Check** (`/assessments/new`).
   - Enter a situation in plain English, Telugu, or Hindi.
   - Verify that matched schemes and personalized checklists render without errors.
6. **SPA Route Refresh**:
   - Press **F5 / Reload** on `/dashboard`, `/applications`, and `/schemes`.
   - Confirm the page reloads properly without 404 errors.
