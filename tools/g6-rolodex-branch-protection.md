# G6 — Lock `MC-Training-Rolodex` `main` to the deploy bot only

Status: **RUNBOOK — one-time repo setting, applied by a human (not the CI/assistant)**
Roadmap ref: `pm-improvement-roadmap.md` → G6 (the real guardrail gap).

## Why this exists

The market pipeline is already sound and **verified**:

- `market-check.yml` runs `build-market.py --check` on every PR.
- `market-deploy.yml` hard-gates on JS syntax → leak check → resolver tests
  before it extracts and force-pushes the clean build to Rolodex
  (run `27466636487` proved the gate skips Extract/Push on a leak).

The licensed-content leak earlier this cycle reached the public repo for one
reason only: a human **force-pushed directly to `MC-Training-Rolodex` `main`,
bypassing CI**. Nothing currently prevents that. G6 closes it: make the deploy
identity the *only* writer to Rolodex `main`.

## The constraint

`market-deploy.yml` deploys by doing `git init` + commit + **`git push --force`**
to `main` using `ROLODEX_DEPLOY_TOKEN`. Any protection must therefore:

1. **Allow** the deploy identity to force-push a fresh commit, and
2. **Block** every other actor (including the owner's normal account) from
   pushing or force-pushing to `main`.

Note: `MC-Training-Rolodex` is owned by a **personal account**, not an org.
The classic "Restrict who can push to matching branches" branch-protection
control is an org-only feature, so use **repository rulesets** (available on
personal repos, support per-actor bypass) — not classic branch protection.

## Recommended: dedicated deploy identity + ruleset (Option A)

A personal PAT can't distinguish "bot push" from "owner push" — same account.
So give the deploy its own identity and bypass only that.

1. **Create a GitHub App** (or a machine user) to own the deploy:
   - GitHub App: minimal, installed on `MC-Training-Rolodex` with
     **Contents: Read & write**. Note its **App ID** and generate a private key.
   - (Alternative: a machine user added as a collaborator with write + its own
     fine-grained PAT scoped to Contents: RW on the repo.)

2. **Switch the deploy to that identity.** With a GitHub App, mint a token in
   the workflow instead of using a personal PAT:

   ```yaml
   # in .github/workflows/market-deploy.yml, before the push step
   - name: Mint deploy token
     id: app-token
     uses: actions/create-github-app-token@v1
     with:
       app-id: ${{ secrets.ROLODEX_DEPLOY_APP_ID }}
       private-key: ${{ secrets.ROLODEX_DEPLOY_APP_KEY }}
       repositories: MC-Training-Rolodex
   # then push with: x-access-token:${{ steps.app-token.outputs.token }}
   ```

   Keep the existing PAT path until the App is verified working, then remove it.

3. **Add a ruleset** on `MC-Training-Rolodex` →
   Settings → Rules → Rulesets → **New branch ruleset**:
   - **Target**: Default branch (`main`).
   - **Enforcement**: Active.
   - **Rules**: enable **Restrict deletions**, **Block force pushes**
     (`non_fast_forward`), and **Require a pull request before merging**.
   - **Bypass list**: the **deploy App / machine account ONLY**
     (bypass mode: Always). Do **not** add yourself.
   - Result: the bot force-pushes via bypass; every human is forced through a
     PR and cannot force-push — so no one can hand-push the generated repo.

### `gh api` starting point

```bash
# App ID of the installed deploy app (bypass actor):
APP_ID=$(gh api /repos/mcross2298/MC-Training-Rolodex/installation --jq '.app_id')

gh api -X POST /repos/mcross2298/MC-Training-Rolodex/rulesets \
  -f name='lock-main-to-deploy-bot' \
  -f target='branch' \
  -f enforcement='active' \
  -F 'conditions[ref_name][include][]=~DEFAULT_BRANCH' \
  -F "bypass_actors[][actor_id]=${APP_ID}" \
  -F 'bypass_actors[][actor_type]=Integration' \
  -F 'bypass_actors[][bypass_mode]=always' \
  -F 'rules[][type]=deletion' \
  -F 'rules[][type]=non_fast_forward' \
  -F 'rules[][type]=pull_request'
```

Adjust `actor_type` to `Team`/`RepositoryRole` if you use a machine user
instead of an App.

## Quick (solo-owner) fallback — Option B

If you don't want a separate identity yet: create the same ruleset but with
**no bypass actor**, and have the deploy push **without force** (append a
normal commit instead of `git init` + force). This blocks all force-pushes
(including accidental human ones) but requires reworking `market-deploy.yml`
to fetch + commit on top of existing history rather than replacing it. Lower
effort on identity, higher effort on the workflow. Option A is preferred.

## Verify after applying

1. From a normal account/clone, attempt `git push --force origin main` to
   `MC-Training-Rolodex` → **must be rejected**.
2. Push any commit to `4-Weeks-to-Open-` `main` → the deploy job runs and the
   bot's force-push to Rolodex **succeeds** (bypass works).
3. Confirm a fresh `Clean build from 4-Weeks-to-Open- @ <sha>` commit lands on
   Rolodex `main`.

## Why this isn't automated here

The assistant's GitHub tools don't include a rulesets / branch-protection
write API, and creating the deploy App + secrets is an account-level action.
This runbook is the hand-off; the change itself is a one-time setting.
