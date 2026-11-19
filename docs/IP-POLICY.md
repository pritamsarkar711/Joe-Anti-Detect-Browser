# Copyright, licensing and protection strategy

Last updated: v2.0.0. This document explains how Joe Browser protects authorship, identity and release provenance without overstating what an open-source license can do.

## 1. The honest legal baseline

The previous v1.0.0 tag was published as MIT source code. That grant cannot be retroactively revoked. Under MIT, copying, modifying and redistributing the **source code** is permitted when the copyright and permission notices are retained. No public software license can honestly promise to prevent all cloning or redistribution, and no client-side watermark can make a public binary impossible to copy.

What *is* protectable, and what this repository actively protects, is:

- the copyright notice and authorship record,
- the Joe Browser name, logo, trade dress and official screenshots,
- original written documentation and brand assets,
- release integrity and canonical provenance,
- truthful representation: no false ownership, endorsement or official status,
- third-party marks and dataset attributions,
- contributor warranties and a clean chain of ownership.

## 2. Layered licensing

| Material | Grant | Practical effect |
|---|---|---|
| Source code in `packages/`, `src/`, `apps/`, `scripts/`, `tests/` and `site/` | MIT, see [`LICENSE`](../LICENSE) | Forks are allowed with notice. Missing notice is infringement. |
| Generated EXE/APK from tagged source | MIT source with build provenance | Redistribution is allowed with notice, but may not be presented as an official build. |
| `README.md`, `docs/`, original brand assets and favicon | CC BY-ND 4.0, see [`docs/LICENSE.md`](LICENSE.md) | Sharing with attribution is allowed; rebranding, adaptation and false authorship are not. |
| Joe Browser name, logo and trade dress | Reserved, see [`TRADEMARK.md`](../TRADEMARK.md) | Nominative reference only. A fork must use a distinct identity. |
| Official platform marks | Owner's trademark; simple-icon paths CC0 | Used only to identify compatible platforms. No ownership claimed. |
| Fingerprint samples | Apache-2.0 BrowserForge/Apify data | Attribution and license notices are retained in the generated dataset. |
| IBM Plex Sans, flags, MUI and other packages | OFL / MIT / respective licenses | Local copies ship with attribution in [`NOTICE`](../NOTICE). |

The CI unit suite checks that `LICENSE`, `NOTICE`, `TRADEMARK.md`, `docs/IP-POLICY.md` and the canonical repository URL remain present. Removing provenance files breaks the build gate.

## 3. Authorship and provenance

- Every official commit lives in the canonical GitHub repository and is visible in public history.
- Every official binary is produced by `.github/workflows/release.yml` from a tagged source revision, not from a developer laptop.
- Releases include `SHA256SUMS.txt`; users should verify checksums before running EXE or APK files.
- The site, README and source all point to the canonical repository and the canonical Vercel homepage.
- `NOTICE` records copyright, third-party datasets, fonts, flags and official marks.
- The desktop builder embeds `Copyright © 2026 Pritam Sarkar` in its package metadata.
- Future releases should use signed annotated tags when a signing key is available. This is a recommended hardening step, not a claim about existing unsigned tags.

These records make false ownership claims easy to refute with dated, public, machine-verifiable evidence.

## 4. Contribution hygiene

All contributors must sign off on the Developer Certificate of Origin in [`CONTRIBUTING.md`](../CONTRIBUTING.md). A sign-off certifies that the contributor has the right to submit the work under the repository's licenses. This reduces the risk of later ownership disputes and keeps a clean provenance chain.

Do not paste proprietary code, paid templates, private datasets, customer data or third-party brand assets without a compatible license. Official marks in this repository are limited to simple, nominative SVG marks generated from declared sources.

## 5. Binary and release integrity

1. CI runs unit tests, Java parsing, typecheck, production build, core bundling, Android asset generation and SEO site generation.
2. Windows and Android jobs build from the same tagged source and upload distinct artifacts.
3. The release job creates checksums and publishes all binaries plus `SHA256SUMS.txt`.
4. Android builds are debug-signed in CI. Users must verify the checksum; production signing keys should remain private and must never be committed.
5. Repackaged binaries must retain notices and must not use the official name, logo, screenshots or release identity as if they were the canonical build.

## 6. Enforcement workflow

If a mirror, fork, marketplace listing or download claims ownership, removes notices, reuses the official identity or distributes altered binaries as official:

1. Capture the URL, screenshots, file hashes and the date.
2. Compare it against the canonical repository, tag and `SHA256SUMS.txt`.
3. Open a GitHub issue in the canonical repository with evidence.
4. Request correction: attribution, distinct branding, notice restoration or removal.
5. Use the hosting platform's trademark or DMCA notice process for uncorrected use of protected documentation, brand assets or confusing identity.
6. For malicious or security-related repackaging, use GitHub private vulnerability reporting and publish an advisory.

This policy targets false authorship, brand misuse, missing attribution and deceptive binaries. It does not threaten lawful MIT forks that keep notices and use a distinct identity.

## 7. What would be required for stronger restrictions

A blanket prohibition on copying or redistribution would require a private repository and a custom commercial or source-available license. It cannot be applied retroactively to the already published MIT v1.0.0 tag, and it would no longer be an open-source project. If the owner later wants that model, the clean approach is a new major version with a separate license, a signed-tag policy, private signing keys and a contributor license agreement. The current v2 release deliberately preserves the earlier MIT grant and protects identity and provenance around it.

## 8. Scope of use

This project is for legitimate QA, privacy research, ad verification and management of one's own accounts. It does not grant permission to use the name or marks for fraud, impersonation, enforcement evasion or deceptive account activity. Technical limitations are documented in [`ARCHITECTURE.md`](ARCHITECTURE.md) and [`VALIDATION.md`](VALIDATION.md).
