# Mintlify publish

Set the company facts, publish the npm packages, host the plugin wheels, run the docs preflight, connect the repository to Mintlify and serve the docs on `docs.zapbip.com` in English and Portuguese.

The docs live in `apps/docs` and publish when `main` changes. The site links the start link (`https://mcp.zapbip.com/start`) and pins `npx zapbip@<version>`, so steps 1 to 4 come first, and the production deploy ([deploy.md](deploy.md), go-live step 20) and the registered production number (go-live step 21) before step 5. Mintlify publishes on every merge to `main` and cannot refuse, so `pnpm docs:preflight` (step 5) is the gate: the docs must not point at a company fact, an npm package or a wheel that does not exist. The production deploy refuses on the company facts, the plugin files, and an npm package that is squatted or cannot be read; it only warns, and goes on, about an npm package that is not published yet. The runbooks themselves are never published ([ADR 0026](../adr/0026-runbooks-live-in-the-repository-not-on-mintlify.md)).

1. **Publish the npm package.** Check that the package version in `apps/connector/package.json` is the exact version the docs and skills pin as `npx zapbip@<version>`. Create an npm account at `https://www.npmjs.com/signup` with two-factor authentication and run `npm login`. Check that `apps/connector/package.json` is publishable: name `zapbip`, a `version`, `files` listing only `dist`, the `bin` entry `zapbip`, and no `"private"` key. From `main` run `pnpm --filter zapbip build`, `npm pack --dry-run` inside `apps/connector` and finally `npm publish --access public` inside `apps/connector` (never publish or pack with pnpm: it fails on workspace dependencies). Enter the one-time code when npm asks.

   Expect: `npm pack --dry-run` lists only `dist/cli.js`, `README.md` and `package.json`, and `npm view zapbip@<version> maintainers --json` lists your npm user. Publish by hand, with two-factor authentication on the account, using the command above; provenance needs a publish from CI, which does not exist today and is an optional later hardening. Then write your exact npm user name as `ZAPBIP_NPM_PUBLISHER` in your own environment file: the production deploy and the docs deploy refuse until the package resolves and lists that user as a maintainer.

   If it fails: a `403` or a name conflict means the name `zapbip` is taken; stop, because every page and skill pins it. An `EOTP` error means the one-time code expired; run the publish again. A published version cannot be replaced; fix forward with a new version and update the pinned version in the docs and skills.

2. **Fill the Logic Bit company facts.** In `libs/types/src/constants.ts` replace every `COMPANY_FACT_UNSET` value of `COMPANY` (`legalName`, `cnpj`, `address`, `website`, `contactEmail`) with the real Logic Bit data: the legal name and the CNPJ from the company's CNPJ registration certificate (Comprovante de Inscrição e de Situação Cadastral, issued free by the Receita Federal), the registered address from the same certificate, the website you publish for the company and a monitored contact email. Commit it on a branch and merge it through the normal pull request. Never copy the data into a page by hand: the docs footer, the About / Legal page and the install page read it from that one source.

   Expect: `grep -n COMPANY_FACT_UNSET libs/types/src/constants.ts` prints only the definition of the sentinel.

   If it fails: the deploy command refuses at its company facts step and names the fields still holding the sentinel; nothing was deployed.

3. **Publish the npm plugins.** Log in with `npm login` as a member of the `@zapbip` scope (create the scope at `https://www.npmjs.com/org/create` if it does not exist). For each plugin whose registry is `npm` in `libs/agents/src/generated/plugins.ts` (its `plugin.ts` names the package folder, package name and version), check that the `package.json` of its package folder carries that version and name, build it, run `npm pack --dry-run` inside its package folder and then `npm publish --access public` there, from the package folder so its `prepublishOnly` build runs (never publish or pack with pnpm: it fails on the `workspace:*` devDependencies with ERR_PNPM_CANNOT_RESOLVE_WORKSPACE_PROTOCOL). Enter the one-time code when npm asks.

   Expect: `npm view <package name>@<version> maintainers --json` lists your npm user, the same one as `ZAPBIP_NPM_PUBLISHER`.

   If it fails: a 403 means your npm user is not in the `@zapbip` scope; add it in the npm organisation settings. The docs preflight refuses until this command resolves; the production deploy only warns.

4. **Host the plugin wheels.** A plugin whose registry is `self-hosted-wheel` is a wheel built from its package folder, committed in the release folder that its `hostedArtifacts` name and served by the Worker from the `zapbip-packages` bucket under `https://mcp.zapbip.com/pkg/`; no PyPI account is involved ([ADR 0034](../adr/0034-the-hermes-wheel-is-self-hosted-and-installed-by-a-pinned-hash.md)). Run every command here in your own interactive shell with `CLOUDFLARE_API_TOKEN` exported ([deploy.md](deploy.md)). The buckets come from [cloudflare-setup.md](cloudflare-setup.md), step 6. When the source of a plugin changed since the last upload, bump its version everywhere the shape tests name it, run `pnpm plugin-wheel:build <id>` with the plugin folder name from `libs/agents/supported`, set the hash constants in that folder's `wheel.ts` to the hashes it prints, and merge that change first. The release folder holds the wheel and the hash-pinned requirements file that the install command downloads; upload every hosted artifact under a key that is never overwritten, so check it is free: `pnpm --filter @zapbip/api exec wrangler r2 object get zapbip-packages/<filename> --remote --file /tmp/zapbip-wheel-check.whl` must fail; if it succeeds, stop and bump the version. Then upload it: `pnpm --filter @zapbip/api exec wrangler r2 object put zapbip-packages/<filename> --file <release folder>/<filename> --content-type <content type> --remote`, with the filename, release folder and content type of each `hostedArtifacts` entry. To check it on staging first, repeat the put with `zapbip-packages-staging` and `--env staging` omitted: R2 commands take the bucket name, not an environment.

   Expect: the put reports the object as uploaded, and running the `object get` command again followed by `shasum -a 256 /tmp/zapbip-wheel-check.whl` prints the `expectedSha256` of that entry. The production deploy refuses until the bucket holds every hash.

   If it fails: a bucket that does not exist means step 6 of `cloudflare-setup.md` was skipped; do it. A permission error means `wrangler whoami` shows the wrong account or the token lacks R2 edit ([cloudflare-setup.md](cloudflare-setup.md), step 4). A hash that differs means the file in the release folder is not the one the constant names; rebuild with `pnpm plugin-wheel:build <id>`, fix the constant, merge, and upload under a new version.

5. **Run the docs preflight.** From the repository root run `pnpm docs:preflight`. It refuses until every company fact is set, and until `zapbip` and every npm plugin resolve on npm with your npm user (`ZAPBIP_NPM_PUBLISHER`) as their only maintainer, and every file under `https://mcp.zapbip.com/pkg/` that a plugin hosts answers with the sha256 the plugin pins, which needs step 4 and the production deploy first. Mintlify publishes whatever is on `main`, so run it before the first merge of the docs and again before enabling the site.

   Expect: the command prints `the docs are ready to publish` and exits zero.

   If it fails: it prints `refused at <step>: <what to do>`; do that step of this runbook and run it again. Nothing is changed by the command.

6. **Create the Mintlify account.** Sign up at `https://mintlify.com` with the owner's email and create the project from the dashboard. Pick the plan that includes a custom domain; read the plan page for what each plan costs and decide there, since this runbook cannot know today's prices.

   Expect: the dashboard shows an empty project.

   If it fails: if no free plan offers the custom domain, either pay for the plan that does or keep the default Mintlify address and skip step 9; record the choice in the go-live record.

7. **Connect the repository.** Only after steps 1, 3 and 4 are done and step 5 passes: linking the repository makes Mintlify publish the docs on every push to `main`, and the docs print `npx zapbip@0.1.0`, the npm plugin install commands and the pinned wheel install commands, so a package nobody has published or a wheel nobody has uploaded would fail for every reader of the docs. In the dashboard open Git Settings and install the Mintlify GitHub app on this repository only. Choose the production branch `main`. Turn on the monorepo option and set the docs path to `apps/docs`, where `docs.json` lives.

   Expect: Mintlify builds the site from `apps/docs` and shows a preview address with the Get started group.

   If it fails: if the build cannot find `docs.json`, check the path value. If Mintlify cannot build from a subdirectory, this runbook moves ([ADR 0026](../adr/0026-runbooks-live-in-the-repository-not-on-mintlify.md)); record it before changing anything.

8. **Check the links before every merge.** From `apps/docs` run `pnpm dlx mint@4.2.1207 broken-links`. Run it again after each docs change, before merging to `main`.

   Expect: the command reports no broken links.

   If it fails: fix each reported link in both languages; a page and its Portuguese twin must both exist.

9. **Set the domain.** In the dashboard open Settings, Custom domain, and enter `docs.zapbip.com`. Add the CNAME record it shows, as in [dns.md](dns.md), step 4, then redirect the bare domain with step 5, and wait for Mintlify to confirm it.

   Expect: `https://docs.zapbip.com` serves the site over HTTPS.

   If it fails: `dig CNAME docs.zapbip.com +short` must print Mintlify's target; if a proxy in Cloudflare hides it, switch the record to DNS only.

10. **Check the languages.** Open `https://docs.zapbip.com` in a browser set to English, then in one set to Portuguese (Brazil). Use the language switcher and open a few pages in each language.

   Expect: both languages exist for every page, with mirrored paths (`/` and `/pt-BR/`). If Mintlify starts the Portuguese browser in Portuguese, note that; if it does not, the switcher is the rule, and no redirect script is added.

   If it fails: a missing twin page shows a 404 in one language; add the page. Language start behaviour is a Mintlify feature, so check its dashboard for a language setting before concluding it is absent.
