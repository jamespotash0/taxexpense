# TSNAP-EPIC-1 — Foundation & Infrastructure

**Owner:** Raj Patel
**Effort:** 8 hours
**Days:** 1-2
**Priority:** P0 (Blocker)

## Epic Description

Set up all accounts, services, schemas, and infrastructure needed before feature work can begin. Without this complete, nothing else works.

## Epic Acceptance Criteria

- [ ] All service accounts created and accessible
- [ ] Next.js project deployed to production URL
- [ ] Custom domain pointing to Vercel
- [ ] Database schema fully migrated
- [ ] Multi-tenant architecture in place
- [ ] All seed data loaded
- [ ] Environment variables verified in production
- [ ] Initial commit pushed to GitHub

---

## Tickets in Order

### TSNAP-001 — Create Service Accounts
**Type:** Task
**Owner:** You (founder)
**Effort:** 1 hour
**Depends on:** None
**Priority:** P0

**Description:**
Create accounts on all required services and gather API credentials. This must be done manually before any code is written.

**Acceptance Criteria:**
- [ ] Twilio account created with $10 credit added
- [ ] Twilio phone number purchased ($1/month, US number required for TCPA)
- [ ] Twilio Account SID and Auth Token saved to password manager
- [ ] Supabase account created, new project initialized
- [ ] Supabase URL, anon key, and service role key saved
- [ ] Anthropic console account created with $20 credit added
- [ ] Anthropic API key saved
- [ ] Vercel account created (use GitHub login)
- [ ] Domain purchased from Namecheap/Porkbun (~$15/year)
- [ ] GitHub account ready, can create repos
- [ ] Resend.com account created for transactional email (or alternative)
- [ ] Sentry account created (free tier)

**Technical Notes:**
- Save all credentials to a password manager (1Password, Bitwarden) immediately
- Do NOT commit these to git, ever
- Twilio: enable A2P 10DLC registration after launch (required for high-volume US SMS — not blocker for beta)

---

### TSNAP-002 — Initialize Next.js Project
**Type:** Task
**Owner:** Raj (you in Claude Code)
**Effort:** 1 hour
**Depends on:** TSNAP-001
**Priority:** P0

**Description:**
Create a new Next.js 14+ project with App Router, TypeScript, and Tailwind CSS.

**Acceptance Criteria:**
- [ ] `npx create-next-app@latest taxsnap-mvp` completed
- [ ] TypeScript enabled
- [ ] Tailwind CSS configured
- [ ] App Router (not Pages Router) selected
- [ ] ESLint configured
- [ ] `npm run dev` works locally
- [ ] Default "Hello World" page renders
- [ ] Git initialized
- [ ] Initial commit pushed to new GitHub repo

**Technical Notes:**
- Use exact command: `npx create-next-app@latest taxsnap-mvp --typescript --tailwind --app --src-dir --import-alias "@/*"`
- Node 20+ required
- Create `.gitignore` includes `.env.local`, `.env`, `node_modules`, `.next`

---

### TSNAP-003 — Deploy to Vercel
**Type:** Task
**Owner:** Raj
**Effort:** 30 minutes
**Depends on:** TSNAP-002
**Priority:** P0

**Description:**
Connect GitHub repo to Vercel, deploy initial Hello World, point custom domain.

**Acceptance Criteria:**
- [ ] Vercel project linked to GitHub repo
- [ ] Auto-deploy on push to `main` branch working
- [ ] Initial deployment successful at `*.vercel.app` URL
- [ ] Custom domain DNS records configured
- [ ] Custom domain shows the deployed site (HTTPS working)
- [ ] SSL certificate active

**Technical Notes:**
- Vercel auto-detects Next.js, no config needed
- DNS may take 5-30 minutes to propagate
- Use Vercel's nameservers for simplest setup
- Verify SSL with `curl -I https://your-domain.com`

---

### TSNAP-004 — Initialize Supabase Database
**Type:** Task
**Owner:** Raj
**Effort:** 30 minutes
**Depends on:** TSNAP-001
**Priority:** P0

**Description:**
Set up Supabase project, configure connection from Next.js, verify access.

**Acceptance Criteria:**
- [ ] Supabase project created in region closest to user base (US East recommended)
- [ ] `@supabase/supabase-js` installed in Next.js project
- [ ] `lib/supabase.ts` created with client initialization
- [ ] Service role client created for server-side operations
- [ ] Test query succeeds (e.g., `SELECT 1`)
- [ ] Row Level Security policies planned (implement per-table later)

**Technical Notes:**
```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

---

### TSNAP-005 — Create Database Schema
**Type:** Task
**Owner:** Raj
**Effort:** 1.5 hours
**Depends on:** TSNAP-004
**Priority:** P0

**Description:**
Create all database tables per SPEC.md. Multi-tenant from day 1.

**Acceptance Criteria:**
- [ ] `organizations` table created
- [ ] `users` table created with organization_id FK
- [ ] `user_roles` table created (for future multi-user)
- [ ] `receipts` table created with all substantiation fields
- [ ] `substantiation_rules` table created
- [ ] `irc_summaries` table created
- [ ] `conversations` table created
- [ ] `auth_codes` table created
- [ ] `sessions` table created
- [ ] All indexes per SPEC.md created
- [ ] Foreign key constraints in place
- [ ] Sanity-check INSERT works on each table

**Technical Notes:**
- Use Supabase SQL editor for schema creation
- Refer to SPEC.md "Database Schema" section for exact DDL
- Test each table with a sample INSERT before moving on
- Generate `database.types.ts` using `supabase gen types typescript`

---

### TSNAP-006 — Seed IRC Summaries
**Type:** Task
**Owner:** Raj
**Effort:** 45 minutes
**Depends on:** TSNAP-005
**Priority:** P0

**Description:**
Load the 7 core IRC code summaries into the database. Content from IRC-SUMMARIES.md.

**Acceptance Criteria:**
- [ ] All 7 IRC summaries inserted: §162, §262, §274, §280A, §179, §1402, §6654
- [ ] Each summary has: section_id, title, short_summary, deduction_percentage, common_practice, worth_noting, source_url
- [ ] Each summary's text matches IRC-SUMMARIES.md exactly
- [ ] Helper function `getIrcSummary(section: string)` works
- [ ] Tested by retrieving each summary

**Technical Notes:**
- Use the SQL INSERT script in IRC-SUMMARIES.md
- Replace placeholder text with actual content from that file
- Keep version=1 for all initial summaries (for future updates)

---

### TSNAP-007 — Seed Substantiation Rules
**Type:** Task
**Owner:** Raj + Priya
**Effort:** 45 minutes
**Depends on:** TSNAP-005
**Priority:** P0

**Description:**
Load substantiation rules per SPEC.md. This is the data backbone of the decision tree.

**Acceptance Criteria:**
- [ ] All 18 categories inserted (6 strict + 11 general + personal)
- [ ] Each rule has correct substantiation_level, threshold, required_context_fields
- [ ] Lodging marked as always_receipt = TRUE
- [ ] Business gifts has deduction_cap_cents = 2500 ($25)
- [ ] Meals_business has deduction_percentage = 50
- [ ] Query test: `SELECT * FROM substantiation_rules WHERE substantiation_level = 'strict'` returns 6 rows

**Technical Notes:**
- Refer to SPEC.md "Seeded data for v1" section for exact SQL
- Priya should review the rules before bulk insert
- These rules drive ALL AI behavior — get them right

---

### TSNAP-008 — Configure Environment Variables
**Type:** Task
**Owner:** Raj
**Effort:** 30 minutes
**Depends on:** TSNAP-001, TSNAP-003, TSNAP-004
**Priority:** P0

**Description:**
Set up all environment variables in local `.env.local` and Vercel production environment.

**Acceptance Criteria:**
- [ ] `.env.local` created with all required keys
- [ ] `.env.local` added to `.gitignore` (verify with `git status`)
- [ ] Same variables added to Vercel project environment (Production + Preview)
- [ ] App builds successfully locally with env vars
- [ ] App builds successfully on Vercel deploy

**Required Environment Variables:**
```
# Anthropic
ANTHROPIC_API_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Email
RESEND_API_KEY=

# App
NEXT_PUBLIC_APP_URL=https://yourdomain.com
SESSION_SECRET=  # Generate with: openssl rand -base64 32

# Sentry (optional for V1)
NEXT_PUBLIC_SENTRY_DSN=
```

**Technical Notes:**
- Never log env vars, never commit them
- For Vercel: use the dashboard or `vercel env` CLI
- Use different SESSION_SECRET for production vs local

---

### TSNAP-009 — Install Core Dependencies
**Type:** Task
**Owner:** Raj
**Effort:** 30 minutes
**Depends on:** TSNAP-002
**Priority:** P0

**Description:**
Install all libraries needed across the project.

**Acceptance Criteria:**
- [ ] `@supabase/supabase-js` installed
- [ ] `@anthropic-ai/sdk` installed
- [ ] `twilio` installed
- [ ] `resend` installed (or alternative)
- [ ] `zod` installed (for input validation)
- [ ] `nanoid` installed (for ID generation)
- [ ] `@sentry/nextjs` installed (optional, can defer)
- [ ] All packages in package.json
- [ ] `npm install` succeeds with no errors

**Technical Notes:**
```bash
npm install @supabase/supabase-js @anthropic-ai/sdk twilio resend zod nanoid
npm install -D @types/node
```

---

### TSNAP-010 — Test Anthropic API Connection
**Type:** Task
**Owner:** Raj
**Effort:** 30 minutes
**Depends on:** TSNAP-008, TSNAP-009
**Priority:** P0

**Description:**
Verify Anthropic API key works with a simple test call.

**Acceptance Criteria:**
- [ ] `lib/claude.ts` created with Anthropic client
- [ ] Test API route at `/api/test-claude` returns a response from Claude
- [ ] Both Haiku 4.5 and Sonnet 4.6 models accessible
- [ ] Costs visible in Anthropic console
- [ ] Test route removed/disabled before launch

**Technical Notes:**
```typescript
// lib/claude.ts
import Anthropic from '@anthropic-ai/sdk';

export const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Models:
export const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
export const SONNET_MODEL = 'claude-sonnet-4-6';
```

---

### TSNAP-011 — Set Up Project Folder Structure
**Type:** Task
**Owner:** Raj
**Effort:** 30 minutes
**Depends on:** TSNAP-002
**Priority:** P1

**Description:**
Create the folder structure per SPEC.md. Empty files with TODO comments are fine.

**Acceptance Criteria:**
- [ ] `app/api/sms/inbound/` folder created
- [ ] `app/api/auth/request-code/` and `verify-code/` folders created
- [ ] `app/api/receipts/` with `[id]/`, `export/`, `attach-receipt/` subfolders
- [ ] `app/api/email-accountant/` folder created
- [ ] `app/login/`, `app/dashboard/`, `app/receipts/[id]/` folders created
- [ ] `app/privacy/`, `app/terms/` folders created
- [ ] `lib/` folder with empty files: `supabase.ts`, `twilio.ts`, `claude.ts`, `prompts.ts`, `substantiation.ts`, `ocr.ts`, `auth.ts`
- [ ] `components/` folder created
- [ ] `middleware.ts` file created (empty function)

**Technical Notes:**
- Each empty file should export an empty placeholder (e.g., `export {};`)
- Add brief TODO comment explaining what goes here
- This makes the project easier to navigate from day 1

---

### TSNAP-012 — Verify Foundation End-to-End
**Type:** Task
**Owner:** Raj + Jordan
**Effort:** 30 minutes
**Depends on:** TSNAP-001 through TSNAP-011
**Priority:** P0

**Description:**
Confirm foundation is solid before moving to feature work.

**Acceptance Criteria:**
- [ ] Local dev server runs without errors (`npm run dev`)
- [ ] Production build succeeds (`npm run build`)
- [ ] Deployed Vercel site loads at custom domain
- [ ] HTTPS works correctly
- [ ] Supabase connection works from deployed site
- [ ] Anthropic test call works from deployed site
- [ ] All database tables visible in Supabase dashboard
- [ ] Seed data verified (7 IRC summaries + 18 substantiation rules)
- [ ] Jordan signs off on security basics (env vars not exposed, HTTPS enforced)
- [ ] Git committed and pushed

**Technical Notes:**
- If any check fails, fix BEFORE moving on
- Document any decisions in git commit messages
- This is the foundation everything else builds on — don't rush past issues

---

## Day 1 Checklist (Recommended Order)

**Morning (4 hours):**
- [ ] TSNAP-001: Create service accounts (1h)
- [ ] TSNAP-002: Initialize Next.js (1h)
- [ ] TSNAP-003: Deploy to Vercel (30min)
- [ ] TSNAP-004: Initialize Supabase (30min)
- [ ] TSNAP-008: Configure env vars (30min)
- [ ] TSNAP-009: Install dependencies (30min)

**Afternoon (3 hours):**
- [ ] TSNAP-005: Create database schema (1.5h)
- [ ] TSNAP-011: Set up folder structure (30min)
- [ ] TSNAP-010: Test Anthropic connection (30min)
- [ ] Commit progress to git (30min)

## Day 2 Checklist

**Morning (2 hours):**
- [ ] TSNAP-006: Seed IRC summaries (45min)
- [ ] TSNAP-007: Seed substantiation rules (45min)
- [ ] TSNAP-012: End-to-end verification (30min)

**Afternoon (3 hours):**
- [ ] Buffer for any issues
- [ ] Start EPIC 2 tickets if ahead of schedule

---

## Common Issues & Solutions

**"DNS not propagating"**
- Use https://dnschecker.org to verify
- Be patient — can take up to 30 minutes
- Use Vercel's nameservers if your registrar is slow

**"Supabase connection refused"**
- Check that NEXT_PUBLIC_SUPABASE_URL has https://
- Verify keys aren't truncated (long keys often paste incorrectly)
- Test with `curl` directly

**"Build fails on Vercel but works locally"**
- Almost always missing env vars in Vercel
- Check that all variables in `.env.local` are also in Vercel dashboard
- Redeploy after adding env vars

**"Twilio number doesn't send SMS"**
- Trial accounts can only send to verified numbers
- Add your phone to Twilio "Verified Caller IDs" for testing
- Upgrade to paid for production

---

## Definition of Done for EPIC 1

This epic is DONE when:
1. ✅ Custom domain shows the deployed site over HTTPS
2. ✅ Database has all tables + seed data
3. ✅ Claude API responds successfully from production
4. ✅ All credentials are in env vars (none in code)
5. ✅ Folder structure exists for upcoming features
6. ✅ Jordan signs off on basic security
7. ✅ Everything is committed to git

You are now ready for EPIC 2: SMS Pipeline.
