#!/usr/bin/env bash
set -u
here="$(cd "$(dirname "$0")" && pwd)"
failures=0
export HOME=$(mktemp -d)
export XDG_CONFIG_HOME="$HOME/xdg-config"
unset CLOUDFLARE_API_TOKEN CLOUDFLARE_API_KEY
export WRANGLER_REPOSITORY_ROOT=$(mktemp -d)
mkdir -p "$WRANGLER_REPOSITORY_ROOT/apps/api"
api_environment_file="$WRANGLER_REPOSITORY_ROOT/apps/api/.env"
macos_wrangler_config="$HOME/Library/Preferences/.wrangler/config/default.toml"
xdg_wrangler_config="$XDG_CONFIG_HOME/.wrangler/config/default.toml"
legacy_wrangler_config="$HOME/.wrangler/config/default.toml"

log_in_with() { mkdir -p "$(dirname "$1")"; : > "$1"; }
log_out() { rm -rf "$HOME/Library" "$HOME/.wrangler" "$XDG_CONFIG_HOME" "$WRANGLER_REPOSITORY_ROOT"/apps/api/.env*; unset CLOUDFLARE_API_TOKEN CLOUDFLARE_API_KEY; }

expect_exit() {
  local name=$1 expected=$2 script=$3 input=$4
  printf '%s' "$input" | "$here/$script" >/dev/null 2>&1
  local actual=$?
  [[ "$actual" == "$expected" ]] && return
  echo "FAIL $name: expected exit $expected, got $actual"
  failures=$((failures + 1))
}

expect_stderr() {
  local name=$1 pattern=$2 script=$3 input=$4
  local output
  output=$(printf '%s' "$input" | "$here/$script" 2>&1 >/dev/null)
  [[ "$output" =~ $pattern ]] && return
  echo "FAIL $name: stderr did not match /$pattern/: $output"
  failures=$((failures + 1))
}

claude_edit() { printf '{"tool_name":"Edit","tool_input":{"file_path":"%s"}}' "$1"; }
codex_patch() { printf '{"tool_name":"apply_patch","tool_input":{"command":"*** Begin Patch\\n*** %s File: %s\\n@@\\n+x\\n*** End Patch"}}' "$1" "$2"; }
codex_bash_call() { printf '{"tool_name":"Bash","tool_input":{"command":"%s"},"hook_event_name":"PreToolUse"}' "$1"; }
bash_call() { printf '{"tool_name":"Bash","tool_input":{"command":"%s"}}' "$1"; }

expect_exit "claude: .env edit is blocked" 2 guard-secrets.sh "$(claude_edit /repo/.env)"
expect_exit "claude: .env.local edit is blocked" 2 guard-secrets.sh "$(claude_edit /repo/apps/server/.env.local)"
expect_exit "claude: .env.example edit is allowed" 0 guard-secrets.sh "$(claude_edit /repo/.env.example)"
expect_exit "claude: ordinary file is allowed" 0 guard-secrets.sh "$(claude_edit /repo/apps/web/src/main.tsx)"
expect_exit "codex: .env update is blocked" 2 guard-secrets.sh "$(codex_patch Update .env)"
expect_exit "codex: .env add is blocked" 2 guard-secrets.sh "$(codex_patch Add apps/server/.env.production)"
expect_exit "codex: .env.example update is allowed" 0 guard-secrets.sh "$(codex_patch Update .env.example)"
expect_exit "codex: ordinary patch is allowed" 0 guard-secrets.sh "$(codex_patch Update apps/web/src/main.tsx)"
notebook_edit() { printf '{"tool_name":"NotebookEdit","tool_input":{"notebook_path":"%s"}}' "$1"; }
expect_exit "claude: a notebook edit of .env is blocked" 2 guard-secrets.sh "$(notebook_edit /repo/.env)"
expect_exit "claude: an ordinary notebook edit is allowed" 0 guard-secrets.sh "$(notebook_edit /repo/analysis.ipynb)"
blocked_env_writes=('echo X=1 > .env' 'echo X=1 >> apps/server/.env.local' 'echo X=1 >.env.production' 'printf x | tee .env' 'tee -a apps/web/.env.staging < input' 'cp .env.example .env' 'mv draft .env.test' 'sed -i s/a/b/ .env' 'sed -i.bak s/a/b/ apps/server/.env.local' 'echo X=1 > \".env\"')
for form in "${blocked_env_writes[@]}"; do
  expect_exit "claude: $form is blocked" 2 guard-secrets.sh "$(bash_call "$form")"
  expect_exit "codex: $form is blocked" 2 guard-secrets.sh "$(codex_bash_call "$form")"
done
evasive_env_writes=('printf x > \"$(true ).env\"' 'tee \"apps/api/$(: ).env.local\"' 'cp draft .e*v' 'cp draft apps/api/.e?v' 'echo X=1 > ${HOME}.env' 'echo X=1 > `pwd`/.env' 'install -m 600 draft .env' 'dd if=draft of=.env' 'ln -sf draft .env' 'rsync draft .env' 'perl -pi -e s/a/b/ .env' 'python3 -c \"open('.env', 'w').write('x')\"' 'bash -c \"cp draft .env\"' 'echo X=1 > .*')
for form in "${evasive_env_writes[@]}"; do
  expect_exit "claude: $form is blocked" 2 guard-secrets.sh "$(bash_call "$form")"
  expect_exit "codex: $form is blocked" 2 guard-secrets.sh "$(codex_bash_call "$form")"
done
output_env_writes=('git log --output=.env' 'git diff --output=apps/api/.env.local' 'git show --output .env HEAD' 'git log --out=.env' 'tar xf archive.tar .env' 'tar -xzf archive.tgz -C apps/api .env.local' 'unzip archive.zip .env' 'unzip -o archive.zip -d apps/api .env')
for form in "${output_env_writes[@]}"; do
  expect_exit "claude: $form is blocked" 2 guard-secrets.sh "$(bash_call "$form")"
  expect_exit "codex: $form is blocked" 2 guard-secrets.sh "$(codex_bash_call "$form")"
done
allowed_env_commands=('install -m 600 draft .env.example' 'dd if=draft of=notes.txt' 'ln -sf draft link' 'rsync draft backup' 'perl -pi -e s/a/b/ notes.md')
for form in "${allowed_env_commands[@]}"; do
  expect_exit "claude: $form is allowed" 0 guard-secrets.sh "$(bash_call "$form")"
  expect_exit "codex: $form is allowed" 0 guard-secrets.sh "$(codex_bash_call "$form")"
done
allowed_env_commands=('echo X=1 > .env.example' 'cp .env.example /tmp/copy' 'cat .env.example' 'sed -i s/a/b/ .env.example' 'echo x > notes.txt' 'git commit -m \"document the variable\"' 'echo see .env and .env.local' 'git commit -m \"the .env file holds secrets\"' 'grep -rn .env docs' 'cat .env' 'echo \"the .env file\"' 'git log --grep .env' 'git checkout -b feat/x' 'touch notes.md' 'cp a b')
for form in "${allowed_env_commands[@]}"; do
  expect_exit "claude: $form is allowed" 0 guard-secrets.sh "$(bash_call "$form")"
  expect_exit "codex: $form is allowed" 0 guard-secrets.sh "$(codex_bash_call "$form")"
done
strict_env_writes=('echo \"the .env file holds secrets\" >> PROGRESS.md' "echo 'see .env and .env.local' > notes.md" 'cat > .env <<EOF\nX=1\nEOF' 'echo X=1 &> .env' 'echo X=1 >| .env' 'touch .env' 'touch apps/api/.env.local' 'truncate -s 0 .env' 'curl -o .env https://example.com/x' 'wget -O .env https://example.com/x' 'patch .env change.patch' 'git checkout .env' 'git checkout HEAD -- apps/api/.env.production' 'git restore .env' 'node -e \"require(1)\" .env' 'ruby -e \"x\" .env' 'python3 -c \"x\" .env' 'sed -n \"w .env\" input' 'sed s/a/b/w .env input' 'cp draft \".e\"nv' 'cp draft .e\"n\"v' 'cp draft ${HOME}.env' 'cp draft .e*v' 'cp draft .e?v' 'cp draft .e[n]v' 'cp draft .env*' 'mv draft .env.production' 'sed -i s/a/b/ .env' 'sed -i.bak s/a/b/ .env' 'perl -pi -e s/a/b/ .env' 'install -m 600 draft .env' 'rsync draft .env' 'ln -s draft .env' 'dd if=draft of=.env' 'tee .env' 'tee -a .env.local < x' 'pax -rw draft .env' 'ditto draft .env' 'gtar -xf a.tar -C . .env' 'bsdtar -xf a.tar .env' 'cpio -pdm .env < list')
for form in "${strict_env_writes[@]}"; do
  expect_exit "claude: $form is blocked" 2 guard-secrets.sh "$(bash_call "$form")"
  expect_exit "codex: $form is blocked" 2 guard-secrets.sh "$(codex_bash_call "$form")"
done
settings_file="$here/../../.claude/settings.json"
codex_hooks_file="$here/../../.codex/hooks.json"
expect_jq() {
  local name=$1 file=$2 filter=$3
  [[ "$(jq -r "$filter" "$file")" == true ]] && return
  echo "FAIL $name"
  failures=$((failures + 1))
}
expect_jq "settings: guard-secrets watches MultiEdit and NotebookEdit" "$settings_file" '[.hooks.PreToolUse[] | select(any(.hooks[]; .command | contains("guard-secrets.sh"))) | .matcher] | any(test("MultiEdit") and test("NotebookEdit"))'
expect_jq "settings: guard-secrets watches Bash" "$settings_file" '[.hooks.PreToolUse[] | select(.matcher == "Bash") | .hooks[].command] | any(contains("guard-secrets.sh"))'
expect_jq "codex: guard-secrets watches Bash" "$codex_hooks_file" '[.hooks.PreToolUse[] | select(.matcher == "^Bash$") | .hooks[].command] | any(contains("guard-secrets.sh"))'
for rule in 'Edit(./**/.env)' 'Edit(./**/.env.local)' 'Write(./**/.env)' 'Write(./**/.env.production)' 'Read(./**/.env.*.local)' 'Read(~/.ssh/**)'; do
  expect_jq "settings: deny lists $rule" "$settings_file" ".permissions.deny | index(\"$rule\") != null"
done
expect_exit "empty input is allowed" 0 guard-secrets.sh '{}'

expect_exit "git add -A is blocked" 2 guard-git-add-all.sh "$(bash_call 'git add -A')"
expect_exit "git add . is blocked" 2 guard-git-add-all.sh "$(bash_call 'git add .')"
expect_exit "git add --all is blocked" 2 guard-git-add-all.sh "$(bash_call 'git add --all && git commit')"
expect_exit "the no-verify flag is blocked" 2 guard-git-add-all.sh "$(bash_call 'git commit --no-verify -m x')"
blocked_add_forms=('git add :/' 'git add -- :/' 'git add :(top)' 'git add :(top).' 'git add ./' 'git add -- .' 'git add -f .' 'git add src .' 'git add *' 'git add \".\"' 'git add .;' 'git add . && git status' 'git -C . add .' 'git add -u' 'git add --update' 'git add -Av' 'git add ..')
for form in "${blocked_add_forms[@]}"; do
  expect_exit "claude: $form is blocked" 2 guard-git-add-all.sh "$(bash_call "$form")"
  expect_exit "codex: $form is blocked" 2 guard-git-add-all.sh "$(codex_bash_call "$form")"
done
blocked_commit_forms=('git commit -n -m x' 'git commit -nm x' 'git commit -an -m x' 'git -C . commit -n')
for form in "${blocked_commit_forms[@]}"; do
  expect_exit "claude: $form is blocked" 2 guard-git-add-all.sh "$(bash_call "$form")"
  expect_exit "codex: $form is blocked" 2 guard-git-add-all.sh "$(codex_bash_call "$form")"
done
allowed_forms=('git commit -a -m x' 'git add :/src' 'git add src/a.ts docs/x.md' 'git add .gitignore' 'git add -p src/a.ts' 'git commit -m \"fix: handle . and * and -n in names\"' 'git commit -am x' 'git commit -mn x')
for form in "${allowed_forms[@]}"; do
  expect_exit "claude: $form is allowed" 0 guard-git-add-all.sh "$(bash_call "$form")"
  expect_exit "codex: $form is allowed" 0 guard-git-add-all.sh "$(codex_bash_call "$form")"
done
expect_exit "known limit: a shell expansion that prints a dot is not resolved" 0 guard-git-add-all.sh "$(bash_call 'git add $(echo .)')"
expect_exit "git add by name is allowed" 0 guard-git-add-all.sh "$(bash_call 'git add README.md .agents/hooks')"
expect_exit "git add of a dotfile is allowed" 0 guard-git-add-all.sh "$(bash_call 'git add .gitignore')"

blocked_deploy_forms=('pnpm --filter @zapbip/api exec wrangler deploy --env staging' 'wrangler deploy' 'npx wrangler versions deploy abc' 'pnpm --filter @zapbip/api exec wrangler rollback abc --env staging' 'wrangler d1 migrations apply zapbip-staging --env staging --remote' 'wrangler d1 time-travel restore db --bookmark b --remote' 'wrangler secret put META_APP_SECRET --env staging' 'openssl rand -base64 32 | pnpm --filter @zapbip/api exec wrangler secret put WAKE_SECRET_KEY' 'pnpm deploy:staging' 'pnpm deploy:production --first-deploy' 'pnpm migrate:production' 'cd apps/api && wrangler deploy')
for form in "${blocked_deploy_forms[@]}"; do
  expect_exit "claude: $form is blocked" 2 guard-deploy.sh "$(bash_call "$form")"
  expect_exit "codex: $form is blocked" 2 guard-deploy.sh "$(codex_bash_call "$form")"
done
allowed_deploy_forms=('wrangler deploy --dry-run' 'pnpm --filter @zapbip/api exec wrangler deploy --env staging --dry-run' 'wrangler d1 migrations apply zapbip-staging --env staging --local' 'pnpm migrate:development' 'pnpm smoke:staging' 'pnpm exec vitest run' 'git commit -F message.txt')
for form in "${allowed_deploy_forms[@]}"; do
  expect_exit "claude: $form is allowed" 0 guard-deploy.sh "$(bash_call "$form")"
  expect_exit "codex: $form is allowed" 0 guard-deploy.sh "$(codex_bash_call "$form")"
done
evasive_deploy_forms=('wrangler d1 time-travel restore zapbip --timestamp 2026-11-01' 'wrangler d1 delete zapbip' 'wrangler r2 bucket delete zapbip-media' 'wrangler r2 object put zapbip-media/key --file x' 'wrangler triggers deploy' 'pnpm run deploy:production' 'pnpm run migrate:production' "sh -c 'wrangler deploy'" 'bash -c \"wrangler secret put X\"' './node_modules/.bin/wrangler deploy' '/usr/local/bin/wrangler rollback abc')
for form in "${evasive_deploy_forms[@]}"; do
  expect_exit "claude: $form is blocked" 2 guard-deploy.sh "$(bash_call "$form")"
  expect_exit "codex: $form is blocked" 2 guard-deploy.sh "$(codex_bash_call "$form")"
done
allowed_local_forms=('wrangler dev' 'wrangler d1 migrations apply zapbip --local')
for form in "${allowed_local_forms[@]}"; do
  expect_exit "claude: $form is allowed" 0 guard-deploy.sh "$(bash_call "$form")"
  expect_exit "codex: $form is allowed" 0 guard-deploy.sh "$(codex_bash_call "$form")"
done
bypass_deploy_forms=('wrangler \"deploy\"' '(wrangler deploy)' 'wrangler --env production deploy' '\\wrangler deploy' '$(echo wrangler) deploy' '`echo wrangler` deploy' 'w=wrangler; $w deploy' 'bash -lc \"wrangler deploy\"' 'bash -xc \"wrangler deploy\"' 'sh -c \"wrangler secret put X\"' 'eval wrangler deploy' 'echo deploy | xargs wrangler' 'echo wrangler deploy | bash' 'bash <<< \"wrangler deploy\"' 'wrangler deploy # --dry-run' 'wrangler${IFS}deploy' 'wrangler kv key put k v --remote' 'wrangler pages deploy dist' 'npm run deploy:production' 'pnpm run-script deploy:production' 'pnpm -w deploy:production' 'pnpm --silent deploy:production' 'pnpm --filter @zapbip/api run deploy:staging' 'yarn migrate:production' 'pnpm secrets:sync' 'node --env-file=.env --import tsx apps/api/scripts/deploy.ts --environment production' 'tsx apps/api/scripts/smoke.ts --environment staging' 'node node_modules/wrangler/bin/wrangler.js deploy' 'python3 -c \"import os; os.system(\u0027wrangler deploy\u0027)\"' 'wr\"ang\"ler deploy' 'wrangler secret list --env staging' 'wrangler r2 bucket list' 'wrangler d1 list' 'wrangler d1 execute zapbip --command x --remote' 'wrangler dev --remote' 'wrangler d1 execute zapbip --local --remote' 'wrangler deploy --dry-run=false' 'wrangler deploy --dry-run false' 'wrangler deploy --dry-run true' 'wrangler deploy --dry-run --no-dry-run' 'wrangler deploy --dryRun=false' 'wrangler deploy --dry-run --dry-run' 'wrangler deploy --dry-run --DRY-RUN=false' 'wrangler deploy --dryrun' 'wrangler deploy --dry-run --env production --dry-run false' 'wrangler deploy --no-dryRun --dry-run' 'wrangler dev -r' 'wrangler dev -Er' 'wrangler dev -rE' 'wrangler dev --remote=true' 'wrangler d1 execute zapbip --local --command x -r')
for form in "${bypass_deploy_forms[@]}"; do
  expect_exit "claude: $form is blocked" 2 guard-deploy.sh "$(bash_call "$form")"
  expect_exit "codex: $form is blocked" 2 guard-deploy.sh "$(codex_bash_call "$form")"
done
strict_blocked_deploy_forms=('git commit -F - <<@Q@EOF@Q@\nwrangler deploy\nEOF' 'cat <<@Q@EOF@Q@ | sh\nwrangler deploy\nEOF' 'sh <<@Q@EOF@Q@\nwrangler deploy\nEOF' 'bash <<EOF\nwrangler deploy\nEOF' 'git commit -m \"$(cat <<@Q@EOF@Q@\nfeat: wrangler deploy docs\nEOF\n)\"' 'echo wrangler deploy | sh' 'printf \"wrangler deploy\" | bash' 'echo wrangler deploy' 'rg wrangler; wrangler deploy' 'git grep wrangler' 'git grep wrangler | sh' 'git commit -m \"document wrangler deploy\"' 'git commit -m wrangler && wrangler deploy' 'echo \"hello\" ; wrangler deploy' 'echo @Q@wrangler dev@Q@ ; wrangler deploy' 'grep \"x y\" f; wrangler deploy' 'bash <(echo wrangler deploy)' 'source <(echo wrangler deploy)' '. <(echo wrangler deploy)' 'echo wrangler deploy | /bin/sh' 'echo wrangler deploy | env sh' 'echo wrangler deploy | env bash -s' 'echo wrangler deploy | python3 -c \"import os,sys; os.system(sys.stdin.read())\"' 'wrangler dev | sh' 'WRANGLER deploy' 'Wrangler deploy' 'npx WRANGLER deploy' 'node_modules/.bin/wrangler dev' 'wrangler login' 'wrangler logout' 'wrangler dev; wrangler deploy' 'wrangler dev && wrangler deploy' 'wrangler dev || wrangler deploy' 'wrangler types & wrangler deploy' 'wrangler dev > out.txt' 'wrangler dev < in.txt' 'wrangler dev $(wrangler deploy)' 'wrangler dev `wrangler deploy`' 'wrangler dev\nwrangler deploy' 'wrangler dev \\\nx' 'wrangler dev # note' 'wrangler dev $HOME' 'wrangler dev {a,b}' 'wrangler dev (x)' 'wrangler whoami; wrangler deploy' 'pnpm exec wrangler dev | tee log' 'wrangler deploy --dry-run; wrangler deploy' 'wrangler deploy --dry-run # x' 'wrangler deploy --dry-run --dry-run=false' 'wrangler dev --rem\"ote\"' 'rg --pre wrangler pattern docs' 'rg --pre=wrangler pattern docs' 'rg --pre-glob wrangler pattern docs' 'rg -O wrangler docs' 'rg --open-files-in-pager=sh wrangler docs' 'rg -x wrangler docs' 'rg --exec wrangler docs' 'rg -nO wrangler docs' 'rg --hostname-bin=wrangler wrangler docs' 'grep -x wrangler docs' 'git grep -O wrangler' 'git grep -O sh wrangler' 'git restore --staged --worktree apps/api/wrangler.jsonc' 'git restore apps/api/wrangler.jsonc' 'git add apps/api/wrangler.jsonc; rm x' 'cat apps/api/wrangler.jsonc | sh' 'cat $(wrangler deploy)' 'head -1 apps/api/wrangler.jsonc > out' 'sed -n \"1w out-wrangler\" apps/api/wrangler.jsonc' 'sed -n e wrangler' 'sed -i s/a/b/ apps/api/wrangler.jsonc' 'vitest run wrangler; wrangler deploy' 'pnpm test wrangler && wrangler deploy' 'pnpm exec vitest wrangler' 'pnpm test wrangler `wrangler deploy`' 'git commit -F message.txt; wrangler deploy' 'git commit -F message.txt && wrangler deploy' 'git commit -F wrangler-message.txt | sh' 'git commit -m wrangler' 'git log --grep wrangler | sh' 'git log $(wrangler deploy)' 'git log; wrangler deploy' 'git log --output=wrangler.txt' 'git diff --output wrangler.txt' 'git show --output=apps/api/wrangler.jsonc HEAD''pnpm deploy:staging; echo done' 'echo $(pnpm secrets:sync)')
for form in "${strict_blocked_deploy_forms[@]}"; do
  command_text=${form//@Q@/\'}
  expect_exit "claude: $form is blocked" 2 guard-deploy.sh "$(bash_call "$command_text")"
  expect_exit "codex: $form is blocked" 2 guard-deploy.sh "$(codex_bash_call "$command_text")"
done
allowlisted_deploy_forms=('wrangler dev --env development' 'wrangler deploy --dry-run --env production' 'wrangler deploy --env staging --dry-run --outdir dist' 'wrangler d1 migrations apply zapbip-development --env development --local' 'wrangler d1 execute zapbip --local --command x' 'wrangler types' 'pnpm --filter @zapbip/api exec wrangler types' 'wrangler --version' 'wrangler whoami' 'pnpm exec wrangler dev' 'npx wrangler dev' 'npx wrangler types' 'pnpm --filter @zapbip/api exec wrangler dev --env development' 'pnpm --filter @zapbip/api exec wrangler deploy --dry-run --env production' 'npx wrangler d1 execute zapbip --local --file schema.sql' 'pnpm exec wrangler d1 migrations apply zapbip --local' 'pnpm exec wrangler whoami' 'pnpm --filter @zapbip/api exec wrangler --version' 'wrangler d1 execute zapbip --local --command \"select 1\"' 'git add apps/api/wrangler.jsonc' 'git diff apps/api/wrangler.jsonc' 'git show HEAD:apps/api/wrangler.jsonc' 'git status apps/api/wrangler.jsonc' 'git restore --staged apps/api/wrangler.jsonc' 'cat apps/api/wrangler.jsonc' 'head -20 apps/api/wrangler.jsonc' 'tail -5 apps/api/wrangler.jsonc' 'wc -l apps/api/wrangler.jsonc' 'sed -n 1,20p apps/api/wrangler.jsonc' 'sed -n \"1,20p\" apps/api/wrangler.jsonc' 'grep -n wrangler docs/runbooks/deploy.md' 'rg -n wrangler docs' 'rg -n \"wrangler deploy\" docs' 'vitest run apps/api/test/wrangler-config.test.ts' 'pnpm exec vitest run apps/api/test/wrangler-config.test.ts' 'pnpm --filter @zapbip/api exec vitest run wrangler-config' 'npx vitest run wrangler' 'pnpm test wrangler-config' 'pnpm --filter @zapbip/api test wrangler-config' 'git commit -F message.txt' 'git commit -a -F /tmp/wrangler-message.txt' 'git log' 'git log --oneline -5' 'git log --grep wrangler --oneline' 'cd /work/deploy-readiness && pnpm exec vitest run' 'pnpm run deploy-docs' 'git commit -m \"$(cat <<\u0027EOF\u0027\nfeat: document the runbook\nEOF\n)\"')
for form in "${allowlisted_deploy_forms[@]}"; do
  expect_exit "claude: $form is allowed" 0 guard-deploy.sh "$(bash_call "$form")"
  expect_exit "codex: $form is allowed" 0 guard-deploy.sh "$(codex_bash_call "$form")"
done
expect_stderr "deploy guard: the message names the owner and the dry run" 'owner.*dry-run' guard-deploy.sh "$(bash_call 'wrangler deploy')"
expect_stderr "deploy guard: the message points a commit message to a file" 'git commit -F' guard-deploy.sh "$(bash_call 'git commit -m wrangler')"
log_in_with "$macos_wrangler_config"
logged_in_blocked_forms=('wrangler dev' 'wrangler deploy --dry-run' 'wrangler types' 'wrangler d1 migrations apply zapbip --local' 'wrangler d1 execute zapbip --local --command x' 'pnpm exec wrangler dev' 'npx wrangler types' 'pnpm --filter @zapbip/api exec wrangler deploy --dry-run' 'wrangler login' 'wrangler deploy' 'pnpm deploy:staging')
for form in "${logged_in_blocked_forms[@]}"; do
  expect_exit "claude: $form is blocked while wrangler is logged in" 2 guard-deploy.sh "$(bash_call "$form")"
  expect_exit "codex: $form is blocked while wrangler is logged in" 2 guard-deploy.sh "$(codex_bash_call "$form")"
done
logged_in_allowed_forms=('wrangler whoami' 'wrangler --version' 'wrangler logout' 'pnpm exec wrangler whoami' 'npx wrangler logout' 'pnpm --filter @zapbip/api exec wrangler logout' 'git commit -F message.txt' 'pnpm exec vitest run' 'cat apps/api/wrangler.jsonc' 'git add apps/api/wrangler.jsonc')
for form in "${logged_in_allowed_forms[@]}"; do
  expect_exit "claude: $form is allowed while wrangler is logged in" 0 guard-deploy.sh "$(bash_call "$form")"
  expect_exit "codex: $form is allowed while wrangler is logged in" 0 guard-deploy.sh "$(codex_bash_call "$form")"
done
expect_stderr "deploy guard: the logged-in block names wrangler logout" 'wrangler logout' guard-deploy.sh "$(bash_call 'wrangler dev')"
log_out
expect_exit "deploy guard: no login allows the allowlist" 0 guard-deploy.sh "$(bash_call 'wrangler dev')"
expect_exit "deploy guard: no login still blocks logout" 2 guard-deploy.sh "$(bash_call 'wrangler logout')"
log_in_with "$xdg_wrangler_config"
expect_exit "deploy guard: an XDG config blocks wrangler dev" 2 guard-deploy.sh "$(bash_call 'wrangler dev')"
log_out
log_in_with "$legacy_wrangler_config"
expect_exit "deploy guard: a legacy config blocks wrangler dev" 2 guard-deploy.sh "$(bash_call 'wrangler dev')"
expect_exit "deploy guard: a legacy config allows whoami" 0 guard-deploy.sh "$(bash_call 'wrangler whoami')"
log_out
log_in_with "$HOME/Library/Preferences/.wrangler/config/work.toml"
expect_exit "deploy guard: a wrangler profile blocks wrangler dev" 2 guard-deploy.sh "$(bash_call 'wrangler dev')"
log_out
log_in_with "$XDG_CONFIG_HOME/.wrangler/config/default.enc"
expect_exit "deploy guard: a keyring store blocks wrangler dev" 2 guard-deploy.sh "$(bash_call 'wrangler dev')"
log_out
log_in_with "$HOME/.wrangler/config/default.enc"
expect_exit "deploy guard: a legacy keyring store blocks wrangler dev" 2 guard-deploy.sh "$(bash_call 'wrangler dev')"
log_out
printf 'CLOUDFLARE_API_TOKEN=x\n' > "$api_environment_file"
expect_exit "deploy guard: a token in the api environment file blocks wrangler dev" 2 guard-deploy.sh "$(bash_call 'wrangler dev')"
log_out
printf 'OTHER=1\nCLOUDFLARE_API_KEY=x\n' > "$api_environment_file.local"
expect_exit "deploy guard: a key in the api local environment file blocks wrangler dev" 2 guard-deploy.sh "$(bash_call 'wrangler dev')"
log_out
printf 'CLOUDFLARE_API_TOKEN=\n' > "$api_environment_file.example"
printf 'OTHER=1\n' > "$api_environment_file"
expect_exit "deploy guard: the example file and unrelated variables allow wrangler dev" 0 guard-deploy.sh "$(bash_call 'wrangler dev')"
log_out
export CLOUDFLARE_API_TOKEN=scoped-token
expect_exit "deploy guard: an exported API token blocks wrangler dev" 2 guard-deploy.sh "$(bash_call 'wrangler dev')"
expect_exit "deploy guard: an exported API token allows logout" 0 guard-deploy.sh "$(bash_call 'wrangler logout')"
log_out
export CLOUDFLARE_API_KEY=global-key
expect_exit "deploy guard: an exported API key blocks wrangler dev" 2 guard-deploy.sh "$(bash_call 'wrangler dev')"
log_out
export CLOUDFLARE_API_TOKEN=
expect_exit "deploy guard: an empty API token is no login" 0 guard-deploy.sh "$(bash_call 'wrangler dev')"
log_out
expect_jq "settings: guard-deploy watches Bash" "$settings_file" '[.hooks.PreToolUse[] | select(.matcher == "Bash") | .hooks[].command] | any(contains("guard-deploy.sh"))'
expect_jq "codex: guard-deploy watches Bash" "$codex_hooks_file" '[.hooks.PreToolUse[] | select(.matcher == "^Bash$") | .hooks[].command] | any(contains("guard-deploy.sh"))'

expect_exit "verify records: a command naming .git/verify is blocked" 2 guard-verify-records.sh "$(bash_call 'echo x > .git/verify/abc')"
expect_exit "verify records: rm of .git/verify is blocked" 2 guard-verify-records.sh "$(bash_call 'rm -rf .git/verify')"
expect_exit "verify records: cp into .git/verify is blocked" 2 guard-verify-records.sh "$(bash_call 'cp a .git/verify/b')"
expect_exit "verify records: ls of .git/verify is allowed" 0 guard-verify-records.sh "$(bash_call 'ls .git/verify')"
expect_exit "verify records: cat of a record is allowed" 0 guard-verify-records.sh "$(bash_call 'cat .git/verify/x')"
expect_exit "verify records: a search for git-common-dir is allowed" 0 guard-verify-records.sh "$(bash_call 'rg -n git-common-dir scripts/verify.sh')"
expect_exit "verify records: git-common-dir beside pnpm verify is allowed" 0 guard-verify-records.sh "$(bash_call 'git rev-parse --git-common-dir && pnpm verify --plan')"
expect_exit "verify records: a commit message naming .git/verify is allowed" 0 guard-verify-records.sh "$(bash_call 'git commit -m \"mentions .git/verify\"')"
expect_exit "verify records: a relative Codex patch under .git/verify is blocked" 2 guard-verify-records.sh "$(codex_patch Add .git/verify/abc)"
expect_exit "verify records: an edit through dot-dot segments is blocked" 2 guard-verify-records.sh "$(claude_edit /repo/.git/worktrees/x/../../verify/abc)"
expect_exit "verify records: a Claude edit under .git/verify is blocked" 2 guard-verify-records.sh "$(claude_edit /repo/.git/verify/abc)"
expect_exit "verify records: a Codex patch under .git/verify is blocked" 2 guard-verify-records.sh "$(codex_patch Add /repo/.git/verify/abc)"
expect_exit "verify records: pnpm verify --plan is allowed" 0 guard-verify-records.sh "$(bash_call 'pnpm verify --plan')"
expect_exit "verify records: an ordinary edit is allowed" 0 guard-verify-records.sh "$(claude_edit /repo/scripts/verify.sh)"
expect_stderr "verify records: the block names the script" "records of green commits are written only by scripts/verify.sh" guard-verify-records.sh "$(bash_call 'rm -rf .git/verify')"

scratch=$(mktemp -d)
printf 'const value = input ?? "fallback";\nif (a) {\n  b();\n} else {\n  c();\n}\n' > "$scratch/else.ts"
printf 'export function clean(): number {\n  return 1;\n}\n' > "$scratch/clean.ts"
printf 'const value = input ?? "fallback";\n' > "$scratch/notes.md"
printf '// NB ADR 0015: the rule in one sentence.\nexport const LIMIT = 5;\n' > "$scratch/pointer.ts"
printf '// NB ADR 0015: the rule in one sentence.\n// plain comment\nexport const LIMIT = 5;\n' > "$scratch/comment.ts"
expect_stderr "claude: else and ?? default are warned" "else.*return early|masks a missing value" warn-conventions.sh "$(claude_edit "$scratch/else.ts")"
expect_stderr "codex: patch headers reach the same warnings" "masks a missing value" warn-conventions.sh "$(codex_patch Update "$scratch/else.ts")"
expect_exit "clean file passes silently" 0 warn-conventions.sh "$(claude_edit "$scratch/clean.ts")"
[[ -z "$(printf '%s' "$(claude_edit "$scratch/clean.ts")" | "$here/warn-conventions.sh" 2>&1)" ]] || { echo "FAIL clean file produced a warning"; failures=$((failures + 1)); }
[[ -z "$(printf '%s' "$(claude_edit "$scratch/notes.md")" | "$here/warn-conventions.sh" 2>&1)" ]] || { echo "FAIL markdown file produced a warning"; failures=$((failures + 1)); }
expect_stderr "a plain comment next to an NB pointer is warned" "only '// NB ADR NNNN:' pointers are allowed" warn-conventions.sh "$(claude_edit "$scratch/comment.ts")"
[[ -z "$(printf '%s' "$(claude_edit "$scratch/pointer.ts")" | "$here/warn-conventions.sh" 2>&1)" ]] || { echo "FAIL an NB ADR pointer produced a warning"; failures=$((failures + 1)); }
rm -rf "$scratch"

repository=$(mktemp -d)
codex_stop() { printf '{"session_id":"s","turn_id":"t","transcript_path":null,"cwd":"%s","hook_event_name":"Stop","model":"m","permission_mode":"default","stop_hook_active":%s,"last_assistant_message":null}' "$repository" "$1"; }
remind() { (cd "$repository" && printf '%s' "$(codex_stop "$1")" | "$here/remind-docs.sh" 2>&1); }
in_repository() { git -C "$repository" -c user.name=hooks -c user.email=hooks@example.com "$@"; }
expect_match() {
  local name=$1 output=$2 pattern=$3
  [[ "$output" =~ $pattern ]] && return
  echo "FAIL $name: output did not match /$pattern/: $output"
  failures=$((failures + 1))
}
expect_no_match() {
  local name=$1 output=$2 pattern=$3
  [[ "$output" =~ $pattern ]] || return
  echo "FAIL $name: output matched /$pattern/: $output"
  failures=$((failures + 1))
}
expect_silence() {
  local name=$1 output=$2
  [[ -z "$output" ]] && return
  echo "FAIL $name: expected no output, got: $output"
  failures=$((failures + 1))
}
expect_silence "outside a git repository the docs reminder stays silent" "$(remind false)"
in_repository init -q
mkdir -p "$repository/apps/web/src" "$repository/libs/plain" "$repository/.claude/rules"
printf '# Root\n' > "$repository/README.md"
printf '# Web\n' > "$repository/apps/web/README.md"
printf -- '---\npaths:\n  - "apps/web/**"\n---\n\n# Web facts\n' > "$repository/.claude/rules/web.md"
printf 'one\n' > "$repository/apps/web/src/main.tsx"
in_repository add README.md apps .claude
in_repository commit -q -m initial
expect_silence "a clean tree raises no docs reminder" "$(remind false)"
printf 'two\n' > "$repository/apps/web/src/main.tsx"
expect_match "a code change names the nearest README and the rule whose globs match it" "$(remind false)" '"decision": "block".*`\.claude/rules/web\.md` `apps/web/README\.md`'
expect_silence "the same documents are reminded once" "$(remind false)"
printf '{}\n' > "$repository/package.json"
expect_silence "a stop that is already continuing is never blocked" "$(remind true)"
printf '# Web, updated\n' > "$repository/apps/web/README.md"
reminder=$(remind false)
expect_match "a file outside every documented folder names the root README" "$reminder" '`README\.md`'
expect_no_match "a document already reminded since the last commit is not reminded again" "$reminder" 'rules/web'
in_repository add package.json
in_repository commit -qam second
printf 'three\n' > "$repository/apps/web/src/main.tsx"
expect_match "a commit starts the reminders over" "$(remind false)" 'apps/web/README\.md'
in_repository commit -qam third
mkdir -p "$repository/apps/web/src/my dir"
printf 'x\n' > "$repository/apps/web/src/my dir/b c.ts"
expect_match "a path with spaces names its folder's README" "$(remind false)" 'apps/web/README\.md'
in_repository add apps
in_repository commit -qm fourth
in_repository mv apps/web/src/main.tsx libs/plain/main.tsx
expect_match "a rename names the README of the folder the file left" "$(remind false)" 'apps/web/README\.md'
rm -rf "$repository"

doctor_bin=$(mktemp -d)
doctor_home=$(mktemp -d)
stub() { printf '#!/bin/bash\n%s\n' "$2" > "$doctor_bin/$1"; chmod +x "$doctor_bin/$1"; }
stub_all() {
  rm -f "$doctor_bin"/*
  stub node 'echo v24.7.0'
  stub pnpm 'echo 8.15.9'
  stub jq 'exit 0'
  stub gh 'exit 0'
  stub gitleaks 'exit 0'
  stub ffmpeg 'exit 0'
  stub brew 'exit 0'
  stub python3 'exit 0'
  rm -rf "$doctor_home/Library" "$doctor_home/.cache"
  mkdir -p "$doctor_home/Library/Caches/ms-playwright/chromium-1247" "$doctor_home/.cache/ms-playwright/chromium-1247"
}
doctor() { PLAYWRIGHT_BROWSERS_PATH= DOCTOR_UNAME="$1" DOCTOR_PATH="$doctor_bin" DOCTOR_HOME="$doctor_home" DOCTOR_SKIP="${2:-}" "$here/doctor.sh" 2>&1; }
doctor_line() { doctor "$1" "${3:-}" | grep "^$2 "; }
doctor_exit() { local name=$1 expected=$2 platform=$3; doctor "$platform" >/dev/null; local actual=$?; [[ "$actual" == "$expected" ]] && return; echo "FAIL $name: expected exit $expected, got $actual"; failures=$((failures + 1)); }

stub_all
report=$(doctor Darwin)
expect_match "doctor: every tool present reports ok" "$report" 'doctor: 0 missing required, 0 missing optional'
expect_no_match "doctor: every tool present has no missing line" "$report" '\| missing \|'
expect_match "doctor: a line carries the full shape" "$(doctor_line Darwin jq)" '^jq \| ok \| required \| lost: [^|]+ \| fix: brew install jq$'
doctor_exit "doctor: every tool present exits 0" 0 Darwin

rm "$doctor_bin/jq"
report=$(doctor Darwin)
expect_match "doctor: missing jq on macOS names brew" "$(doctor_line Darwin jq)" '^jq \| missing \| required \| lost: the four hooks; the two guards block \| fix: brew install jq$'
expect_match "doctor: one missing required is counted" "$report" 'doctor: 1 missing required, 0 missing optional'
doctor_exit "doctor: a missing required tool exits 1" 1 Darwin

stub_all; rm "$doctor_bin/jq" "$doctor_bin/brew"; stub apt-get 'exit 0'
report=$(doctor Linux)
expect_match "doctor: missing jq on Linux names apt-get" "$report" 'fix: sudo apt-get install -y jq'
expect_match "doctor: chromium on Linux installs with deps" "$(doctor_line Linux chromium)" '^chromium \| ok \| required \| lost: [^|]+ \| fix: npx -y playwright install --with-deps chromium$'

stub_all; rm "$doctor_bin/jq" "$doctor_bin/brew"
report=$(doctor Linux)
expect_match "doctor: no package manager falls back to the URL" "$report" 'fix: https://jqlang.github.io/jq/download/'
doctor_exit "doctor: the fallback keeps the exit code" 1 Linux

stub_all; rm "$doctor_bin/gh" "$doctor_bin/brew"; stub apk 'exit 0'
expect_match "doctor: gh on Alpine is github-cli" "$(doctor_line Linux gh)" 'fix: sudo apk add github-cli$'

stub_all; rm "$doctor_bin/ffmpeg" "$doctor_bin/gitleaks"
report=$(doctor Darwin)
expect_match "doctor: optional tools are counted apart" "$report" 'doctor: 0 missing required, 2 missing optional'
expect_match "doctor: ffmpeg says what is lost" "$(doctor_line Darwin ffmpeg)" '^ffmpeg \| missing \| optional \| lost: the recorder.s mp4 and gif; a PR that touches UI cannot ship \| fix: brew install ffmpeg$'
doctor_exit "doctor: missing optional tools exit 0" 0 Darwin

stub_all; stub gh 'exit 1'
report=$(doctor Darwin)
expect_match "doctor: gh without auth is missing with the human step" "$(doctor_line Darwin gh)" '^gh \| missing \| required \| lost: [^|]+ \| fix: gh auth login \(run it yourself; the agent cannot\)$'

stub_all; stub node 'echo v22.11.0'
expect_match "doctor: node below .nvmrc is missing" "$(doctor_line Darwin node)" '^node \| missing \| required \| lost: everything \| fix: nvm install \(reads \.nvmrc\), or https://nodejs\.org/en/download$'

stub_all; stub python3 'exit 1'
expect_match "doctor: python outside 3.11 to 3.13 is missing" "$(doctor_line Darwin python)" '^python \| missing \| required \| lost: the Hermes plugin.s typecheck and tests; pnpm verify fails in apps/hermes-plugin \| fix: brew install python@3\.13 && python3 -m pip install --require-hashes -r apps/hermes-plugin/requirements-dev\.txt$'

stub_all; stub python3 '[[ "$2" == *"<= (3, 14)"* ]]'
expect_match "doctor: python 3.14 is accepted" "$(doctor_line Darwin python)" '^python \| ok \|'

stub_all; stub pnpm 'echo 9.0.0'
expect_match "doctor: pnpm at another version is missing" "$(doctor_line Darwin pnpm)" '^pnpm \| missing \| required \| lost: everything \| fix: corepack enable && corepack prepare pnpm@8\.15\.9 --activate$'

stub_all; rm -rf "$doctor_home/Library/Caches/ms-playwright"
expect_match "doctor: no chromium in the cache is missing" "$(doctor_line Darwin chromium)" '^chromium \| missing \| required \| lost: every Playwright MCP server, /check-ui, /scenario, the tester \| fix: npx -y playwright install chromium$'

stub_all; rm -rf "$doctor_home/Library/Caches/ms-playwright"
report=$(doctor Darwin chromium)
expect_match "doctor: a skipped tool is printed as skipped" "$(doctor_line Darwin chromium chromium)" '^chromium \| skipped \| required \|'
expect_match "doctor: a skipped tool is not counted" "$report" 'doctor: 0 missing required, 0 missing optional'

stub_all; rm "$doctor_bin/jq"
fix_line=$(DOCTOR_PATH="$doctor_bin" "$here/doctor.sh" --fix jq)
[[ "$fix_line" == "brew install jq" ]] || { echo "FAIL doctor --fix prints the fix alone: $fix_line"; failures=$((failures + 1)); }

wrangler_fix='wrangler is logged in for this OS user; run `wrangler logout` and deploy with a scoped CLOUDFLARE_API_TOKEN exported only in your own shell'
wrangler_warning_line='^wrangler \| warning \| warning \| lost: [^|]+ \| fix: wrangler is logged in for this OS user; run `wrangler logout` and deploy with a scoped CLOUDFLARE_API_TOKEN exported only in your own shell$'

stub_all; log_out
expect_match "doctor: no login is ok" "$(doctor_line Darwin wrangler)" '^wrangler \| ok \| warning \|'

log_in_with "$doctor_home/Library/Preferences/.wrangler/config/default.toml"
report=$(doctor Darwin)
expect_match "doctor: a macOS config is a warning line" "$(doctor_line Darwin wrangler)" "$wrangler_warning_line"
expect_match "doctor: a login is not counted as missing" "$report" 'doctor: 0 missing required, 0 missing optional'
expect_match "doctor: a login prints the warning sentence" "$report" 'doctor: warning: wrangler is logged in for this OS user; run `wrangler logout`'
doctor_exit "doctor: a login exits 0" 0 Darwin
stub_all

log_in_with "$doctor_home/.wrangler/config/default.toml"
expect_match "doctor: a legacy config is a warning" "$(doctor_line Darwin wrangler)" "$wrangler_warning_line"
rm -rf "$doctor_home/.wrangler"

log_in_with "$xdg_wrangler_config"
expect_match "doctor: an XDG config is a warning" "$(doctor_line Darwin wrangler)" "$wrangler_warning_line"
log_out

log_in_with "$doctor_home/.wrangler/config/work.toml"
expect_match "doctor: a wrangler profile is a warning" "$(doctor_line Darwin wrangler)" "$wrangler_warning_line"
rm -rf "$doctor_home/.wrangler"

printf 'CLOUDFLARE_API_TOKEN=x\n' > "$api_environment_file"
expect_match "doctor: a token in the api environment file is a warning" "$(doctor_line Darwin wrangler)" "$wrangler_warning_line"
log_out

expect_match "doctor: an exported API token is a warning" "$(CLOUDFLARE_API_TOKEN=scoped-token doctor_line Darwin wrangler)" "$wrangler_warning_line"
expect_match "doctor: an exported API key is a warning" "$(CLOUDFLARE_API_KEY=global-key doctor_line Darwin wrangler)" "$wrangler_warning_line"
expect_match "doctor: a skipped wrangler is printed as skipped" "$(CLOUDFLARE_API_TOKEN=scoped-token doctor_line Darwin wrangler wrangler)" '^wrangler \| skipped \| warning \|'

fix_line=$(DOCTOR_PATH="$doctor_bin" "$here/doctor.sh" --fix wrangler)
[[ "$fix_line" == "$wrangler_fix" ]] || { echo "FAIL doctor --fix wrangler: $fix_line"; failures=$((failures + 1)); }

nvmrc_file=$(mktemp)
doctor_nvmrc() { DOCTOR_NVMRC="$nvmrc_file" DOCTOR_PATH="$doctor_bin" DOCTOR_HOME="$doctor_home" "$here/doctor.sh" 2>&1; }
stub_all
printf '24.7.0\n' > "$nvmrc_file"
expect_match "doctor: a full version in .nvmrc is read as its major" "$(doctor_nvmrc | grep '^node ')" '^node \| ok \|'
pwned_dir=$(mktemp -d)
printf 'root[$(touch${IFS}'"$pwned_dir"'/marker)]\n' > "$nvmrc_file"
output=$(doctor_nvmrc); status=$?
[[ "$status" == 1 ]] || { echo "FAIL doctor with a hostile .nvmrc: expected exit 1, got $status"; failures=$((failures + 1)); }
expect_match "doctor: a hostile .nvmrc is refused" "$output" '^doctor: \.nvmrc is not a version$'
[[ ! -e "$pwned_dir/marker" ]] || { echo "FAIL doctor evaluated the .nvmrc"; failures=$((failures + 1)); }
rm -rf "$pwned_dir"
rm -f "$nvmrc_file"

guard_path=$(mktemp -d)
for tool in bash env cat dirname sed tr uname ls grep; do ln -s "$(command -v $tool)" "$guard_path/$tool"; done
guard_without_jq() { PATH="$guard_path" "$here/$1" 2>&1 >/dev/null; }
output=$(printf '%s' "$(claude_edit /repo/apps/web/src/main.tsx)" | guard_without_jq guard-secrets.sh); status=$?
[[ "$status" == 2 ]] || { echo "FAIL guard-secrets without jq: expected exit 2, got $status"; failures=$((failures + 1)); }
expect_match "guard-secrets without jq names the fix" "$output" '^Blocked: the hooks need jq\. fix: https://jqlang\.github\.io/jq/download/$'
output=$(printf '%s' "$(bash_call 'git add README.md')" | guard_without_jq guard-git-add-all.sh); status=$?
[[ "$status" == 2 ]] || { echo "FAIL guard-git-add-all without jq: expected exit 2, got $status"; failures=$((failures + 1)); }
expect_match "guard-git-add-all without jq names the fix" "$output" '^Blocked: the hooks need jq\. fix: '
rm -rf "$doctor_bin" "$doctor_home" "$guard_path"

[[ "$failures" == 0 ]] && echo "hooks: all checks passed" && exit 0
echo "hooks: $failures check(s) failed"
exit 1
