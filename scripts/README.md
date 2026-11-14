# Scripts

Repository scripts that are not part of any package.

| Path | What it does |
| --- | --- |
| [verify.sh](verify.sh) | The local gate: runs only what the diff can break, from the gates listed in [verify-gates.tsv](verify-gates.tsv) |
| [pr-media.sh](pr-media.sh) | Attaches screenshots and videos to a pull request with the GitHub CLI's `--attach` |
| [emails-preview.sh](emails-preview.sh) | Opens the React Email studio on the email templates, with the welcome in every language and the digest |
| [docker-entrypoint.sh](docker-entrypoint.sh) | Starts the development sandbox inside the Docker image: keeps generated secrets in the data volume, applies the migrations and runs the Worker |
| [plugin-wheel](plugin-wheel/) | Builds the Python wheel of a channel plugin that zapbip hosts |
| [e2e](e2e/) | Docker fixtures of the client end-to-end suite |
