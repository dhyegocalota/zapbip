# 0034. The Hermes wheel is self-hosted and installed by a pinned hash

- Status: Accepted (owner delegated 2026-11-06)
- Date: 2026-11-07
- Deciders: Dhyego Calota (owner, delegated); Claude (advisor)
- Inspired by: [ADR 0027](0027-deploys-run-from-the-owners-machine-not-from-ci.md), [ADR 0028](0028-the-native-channel-plugin-is-the-first-rung-for-openclaw-and-hermes.md), [ADR 0014](0014-inbound-media-stored-in-r2-at-webhook-time.md), the deploy-readiness PyPI squatting preflight, `docs/features/hermes-wheel-hosting/spec.md`

## Context

The Hermes plugin is a Python package, `zapbip-platform`, and the install copy and docs printed `pip install zapbip-platform==0.1.0`. The owner has no PyPI account and agents may not create one, so the package cannot be published, and an unpublished name is open to squatting: anyone could publish a `zapbip-platform` that every user would then install. The deploy preflight tried to defend that with PyPI role-holder checks that can never pass here.

## Decision

1. The wheel is built from `apps/hermes-plugin`, committed under `apps/hermes-plugin/release/`, stored in R2 (`zapbip-packages`, binding `PACKAGES`) under an immutable versioned key, and served by the Worker at `https://mcp.zapbip.com/pkg/<wheel filename>`: GET only, immutable cache headers on a 200, 404 for everything else.
2. The install command is a pip direct reference with a sha256 fragment: `pip install "zapbip-platform @ https://mcp.zapbip.com/pkg/zapbip_platform-<version>-py3-none-any.whl#sha256=<hash>"`. A direct URL names no index, so a squatted PyPI name cannot be installed by it, and pip refuses bytes that do not match the hash.
3. The version and the hash are constants in `libs/types` (`ZAPBIP_HERMES_PLUGIN_VERSION`, renamed from `ZAPBIP_PYPI_VERSION`, and `ZAPBIP_HERMES_WHEEL_SHA256`). The hash is the sha256 of the committed wheel; a shape test compares the two and compares the wheel's package files with the plugin source.
4. The deploy preflight checks the hosted wheel's hash (R2 through the shell for the Worker deploy, HTTPS for the docs deploy). The upload is a runbook step run from the owner's shell.
5. PyPI stays an optional later channel. Publishing there changes no printed command.

Amendment (security review, owner delegated 2026-11-06): the `#sha256=` direct reference pins only our wheel, while its `Requires-Dist` (httpx, websockets and their dependencies) would come unpinned from PyPI into the process that holds the connection link. The install command therefore downloads `zapbip_platform-<version>-requirements.txt`, checks its sha256 (a constant in `libs/types`) and installs with `pip install --require-hashes -r`. The file lists the wheel by URL with its hash and every runtime dependency pinned `==` with `--hash` lines; it is committed beside the wheel and served by the same route.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Publish to PyPI | the shortest command, a familiar index | needs an account the owner does not have and agents may not create; the name is squattable until published | blocked by the owner's constraint |
| Install from the GitHub repository (`pip install git+https://...`) | no hosting, no upload | pins a commit, not a wheel; needs git and a build toolchain on the user's machine; the repository may be private or renamed | slower, heavier and ties installs to the repository's visibility |
| GitHub release asset URL | no Worker route | a URL outside our control, redirects through another host, no cache headers we set, availability tied to the repository | the Worker already serves this host and R2 is in place |
| Serve a PEP 503 index from the Worker (`--extra-index-url`) | `pip install zapbip-platform` stays short | an extra index lets another index win with a higher version (dependency confusion); more surface for one file | the direct URL plus hash is simpler and safer |
| Wheel in the `MEDIA` bucket under `pkg/` | no new bucket | the media retention sweep and the account purge could reach it | a separate bucket costs one runbook line |
| Rebuild the wheel in the shape test and compare hashes | no binary in git | zip metadata, setuptools and Python versions change the bytes, so the test is flaky across machines and CI images; the uploaded bytes are not the tested bytes | a committed wheel is the exact artifact, and the contents test still catches drift |

## Consequences

- The runtime dependencies are pinned and hashed too; a dependency bump means regenerating `apps/hermes-plugin/requirements.txt`, rebuilding the requirements file, a new hash constant and a new upload.
- The command is one shell line with `curl` and `sha256sum` (`shasum -a 256 -c -` on macOS) in front of pip.
- Each plugin change needs a rebuilt wheel, a version bump (a new immutable key), a new hash constant and an upload; the shape test blocks any partial step.
- The command is long. The docs show it in a copyable block and the install copy renders it from the constants, so nobody types it.
- The hash in the docs is the only trust anchor for the plugin code; protecting the repository and the owner's shell protects it.
- The Worker gains a public, unauthenticated route; it reads one bucket and only names that match the wheel pattern.
- A binary of about 20 KB lives in git.

## Evidence

- The route, the hash and the shape tests are specified in `docs/features/hermes-wheel-hosting/test-plan.md`; the e2e installs the direct reference with `pip` from a local Worker, once with the right hash and once with a wrong one.
- pip verifies a `#sha256=` fragment on direct URL requirements and fails with `THESE PACKAGES DO NOT MATCH THE HASHES` on a mismatch.

## Revisit when

- The owner creates a PyPI account and wants the short command.
- Hermes ships its own plugin registry or an `hermes plugins install <url>` that makes pip unnecessary.
- The wheel grows past what a committed binary should carry, or more than one Python package is hosted (then an index route earns its place).
