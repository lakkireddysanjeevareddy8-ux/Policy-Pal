# PolicyPal 🏛️🇮🇳
> **Intelligent Government Scheme Discovery & Cross-Scheme Document Readiness Tracker for Indian Citizens**

[![Node.js](https://img.shields.io/badge/Node.js-v24.x-339933?logo=node.js)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-v4.21-000000?logo=express)](https://expressjs.com)
[![React](https://img.shields.io/badge/React-v19.x-61DAFB?logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-v8.x-646CFF?logo=vite)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4.x-38B2AC?logo=tailwind-css)](https://tailwindcss.com)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-2.5_Flash-4285F4?logo=google)](https://ai.google.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-336791?logo=postgresql)](https://supabase.com)

---

## 🌐 Live Demo
- **Frontend App**: [https://policy-pal-six.vercel.app](https://policy-pal-six.vercel.app)
- **Backend API Health**: [https://policy-pal-tbti.onrender.com/health](https://policy-pal-tbti.onrender.com/health)
- **Demo Credentials**:
  - Email: `demo@policypal.app`
  - Password: `Demo@12345`

---

## 📚 Deliverable Documentation
- 🏛️ **[System Architecture & Database Design Guide](docs/ARCHITECTURE.md)** — In-depth architectural blueprint, user personas, complete database schema, assessment sequence diagram, and Row Level Security (RLS) rationale.
- 🤖 **[Gemini AI Integration & Security Architecture](docs/AI_INTEGRATION.md)** — Detailed breakdown of the 3-step pipeline (`extractProfile`, `matchSchemes`, `buildChecklist`), prompt hardening, Zod validation & backoff retry strategy, anti-hallucination catalog grounding, and secret safety.
- 🚀 **[Production Deployment & Hosting Guide](DEPLOYMENT.md)** — End-to-end production setup covering Supabase PostgreSQL, migration, idempotent seeding, Render backend setup, Vercel frontend, strict CORS lockdown, and live smoke test.

---

## 📌 Problem Statement
Millions of Indian citizens—farmers, students, daily wage earners, and small entrepreneurs—miss out on eligible Central and State welfare subsidies because:
1. Eligibility rules are buried in complex administrative circulars.
2. Portals require formal legal terminology rather than everyday language.
3. Citizens do not know which documents they already possess or where to obtain missing ones.
4. **The Redundancy Problem:** When applying for multiple schemes, citizens are repeatedly asked for the same core documents (Aadhaar, PAN, Bank Passbook, Land Records).

**PolicyPal solves this:**
- The citizen describes their life situation in natural language (**13 Indian languages (English, Hindi, Telugu, Tamil, Kannada, Malayalam, Marathi, Gujarati, Bengali, Punjabi, Odia, Assamese, Urdu)**).
- **Google Gemini 2.5 Flash** parses the unstructured story into an economic profile and matches it against curated scheme rules.
- **THE TWIST — Document Readiness Tracker:** Documents are shared across schemes. When a user marks "Aadhaar - ready" once, the readiness progress bar updates across *every single scheme* requiring Aadhaar. The citizen instantly sees which scheme is closest to being application-ready.

---

## 👥 User Roles
- **Citizen / Applicant:**
  - Describes household background in plain language.
  - Reviews AI match score, exact eligibility reasoning, and step-by-step application checklists.
  - Manages unified document repository with cross-scheme synchronization.
  - Tracks application stages (`saved` → `applying` → `applied`).
- **Guest / Public Explorer:**
  - Browses the public catalog of 20 curated central and state schemes with keyword search and category filters.
  - Tests the interactive live Document Readiness Tracker demonstration on the landing page.

---

## 🏗️ Architecture Diagram

```mermaid
graph TD
    subgraph Client["Client (React + Vite + Tailwind CSS)"]
        UI["User Interface / Multilingual (13 Indian Languages)"]
        AuthCtx["Auth Context and JWT Store"]
        DocTrackerUI["Shared Document Readiness Tracker"]
        AxiosClient["Axios with Bearer Interceptor"]
    end

    subgraph Gateway["Server (Node.js + Express)"]
        SecMW["Helmet + CORS + Morgan"]
        RateLimiter["Express Rate Limiter: Auth and AI"]
        AuthMW["JWT Verification Middleware"]
        ZodValidator["Zod Schema Request Validation"]
        Router["REST API Router /api/*"]
    end

    subgraph Database["Database (PostgreSQL / Supabase)"]
        UsersTab[("users")]
        ProfilesTab[("profiles")]
        SchemesTab[("schemes - 20 Curated")]
        DocTypesTab[("document_types - 16 Keys")]
        UserDocsTab[("user_documents - Shared Tracker")]
        AssessmentsTab[("assessments")]
        MatchesTab[("scheme_matches")]
        RLS["Row Level Security Enabled"]
    end

    subgraph AI["Google GenAI Service"]
        GeminiSDK["@google/genai SDK"]
        Model["gemini-2.5-flash (JSON Mode)"]
        ZodAISchema["Zod AI Response Validation"]
    end

    UI --> AxiosClient
    AxiosClient -->|"HTTP / JSON"| SecMW
    SecMW --> RateLimiter
    RateLimiter --> AuthMW
    AuthMW --> ZodValidator
    ZodValidator --> Router
    Router -->|"pg Pool / SQL Scoped by user_id"| Database
    Router -->|"extractProfile / matchSchemes / buildChecklist"| GeminiSDK
    GeminiSDK --> Model
    Model --> ZodAISchema
```

---

## 🗄️ Database Schema & RLS

All tables utilize UUID primary keys (`DEFAULT gen_random_uuid()`) and timestamps (`created_at`, `updated_at`). **Row Level Security (RLS) is enabled on all tables** with no public policies, as only the backend connects with authorized service credentials.

```mermaid
erDiagram
    users ||--o| profiles : "has one"
    users ||--o{ user_documents : "manages"
    users ||--o{ assessments : "submits"
    users ||--o{ scheme_matches : "owns"
    document_types ||--o{ user_documents : "references key"
    assessments ||--o{ scheme_matches : "generates"
    schemes ||--o{ scheme_matches : "matched against"

    users {
        uuid id PK
        text email UK
        text password_hash
        text full_name
        text preferred_language
    }

    profiles {
        uuid id PK
        uuid user_id FK
        int age
        text gender
        text state
        text district
        text occupation
        numeric annual_income
        text social_category
        numeric land_holding_acres
        boolean is_farmer
        boolean is_student
        boolean is_business_owner
        int family_size
    }

    schemes {
        uuid id PK
        text slug UK
        text name
        text name_te
        text name_hi
        text ministry
        text level
        text category
        text benefit_summary
        text eligibility_summary
        text_array required_doc_keys
        jsonb application_steps
        text official_url
        date last_verified
    }

    document_types {
        uuid id PK
        text key UK
        text label
        text label_te
        text label_hi
        text where_to_get
    }

    user_documents {
        uuid id PK
        uuid user_id FK
        text doc_key FK
        boolean is_ready
        text notes
        timestamptz ready_at
    }

    assessments {
        uuid id PK
        uuid user_id FK
        text situation_text
        text language
        jsonb extracted_profile
        text ai_summary
        boolean archived
    }

    scheme_matches {
        uuid id PK
        uuid assessment_id FK
        uuid user_id FK
        uuid scheme_id FK
        int match_score
        text eligibility_reason
        jsonb missing_info
        text status
        jsonb ai_checklist
    }
```

---

## 🤖 AI Workflow Breakdown

The system implements a 3-stage pipeline located in `/server/src/services/ai`:

1. **`extractProfile(situationText, language)`**
   - System instruction strictly prompts the model to ignore any instructions inside the user text (jailbreak protection).
   - Extracts demographic variables (`age`, `occupation`, `land_holding_acres`, `annual_income`, `is_farmer`, `is_student`, etc.).
   - Returns a friendly 1-paragraph summary in the citizen's chosen language plus missing-info questions.
2. **`matchSchemes(profile, catalog, language)`**
   - The server passes a compact representation of curated catalog schemes.
   - The model evaluates scheme eligibility rules against the facts and outputs matches with `match_score >= 50` (max 8).
   - **Strict server-side validation:** Any `scheme_id` not found in the official catalog is dropped.
3. **`buildChecklist(profile, scheme, language)`**
   - Builds 4–7 personalized application steps consistent with the scheme's official procedure.
   - Run in parallel for all matched schemes using a concurrency cap (`Promise.all` with chunking).

### Secret Management & Resilience
- `GEMINI_API_KEY`, `JWT_SECRET`, and `DATABASE_URL` exist exclusively in server environment variables. Never exposed to the client bundle.
- Every Gemini response uses `responseMimeType: application/json` and is validated against Zod schemas. If validation fails, it retries once; if it fails again, it returns a clean HTTP 502 error.
- An intelligent deterministic rule-based fallback is included so test suites and offline development continue to operate smoothly even before an API key is supplied.

---

## 🚀 Setup & Local Running

### Prerequisites
- Node.js v18+ (tested on Node v24)
- npm v9+

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-username/PolicyPal.git
cd PolicyPal

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Environment Variables
Copy `.env.example` to `.env` in both folders:

**Server (`/server/.env`):**
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/policypal # Or your Supabase connection string
JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters
JWT_EXPIRES_IN=7d
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

*(Note: If `DATABASE_URL` is omitted in local development, PolicyPal automatically initializes an embedded WebAssembly PostgreSQL engine with full persistence in `/server/.pglite_data` for zero-configuration startup).*

**Client (`/client/.env`):**
```env
VITE_API_URL=http://localhost:5000/api
```

### 3. Run Migrations & Seed Data
```bash
cd server
npm run migrate
npm run seed
```

This seeds:
- **20 real national schemes**: PM-KISAN, PM Fasal Bima Yojana, Kisan Credit Card, Rythu Bandhu, PM Awas Yojana, Ayushman Bharat PM-JAY, Aarogyasri, Sukanya Samriddhi Yojana, PM Mudra Yojana, Stand-Up India, PM SVANidhi, PM Vishwakarma, MGNREGA, PM Ujjwala Yojana, Atal Pension Yojana, PM Jeevan Jyoti Bima, PM Suraksha Bima, National Scholarship Portal, Janani Suraksha Yojana, NSAP old-age pension.
- **16 document types**: Aadhaar, PAN, Income Certificate, Caste Certificate, Land Records, etc.
- **Pre-configured Demo Account**: `demo@policypal.app` / `Demo@12345`.

### 4. Start Development Servers
In two separate terminals:

```bash
# Terminal 1: Backend API
cd server
npm run dev
# Running at http://localhost:5000

# Terminal 2: Frontend Client
cd client
npm run dev
# Running at http://localhost:5173
```

### 5. Run Automated Test Suite
```bash
cd server
npm test
```
Runs 8 comprehensive end-to-end integration and security test suites verifying authentication, password hashing, Zod validation, cross-user isolation, document synchronization, and full CRUD.

---

## 🔑 Test Credentials

| Role | Email | Password | Pre-loaded Data |
|---|---|---|---|
| **Demo Citizen** | `demo@policypal.app` | `Demo@12345` | Small farmer profile (Telangana), 4 active documents, sample assessment with 5 matched schemes |

---

## 🌐 REST API Reference

All endpoints return `{ success: true, data: ... }` or `{ success: false, error: { code, message, details? } }`.

### Authentication & Profile
- `POST /api/auth/register` - Create new citizen account
- `POST /api/auth/login` - Authenticate & obtain JWT
- `GET /api/auth/me` - Get current session
- `POST /api/auth/logout` - Discard session
- `GET /api/profile` - Retrieve demographic profile
- `PUT /api/profile` - Update demographic profile

### Schemes Catalog (Public)
- `GET /api/schemes` - List schemes (supports `q`, `category`, `level`, `page`, `limit`)
- `GET /api/schemes/:slug` - Get single scheme details & required documents

### AI Welfare Assessments
- `POST /api/assessments` - Run 3-step Gemini AI workflow on user situation text
- `GET /api/assessments` - List user assessments (supports `archived`, `q`)
- `GET /api/assessments/:id` - Get assessment with matched schemes & readiness
- `PATCH /api/assessments/:id` - Edit `situation_text` or `archived` status
- `DELETE /api/assessments/:id` - Delete assessment & associated matches
- `POST /api/assessments/:id/rerun` - Re-evaluate assessment with AI

### Cross-Scheme Document Readiness Tracker
- `GET /api/documents` - Fetch 16 document types merged with user ready state & scheme dependency count
- `PUT /api/documents/:key` - Set `is_ready` and personal notes (synchronizes across all schemes)

### Scheme Matches & Applications
- `GET /api/matches` - List user matches with SQL readiness percentage (`sort_by=score` or `sort_by=readiness`)
- `PATCH /api/matches/:id` - Update status (`saved`, `applying`, `applied`, `rejected`, `archived`)
- `PATCH /api/matches/:id/checklist/:index` - Toggle checklist step completion

### Dashboard
- `GET /api/dashboard` - Stats (`total_matches`, `applications_in_progress`, `overall_document_readiness_percent`, `top_closest_to_ready_schemes`)

### Multimodal Voice Transcription
- `POST /api/voice/transcribe` - Verbatim native script speech-to-text via Gemini (auth required, multipart/base64, max 1.5MB, in-memory processing only, PII redaction)

### Multilingual PolicyPal Assistant (Chatbot)
- `POST /api/chat` - Send citizen inquiry, receive grounded reply, action buttons & followups
- `GET /api/chat/conversations` - List conversations for user (supports search `q`)
- `GET /api/chat/conversations/:id` - Retrieve conversation history & messages
- `PATCH /api/chat/conversations/:id` - Rename or archive conversation
- `DELETE /api/chat/conversations/:id` - Delete conversation & messages

---

## 🎙️ Multimodal Voice Input & PolicyPal Assistant

### 1. Dual-Path Voice Input Foundation
- **Primary Engine**: Browser Web Speech API (`webkitSpeechRecognition` / `SpeechRecognition`) with continuous capture and live interim feedback.
- **Fallback Engine**: Automated switch to `MediaRecorder` + backend Gemini multimodal audio transcription when browser speech recognition is unavailable or restricted.
- **Microphone on Situation Textarea & Profile Notes**: Located in the corner of the situation box on New Assessment and Profile Notes; appends transcribed sentences non-destructively without overwriting existing text.
- **Speaking Language Synchronizer**: Displays dynamic native indicator (`Speaking in: తెలుగు / हिन्दी / English`) synced with the chosen evaluation language.

### 2. Voice-Enabled Multilingual Assistant ("PolicyPal Assistant")
- **Lazy-Loaded Interface**: `React.lazy` floating assistant available on all authenticated pages; renders as an ergonomic bottom sheet on 375px mobile screens.
- **Grounded AI Guidance**: Grounded strictly on the citizen's profile, top scheme matches, readiness percentages, and compact 20-scheme catalog.
- **Action Navigation**: AI responses include verified next-step action buttons (`open_scheme`, `open_documents`, `start_assessment`, `open_applications`) that route internally with React Router.
- **Client-Side Speech Output**: Native browser synthesis (`window.speechSynthesis`) reading replies in native Indic speech without calling external TTS APIs.
- **Conversation Management**: Searchable chat history, instant new session button, and deletion.

### 3. Voice Languages Actually Tested Live
During Phase 5 verification, the following languages were verified with live Gemini API requests:
- 🇬🇧 **English (`en-IN`)**: Verified PM-KISAN documentation queries, catalog grounding, and injection defense.
- 🇮🇳 **Telugu (`te-IN`)**: Verified verbatim Telugu script output (`పీఎం-కిసాన్ పథకానికి ఆధార్ కార్డ్, భూమి రికార్డులు...`).
- 🇮🇳 **Hindi (`hi-IN`)**: Verified Devanagari script output (`पीएम-किसान योजना के लिए आधार कार्ड, भूमि रिकॉर्ड...`).
- 🇮🇳 **Tamil (`ta-IN`)**: Verified Tamil script output (`பிஎம்-கிசான் திட்டத்திற்கு ஆதார் அட்டை, நில ஆவணங்கள்...`).
- All 13 supported Indic codes (`en-IN`, `hi-IN`, `te-IN`, `ta-IN`, `kn-IN`, `ml-IN`, `mr-IN`, `gu-IN`, `bn-IN`, `pa-IN`, `or-IN`, `as-IN`, `ur-IN`) are configured in `speechLanguages.js`.

### 4. Browser Support & Compatibility
| Browser | Web Speech API | MediaRecorder Fallback | Speech Synthesis |
| :--- | :---: | :---: | :---: |
| **Google Chrome / Chromium** | ✅ Native | ✅ Supported | ✅ Native |
| **Microsoft Edge** | ✅ Native | ✅ Supported | ✅ Native |
| **Mozilla Firefox** | ⚠️ Fallback to Server | ✅ Automatic Fallback | ✅ Native |
| **Apple Safari (macOS / iOS)** | ⚠️ Fallback to Server | ✅ Automatic Fallback | ✅ Native |

### 5. Privacy Guarantee & Limitations
- **Audio Never Stored**: Audio input is held strictly in volatile RAM memory buffer during transcription and immediately discarded. No audio is ever written to disk or database.
- **Automatic PII Redaction**: 12-digit Aadhaar numbers, PAN patterns, OTPs, and bank account numbers are scrubbed in memory into `[REDACTED]` prior to AI submission or database persistence.
- **Secure Context Requirement**: Microphone access requires HTTPS (or `localhost`). If accessed over plain HTTP, voice buttons cleanly hide and display a privacy note.

---

## 🚢 Production Deployment

### 1. Database (Supabase PostgreSQL)
1. Create a project at [supabase.com](https://supabase.com).
2. Go to **Project Settings > Database > Connection Pooling**.
3. Copy the **URI** connection string.
4. Set it as `DATABASE_URL` in your server environment variables.
5. Migrations and seeding will automatically execute upon server startup.

### 2. Backend (Render)
1. Fork/push this repository to GitHub.
2. In Render, click **New > Blueprint** and select `server/render.yaml` (or create a **Web Service** with root directory `server`).
3. Set environment variables:
   - `DATABASE_URL` = Your Supabase Postgres pooler URI
   - `JWT_SECRET` = A strong 64-char string
   - `GEMINI_API_KEY` = Your Google AI Studio API key
   - `CLIENT_URL` = Your Vercel frontend URL (e.g. `https://policypal.vercel.app`)
4. Build command: `npm install && npm run migrate && npm run seed`
5. Start command: `npm start`

### 3. Frontend (Vercel)
1. In Vercel, click **Add New > Project** and import the repository.
2. Set **Root Directory** to `client`.
3. Framework Preset: **Vite**.
4. Add Environment Variable:
   - `VITE_API_URL` = Your Render backend URL (e.g. `https://policypal-backend.onrender.com/api`)
5. Deploy. `client/vercel.json` already contains the SPA routing configuration.

---

## 🛡️ License
Built for public good under the [MIT License](LICENSE).
