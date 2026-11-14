# Scripts

Repository scripts that are not part of any package.

| Path | What it does |
| --- | --- |
| [verify.sh](verify.sh) | The local gate: runs only what the diff can break, from the gates listed in [verify-gates.tsv](verify-gates.tsv) |
| [pr-media.sh](pr-media.sh) | Attaches screenshots and videos to a pull request through GitHub's own upload |
| [plugin-wheel](plugin-wheel/) | Builds the Python wheel of a channel plugin that zapbip hosts |
| [e2e](e2e/) | Docker fixtures of the client end-to-end suite |
