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
- ChatGPT was especially helpful in diagnosing the likely technical root cause behind those failed or partial fixes and generating more precise, technically specific prompts for Lovable, which improved the reliability of subsequent implementations.

---

# What Didn't Work Well

- Some generated pages produced React hook and routing issues that required additional debugging.
- Generated UI sometimes introduced redundant actions or duplicated sections that needed cleanup.
- In some cases, Lovable reported that a fix had been implemented successfully, but the actual UI behavior or rendered interface remained unchanged and required additional verification and follow-up fixes.
- Lovable prompt usage costs encouraged more careful prompt engineering and smaller iterative changes.

---

# Notable Decisions

- Because of limited Lovable credits, ChatGPT was used extensively to:
  - optimize prompts before sending them to Lovable
  - reduce unnecessary iterations
  - debug issues before spending additional credits
  - prioritize MVP-safe implementation decisions