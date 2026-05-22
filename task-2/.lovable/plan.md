
# Event Hosting & Attendance Platform — Plan

## Stack
React + TypeScript + TanStack Start + Lovable Cloud (Postgres, Auth, Storage). Auth: Email/password + Google. Tailwind + shadcn/ui. QR via `qrcode` (render) and `html5-qrcode` (scan).

## Roles
- **User** — any signed-in account. Can RSVP, leave feedback, upload gallery, report.
- **Host** — auto-created on "Become a host". Owns a `hosts` row; can create events.
- **Host member (checker)** — added by host owner via email; gains check-in access for that host's events.

Roles are stored in two places:
- `user_roles` (global enum: `user`) — every signed-in user has `user`. Reserved for future admin.
- `host_members(host_id, user_id, role: 'owner' | 'checker')` — per-host roles.

A `has_host_role(user_id, host_id, role)` SECURITY DEFINER function powers RLS without recursion.

## Data Model

```text
profiles(id PK→auth.users, full_name, avatar_url, created_at)
user_roles(user_id, role app_role)            -- enum: 'user'
hosts(id, owner_id→auth.users, name, slug UNIQUE, bio, logo_url, created_at)
host_members(id, host_id→hosts, user_id→auth.users, role host_member_role, UNIQUE(host_id,user_id))
                                                -- enum: 'owner' | 'checker'
events(id, host_id, title, slug, description, cover_url,
       starts_at, ends_at, location, capacity int,
       is_paid bool default false,             -- always false for now (UI shows "Coming soon")
       status event_status default 'published',-- 'draft'|'published'|'cancelled'
       created_at)
rsvps(id, event_id, user_id, status rsvp_status, position int null, created_at,
      UNIQUE(event_id,user_id))                -- 'confirmed'|'waitlisted'|'cancelled'
tickets(id, rsvp_id UNIQUE, code text UNIQUE,  -- short manual code + QR encodes same
        issued_at, revoked bool default false)
checkins(id, ticket_id UNIQUE, event_id, checked_in_by→auth.users, checked_in_at)
feedback(id, event_id, user_id, rating 1-5, comment, created_at, UNIQUE(event_id,user_id))
gallery_photos(id, event_id, uploader_id, storage_path, status photo_status, created_at)
                                                -- 'pending'|'approved'|'rejected'
reports(id, target_type report_target, target_id, reporter_id, reason,
        status report_status default 'open', created_at)
                                                -- target: 'event'|'photo'|'feedback'|'user'
                                                -- status: 'open'|'resolved'|'dismissed'
```

Storage buckets: `event-covers` (public), `host-logos` (public), `gallery` (public read for approved, write authenticated).

## RLS Summary
- `events`: public SELECT where `status='published'`; INSERT/UPDATE/DELETE only by host owner.
- `rsvps`: user sees own rows; host owner sees all rows for their events; INSERT only as self.
- `tickets`: user sees own; host owner + checker (via `host_members`) see for their events.
- `checkins`: insert/select restricted to host owner + checker.
- `feedback`: public SELECT for past events; INSERT by attendees with confirmed RSVP only.
- `gallery_photos`: public SELECT where `status='approved'`; uploader sees own; host owner manages.
- `reports`: reporter sees own; host owner sees reports targeting their events/photos/feedback.

## Server Functions (TanStack `createServerFn`, all under `src/lib/*.functions.ts`)

- `becomeHost({name, slug, bio})` — creates `hosts` + `host_members(role='owner')`.
- `addHostMember({host_id, email, role})` — looks up auth.users by email, inserts host_members.
- `createEvent`, `updateEvent`, `cancelEvent`.
- `rsvpToEvent({event_id})` — atomic: counts confirmed; if `< capacity` → confirmed, else waitlisted with next `position`. Issues ticket on confirm. Returns redirect-friendly result.
- `cancelRsvp({event_id})` — frees seat, then `promoteWaitlist(event_id)` (FIFO by position): promote head, issue ticket, send notification toast on next page load.
- `checkInByCode({event_id, code})` — checker-only; validates ticket belongs to event, not revoked, not already checked in.
- `submitFeedback`, `uploadGalleryPhoto`, `moderatePhoto`, `submitReport`, `resolveReport`.
- `exportAttendeesCsv({event_id})` — host-only, returns CSV: `name,email,rsvp_status,checked_in_at`.

All mutations validated with Zod (length limits, slug regex).

## Routes (file-based, `src/routes/`)

Public:
- `index.tsx` — landing: hero, featured upcoming events, CTA.
- `events.tsx` — Explore: grid with search + upcoming/past tabs. Past events show "Ended" badge; RSVP hidden.
- `events.$slug.tsx` — event detail: cover, host, when/where, capacity meter, RSVP button (disabled+tooltip if past or full → "Join waitlist"), paid section disabled with "Coming soon" tooltip, gallery (approved), feedback (after end). RSVP click while signed-out → `/login?redirect=/events/<slug>`.
- `hosts.$slug.tsx` — host profile + their events.
- `login.tsx`, `signup.tsx` — email/password + Google; honors `?redirect=`.

Authenticated (`_authenticated/`):
- `tickets.tsx` — list user's tickets with QR.
- `tickets.$id.tsx` — full-screen QR + manual code.
- `feedback.$eventId.tsx` — leave rating/comment.
- `become-host.tsx` — host registration form.

Host area (`_authenticated/host/`, gated by `host_members.role='owner'`):
- `dashboard.tsx` — list of host's events + KPIs.
- `events.new.tsx`, `events.$id.edit.tsx`.
- `events.$id.attendees.tsx` — table, CSV export button, waitlist tab.
- `events.$id.gallery.tsx` — approve/reject pending photos.
- `events.$id.reports.tsx` — report queue (resolve/dismiss).
- `members.tsx` — invite checkers by email.

Checker area (`_authenticated/check-in/`, gated by `host_members` membership):
- `check-in.$eventId.tsx` — QR camera scanner + manual code input; success/duplicate/invalid states.

## Key UI Behaviors
- **Paid toggle**: visible Switch, `disabled`, wrapped in Tooltip "Coming soon".
- **Past events**: `ends_at < now()` → badge "Ended"; RSVP/waitlist buttons hidden; feedback enabled.
- **RSVP gate**: not signed in → navigate to `/login?redirect=<current>`; after login redirect back and auto-prompt RSVP confirmation.
- **Capacity**: enforced server-side in `rsvpToEvent` inside a transaction (count confirmed → decide).
- **Waitlist FIFO**: `position = max(position)+1`; promotion picks `MIN(position)`.
- **CSV**: `name,email,rsvp_status,checked_in_time` — UTF-8 with header row, downloaded via Blob.

## Seed Data (migration)
- 1 host: "Lumen Collective" (owner = first signed-up user via trigger note; or seeded with a fixed test user — see Technical).
- 1 upcoming event: "Founders Mixer" (capacity 25, starts in 7 days).
- 1 past event: "Spring Demo Night" (ended 14 days ago, with 3 sample feedback entries and 2 approved gallery photos using placeholder images).

## Design
Clean, modern, slightly editorial. Tokens added to `src/styles.css`:
- Primary: warm indigo; Accent: soft amber; Surface neutrals.
- Card-based event grid, rounded-2xl, subtle shadows, gradient hero.
- Dark mode supported via existing `.dark` tokens.

## Out of Scope (this iteration)
- Payments (Stripe) — UI placeholder only.
- Email notifications — toast + in-app only.
- Admin/global moderation dashboard.

## Technical Notes
- Use `requireSupabaseAuth` middleware on all protected server fns; `supabaseAdmin` only inside server fns for trusted ops (waitlist promotion, member email lookup).
- Trigger: `on auth.users insert` → create `profiles` row + assign `user_roles.role='user'`.
- RLS uses `has_host_role(auth.uid(), host_id, role)` SECURITY DEFINER to avoid recursion.
- Seed host owner: migration uses a deterministic email "demo@lumen.events"; if no matching auth user exists, the host row is created with `owner_id = NULL` and claimed on first matching signup via trigger.
- QR encodes the ticket `code` (short nanoid, 10 chars). Manual entry uses the same code.
- Capacity enforcement uses `SELECT … FOR UPDATE` on the event row inside the RPC to serialize concurrent RSVPs.

## Build Order
1. Enable Lovable Cloud + schema migration + RLS + seed.
2. Auth pages + profile bootstrap trigger.
3. Public explore + event detail.
4. RSVP + tickets + waitlist (server fn).
5. Host dashboard + event CRUD + members + CSV export.
6. Checker check-in (QR + manual).
7. Feedback + gallery upload/approval.
8. Reports queue.
9. Polish, empty states, toasts.
