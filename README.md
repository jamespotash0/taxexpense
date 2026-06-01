# TaxSnap MVP — Claude Code Handoff Package

This folder contains everything needed to build TaxSnap V1 in 10 working days using Claude Code.

**33 files total.** Don't be overwhelmed — you don't read them all at once. CLAUDE.md loads automatically, and the rest get pulled in as you work on specific things.

---

## Quick Start

### 1. Install Claude Code

Visit [claude.com/code](https://claude.com/code) and follow installation instructions. You'll need Node.js 20+ installed first.

### 2. Create Your Project Directory

```bash
mkdir taxsnap-mvp
cd taxsnap-mvp
```

### 3. Copy All Files Into Your Project

Place this entire `taxsnap-handoff/` folder contents into your `taxsnap-mvp/` directory:

```
taxsnap-mvp/
├── CLAUDE.md            ← Auto-loaded by Claude Code
├── README.md            ← This file
├── PLAN.md
├── CONTEXT.md
├── SPEC.md
├── ... (all other .md files)
├── team/
└── tickets/
```

### 4. Start Claude Code

```bash
claude
```

Claude Code automatically reads `CLAUDE.md` on startup — it now knows the project.

### 5. Kick Off Day 1

Paste this:

```
I'm starting Day 1 of the TaxSnap build. Read tickets/01-foundation.md 
and walk me through TSNAP-001. After we complete it, suggest the next 
ticket.
```

That's it. Claude Code has everything it needs.

---

## File Map (33 Files)

### Auto-loaded Context (Read this FIRST)

| File | Purpose |
|------|---------|
| **CLAUDE.md** | Project memory — Claude Code reads this every session |

### Strategy & Context (7 files)

| File | Purpose |
|------|---------|
| **README.md** | This file — package overview |
| **CONTEXT.md** | Product vision, positioning, target user |
| **PLAN.md** | 10-day execution roadmap |
| **BRAND.md** | Brand name decision framework (TODO: pick a name) |
| **JOURNAL.md** | Decisions log (track what & why) |
| **VALIDATION.md** | How to validate with 5 real users before building |
| **AGENTS-VS-WORKFLOWS.md** | Why V1 is workflow, not agent |

### Technical Reference (3 files)

| File | Purpose |
|------|---------|
| **SPEC.md** | Database schema, API contracts, decision tree |
| **SYSTEM-PROMPTS.md** | All AI prompts (verbatim) |
| **IRC-SUMMARIES.md** | 7 IRC code summaries + SQL seed script |

### Team Personas (11 files)

| File | When to Invoke |
|------|----------------|
| **TEAM.md** | Index for the team folder |
| team/marcus-chen.md | Strategy, prioritization, positioning |
| team/priya-sharma.md | Specs, edge cases, metrics |
| team/sofia-reyes.md | Flows, conversation design, copy |
| team/david-park.md | Visual design, components |
| team/raj-patel.md | Architecture, database, scaling |
| team/emma-larsson.md | Next.js, frontend, performance |
| team/jordan-kim.md | Security, compliance, testing |
| team/alex-moreno.md | Pressure-testing, devil's advocate |
| team/maya-okafor.md | Content, distribution, growth |
| team/ethan-vance.md | Long-term positioning, acquisition |

### Tickets (9 files, 80 tickets)

| File | Days | Owner |
|------|------|-------|
| tickets/README.md | — | How to use tickets |
| tickets/00-EPICS.md | All | Master overview + dependencies |
| tickets/01-foundation.md | 1-2 | Raj |
| tickets/02-sms-pipeline.md | 3-5 | Raj + Sofia |
| tickets/03-substantiation.md | 4-5 | Priya + Raj |
| tickets/04-web-app.md | 6-8 | Emma + David |
| tickets/05-landing-legal.md | 9 | David + Jordan |
| tickets/06-testing-launch.md | 10 | Jordan + Priya |
| tickets/07-security-crosscutting.md | Throughout | Jordan |

### Go-To-Market (2 files)

| File | Purpose |
|------|---------|
| **OUTREACH.md** | First 10 customer acquisition templates |
| **CONTENT-STRATEGY.md** | 2026 content marketing playbook with Trial Reels |

---

## How to Use This Package with Claude Code

### Daily Workflow

**Morning (5 min):**
```
"What's on the plan for today? 
Read PLAN.md and the relevant 
ticket file."
```

**During work:**
```
"Let's tackle TSNAP-013. Read 
tickets/02-sms-pipeline.md for 
context, then walk me through 
the implementation."
```

**For domain expertise:**
```
"Read team/raj-patel.md and 
help me design this database 
schema as Raj would."
```

**For multi-perspective review:**
```
"Read team/jordan-kim.md, 
team/alex-moreno.md, and 
team/priya-sharma.md. Review 
my auth flow. One concern 
from each. Don't soften them."
```

**End of day:**
```
"Today I completed TSNAP-001 
through TSNAP-005. Mark them 
done in my notes. What's 
tomorrow's first ticket?"
```

### When Stuck

```
"I'm stuck on TSNAP-XXX. Here's 
what I tried: [explanation]. 
Read SPEC.md section [X] and 
help me debug."
```

### For Big Decisions

```
"Before I commit to [decision], 
read team/alex-moreno.md and 
pressure-test it. What am I 
missing?"
```

---

## What's Already Decided

The strategy work is DONE. These are locked:

✅ Target market: Self-employed people WITHOUT modern banking
✅ Core value prop: Capture WHY (not just WHAT) in real-time
✅ Tech stack: Next.js + Supabase + Twilio + Claude
✅ Architecture: AI workflow (not agent) for V1
✅ Pricing tiers: $9/$19/$39 (sole prop / LLC Essentials / LLC Pro)
✅ Substantiation logic: Smart questioning per IRS rules
✅ 2-week MVP scope: 8 epics, 80 tickets
✅ Distribution: Instagram Trial Reels primary, repurpose to TikTok later

Don't relitigate these mid-build. If you must change a major decision, log it in JOURNAL.md with reasoning.

---

## What's Still Pending

⏳ **Brand name** — Working name is "TaxSnap." Use BRAND.md to pick a real one before Day 9 (when it appears on landing page).

⏳ **User validation** — Talk to 5 real unsophisticated self-employed people before Day 1 (or in parallel with build). Use VALIDATION.md for the structure.

⏳ **Lawyer review** — Disclaimer/privacy/terms before paying users. ~$1,500-2,500. Not blocking for beta.

⏳ **CPA review** — Spot-check IRC summaries post-launch when revenue justifies.

---

## Total Cost to Launch

```
ONE-TIME:
- Domain                  $15
- Twilio credit           $10
- Anthropic credit        $20
- Other services          $0 (free tiers)
                          ────
                          $45

MONTHLY (at 1-10 users):
- Twilio phone            $1
- API costs               ~$5
                          ────
                          ~$6/month
```

---

## Setup Tips

### DO:

- ✅ Share full files when asking for help ("Read CONTEXT.md, then...")
- ✅ Reference specific spec sections by name
- ✅ Use git commits frequently (every working feature)
- ✅ Test locally before deploying
- ✅ Let Claude Code write tests for critical paths
- ✅ Take breaks — burnout in week 1 = failure in week 2

### DON'T:

- ❌ Skip reading code Claude Code generates
- ❌ Deploy without testing
- ❌ Add features not in the spec (resist scope creep)
- ❌ Try to do all 10 days in one session
- ❌ Commit secrets or API keys to git
- ❌ Spend more than 1 hour/day on content during build

---

## Common Issues & Solutions

**"Claude Code isn't aware of project context"**
- Verify CLAUDE.md is in your project root
- Restart Claude Code session

**"I'm getting overwhelmed by all these files"**
- Just open today's ticket file
- CLAUDE.md auto-loads — you don't need to read everything else
- Use team personas only when needed

**"Strategy seems to change every conversation"**
- Read JOURNAL.md to see what's actually locked
- If strategy feels unstable, you're overthinking — start building

**"I'm not sure which ticket to work on"**
- Read tickets/00-EPICS.md for the dependency graph
- Today's epic is named in PLAN.md
- Always start with P0 tickets

**"Claude Code is generating code that doesn't match the spec"**
- Tell it explicitly: "Read SPEC.md section [X], then redo this"
- The specs are right; Claude sometimes guesses when it shouldn't

---

## The Team's Parting Wisdom

When you read these files, you'll meet 10 team personas. Here's their advice condensed:

**Alex:** "Ship the embarrassing first version. The MVP isn't about pride — it's about learning."

**Marcus:** "Your first 10 users will teach you more than the next 10 weeks of planning."

**Raj:** "When you get stuck, the answer is usually in the spec. Re-read before improvising."

**Priya:** "Build the core loop perfectly. Everything else comes later."

**Jordan:** "Get the disclaimer template lawyer-reviewed once you have paying users."

**Maya:** "Make 1 Trial Reel per day during the build. Worst case you have content for launch."

**Sofia:** "If a user has to think for more than 3 seconds, we've failed."

**David:** "Less, but better."

**Emma:** "Will this work on a 2-year-old Android phone over 3G? If not, fix it."

**Ethan:** "Build it as if Intuit might want to acquire it in 3 years. They might."

---

## Success Criteria

### By End of Day 10:
- [ ] V1 launched to first 10 beta users
- [ ] No P0 bugs in production
- [ ] All legal pages live
- [ ] Sentry shows minimal errors

### By End of Week 3:
- [ ] 10 active beta users
- [ ] 5+ users sending 3+ receipts per week
- [ ] At least 1 "I'd be sad if this disappeared" answer

---

## When You're Ready

```
1. Make sure CLAUDE.md is in 
   your project root
   
2. Run: claude
   
3. Say: "I'm starting Day 1. 
   Help me with TSNAP-001."
   
4. Build.
```

Good luck. Go ship.
