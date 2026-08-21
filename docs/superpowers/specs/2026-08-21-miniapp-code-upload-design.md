# Miniapp Secure Code Upload Design

## Goal

Provide one manually triggered GitHub Actions path that resolves a CI-approved commit, builds the UniApp `mp-weixin` artifact, and uploads that artifact to the WeChat Mini Program backend without exposing or committing the upload key.

## Scope

This workflow performs the same **code upload** operation as WeChat Developer Tools. It creates a development/experience version in the WeChat backend. Submitting for review and releasing to end users remain manual WeChat control-plane actions; automating those would require a different credential and approval design.

## Current risks to remove

- `.github/workflows/miniapp-release.yml` downloads `miniprogram-ci@latest` during a production upload.
- It builds without exporting the public AppID expected by `manifest.config.ts`.
- It writes the private key into the repository checkout instead of an isolated runner directory.
- It does not bind the upload to an exact commit with a successful `ci.yml` run.
- It does not use the protected `production` Environment or a non-cancelling upload lock.

## Release contract

- Manual inputs: `ref`, `version`, and `desc`.
- Resolve `ref` through `actions/checkout`, then use the full lowercase 40-character SHA for the build checkout.
- Require at least one completed successful `ci.yml` run for that exact SHA before the upload job can start.
- Use `environment: production` and concurrency group `petcare-miniapp-production` with `cancel-in-progress: false`.
- Build with public `WECHAT_APP_ID=wx3bdad4ab652f0d1d` and upload `apps/miniapp/dist/build/mp-weixin`.
- Pin `miniprogram-ci` to `2.1.31` in `apps/miniapp/package.json` and the workspace lockfile. Invoke it through `pnpm --dir apps/miniapp exec`; do not use `npx`, `latest`, or a runtime package download.
- Use robot `1` and the generated `project.config.json` through `--use-project-config true`.

## Secret custody

- GitHub `production` Environment secret: `MP_UPLOAD_PRIVATE_KEY_B64`.
- Expose that secret only to the key-decoding step; the upload step receives only the temporary key path.
- Decode it only under `${{ runner.temp }}/petcare-miniapp-${{ github.run_id }}-${{ github.run_attempt }}`.
- Directory mode is `700`; key mode is `600`; the key never enters the checkout.
- An `if: always()` step removes only that exact temporary directory on success or failure.
- Never print the key, its Base64 value, an AppSecret, or a local key path.

## Trust-boundary validation

- `version` must be a SemVer-shaped value and is passed as a quoted environment value.
- `desc` must be non-empty and contain no carriage return or newline.
- The built `app.json` and `project.config.json` must exist and be non-empty before upload.
- The workflow has only `contents: read` and `actions: read` permissions.

## External prerequisites

- The code-upload key must belong to AppID `wx3bdad4ab652f0d1d`.
- WeChat's CI IP whitelist must allow the runner path (or the operator must deliberately accept the risk of disabling the restriction).
- The selected commit must first have a successful manually dispatched or master-push `ci.yml` run.

## Verification boundary

Local checks cover static policy, dependency lock, and a real `mp-weixin` compile. The actual upload, GitHub Environment protection, WeChat IP whitelist, and WeChat backend acceptance are verified only by the protected GitHub Actions run.
