# INDRA AI — External Requirements & API Provisioning Guide
> **Version 1.0** | Comprehensive Checklist for Production & Third-Party Service Integration

This document outlines all external API keys, service accounts, cloud resources, and OAuth applications required to transition **INDRA AI** from local development mode to production deployment with live AI RAG, vector search, cloud authentication, and third-party data connectors.

---

## 📋 Quick Setup Overview

Copy the template file to `.env` in `apps/api/`:
```bash
cp apps/api/.env.example apps/api/.env
```
Fill in the credentials as you obtain them following the step-by-step guide below.

---

## 🚨 Priority 1: Critical AI & Vector Database (Required for Live RAG)

### Step 1: OpenAI API Key (`OPENAI_API_KEY`, `OPENAI_ORG_ID`)
- **Purpose**: Powers semantic embeddings (`text-embedding-3-large`) and AI Q&A generation (`gpt-4o`).
- **How to obtain**:
  1. Go to [OpenAI Platform Dashboard](https://platform.openai.com/).
  2. Navigate to **API Keys** → **Create new secret key**.
  3. Copy your organization ID from **Settings** → **Organization Settings**.
- **Variables to set**:
  ```env
  OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx
  OPENAI_ORG_ID=org-xxxxxxxxxxxxxxxxxxxxxxxx
  EMBEDDING_MODEL=text-embedding-3-large
  COMPLETION_MODEL=gpt-4o
  ```

---

### Step 2: Pinecone Vector Database (`PINECONE_API_KEY`, `PINECONE_INDEX_NAME`)
- **Purpose**: Stores vector embeddings for real-time semantic search and context retrieval.
- **How to obtain**:
  1. Register at [Pinecone Console](https://app.pinecone.io/).
  2. Navigate to **API Keys** → Create API Key.
  3. Create an index named `indra-ai-prod` with **Dimensions: 3072** (for `text-embedding-3-large`) and **Metric: Cosine**.
- **Variables to set**:
  ```env
  PINECONE_API_KEY=pcsk_xxxxxxxxxxxxxxxxxxxxxxxx
  PINECONE_INDEX_NAME=indra-ai-prod
  PINECONE_ENVIRONMENT=us-east-1-aws
  ```

---

## 🔐 Priority 2: Authentication & Database Services

### Step 3: Firebase Admin SDK Credentials (`FIREBASE_*`)
- **Purpose**: Powers enterprise authentication, ID tokens, SAML 2.0 / OIDC SSO, and role management.
- **How to obtain**:
  1. Go to [Firebase Console](https://console.firebase.google.com/).
  2. Create or select your project `indra-ai-prod`.
  3. Navigate to **Project Settings** → **Service accounts**.
  4. Click **Generate new private key** (downloads a JSON file).
- **Variables to set**:
  ```env
  FIREBASE_PROJECT_ID=indra-ai-prod
  FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxx@indra-ai-prod.iam.gserviceaccount.com
  FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
  ```

---

### Step 4: Managed PostgreSQL Database (`DATABASE_URL`)
- **Purpose**: Production relational storage replacing local SQLite (`dev.db`).
- **Recommended Provider**: GCP Cloud SQL for PostgreSQL 15, Supabase, or AWS RDS.
- **Variables to set**:
  ```env
  DATABASE_URL="postgresql://indra_admin:StrongPassword123@db-host.gcp.cloudsql.com:5432/indraai?schema=public&sslmode=require"
  ```

---

### Step 5: Upstash Redis (`REDIS_URL`, `REDIS_TOKEN`)
- **Purpose**: Sub-millisecond caching layer for hot search queries, rate limiting (1,000 req/min), and user session tokens.
- **How to obtain**:
  1. Create a database at [Upstash Console](https://console.upstash.com/).
  2. Select Redis → Global Database.
  3. Copy the `REDIS_URL` and REST Token.
- **Variables to set**:
  ```env
  REDIS_URL=rediss://default:xxxxxx@your-redis.upstash.io:6379
  REDIS_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxx
  ```

---

## 🔌 Priority 3: Data Connector OAuth Apps (Data Ingestion Pipeline)

To allow organization users to connect their enterprise tools (§6.7 Integrations), register OAuth 2.0 applications for each provider:

| Integration | Required Credentials | Developer Portal |
| :--- | :--- | :--- |
| **Google Drive / Workspace** | `GOOGLE_CLIENT_ID`<br>`GOOGLE_CLIENT_SECRET` | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |
| **Confluence & Jira** | `ATLASSIAN_CLIENT_ID`<br>`ATLASSIAN_CLIENT_SECRET` | [Atlassian Developer Console](https://developer.atlassian.com/console/myapps/) |
| **Notion Workspace** | `NOTION_CLIENT_ID`<br>`NOTION_CLIENT_SECRET` | [Notion My Integrations](https://www.notion.so/my-integrations) |
| **Slack Workspace** | `SLACK_BOT_TOKEN`<br>`SLACK_SIGNING_SECRET` | [Slack API Apps](https://api.slack.com/apps) |
| **GitHub Enterprise / Cloud** | `GITHUB_APP_CLIENT_ID`<br>`GITHUB_APP_CLIENT_SECRET` | [GitHub Developer Settings](https://github.com/settings/developers) |

---

## 💳 Priority 4: Billing & Cloud Storage

### Step 6: Stripe Developer Keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`)
- **Purpose**: Powers organization tier subscriptions (Starter, Pro, Enterprise) and seat-based billing (§5.3).
- **How to obtain**:
  1. Log into [Stripe Dashboard](https://dashboard.stripe.com/).
  2. Copy Secret Key from **Developers** → **API keys**.
  3. Add a webhook endpoint pointing to `https://api.indraai.com/v1/stripe/webhook` subscribing to `customer.subscription.updated` and `invoice.payment_succeeded`.
- **Variables to set**:
  ```env
  STRIPE_SECRET_KEY=sk_test_YOUR_STRIPE_SECRET_KEY_HERE
  STRIPE_WEBHOOK_SECRET=whsec_YOUR_STRIPE_WEBHOOK_SECRET_HERE
  ```

---

### Step 7: Supabase Storage & Project (`SUPABASE_*`)
- **Purpose**: Raw document ingestion storage, PDF parsing buffers, and asset exports via Supabase Storage Buckets.
- **Variables to set**:
  ```env
  SUPABASE_URL=https://pssnqkmiyakoejbpdpux.supabase.co
  SUPABASE_PUBLISHABLE_KEY=sb_publishable_giQ8sIvlCRA8_skiGRfxDQ_enFIWTbI
  ```

---

## 📊 Summary Checklist

- [ ] **OpenAI Key & Org ID** (`OPENAI_API_KEY`)
- [ ] **Pinecone Key & Index** (`PINECONE_API_KEY`)
- [ ] **Firebase Service Account JSON** (`FIREBASE_PRIVATE_KEY`)
- [ ] **PostgreSQL Database URL** (`DATABASE_URL`)
- [ ] **Upstash Redis Credentials** (`REDIS_URL`)
- [ ] **Google Workspace OAuth Client** (`GOOGLE_CLIENT_ID`)
- [ ] **Confluence / Atlassian OAuth Client** (`ATLASSIAN_CLIENT_ID`)
- [ ] **Slack App Bot Token** (`SLACK_BOT_TOKEN`)
- [ ] **Stripe Secret Key & Webhook Secret** (`STRIPE_SECRET_KEY`)
- [ ] **Supabase URL & Publishable Key** (`SUPABASE_URL`)

---

*Once you have gathered these keys, paste them into `apps/api/.env` and run `pnpm dev` or deploy via Docker to activate real production integration mode.*
