# Task 2 — Development Report

# Tools Used

## Lovable

Lovable was used for:
- UI generation
- routing
- backend integration
- authentication
- feature implementation
- deployment

## ChatGPT

ChatGPT was used for:
- implementation planning
- prompt engineering for Lovable
- debugging runtime and logic issues
- validating requirement coverage
- improving UX flows
- generating documentation

---

# Development Approach

The project was developed iteratively:

1. Analyze requirements
2. Break features into smaller tasks
3. Generate focused Lovable prompts
4. Test flows manually
5. Fix bugs and edge cases

The focus was on:
- stable end-to-end flows
- MVP simplicity
- requirement coverage

---

# What Worked Well

- AI-assisted development significantly accelerated implementation.
- RSVP, waitlist, and check-in flows worked reliably.
- Shared operational flows reduced duplicated logic.

---

# What Didn't Work Well

- Some generated pages produced React hook and routing issues that required additional debugging.
- Generated UI sometimes introduced redundant actions or duplicated sections that needed cleanup.
- Lovable prompt usage costs encouraged more careful prompt engineering and smaller iterative changes.
- Because of limited Lovable credits, ChatGPT was used extensively to:
  - optimize prompts before sending them to Lovable
  - reduce unnecessary iterations
  - debug issues before spending additional credits
  - prioritize MVP-safe implementation decisions

---

# Notable Decisions

- A single CSV export was used instead of separate RSVP and Attendance exports.
- Moderation was implemented with lightweight Host-managed flows.
- Stability and requirement coverage were prioritized over deep refactoring and advanced architecture.