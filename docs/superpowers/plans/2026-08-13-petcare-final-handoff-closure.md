# PetCare Figma Final Handoff Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Do not dispatch subagents for this plan.

**Goal:** Complete the four authoritative detail pages required by five favorite/follow entries, close implementation-impacting Figma debt, synchronize Prototype and Ready for Dev, and update the product specification.

**Architecture:** Keep `10–70` business pages as visual source of truth, `02 · Components` as component source of truth, and treat `90 · Prototype` plus `98 · Ready for Dev` as synchronized delivery copies. Work pattern-by-pattern with exact node discovery, incremental writes, screenshots, and a final graph/instance audit.

**Tech Stack:** Figma Plugin API through `use_figma`, Figma desktop UI through Computer Use, Markdown product documentation, Git.

## Global Constraints

- Preserve the existing 14 top-level Figma pages and their order.
- Do not redesign approved screens, rebuild variables, introduce another visual system, detach instances in bulk, or delete uncertain work.
- Use Noto Sans SC, existing PetCare variables, White/Light Neutral/Light Primary Blue surfaces, Primary Blue, limited Mint, and Amber only for small price/value emphasis.
- Follow the 4px grid and even dimensions except for 1px borders.
- Business pages own approved visuals; Prototype and Ready for Dev are synchronized copies only.
- Do not connect Prototype to Archive, Full Page Review, old frames, or another page.
- Do not use subagents.

---

### Task 1: Freeze the delivery contract and update the product specification

**Files:**

- Modify: `docs/01-requirements/04-prototype-specification.md`
- Reference: `docs/superpowers/specs/2026-08-13-petcare-final-handoff-closure-design.md`

**Interfaces:**

- Consumes: the approved four-page/five-entry mapping and the current `/favorites` and `/follows` requirements.
- Produces: authoritative routes, field lists, states, and interactions used by the Figma annotations and prototype links.

- [ ] **Step 1: Add the detail-page requirements**

  Add `Service / Detail / Default`, `Caregiver / Detail / Default`, `Store / Detail / Default`, and `Creator / Profile / Default` with the exact sections from the approved design specification.

- [ ] **Step 2: Add the five entry mappings**

  Record that Favorite Service targets Service Detail; Favorite Caregiver and Follow Caregiver share Caregiver Detail; Follow Store targets Store Detail; Follow Creator targets Creator Profile.

- [ ] **Step 3: Update the route table and version history**

  Add `/services/:id`, `/caregivers/:id`, `/stores/:id`, and `/creators/:id`, and record the final-handoff version dated 2026-08-13.

- [ ] **Step 4: Verify the document**

  Run `pnpm exec prettier --write docs/01-requirements/04-prototype-specification.md` and `git diff --check -- docs/01-requirements/04-prototype-specification.md`. Expected: both commands succeed and no TBD/TODO/placeholder copy is introduced.

- [ ] **Step 5: Commit the documentation contract**

  Commit only the specification change with `docs: 完善收藏关注详情页需求`.

### Task 2: Audit and prepare the reusable component layer

**Figma ownership:**

- Modify: `02 · Components / 11 · Content & Social`
- Modify only when pixel-equivalent: existing `Button`, `Navbar`, `Tabs`, `SegmentedControl`, and `FAB` formal families.

**Interfaces:**

- Consumes: existing 119 variables, 91 formal component families, legacy pattern inventory, and approved business-screen visuals.
- Produces: a reusable Favorite Content Card family plus an exact migration ledger for Button/Navbar/Tabs and the remaining patterns.

- [ ] **Step 1: Re-read formal component APIs and legacy geometry**

  Return component property definitions, variant axes, dimensions, descriptions, and samples for Button/Navbar/Tabs/SegmentedControl/FAB, then return every matching legacy frame with page, screen, size, label, and child structure.

- [ ] **Step 2: Create the Favorite Content Card family**

  Create one token-bound component family with `Type=Article|Bounty|Service|Caregiver`, `State=Default|Loading`, text properties, media/avatar slot, metadata, price/value line, and a 44×44 Favorite Action. Place it in `11 · Content & Social` and document purpose and usage.

- [ ] **Step 3: Validate the new family**

  Read back variant count, properties, bindings, scopes, and descriptions. Capture a screenshot covering all variants and verify no clipping, hardcoded tokenizable color, odd dimension, or duplicate formal name.

- [ ] **Step 4: Migrate exact legacy matches**

  Replace only pixel-equivalent Button/Navbar/Tabs/SegmentedControl/FAB and Favorite card frames in `10–70` business pages. Preserve node position, size, name, prototype reactions, and text. After each family, screenshot at least one migrated screen and compare with its pre-migration screenshot.

- [ ] **Step 5: Record justified non-matches**

  Update `12 · Component Inventory & Migration Notes` with migrated counts and exact reasons for any retained frames: label model, width, shadow, hit geometry, or nested interaction mismatch. Do not call a retained non-match “resolved.”

### Task 3: Build the four authoritative detail screens

**Figma ownership:**

- Modify: `70 · Profile & Pets / 04 · Social`
- Create: `Service / Detail / Default`
- Create: `Caregiver / Detail / Default`
- Create: `Store / Detail / Default`
- Create: `Creator / Profile / Default`

**Interfaces:**

- Consumes: existing Navigation, Button, Avatar, Tag/Badge, Cell, ReviewCard, icons, variables, and the Task 2 component family.
- Produces: four 375×812 scrollable business source screens with fixed headers/actions and deterministic names.

- [ ] **Step 1: Build Service Detail**

  Compose Navigation Header, service summary, content/scope, process, protection, caregiver summary, review summary, and fixed contact/book action. Use the approved example “专业上门洗护 / 林可 / ¥88 起”.

- [ ] **Step 2: Validate Service Detail**

  Screenshot the whole viewport and the content subtree. Verify 375×812, Vertical Scroll, fixed bottom action, 44px touch targets, no BottomTabBar, and no overflow or placeholder copy.

- [ ] **Step 3: Build Caregiver Detail**

  Compose public profile, capability, bookable services, trust information, reviews, and fixed message/service actions. Use “林可 / 4.9 / 328 笔服务 / 平均 10 分钟响应”.

- [ ] **Step 4: Validate Caregiver Detail**

  Verify both Favorite Caregiver and Follow Caregiver can share this screen without source-specific copy or controls.

- [ ] **Step 5: Build Store Detail**

  Compose store summary, address/hours/contact, services, introduction, reviews, and fixed contact/service actions. Use “爱宠生活馆 / 静安区 / 营业中”.

- [ ] **Step 6: Validate Store Detail**

  Confirm no commerce, promotion, group-buy, product catalog, or membership UI was introduced.

- [ ] **Step 7: Build Creator Profile**

  Compose public profile, follower/content/interaction metrics, content topics, three representative content entries, and Follow action. Use “萌宠观察局 / 2.4w 关注”.

- [ ] **Step 8: Validate Creator Profile**

  Confirm representative content targets existing Post/Article details and no private-message action was introduced.

- [ ] **Step 9: Add developer annotations**

  Add native annotations or external even-grid annotation cards for scroll/fixed behavior, routes, data fields, Loading/Unavailable behavior, shared Caregiver route, follow cancellation, and dangerous-action rules. Keep them outside product frames.

### Task 4: Connect Prototype and synchronize Ready for Dev

**Figma ownership:**

- Modify: `90 · Prototype / 07 · Profile & Pets`
- Modify: `98 · Ready for Dev / 07 · Profile & Pets`

**Interfaces:**

- Consumes: four validated business source frames and the existing official Main Product Flow.
- Produces: four Prototype copies with interactions, four non-interactive Ready copies, and five complete entry paths.

- [ ] **Step 1: Clone the four screens into Prototype**

  Preserve all component relationships and place the frames in the existing left-to-right flow grid. Add Back actions, Service→Caregiver navigation, Caregiver/Store/Creator follow ActionSheet actions, and content/detail links.

- [ ] **Step 2: Connect the five source entries**

  Connect Favorite Service, Favorite Caregiver, Follow Caregiver, Follow Store, and Follow Creator card bodies to the exact new targets. Keep Favorite Action and Following Action independent from card-body navigation.

- [ ] **Step 3: Audit the Prototype graph**

  Verify one flow start at Login, no missing/cross-page/Archive/Full Page targets, no dead ends, and all four new frames reachable from the official start.

- [ ] **Step 4: Clone the four screens into Ready for Dev**

  Place them in `07 · Profile & Pets`, remove all reactions recursively, and verify the Ready screen count increases from 67 to 71 with no duplicate names.

- [ ] **Step 5: Audit instance provenance**

  Verify every Ready instance resolves, every master is on `02 · Components`, and no Ready frame contains Archive, Full Page, Draft, Review, old-version, or prototype-note content.

### Task 5: Correct Overlay behavior and Ready for Dev status in the Figma UI

**Windows ownership:** Figma desktop app, current PetCare file.

**Interfaces:**

- Consumes: the eight existing Overlay destination frames and 71 final Ready screens.
- Produces: correct modal placement/background behavior and explicit Figma development status.

- [ ] **Step 1: Configure ActionSheet, BottomSheet, and Picker**

  In Prototype settings set bottom positioning, a dimmed background, and close-on-outside-click for non-destructive selection sheets.

- [ ] **Step 2: Configure centered overlays**

  Keep Delete Confirm, Unsaved Changes, Image Preview, Delete Pet, and Logout Confirm centered with a dimmed background. Allow outside close for Image Preview; disable it for destructive or unsaved-change dialogs.

- [ ] **Step 3: Mark final screens Ready for Dev**

  Apply Ready for Dev to all 71 final delivery frames, preserving Completed if any frame already has that higher status.

- [ ] **Step 4: Verify through the UI**

  Re-select representative bottom sheet, dialog, image preview, and Ready frames and capture screenshots showing the relevant Prototype and Dev Mode controls.

### Task 6: Close typography debt and run final QA

**Figma ownership:** `10–70`, `02 · Components`, `90 · Prototype`, and `98 · Ready for Dev` only through synchronized source changes.

**Interfaces:**

- Consumes: existing Noto Sans SC styles, the current 12/14/16/18/20/22/24 type scale, and the technical-debt inventory.
- Produces: normalized ordinary UI text, final component/flow metrics, and a zero-blocker handoff report.

- [ ] **Step 1: Normalize unsupported ordinary UI sizes**

  Change ordinary UI text `13→14`, `15→16`, `17→18`, and readable `10→12` only after checking the containing layout. Preserve intentional brand-display `32px` and documented non-UI micro labels.

- [ ] **Step 2: Apply existing Text Styles where semantically exact**

  Map page titles, section headings, body, secondary text, metadata, and action labels to existing local styles. Do not create a second typography system or change color hierarchy.

- [ ] **Step 3: Synchronize typography changes**

  Re-copy or update Prototype and Ready equivalents from the corrected business sources; do not edit delivery copies independently.

- [ ] **Step 4: Run the full automated audit**

  Verify page order, sections, 71 Ready screens, 0 duplicate screen names, 0 broken instances, 0 Archive master references, variables/scopes/code syntax, text sizes, component debt counts, prototype graph, overlays, canvas overlap, and annotation placement.

- [ ] **Step 5: Run visual regression checks**

  Capture the four new screens, representative migrated Button/Navbar/Tabs/Favorite cards, the Prototype Profile flow, the Ready Profile section, and Components migration notes. Fix any clipping, overflow, overlap, incorrect font, wrong variant, or visible developer note.

- [ ] **Step 6: Verify repository changes and commit**

  Run Prettier on changed Markdown, `git diff --check`, inspect `git status --short`, and commit only the plan/specification changes owned by this task.

- [ ] **Step 7: Report final delivery status**

  Report created screens, five entry mappings, component migrations and justified retained debt, Prototype reachability/dead ends, Overlay settings, Ready count/status, typography result, document commit, and any permission-limited item with evidence.
