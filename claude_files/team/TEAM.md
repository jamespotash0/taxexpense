# Tally — The Team

The team is split across individual files in the `team/` folder. Each file contains one persona's background, expertise, voice, and when to invoke them.

## Quick Index

| Role | Name | File | When to Invoke |
|------|------|------|----------------|
| Group Product Manager | Marcus Chen | [`team/marcus-chen.md`](./team/marcus-chen.md) | Strategy, prioritization, positioning |

| Senior Product Manager | Priya Sharma | [`team/priya-sharma.md`](./team/priya-sharma.md) | Specs, edge cases, metrics |

| Senior UX Designer | Sofia Reyes | [`team/sofia-reyes.md`](./team/sofia-reyes.md) | Flows, conversation design, copy |

| Principal Backend | Raj Patel | [`team/raj-patel.md`](./team/raj-patel.md) | Architecture, schema, scaling |

| Senior Frontend | Emma Larsson | [`team/emma-larsson.md`](./team/emma-larsson.md) | Next.js, performance, mobile |

| Principal QA/Security | Jordan Kim | [`team/jordan-kim.md`](./team/jordan-kim.md) | Security, compliance, testing |

| Principal Strategist | Alex Moreno | [`team/alex-moreno.md`](./team/alex-moreno.md) | Pressure-testing, pre-mortems |

| Head of Growth | Maya Okafor | [`team/maya-okafor.md`](./team/maya-okafor.md) | Content, distribution, virality |


---

## How to Use the Team in Claude Code

### Loading a Single Persona

To get one team member's perspective:

```
"Read team/raj-patel.md and review this database schema as Raj would."
```

This loads only Raj's context — efficient when you need a single viewpoint.

### Loading Multiple Personas

For multi-perspective reviews:

```
"Read team/raj-patel.md, team/jordan-kim.md, and team/alex-moreno.md.
Give me a review of this auth flow:
- Raj: technical concerns?
- Jordan: security concerns?
- Alex: what am I missing?

One concern from each. Don't soften them."
```

### Quick Persona Invocation (without loading file)

If you've already loaded a persona in the conversation, you can invoke them by name:

```
"As Sofia, review this SMS copy."
"As Marcus, does this feature belong in V1?"
"As Alex, pressure-test this plan."
```

Claude Code will maintain the persona for that response.

---

## Common Team Review Patterns

### Pattern 1: Pre-Decision Check

Before committing to anything significant:

```
"Read team/raj-patel.md, team/jordan-kim.md, and team/alex-moreno.md.

I'm about to commit to [decision]. Quick team check:

- Raj: technical concerns?
- Jordan: security/risk concerns?
- Alex: what am I being naive about?

One concern from each. Don't soften it."
```

### Pattern 2: Design Review

When designing a feature:

```
"Read team/sofia-reyes.md, team/david-park.md, team/priya-sharma.md, and team/emma-larsson.md.

I'm designing [feature]. Run a design review:

- Sofia: user flow concerns?
- David: visual considerations?
- Priya: missing edge cases?
- Emma: implementation pitfalls?

Be specific. No vague feedback."
```

### Pattern 3: Strategic Review

When making strategic decisions:

```
"Read team/marcus-chen.md, team/alex-moreno.md, team/maya-okafor.md, and team/ethan-vance.md.

Strategic decision: [decision]. Get the team's perspectives:

- Marcus: does this align with product strategy?
- Alex: what assumptions am I making?
- Maya: does this help or hurt growth?
- Ethan: does this affect acquisition value?

Identify the biggest objection."
```

### Pattern 4: Pre-Launch Pre-Mortem

Before shipping anything significant:

```
"Read team/alex-moreno.md, team/jordan-kim.md, team/sofia-reyes.md, team/maya-okafor.md, team/marcus-chen.md, and team/raj-patel.md.

Imagine it's 30 days after launching [feature] and it failed. Each team member explains why:

- Alex (most likely failure mode)
- Jordan (security/compliance issue we missed)
- Sofia (UX problem)
- Maya (no one shared it)
- Marcus (no one wanted it)
- Raj (technical breakdown)

List the failure modes in order of likelihood."
```

### Pattern 5: Stuck on a Problem

When you're stuck:

```
"Read team/raj-patel.md, team/emma-larsson.md, team/sofia-reyes.md, and team/alex-moreno.md.

I'm stuck on [problem]. Each team member, offer one specific suggestion from your expertise:

- Raj
- Emma  
- Sofia
- Alex

Different angles, not the same answer in different words."
```

---

## Important Notes

### Don't Overuse This Pattern

If you ask for team reviews on every decision, it becomes noise.

**Use it for:**
- Significant features
- Strategic decisions
- When you're excited (Alex is most valuable here)
- When you're stuck
- Pre-launch reviews

**Don't use it for:**
- Writing a SQL query
- Naming a variable
- Implementing well-defined tasks
- Routine debugging

### Single-Person Mode is Usually Right

Most of the time, you just want to talk to one team member:

```
"Read team/raj-patel.md. Help me design this database schema."
"Read team/sofia-reyes.md. Review this onboarding copy."
"Read team/alex-moreno.md. What am I missing here?"
```

That's faster and clearer than always getting multiple perspectives.

### When the Team Disagrees

Claude Code will often surface tension between team members. That's good — it's where insights come from.

When team members disagree:

```
"Alex and Marcus disagree on this. Who's more right and why? 
Make the case for the dissenting view."
```

This forces clearer thinking than just defaulting to consensus.

### Don't Hide Behind Personas

The personas are tools for getting different perspectives — they're not separate intelligences. You (and Claude Code) are still making decisions.

Don't say: "Alex said no, so I won't do it."
Do say: "Alex raised these concerns. After considering them, I'm doing X because Y."

You're the founder. The team is your sounding board, not your boss.

---

## File Sizes

Each persona file is ~5-10KB. Loading all 10 = ~70KB. Loading 3-4 for a review = ~25KB. Modest cost for the clarity benefit.

For maximum efficiency, load only the personas you need for the specific review you're running.
