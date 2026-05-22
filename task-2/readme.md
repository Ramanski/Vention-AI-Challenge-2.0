# Convene — Community Event Platform

Convene is a lightweight community event hosting platform built as part of the Vention AI Challenge.

The application allows Hosts to publish and manage events, attendees to RSVP and receive digital tickets, and Checkers to validate attendance through a check-in flow.

---

# Features

## Public event discovery

- Explore public upcoming and past events
- Search and filter events
- Public and Unlisted event support
- Public Host pages

---

## Event management

Hosts can:

- Create events
- Publish / unpublish events
- Duplicate events
- Manage attendees
- Moderate gallery uploads
- Review reports
- Export attendee CSVs

---

## RSVP and tickets

Attendees can:

- RSVP to events
- Join waitlists when capacity is reached
- Cancel RSVP
- Receive QR-code tickets
- View tickets in the My Tickets page

---

## Check-in system

Checkers can:

- Open event check-in pages
- Enter ticket codes manually
- Prevent duplicate check-ins
- Undo the last check-in
- Monitor live attendance counters

---

## Gallery and feedback

Users can:

- Upload event gallery photos
- Submit post-event feedback and ratings
- Report events or gallery images

Hosts can:

- Approve or hide gallery uploads
- Review reports
- Hide inappropriate content

---

# Main user flows

## Publish Event

1. Sign in
2. Register as Host
3. Open Host Dashboard
4. Create an event
5. Publish the event

---

## RSVP Flow

1. Open an Event page
2. Click RSVP
3. Sign in if required
4. Receive confirmation or waitlist placement
5. Open My Tickets to access ticket and QR code

---

## Ticket and Check-in Flow

1. Open My Tickets
2. Show QR/ticket code at venue
3. Checker opens Check-in page
4. Checker enters/scans code
5. Attendance is recorded

---

# Roles

## Host

Can:

- Manage events
- Moderate gallery uploads
- Review reports
- Export CSV data
- Invite team members
- Access Host Dashboard

---

## Checker

Can:

- Access check-in pages
- Perform attendee check-ins

---

# Technologies used

- Lovable
- React
- TypeScript
- Tailwind CSS
- Supabase/Lovable backend services
- QR code generation
- CSV export utilities

# Running locally

```bash
npm install
npm run dev