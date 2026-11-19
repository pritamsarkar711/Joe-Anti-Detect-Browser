# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); releases are tagged
on GitHub with `SHA256SUMS.txt` for every binary.

## [Unreleased]

### Added

- Real Supabase cloud accounts: sign-up with email confirmation, sign-in,
  password reset with paste-link recovery, session persistence and sign-out;
  entitlement read from a server-side `accounts` row with the
  `guard_account_plan` trigger blocking client-side escalation.
- Migration `0002_accounts_and_licensing.sql`: allowlist, entitlement rows and
  backfill for pre-trigger users, licensing state, admin guards, the
  `joe-command-validate` policy note, and an event trigger that re-enables RLS
  if a future migration forgets it.
- EXE⇄APK command relay through the `joe-command-validate` edge function
  (send / poll / ack) — the only holder of the service-role key; the desktop
  and Android clients now speak it instead of unauthenticated table writes.
- Desktop `keystrokes:send`: "Paste as human" replays the reviewed schedule
  through CDP with per-key delays; non-desktop platforms label the button
  "Copy plan". Main-process smoke coverage for dispatch and refusals.
- Brand guard in `test:icons`: every published mark (both favicons, README
  logo) must match `Brand.tsx`'s J monogram.

### Fixed

- Desktop `app:info` reported version 3.1.0 while the product shipped 3.1.1.
- The brand generator emitted the retired ring-and-dot mark, so the README
  header and favicons disagreed with the app.
- Auth confirmation/reset links pointed at `http://localhost:3000`; Supabase
  redirects now use the canonical Vercel origin.
- Built site linked documentation to a branch that does not contain the work.
- Demo activity row claimed "24 profiles" in a six-profile workspace.
- Settings promised cloud auth before it existed.
- Dependency audit: 11 vulnerabilities (2 critical) → 0, without breaking
  `java-parser`'s pinned chevrotain.

## [3.1.1] and [3.1.0]

See the [GitHub releases](https://github.com/pritamsarkar711/Joe-Anti-Detect-Browser/releases)
for the shipped notes. 3.1.0 could not start (`extensions.cjs` missing from
the package); 3.1.1 fixes it and adds the gates that would have caught it.
