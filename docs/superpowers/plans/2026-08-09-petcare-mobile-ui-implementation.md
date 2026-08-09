# PetCare Mobile UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Because every task writes to the same Figma file, execute tasks sequentially and review after each task.

**Goal:** Create a production-grade, fully editable PetCare mobile UI design system and 70–90 validated mobile frames in a new Figma Design file.

**Architecture:** One Figma file is divided into Foundations, Components, domain screen pages, state samples, and prototype flows. Variables and components are created first; every screen is assembled from those assets and validated incrementally with metadata plus screenshots.

**Tech Stack:** Figma Design, Figma MCP `create_new_file` and `use_figma`, Figma variables/styles/components, approved PetCare SVG/PNG assets.

## Global Constraints

- Target plan: `team::1311960381185140198` (`yunfeng zheng's team`, Full seat).
- File name: `PetCare Mobile Design System`.
- Canonical frame: 375×812, 16px horizontal safe margin, 4-column grid, 12px gutter.
- Visual direction: calm, warm, professional, modern, restrained.
- Authority: Brand Book and prototype specification; current application code is not a visual authority.
- Use v45 page/brand baseline and v46 authentication behavior.
- Build all screens in Light mode; create Dark variables plus Auth, Home, and Monitor dark samples.
- All touch targets are at least 44×44px; body copy is 14–16px.
- Use UI mint `#5BC8AF`; reserve Logo mint `#5BC9B9` for approved logo artwork only.
- Never regenerate or redraw approved Logo and Hero artwork.
- Never use emoji as structural icons.
- Each `use_figma` write call has at most 10 logical operations, returns mutated node IDs, and is followed by structural or screenshot validation.
- No two workers may modify the Figma file concurrently.

---

### Task 1: Create and Inspect the Figma File

**Files:**

- Read: `docs/superpowers/specs/2026-08-09-petcare-mobile-ui-design.md`
- Create externally: Figma Design file `PetCare Mobile Design System`
- Record: Figma `fileKey` and URL in the task report; do not write credentials to the repository.

**Interfaces:**

- Consumes: plan key `team::1311960381185140198`.
- Produces: one writable Figma `fileKey`, initial page IDs, and an empty-file inspection report.

- [ ] Load `figma-create-new-file` before invoking `create_new_file`.
- [ ] Create a `design` file named `PetCare Mobile Design System` in the target plan without guessing a project ID.
- [ ] Load `figma-use` and its required gotchas/validation references.
- [ ] Inspect pages, local variables, styles, and top-level nodes with a read-only `use_figma` call.
- [ ] Verify the new file is writable and return the `fileKey`, URL, page IDs, and empty-file metadata.

### Task 2: Build Foundations and Variables

**Files:**

- Read: `docs/10-brand-system/PetCare-Brand-Book-v1.0.md`
- Read: `docs/10-brand-system/deliverables/README.md`
- Modify externally: local Figma variables, text styles, and effect styles only

**Interfaces:**

- Consumes: Task 1 `fileKey`.
- Produces: primitive, semantic, and dimension variable collection IDs plus typography/effect style IDs.

- [ ] Create Light/Dark color variables for brand, UI care, Logo mint, text, surfaces, borders, and semantic status colors.
- [ ] Create number variables for spacing, radii, control heights, icon sizes, and safe-area constants.
- [ ] Detect available Figma fonts before loading or mutating any text.
- [ ] Create ten text styles: Chinese Display, H1, H2, H3, Title, Body Large, Body, Caption; Montserrat Brand English; and JetBrains Mono Data.
- [ ] Create effect styles `none`, `shadow-xs`, `shadow-sm`, `shadow-md`, and `shadow-lg` using restrained elevation.
- [ ] Validate variable counts, modes, style names, font availability, color separation, aliases, scopes, and Web code syntax.

### Task 2B: Build File Structure and Foundations Documentation

**Files:**

- Modify externally: Figma pages `00 Cover & Guide`, `01 Foundations`, `02 Components`, `03 Auth & Main Tabs`, `04 Bounty`, `05 Orders & Care`, `06 Pets & Profile`, `07 Content & Assets`, `08 States & Dark Samples`, `09 Prototype Flows`, and `99 Archive`

**Interfaces:**

- Consumes: Task 2 variable and style IDs.
- Produces: eleven ordered page IDs, cover frame ID, and Foundations documentation frame IDs.

- [ ] Rename the initial page and create all eleven approved pages, preserving `99 Archive` as the last page.
- [ ] Build a 1440×900 branded cover using semantic variables and approved typography.
- [ ] Build the 1440px Foundations documentation canvas with variable-bound primitive and semantic swatches, type specimens, spacing bars, radius samples, shadow samples, accessibility notes, and the 375×812 mobile reference grid.
- [ ] Keep all documentation containers in Auto Layout and display Web code syntax for developer-facing tokens.
- [ ] Validate page order, variable bindings, typography, section spacing, clipping, and a Foundations screenshot.

### Task 3: Import Assets and Build the Component Library

**Files:**

- Read: `docs/10-brand-system/deliverables/manifest.json`
- Read assets under: `docs/10-brand-system/deliverables/`
- Modify externally: Figma page `02 Components`

**Interfaces:**

- Consumes: Task 2 variable/style IDs and approved asset paths.
- Produces: component/component-set keys for navigation, forms, feedback, content, and domain UI.

- [ ] Upload approved Logo, Symbol, three 750×340 Hero images, navigation icons, placeholders, gradients, overlays, badges, and connection pattern.
- [ ] Build Button, Icon Button, Input, Textarea, Search, Amount, Date/Time, Address, Upload, Chip, Segmented Tab, Badge, Toast, Alert, Dialog, Bottom Sheet, Skeleton, Progress, and Empty/Error State variants.
- [ ] Build App Bar, Back Bar, 5-item Tab Bar, Pagination Dots, Avatar, Tag, Price, Rating, Card, List Item, and Media Thumbnail variants.
- [ ] Build service progress, bounty, order, pet, provider identity, SOP timeline, care evidence, monitor player, chat, coupon, wallet, review, community, article, location, map marker, map bottom sheet, and upload queue components.
- [ ] Bind component properties to variables and use Auto Layout for every structurally related container.
- [ ] Validate component-set names, variant properties, instance integrity, text clipping, hit-area dimensions, and overview screenshots.

### Task 4: Build Auth and Main Tab Screens

**Files:**

- Read: `docs/01-requirements/04-prototype-specification.md`
- Modify externally: Figma page `03 Auth & Main Tabs`

**Interfaces:**

- Consumes: Task 3 component keys.
- Produces: Auth and five main-tab frame IDs.

- [ ] Build Auth default, phone authorization, authorization denied, login failed, and session restoring frames.
- [ ] Build Home default, ongoing-service, no-service, location denied, and loading/error variants using approved Hero artwork.
- [ ] Build Bounty list, filter-open, no-results, loading/error, map-collapsed, map-expanded, and location-denied frames.
- [ ] Build Community Featured, Classroom, Nearby, location-denied, and empty/error frames.
- [ ] Build Messages category tabs, unread/read, per-category empty, swipe-action, and error frames.
- [ ] Build Profile default, missing-profile-data, and logged-out/permission frames.
- [ ] Validate all frames at 375×812, safe areas, 5-tab visibility rules, typography, and major screenshots.

### Task 5: Build the Bounty Transaction Flow

**Files:**

- Modify externally: Figma page `04 Bounty`

**Interfaces:**

- Consumes: Task 4 Bounty navigation entry and Task 3 components.
- Produces: publish-flow and reward-detail frame IDs.

- [ ] Build Publish Step 1 default, selected, and next-disabled states.
- [ ] Build Publish Step 2 default, focused, validation-error, no-pet, upload-in-progress, and upload-failed states.
- [ ] Build Publish Step 3 default, agreement-unchecked, submitting, and submit-failed states.
- [ ] Build Publish Success and recovery path frames.
- [ ] Build Reward Detail variants for available-to-accept, own-post/edit, accepted, completed, cancelled, and unavailable.
- [ ] Connect only local screen transitions; do not imply real payment, identity, or dispatch capability.
- [ ] Validate field labels, error placement, price emphasis, destructive actions, scroll bounds, and screenshots.

### Task 6: Build Orders, Care Evidence, Monitor, and Chat

**Files:**

- Modify externally: Figma page `05 Orders & Care`

**Interfaces:**

- Consumes: Task 3 order/SOP/monitor/chat components.
- Produces: orders, order detail, monitor, and chat frame IDs.

- [ ] Build Orders list status tabs for pending payment, pending service, in progress, completed, and cancelled plus empty/loading/error states.
- [ ] Build Order Detail status variants with the correct bottom action area and service evidence hierarchy.
- [ ] Build care SOP timeline and photo/video evidence feed samples.
- [ ] Build Monitor connecting, LIVE, paused, disconnected, and no-permission frames with text recovery paths.
- [ ] Build Chat empty, populated, sending, failed, and offline frames.
- [ ] Validate high-risk status language, evidence legibility, media controls, safe-area actions, and screenshots.

### Task 7: Build Pets, Profile, Social, Content, and Assets Screens

**Files:**

- Modify externally: Figma pages `06 Pets & Profile`, `07 Content & Assets`

**Interfaces:**

- Consumes: Task 3 components.
- Produces: remaining canonical and Design-completion frame IDs.

- [ ] Build Pet list/default/empty/error, add/edit/default/error/upload, detail, and delete-confirmation frames.
- [ ] Build Profile Info view/edit/validation/save-feedback frames.
- [ ] Build Favorites, Follows, and Reviews default/tab/empty/action states.
- [ ] Build Classroom Article and Community Article with recommendation and comment states.
- [ ] Build Community Publish default/validation/upload/success as a `Design completion` flow.
- [ ] Build Public User Profile and About as `Design completion` pages.
- [ ] Build Coupons available/used/expired/empty and Wallet balance/transactions/withdraw-disabled/withdraw-in-progress states.
- [ ] Build Help Center and Contact Support pages with calm recovery-oriented language.
- [ ] Validate content hierarchy, list consistency, form states, asset cards, and screenshots.

### Task 8: Build Global States, Dark Samples, and Prototype Flows

**Files:**

- Modify externally: Figma pages `08 States & Dark Samples`, `09 Prototype Flows`

**Interfaces:**

- Consumes: all prior frame IDs and variable collections.
- Produces: system-state frames, three Dark validation frames, and five clickable prototype entry points.

- [ ] Build 404, no-permission, offline, service-unavailable, global loading, empty, and destructive-confirmation frames.
- [ ] Duplicate Auth, Home, and Monitor validation samples and switch them to Dark variables without hardcoded overrides.
- [ ] Connect the approved Auth, Bounty publish, Service fulfillment, Pet management, and Community interaction prototype flows.
- [ ] Add cover-page links and flow labels so reviewers can enter every flow from `00 Cover & Guide`.
- [ ] Validate reduced-motion alternatives, back paths, Tab transitions, overlays, scroll behavior, and dark contrast.

### Task 9: Final Figma QA and Handoff

**Files:**

- Read: `docs/superpowers/specs/2026-08-09-petcare-mobile-ui-design.md`
- Inspect externally: entire Figma file

**Interfaces:**

- Consumes: all node IDs, variables, components, and flows.
- Produces: final URL, page/frame/component/variable counts, QA evidence, and remaining product dependencies.

- [ ] Enumerate all Figma pages, top-level frames, components, component sets, variable collections, modes, styles, and prototype starting points.
- [ ] Verify every canonical route or approved Design-completion page has at least one matching frame.
- [ ] Screenshot each page overview and all high-risk frames: Auth error, Publish validation, Order in progress, Monitor disconnected, Wallet withdrawal disabled, and Dark Home.
- [ ] Check for unnamed layers, detached instances, overlapping top-level nodes, clipped text, invalid Auto Layout, stray placeholder shimmer, raw colors, and touch targets below 44×44px.
- [ ] Check WCAG contrast targets and confirm every status has text plus icon or shape semantics.
- [ ] Fix discovered defects in targeted calls and repeat the failed check.
- [ ] Return the final Figma URL, exact counts, completed flows, known backend/product dependencies, and any design exceptions.
