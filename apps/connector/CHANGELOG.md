# Changelog

All notable changes to this package are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the package follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `zapbip.json` sets the program and arguments `connect` starts for each client, found in the working folder or named by `--config` or `ZAPBIP_CONNECTOR_CONFIG`.

## [0.1.0] - 2026-11-13

### Added

- First release of the local connector: `connect` resumes the owner's coding session for each WhatsApp message, `listen` prints one line per message and `channel` relays them into an open session.
