# TaxSnap — AI Architecture: Workflow vs Agent

## TL;DR

**You're building an AI WORKFLOW for v1, not an AI AGENT.** This is intentional and correct.

When someone asks if your product "is AI-powered," yes. When someone asks if it's "an agent," technically no — but the marketing world uses these terms loosely.

This document explains what you're building, why, and when to consider becoming an agent.

---

## The Difference

### AI Workflow (What You're Building)

```
USER ACTION
    ↓
YOUR CODE decides what to do
    ↓
YOUR CODE calls Claude for one specific task
    ↓
YOUR CODE handles the response
    ↓
YOUR CODE decides next step
    ↓
[Repeat as needed]
```

Your code is in control. Claude is a smart subroutine.

### AI Agent

```
USER GOAL
    ↓
AGENT plans steps autonomously
    ↓
AGENT decides which tool to call
    ↓
AGENT executes tool
    ↓
AGENT evaluates result
    ↓
AGENT decides next step
    ↓
[Agent loops until goal achieved]
```

The AI is in control. Your code provides tools.

---

## Concrete Example: Logging a Receipt

### Workflow Version (V1)

```typescript
// app/api/sms/inbound/route.ts

async function handleIncomingSMS(message: SMSMessage) {
  // 1. Look up user
  const user = await db.users.findByPhone(message.from);
  
  // 2. Determine state
  if (!user) {
    return startOnboarding(message);
  }
  if (!user.onboarding_completed) {
    return continueOnboarding(user, message);
  }
  
  // 3. Process receipt
  let extractedData;
  if (message.mediaUrl) {
    // Photo received — use Claude Vision
    extractedData = await claude.extractReceipt(message.mediaUrl);
  } else {
    // Text only — use Claude for text parsing
    extractedData = await claude.parseTextReceipt(message.body);
  }
  
  // 4. Categorize
  const ircSummary = await db.ircSummaries.findRelevant(extractedData);
  const categorization = await claude.categorize({
    receipt: extractedData,
    user: user,
    ircContext: ircSummary
  });
  
  // 5. Store
  const receipt = await db.receipts.create({
    user_id: user.id,
    ...extractedData,
    ...categorization
  });
  
  // 6. Respond
  await twilio.sendSMS(message.from, categorization.response);
  
  return { success: true };
}
```

**Notice:** Your code orchestrates everything. Claude is called 2-3 times for specific tasks. The code knows exactly what each step does.

### Agent Version (Not What You're Building)

```typescript
// app/api/sms/inbound/route.ts

async function handleIncomingSMS(message: SMSMessage) {
  const user = await db.users.findByPhone(message.from);
  
  // Define tools available to agent
  const tools = [
    { name: 'extractReceipt', description: '...', execute: ... },
    { name: 'queryIrcCode', description: '...', execute: ... },
    { name: 'saveReceipt', description: '...', execute: ... },
    { name: 'lookupUserHistory', description: '...', execute: ... },
    { name: 'sendSMS', description: '...', execute: ... },
    { name: 'askClarifyingQuestion', description: '...', execute: ... }
  ];
  
  // Let agent decide what to do
  await claude.agent({
    goal: `Process this SMS from a user. Log any receipts, 
           answer any questions, maintain conversation context.`,
    context: { user, message },
    tools: tools,
    maxSteps: 10
  });
  
  // Agent figures out the rest on its own
  return { success: true };
}
```

**Notice:** You give the agent a goal and tools. The agent decides everything else. You don't know in advance what it will do.

---

## Why Workflow > Agent for V1

### 1. Predictability

**Workflow:** You know exactly what code runs every time.
**Agent:** Behavior varies even for same input. Hard to debug.

For tax data, predictability matters more than flexibility.

### 2. Cost

**Workflow:** 2-3 Claude calls per receipt = ~$0.03
**Agent:** 5-15 Claude calls per receipt = ~$0.15-0.50

At 1,000 receipts/day:
- Workflow: $30/day = $900/month
- Agent: $150-500/day = $4,500-15,000/month

For an MVP, this matters.

### 3. Latency

**Workflow:** Linear path, 2-3 seconds total
**Agent:** Loop until done, 5-20 seconds

SMS expects fast responses. Slow = bad UX.

### 4. Liability

**Workflow:** You control exactly what gets stored and how.
**Agent:** Agent might make decisions you didn't anticipate. In tax/finance, surprises are bad.

If your agent decides to "be helpful" by computing tax estimates and gets it wrong, you're liable. Your code never asked it to do that.

### 5. Debugging

**Workflow:** Linear logs. Easy to trace what happened.
**Agent:** "The agent decided to call tool X then tool Y." Why? Hard to know.

When users report bugs, you need to reproduce them. Workflows are easier to reproduce.

### 6. Compliance

**Workflow:** Easy to audit every interaction.
**Agent:** Each interaction can be different. Auditors don't like this.

For tax/financial products, audit trails matter.

---

## When to Consider Becoming an Agent

You should evolve from workflow to agent when:

### Signal 1: Multi-step Tasks Become Common

If users start asking:
- "Help me prepare for an audit"
- "Review my year and tell me what's missing"
- "Find all my deductions for the past quarter"

These need autonomous multi-step thinking. Workflows can't handle them efficiently.

### Signal 2: You Have Specific Autonomous Use Cases

Examples:
- Year-end review (looks at all data, identifies gaps, generates report)
- Audit prep (compiles documentation, identifies risks, flags issues)
- Tax estimate calculation (pulls data, applies rules, generates estimate)

These are bounded but complex. Good agent territory.

### Signal 3: You Can Afford Observability

You need:
- Trace logging (Langsmith, Helicone, Phoenix)
- Eval framework (test agent decisions)
- Cost monitoring (per user, per interaction)
- Safety guardrails (refuse certain actions)

Solo founder can't maintain all this in v1. By v2-3, maybe.

### Signal 4: Customers Pay Enough to Justify Cost

Agent calls cost 5-10x more than workflow calls. You need pricing that supports it.

If users pay $19/month and 80% margin requires keeping costs under $3.80/month — agents don't fit unless they're rare events.

---

## The Migration Path

When you're ready to add agent capabilities:

### Phase 1 (V1 - Now): Pure Workflow

What you're building. 

### Phase 2: Workflow + Limited Agent

Keep the core SMS flow as a workflow. Add specific agent endpoints for complex tasks:

- `/api/agents/year-end-review` — generates comprehensive year-end report
- `/api/agents/audit-prep` — compiles audit documentation
- `/api/agents/tax-estimate` — calculates estimated quarterly tax

These run when the user explicitly requests them. They have well-defined goals.

### Phase 3: Smart Routing

Build a router that decides:
- Simple receipt → workflow path
- Complex question → agent path
- Multi-step task → agent path

User doesn't know the difference. System uses cheapest path that works.

### Phase 4: Full Agent (Far Future)

If/when it makes sense:
- All interactions go through agent
- Agent has access to user's full history
- Agent makes autonomous decisions
- Heavy observability and guardrails

Most products never reach this. Probably fine.

---

## Building Toward Agent-Readiness (Without Building Agents)

Even though v1 is a workflow, design it so future agent features are easy:

### 1. Clean Tool Interfaces

Build your database operations as clean functions:

```typescript
// Good — easy to expose as agent tool later
async function logReceipt(userId: string, receiptData: ReceiptData) { ... }
async function lookupIrcCode(section: string) { ... }
async function searchUserReceipts(userId: string, query: SearchQuery) { ... }
```

When you're ready for agents, these become tools.

### 2. Structured Logging

Log every operation in a consistent format:

```typescript
log.info('receipt_logged', {
  user_id: '...',
  receipt_id: '...',
  vendor: '...',
  amount: 0,
  category: '...',
  confidence: 0.95
});
```

Agents need observability. Build it from day one.

### 3. Idempotent Operations

Make sure operations can be safely retried:

```typescript
// Bad — running twice creates two receipts
await db.receipts.create({ ... });

// Good — running twice does the same thing
await db.receipts.upsert({ external_id: '...', ... });
```

Agents sometimes retry. Be safe.

### 4. Clear Data Boundaries

Multi-tenant from day one. Even though you have one user per query now, structure data so agents can safely operate on user-specific data:

```typescript
// All queries scoped to user_id
function getUserContext(userId: string) {
  return {
    receipts: db.receipts.findByUser(userId),
    profile: db.users.findById(userId),
    history: db.conversations.findByUser(userId)
  };
}
```

---

## Marketing Note

When talking about your product publicly:

✅ "AI-powered expense tracker"
✅ "Uses AI to categorize your receipts"
✅ "Smart receipt logging"

❌ "Fully autonomous AI agent" (technically not true)
❌ "AI agent that handles your taxes" (legal risk)

Be accurate. Buyers in 2026 are getting sophisticated about agent claims.

---

## Summary

**For v1:** Build the workflow. It's right for your stage, costs, and risk profile.

**Future:** Layer in agent capabilities for specific complex tasks (audit prep, year-end review). Keep the workflow for everything routine.

**Forever:** Don't make the whole product an agent unless you have a specific reason. Workflows + targeted agents is the right architecture for most AI products.

The team agrees: workflow now, agents later.
