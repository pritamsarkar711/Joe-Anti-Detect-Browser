# Unreleased — cloud auth, validated sync, clean audit

## Cloud accounts are real now

The account screen previously promised Supabase while binding every email
locally. Sign-up (with email confirmation), sign-in, password reset with
paste-link recovery, session persistence and sign-out now run through the
official Supabase client; entitlement is read from a server-side account row.
Local sign-in still works when cloud keys are not configured, and the UI says
which mode you are in. Confirmation links point at the canonical
`https://joe-browser-control.vercel.app` origin instead of `localhost:3000`.

## EXE ⇄ APK sync works through a validated relay

The desktop previously depended on Realtime broadcasts it could not write, and
the APK polled a table row-level security blocked it from reading. Both sides
now use the `joe-command-validate` edge function (send / poll / ack), which
holds the only service-role key and validates action, profile, device and
payload shape. Clients keep just the anon key; an anonymous INSERT into
`commands` is denied with SQLSTATE 42501 on the live database. Migration
`0002_accounts_and_licensing` captures the schema in the repository and
backfills three pre-trigger users; the owner allowlist resolves to
`plan=owner, unlimited=true`, and a trigger blocks client-side plan
escalation.

## Paste as human is no longer a fake button

"Send to ⟨profile⟩" only copied to the clipboard. The desktop shell now
replays the reviewed keystroke plan through CDP `Input.dispatchKeyEvent` with
each per-key delay, refusing invalid plans and closed windows with a reason;
other platforms label the button "Copy plan". Accessibility text entry only —
CAPTCHA challenges stay with a person.

## Quality and housekeeping

- `npm audit` (production and development): **11 vulnerabilities, 2 critical → 0**.
- The brand generator emitted the retired ring-and-dot, so the README header
  and favicons disagreed with the app's J monogram. One geometry now, and
  `test:icons` fails if any published mark drifts.
- Desktop `app:info` reported 3.1.0 while the product shipped 3.1.1.
- The built site linked documentation to a branch that does not contain the
  work; the branch is now derived from the build environment.
- A demo activity row claimed "24 profiles" in a six-profile workspace.
- Startup-retry and signing checkpoint (previous notes): retry loading the
  workspace without clearing profiles when the entry script or application
  chunk fails. No new installer or APK is published with these changes.

For maintainers: configure repository signing secrets
`JOE_SIGNING_STORE_B64` (base64-encoded keystore), `JOE_SIGNING_ALIAS`,
`JOE_STORE_PASSWORD`, and `JOE_KEY_PASSWORD` through the CI secret store, not
in source or chat. Preserve and back up the same signing identity across
releases. Before distribution compare the APK signer certificate against the
owner's trusted fingerprint, then test a clean install and in-place upgrade.
Signature verification alone is not an installation test. The Windows EXE
remains **unsigned** until a code-signing certificate is wired into the
workflow.
