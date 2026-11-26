# Node build compatibility (11.2F.2B)

Build-policy ranges: Node `^22.20.0 || ^24.12.0 || ^26.0.0`, stable npm `>=10.0.0`. Use the latest patched version in one of those Node branches. The floors are not security patch guarantees. Node 20 is retired; unsupported odd or future branches require separate review. Node 24 is the recommended build baseline; Node 26 has entered LTS. Existing Node 26.1.0 is within the compatibility range but should be updated to the current patched branch release.

The stricter 22/24 floors account for the locked optional Linux x64 native package `@napi-rs/lzma-linux-x64-gnu@1.5.1` (`^22.20 || ^24.12 || >=25`). All locked Node engine ranges were statically evaluated against 22.20.0, 24.12.0 and 26.0.0 with npm's bundled semver. Static evaluation is not a runtime test. The 188 non-root records are unchanged.

## Local QA

Run `npm run check:runtime`, `npm run test:runtime`, `npm ci --engine-strict --strict-peer-deps --force=false --legacy-peer-deps=false --include=dev --include=optional`, `npm audit`, `npm audit --omit=dev`, `npm ls --all`, `npm run typecheck`. The prebuild and pretypecheck scripts repeat the runtime check. No consumer install hook or global engine-strict configuration is installed. `engines` is advisory for consumers unless strict npm engine enforcement is configured; this intentionally narrows the published package's declared Node range. Browser React compatibility remains a later test. No npm registry publish is authorized.

## Hosted QA

Separate Editor Node build compatibility workflow: latest patch of each of 22, 24, 26 on Ubuntu 24.04 and Windows 2025 x64. Six required jobs and one aggregate gate, no cache, pinned Node24-based actions, contents read-only, no persisted checkout credentials. Each job runs guard tests, frozen install, dependency tree, both security audits, TypeScript and existing production build smoke test. Evidence includes logs, npm JSON reports and build summary (runtime, commit, lock/manifest SHA-256, selected actual installed versions, output hashes and sizes). CI rejects missing outputs and nonzero/malformed audit reports. The build runs on disposable CI checkouts; it does not publish, upload a release tarball or modify the working project. The existing PHP compatibility workflow stays unchanged. A new workflow's required gate is not automatically a repository branch-protection requirement.

The workflow tests latest patch releases, not all versions within the declared ranges. Browser behavior, declaration consumer compatibility, distribution consistency and fresh release packaging remain future phases. Do not reuse the old tgz.
