# Release a published package

Tag and announce a version of a published package: the connector and the channel plugins on npm, and the Python wheel the Worker hosts.

A package is published once, by hand, and its first publish is steps 1 and 3 of [mintlify-publish.md](mintlify-publish.md) and the wheel is hosted in step 4 of the same runbook. This runbook is what follows every version after that: the version bump, the changelog, the tag and the GitHub Release. A GitHub Release is a real release of one package, so its notes are the changelog section and it carries no assets: media for pull requests lives in the private media repository, never here. Every package has its own version, its own `CHANGELOG.md` and its own tags, named `<package>-vX.Y.Z` with the package name without its scope: `zapbip-v0.1.0`, `zapbip-platform-v0.1.0`.

1. **Choose the version.** Read the `CHANGELOG.md` of the package folder. Pick the next version by [Semantic Versioning](https://semver.org/spec/v2.0.0.html): a patch for a fix, a minor for a feature that keeps every install working, a major for a change that breaks a documented install or tool.

   Expect: the version is greater than the newest `## [X.Y.Z]` heading of the changelog.

   If it fails: when two changes in the same release disagree on the size, take the larger one.

2. **Bump the version and write the changelog.** In a branch `chore/release-<package>-<version>`, set the version in `package.json` (or `pyproject.toml`) of the package folder and everywhere the shape tests name it. Move the `## [Unreleased]` entries of its `CHANGELOG.md` under a new `## [<version>] - <date>` heading, grouped as Added, Changed, Fixed, Removed or Security, and leave an empty `## [Unreleased]` above it. Merge it through the normal pull request.

   Expect: `pnpm verify` is green and the heading of the changelog matches the version of the manifest.

   If it fails: the open-source shape test names the package whose changelog does not carry its current version.

3. **Publish.** From the merged `main`, publish exactly as [mintlify-publish.md](mintlify-publish.md) says for the package: `npm publish --access public` from the package folder for an npm package, the wheel upload for a hosted wheel.

   Expect: `npm view <package name>@<version> version` prints the version, or the hosted file answers with the pinned hash.

   If it fails: a published version cannot be replaced; fix forward with the next patch and its own entry in the changelog.

4. **Tag.** From the merged `main`, create the annotated tag and push only that tag: `git tag -a <package>-v<version> -m "<package> <version>"` then `git push origin <package>-v<version>`.

   Expect: `git ls-remote --tags origin <package>-v<version>` prints one line.

   If it fails: a tag that already exists names a version that was released before; check step 1. Never move a pushed tag.

5. **Create the GitHub Release.** Copy the section of the new version out of `CHANGELOG.md` into a file in your scratch folder and run `gh release create <package>-v<version> --verify-tag --title "<package> <version>" --notes-file <file>`, adding `--latest=false` for every package except the connector. Add no files: the package is on npm, or on the Worker for a wheel.

   Expect: the Releases page lists the release with the changelog section as its notes and no assets.

   If it fails: `--verify-tag` refusing means step 4 did not push the tag; run it again.
