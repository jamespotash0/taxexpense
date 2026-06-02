# TSNAP-EPIC-5 — Landing Page & Legal

**Owner:** David Park + Jordan Kim
**Effort:** 6 hours
**Day:** 9
**Priority:** P0 (Blocker)

## Epic Description

Public face of the product. Visitors discover what Tally does, get the phone number to text, and read legal disclaimers. Includes mandatory privacy policy, terms of service, and tax disclaimer.

## Epic Acceptance Criteria

- [ ] Landing page communicates value prop in 5 seconds
- [ ] Phone number to text is prominent
- [ ] TCPA-compliant opt-in if user submits form for follow-up
- [ ] Privacy Policy, Terms of Service, Tax Disclaimer published
- [ ] All pages mobile responsive
- [ ] Page loads under 2 seconds on 4G

---

## Tickets in Order

### TSNAP-049 — Landing Page: Hero Section
**Type:** Story
**Owner:** David + Emma
**Effort:** 1.5 hours
**Depends on:** TSNAP-034
**Priority:** P0

**Description:**
The hero section is the first thing visitors see. Must communicate the value prop instantly using the locked positioning.

**Acceptance Criteria:**
- [ ] Headline: "Your bank knows WHAT you spent — but not WHY. Tally captures both."
- [ ] Subheadline: 1-2 sentences expanding on the hook
- [ ] Primary CTA: Phone number to text, prominently displayed (e.g., "Text +1 555-XXX-XXXX to start")
- [ ] Visual: optional simple illustration or screenshot of an SMS exchange
- [ ] Mobile-first responsive design
- [ ] Below the fold: "How it works" preview

**Technical Notes:**
- Use the locked external positioning statement from CONTEXT.md
- David: keep it quiet and confident, not loud
- The phone number should be clickable on mobile (tel: link or SMS link)
- Test on real iPhone: tapping the number should open Messages with the number prefilled

```html
<a href="sms:+15551234567">Text +1 555-123-4567</a>
```

---

### TSNAP-050 — Landing Page: How It Works
**Type:** Story
**Owner:** David + Sofia
**Effort:** 1 hour
**Depends on:** TSNAP-049
**Priority:** P0

**Description:**
Three-step explanation of how Tally works. Visual, scannable.

**Acceptance Criteria:**
- [ ] Section title: "How it works"
- [ ] Three steps with brief copy:
  1. "Text a receipt or expense" — photo or "$340 dinner with John"
  2. "AI captures the context" — categorizes per IRC, asks for what IRS requires
  3. "Tax time is already done" — export to CSV or send to your accountant
- [ ] Each step has a visual element (icon, illustration, or screenshot)
- [ ] Mobile responsive (stacks vertically)

**Technical Notes:**
- Sofia: copy should feel reassuring, not technical
- David: visuals should reinforce the SMS-first mechanism

---

### TSNAP-051 — Landing Page: FAQ Section
**Type:** Story
**Owner:** Marcus + Sofia
**Effort:** 45 minutes
**Depends on:** TSNAP-049
**Priority:** P1

**Description:**
Address common objections and questions before users have to ask.

**Acceptance Criteria:**
- [ ] 5-7 FAQ items, expandable (accordion style)
- [ ] Suggested questions:
  - "Is this really just SMS? Do I need to download an app?"
  - "How do I know my data is secure?"
  - "What does the AI actually do?"
  - "Will this give me tax advice?"
  - "What does it cost?"
  - "Who is this for?"
  - "Can my accountant access this?"
- [ ] Answers are conversational, not corporate
- [ ] Marcus reviews positioning consistency

---

### TSNAP-052 — Privacy Policy Page
**Type:** Task
**Owner:** Jordan + You (founder)
**Effort:** 1 hour
**Depends on:** TSNAP-002
**Priority:** P0

**Description:**
Required legal page. Outlines what data we collect, how we use it, retention, user rights.

**Acceptance Criteria:**
- [ ] `/privacy` page accessible
- [ ] Covers:
  - What data we collect (phone number, photos, business context, conversations)
  - How we use it (categorize expenses, provide service)
  - Third parties (Twilio, Supabase, Anthropic, Vercel)
  - Data retention (kept while account active + 30 days after deletion)
  - User rights (access, delete, export)
  - Contact email for privacy requests
  - Cookies usage
  - Updated date
- [ ] Linked from footer of every page
- [ ] Plain language, not legalese

**Technical Notes:**
- Use a privacy policy template as starting point (https://termly.io or similar)
- Customize for Tally-specific data flows
- Jordan reviews for compliance gaps
- A lawyer review is RECOMMENDED before launch (~$500-1,500) but not blocking for beta

---

### TSNAP-053 — Terms of Service Page
**Type:** Task
**Owner:** Jordan + You (founder)
**Effort:** 1 hour
**Depends on:** TSNAP-002
**Priority:** P0

**Description:**
Standard ToS. Limits liability, sets expectations, defines acceptable use.

**Acceptance Criteria:**
- [ ] `/terms` page accessible
- [ ] Covers:
  - Service description
  - Acceptable use (no fraud, no abuse, no illegal activity)
  - Disclaimers ("We are not tax advisors")
  - Limitation of liability
  - User responsibilities
  - Account termination
  - Disputes and governing law
  - Updates to terms
  - Contact info
- [ ] Linked from footer
- [ ] Updated date

**Technical Notes:**
- Use template from termly.io or similar
- IMPORTANT: include "Tally is not a tax advisor" disclaimer
- Jordan reviews

---

### TSNAP-054 — Tax Disclaimer Page
**Type:** Task
**Owner:** Jordan + You (founder)
**Effort:** 45 minutes
**Depends on:** TSNAP-002
**Priority:** P0 (legal critical)

**Description:**
Specific page making clear Tally is NOT a tax advisor. This is critical for liability.

**Acceptance Criteria:**
- [ ] `/disclaimer` page accessible
- [ ] Clear statements:
  - "Tally is a tracking tool, not a tax advisor"
  - "We do not provide tax advice for your specific situation"
  - "Always consult a qualified CPA or tax professional"
  - "We don't guarantee tax outcomes"
  - "We don't represent users in audits"
  - "Categorizations are suggestions based on IRC code and common practice, not professional advice"
- [ ] Linked from footer AND from every AI response that mentions tax implications
- [ ] Easy to understand language

**Technical Notes:**
- This is the most important legal page for Tally specifically
- A lawyer review is STRONGLY RECOMMENDED before launch (~$500-1,000)
- Jordan: this is the document that protects us from claims like "Tally told me this was deductible"

---

### TSNAP-055 — TCPA Opt-In Language
**Type:** Task
**Owner:** Jordan
**Effort:** 30 minutes
**Depends on:** TSNAP-049
**Priority:** P0 (compliance)

**Description:**
If we collect phone numbers via web form (not just from inbound SMS), TCPA requires explicit consent. Add proper language.

**Acceptance Criteria:**
- [ ] Any web form that captures phone number includes:
  - Required checkbox: "I consent to receive SMS messages from Tally"
  - Disclaimer: "Message and data rates may apply. Reply STOP to opt out."
  - Link to Privacy Policy
- [ ] Consent is logged in database with timestamp
- [ ] STOP keyword automatically handles opt-out (Twilio does this — verify)
- [ ] If user texts STOP, they get confirmation and no further messages

**Technical Notes:**
- For V1, we may not have a web form requesting phone number — users start by texting us, which is itself consent
- BUT if we add a "request beta access" form, this becomes critical
- Jordan: clarify whether V1 has any form-based phone collection
- TCPA violations are $500-1,500 per violation — take this seriously

---

### TSNAP-056 — Footer with Legal Links
**Type:** Task
**Owner:** Emma + David
**Effort:** 30 minutes
**Depends on:** TSNAP-052, TSNAP-053, TSNAP-054
**Priority:** P0

**Description:**
Every page has a footer with required legal links.

**Acceptance Criteria:**
- [ ] Footer component appears on every page (landing, dashboard, login, all legal pages)
- [ ] Footer contains links to: Privacy Policy, Terms of Service, Tax Disclaimer
- [ ] Footer contains: copyright notice, contact email
- [ ] Mobile responsive
- [ ] Clean visual design, not cluttered

---

### TSNAP-057 — Landing Page Mobile + Performance Audit
**Type:** Task
**Owner:** Emma + David
**Effort:** 45 minutes
**Depends on:** TSNAP-049, TSNAP-050, TSNAP-051, TSNAP-056
**Priority:** P0

**Description:**
Verify landing page loads fast and works on mobile.

**Acceptance Criteria:**
- [ ] Lighthouse score 90+ for Performance, Accessibility, Best Practices
- [ ] Loads in under 2 seconds on simulated 4G
- [ ] Tested on real iPhone (Safari) and Android (Chrome)
- [ ] No layout shifts (CLS < 0.1)
- [ ] Phone number tap-to-text works on iOS and Android
- [ ] No JavaScript errors in console

**Technical Notes:**
- Use Chrome Lighthouse for measurement
- For 4G simulation, use Chrome DevTools throttling
- Images should be optimized (Next.js Image component handles this)

---

## Day 9 Checklist

**Morning (4 hours):**
- [ ] TSNAP-049: Hero section (1.5h)
- [ ] TSNAP-050: How it works (1h)
- [ ] TSNAP-051: FAQ (45min)
- [ ] TSNAP-056: Footer (45min)

**Afternoon (3 hours):**
- [ ] TSNAP-052: Privacy Policy (1h)
- [ ] TSNAP-053: Terms of Service (1h)
- [ ] TSNAP-054: Tax Disclaimer (45min)
- [ ] TSNAP-055: TCPA language (15min — if applicable)
- [ ] TSNAP-057: Mobile + performance audit (varies — squeeze in)

---

## Definition of Done for EPIC 5

This epic is DONE when:
1. ✅ Landing page communicates value prop instantly
2. ✅ Phone number is prominent and tap-to-SMS works
3. ✅ How it works section explains the product
4. ✅ FAQ addresses common objections
5. ✅ Privacy Policy, Terms, Disclaimer all published
6. ✅ TCPA compliance language present where needed
7. ✅ Footer with legal links on every page
8. ✅ Mobile responsive, fast loading
9. ✅ Jordan signs off on legal compliance basics
10. ✅ David signs off on visual design

You are now ready for EPIC 6: Testing & Launch.
