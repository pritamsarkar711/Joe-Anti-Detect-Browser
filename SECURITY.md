# Security policy

## Reporting a vulnerability

Please report security issues privately through
[GitHub security advisories](https://github.com/pritamsarkar711/Joe-Anti-Detect-Browser/security/advisories/new)
for this repository rather than in a public issue. Include the affected
component (Windows EXE, Android APK, web control plane, Supabase edge
function or migration), a reproduction if you have one, and the impact you
believe it has.

Do **not** include real credentials, session cookies or personal data in a
report. If a report accidentally contains secrets, rotate them first and say
so in the follow-up.

## Supported versions

| Version | Supported |
|---|---|
| 3.1.x | yes |
| < 3.1 | no — 3.1.0 in particular could not start (see `RELEASE_NOTES.md`) |

## Scope notes

- Joe Browser is a profile isolation manager for legitimate privacy research,
  QA and separating your own accounts. It is not undetectable, ships no
  patched engine, and adds no CAPTCHA bypass, ban evasion or impersonation.
- The service-role key exists only as a Supabase project secret used by the
  `joe-command-validate` edge function; clients carry the publishable anon key
  and are denied direct access to the relay tables by row-level security.
- The Windows installer is currently **unsigned**; verify `SHA256SUMS.txt`
  from the release before running any binary.
