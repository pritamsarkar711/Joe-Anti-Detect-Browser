# Contributing to Joe Browser

Thank you for helping improve a project that values honest technical limits, clean UX and legitimate privacy/QA work.

## Before you start

- Open an issue for substantial features so scope and licensing can be checked.
- Keep the v2 design system: one pink primary color, no gradients, no dashed borders, 2px radii, IBM Plex Sans, MUI Rounded icons and short labels.
- Do not add fraud, impersonation, enforcement-evasion or ban-evasion features.
- Do not paste proprietary code, paid templates, private datasets or unlicensed brand assets.
- Use local fonts, flags and SVG marks. Do not introduce external CDN dependencies.

## Local checks

```bash
npm install
npm test
npm run test:fingerprint
npm run test:java
npm run build
npm run dev                 # in one terminal
npm run test:ui             # in another terminal
npm run test:devices
npm run test:site
```

Native EXE and APK builds run in GitHub Actions. Please do not commit generated binaries, `dist/`, `dist-site/`, `apps/desktop/core.cjs`, `apps/android/assets/` or signing keys.

## Developer Certificate of Origin

By contributing, you certify the Developer Certificate of Origin 1.1. Add a sign-off line to every commit:

```text
Signed-off-by: Your Name <your.email@example.com>
```

Use `git commit -s` to add it automatically. The sign-off certifies that you wrote the contribution or have the right to submit it under the repository's licenses, and that you understand the work is public and documented.

The full DCO text is available at <https://developercertificate.org/>.

## License boundaries

Source code is MIT. Original documentation and Joe Browser brand assets are CC BY-ND 4.0. The Joe Browser name and logo are reserved. Official third-party marks belong to their owners. See [`LICENSE`](LICENSE), [`NOTICE`](NOTICE), [`TRADEMARK.md`](TRADEMARK.md) and [`docs/IP-POLICY.md`](docs/IP-POLICY.md).
