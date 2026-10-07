# PolicyPal — System Architecture & Database Design

## 1. Problem Statement
Across India, over 800 Central and State government welfare programs offer critical direct benefit transfers (DBT), subsidized loans, healthcare coverage, and educational scholarships. However, tens of millions of deserving citizens—including smallholders, sharecroppers, informal laborers, artisans, and underprivileged students—never benefit because:
- **Linguistic and Bureaucratic Disconnect**: Scheme guidelines are published in dense administrative legalese, predominantly in standard English or official Hindi.
- **Fragmented Discovery**: Eligibility criteria are scattered across dozens of ministry websites and state portals (e.g., pmkisan.gov.in, myscheme.gov.in, dharani.telangana.gov.in).
- **The Redundant Documentation Burden**: Every time a citizen applies for a scheme, they must re-verify which certificates they possess. A single document (like an Aadhaar Card or Bank Passbook) is shared by dozens of schemes, yet no existing portal tracks cross-scheme readiness.

**PolicyPal** solves this by providing:
1. Natural language voice/text input in **English, Telugu (తెలుగు), and Hindi (हिन्दी)**.
2. AI-driven profile extraction and eligibility matching powered by **Google Gemini 2.5 Flash**.
3. **The Shared Document Readiness Tracker**: Ticking a document as ready once instantly updates readiness percentages across *every* scheme requiring that certificate, highlighting the schemes closest to completion.

---

## 2. User Roles & Personas
- **Citizen / Applicant (Authenticated)**:
  - Submits free-form situations in everyday language.
  - Receives match scores (0–100), customized justification reasons, and personalized 4–7 step checklists.
  - Manages the unified Document Tracker (16 shared national document types).
  - Tracks application lifecycles: `saved` → `applying` → `applied` → `rejected` / `archived`.
- **Public Explorer (Guest)**:
  - Explores the public catalog of 20+ verified central and state schemes with instant search, category filtering, and level toggles.
  - Experiments with the interactive live Document Readiness Tracker demo on the landing page.
- **PolicyPal Backend Service (Internal)**:
  - The single authorized database consumer connecting with secure service-level credentials.
  - Orchestrates Gemini GenAI calls, validates AI outputs against Zod schemas, and calculates mathematical readiness in SQL.

---

## 3. High-Level System Architecture

```mermaid
graph TB
    subgraph ClientLayer ["Client Layer (React 19 + Vite + Tailwind CSS)"]
        SPA["Single Page Application (SPA)"]
        Router["React Router v7"]
        AuthContext["Auth Context (JWT + Language: EN/TE/HI)"]
        AxiosClient["Axios Client (Bearer Interceptor + 401 Redirect)"]
        SPA --> Router --> AuthContext --> AxiosClient
    end

    subgraph SecurityLayer ["Security & Ingress Layer"]
        Helmet["Helmet (HTTP Security Headers)"]
        CORS["CORS (Restricted to CLIENT_ORIGIN & Localhost)"]
        RateLimiter["Rate Limiters (Auth: 30/15m, AI: 20/15m)"]
        AuthMW["JWT Auth Middleware (Bearer Token Verification)"]
        ZodMW["Zod Request Validator (Body, Query, Params)"]
    end

    subgraph ServerLayer ["Server Layer (Node.js + Express)"]
        AuthController["Auth Controller (bcrypt cost 10)"]
        ProfileController["Profile Controller (user_id Scoped)"]
        SchemeController["Scheme Controller (Public Catalog)"]
        DocumentController["Document Controller (Shared Tracker)"]
        MatchController["Match Controller (SQL Readiness Engine)"]
        AssessmentController["Assessment Controller (AI Orchestrator)"]
    end

    subgraph AIEngine ["AI Layer (Google Gemini)"]
        GeminiSDK["@google/genai SDK"]
        Model["gemini-2.5-flash (JSON Mode)"]
        ZodAI["Zod AI Schema Validator & Retry Engine"]
    end

    subgraph DataLayer ["Data Layer (Supabase PostgreSQL)"]
        DB[(PostgreSQL Database)]
        RLS["Row Level Security (RLS: Enabled on All Tables)"]
        Triggers["updated_at Auto-Update Triggers"]
    end

    AxiosClient -->|HTTPS REST| Helmet
    Helmet --> CORS --> RateLimiter --> AuthMW --> ZodMW
    ZodMW --> AuthController & ProfileController & SchemeController & DocumentController & MatchController & AssessmentController
    AssessmentController <-->|JSON Mode Prompts| GeminiSDK <--> Model <--> ZodAI
    ServerLayer <-->|pg Pool / SQL Queries scoped by user_id| DB
    DB --- RLS
    DB --- Triggers
```

---

## 4. Database Schema & Relational Structure

All tables use standard UUID v4 primary keys (`DEFAULT gen_random_uuid()`) and UTC timestamps with timezone (`TIMESTAMPTZ`).

```mermaid
erDiagram
    users ||--o| profiles : "has one (1:1)"
    users ||--o{ user_documents : "maintains (1:N)"
    users ||--o{ assessments : "submits (1:N)"
    users ||--o{ scheme_matches : "owns (1:N)"
    document_types ||--o{ user_documents : "keyed by doc_key (1:N)"
    assessments ||--o{ scheme_matches : "generates (1:N)"
    schemes ||--o{ scheme_matches : "matched to (1:N)"

    users {
        uuid id PK
        text email UK "Case-insensitive unique"
        text password_hash "Bcrypt cost 10+"
        text full_name
        text preferred_language "en | te | hi"
        timestamptz created_at
        timestamptz updated_at
    }

    profiles {
        uuid id PK
        uuid user_id FK "Unique FK to users(id) ON DELETE CASCADE"
        int age "0-125"
        text gender
        text state
        text district
        text occupation
        numeric annual_income "Annual INR"
        text social_category "General, OBC, SC, ST, EWS"
        numeric land_holding_acres
        text education_level
        boolean is_student
        boolean is_farmer
        boolean is_business_owner
        int family_size
        text notes
        timestamptz created_at
        timestamptz updated_at
    }

    schemes {
        uuid id PK
        text slug UK "Unique slug (e.g. pm-kisan)"
        text name "Official English Name"
        text name_te "Telugu Name"
        text name_hi "Hindi Name"
        text ministry
        text level "central | state"
        text state "Nullable, specified for state schemes"
        text category "agriculture, health, education, housing, finance, etc."
        text benefit_summary
        text eligibility_summary
        text_array required_doc_keys "Array of FK keys from document_types"
        jsonb application_steps "Ordered array of {title, detail}"
        text official_url
        date last_verified
        timestamptz created_at
        timestamptz updated_at
    }

    document_types {
        uuid id PK
        text key UK "Unique key (e.g. aadhaar, pan, land_records)"
        text label "English title"
        text label_te "Telugu title"
        text label_hi "Hindi title"
        text where_to_get "Official issuing authority instructions"
        timestamptz created_at
        timestamptz updated_at
    }

    user_documents {
        uuid id PK
        uuid user_id FK "FK to users(id) ON DELETE CASCADE"
        text doc_key FK "FK to document_types(key) ON DELETE CASCADE"
        boolean is_ready "True if citizen has document ready"
        text notes "User notes (e.g. locker location)"
        timestamptz ready_at
        timestamptz created_at
        timestamptz updated_at
    }

    assessments {
        uuid id PK
        uuid user_id FK "FK to users(id) ON DELETE CASCADE"
        text situation_text "Max 2000 chars"
        text language "en | te | hi"
        jsonb extracted_profile "Structured demographic facts"
        text ai_summary "Empathetic citizen summary"
        boolean archived "Default false"
        timestamptz created_at
        timestamptz updated_at
    }

    scheme_matches {
        uuid id PK
        uuid assessment_id FK "FK to assessments(id) ON DELETE CASCADE"
        uuid user_id FK "FK to users(id) ON DELETE CASCADE"
        uuid scheme_id FK "FK to schemes(id) ON DELETE CASCADE"
        int match_score "0 to 100"
        text eligibility_reason "1-2 sentence justification"
        jsonb missing_info "Array of clarifying questions"
        text status "saved | applying | applied | rejected | archived"
        jsonb ai_checklist "Ordered array of {step, detail, done}"
        timestamptz created_at
        timestamptz updated_at
    }
```

---

## 5. Assessment Request Flow

The following sequence diagram details the end-to-end processing of a citizen's situation description:

```mermaid
sequenceDiagram
    autonumber
    actor Citizen as Citizen (Browser)
    participant Client as React Client (Axios)
    participant Gateway as Express Gateway & Middlewares
    participant Cache as Assessment Cache (24h Window)
    participant AI as Gemini Service (@google/genai)
    participant DB as Supabase PostgreSQL

    Citizen->>Client: Enters situation in Telugu/Hindi/English & clicks "Find My Schemes"
    Client->>Gateway: POST /api/assessments (Authorization: Bearer <JWT>)
    Gateway->>Gateway: Rate limiter check (max 20 / 15 min)
    Gateway->>Gateway: Zod Schema validation (10 <= text.length <= 2000)
    Gateway->>Gateway: JWT verification & user_id extraction
    
    Gateway->>Cache: Query DB for identical situation_text & language within 24h
    alt Identical submission exists within 24 hours
        Cache-->>Gateway: Return existing cached assessment & matches
    else Cache Miss (Fresh Evaluation)
        Gateway->>AI: 1. extractProfile(text, language) [Timeout: 25s]
        AI-->>Gateway: Returns structured facts, summary, missing questions
        Gateway->>DB: Fetch compact schemes catalog (id, slug, rules, docs)
        DB-->>Gateway: Catalog rows
        Gateway->>AI: 2. matchSchemes(profile, catalog, language)
        AI-->>Gateway: Candidate scheme IDs + scores + reasons
        Gateway->>Gateway: Validate scheme IDs exist in catalog; drop unknown/hallucinations
        Gateway->>AI: 3. buildChecklistsForMatches(profile, matches, language) [Concurrency Cap = 3]
        AI-->>Gateway: Personalized 4-7 step checklists
        Gateway->>DB: INSERT INTO assessments (...)
        Gateway->>DB: INSERT INTO scheme_matches (...)
        Gateway->>DB: UPDATE profiles (sync empty demographic fields)
    end

    Gateway->>DB: Compute document readiness from user_documents
    DB-->>Gateway: Matched rows with required_documents & readiness_percent
    Gateway-->>Client: HTTP 201 { success: true, data: { assessment, matches } }
    Client-->>Citizen: Renders Assessment Result (Summary, Match Badges, Checklists)
```

---

## 6. Security Rationale: Row Level Security with No Public Policies

### Architectural Justification
1. **Direct Backend Connection via `DATABASE_URL`**:
   - The Express backend connects directly to Supabase PostgreSQL using `DATABASE_URL` via a connection pool (`pg.Pool`).
   - The Supabase client SDK (`@supabase/supabase-js`) is not used by the browser or the server; neither client-side direct database queries nor Supabase service role keys are employed.
2. **RLS as a Deny-by-Default Safety Net**:
   - Every database table has Row Level Security enabled (`ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;`) with **no public policies** defined.
   - This functions as an impenetrable deny-by-default safety net: if Supabase's public-facing REST API (PostgREST) or GraphQL endpoints are queried by anonymous (`anon`) or public roles, PostgreSQL blocks all access and returns zero rows or an authorization error.
3. **Real Isolation via Server-Side `user_id` Scoping & JWT Auth**:
   - Real tenant isolation is enforced at the application layer:
     - All protected API routes require a valid JSON Web Token (JWT) verified by `requireAuth` middleware.
     - The verified `req.user.id` is explicitly injected into every SQL query (e.g., `SELECT * FROM assessments WHERE id = $1 AND user_id = $2`).
     - A user can never view, mutate, rerun, or delete another citizen's records. Any cross-tenant attempt yields an immediate **HTTP 404 Not Found**, completely preventing Insecure Direct Object Reference (IDOR) attacks.

