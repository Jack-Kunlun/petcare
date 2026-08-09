# PetCare UniApp

PetCare's multi-platform client workspace is generated from the official `wot-starter-v2` template. It retains the template's Vue 3, Vite, uni-app, Wot UI v2, UnoCSS, and platform configuration.

## Template provenance

This workspace was generated on 2026-08-09 with the official create-uni CLI:

```powershell
pnpm create uni@latest apps/uniapp -t wot-starter-v2
```

`pnpm create uni@latest --help` confirmed the `create-uni [PROJECT_NAME] [OPTION]...` syntax and that `-t` selects a specific template. The command output did not report a create-uni package version, so this README intentionally does not claim one.

## Install and run

Install dependencies from the monorepo root:

```powershell
pnpm install
```

Use the root aliases for the target you are developing:

```powershell
pnpm dev:uniapp:h5
pnpm dev:uniapp:mp-weixin
pnpm dev:uniapp:app-android
pnpm dev:uniapp:app-ios
```

The package-level equivalents are `pnpm --filter @petcare/uniapp dev:<target>`. The official-template-derived expected development output paths are `dist/dev/h5` and `dist/dev/<target>` for other platforms. They remain unverified because target builds were intentionally skipped.

## Build targets

```powershell
pnpm build:uniapp:h5
pnpm build:uniapp:mp-weixin
pnpm build:uniapp:app-android
pnpm build:uniapp:app-ios
```

The official-template-derived expected production output paths are beneath `dist/build/` for H5 and mini-program targets. They remain unverified because target builds were intentionally skipped. App-platform CLI compilation creates offline resources; HBuilderX determines the exact native output layout for its selected App build configuration.

### H5

Run `pnpm build:uniapp:h5`; the expected official-template output is `apps/uniapp/dist/build/h5`, which remains unverified because this build was skipped.

### WeChat Mini Program

Run `pnpm build:uniapp:mp-weixin`, then import the expected official-template output directory `apps/uniapp/dist/build/mp-weixin` in WeChat DevTools. This path remains unverified because the build was skipped. Before publishing, set the user-owned WeChat App ID in `manifest.config.ts` (and regenerate) and complete DevTools upload/review steps.

### Android

Run `pnpm build:uniapp:app-android` to compile the App resources. Open `apps/uniapp` in HBuilderX and use its Android cloud/local packaging workflow with your own package name and signing certificate. CLI resource compilation alone does not produce, sign, or install a final APK/AAB.

### iOS

Run `pnpm build:uniapp:app-ios` to compile the App resources. Complete iOS packaging in HBuilderX and Xcode with your own Apple team, provisioning profile, certificate, and App Store credentials. CLI resource compilation alone does not produce, sign, or install an IPA.

## Required user-owned configuration

`manifest.config.ts` deliberately uses `__UNI__UNCONFIGURED__` as the development App ID. Replace it with the App ID assigned to your project before an App release. Supply real WeChat App IDs, Android signing materials, Apple certificates/profiles, and store credentials locally or through approved CI secrets; none belong in this repository.

## Starter samples

The official starter's demo pages, mock modules, and sample integrations are retained as scaffold content. Replace or remove them before production; they are not migrated PetCare business code.

## Quality commands

```powershell
pnpm --filter @petcare/uniapp lint
pnpm --filter @petcare/uniapp typecheck
pnpm --filter @petcare/uniapp test
pnpm --filter @petcare/uniapp test:coverage
```
