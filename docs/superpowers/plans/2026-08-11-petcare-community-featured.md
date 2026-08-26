# PetCare Community Featured Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved `Community / Featured` viewport and `Community / Featured / Full Page` review frame in the existing PetCare Figma file.

**Architecture:** Work only inside `50 · Community & Content`, creating one `01 · Community` section that owns both delivery frames. Reuse existing tokens, functional icons, tab-navigation components, approved visual language, and page-level Auto Layout; do not create a new top-level page or expand the public component library.

**Tech Stack:** Figma Design, Figma Plugin API through `use_figma`, PetCare local variables and styles, Noto Sans SC, approved/local raster photography assets.

## Global Constraints

- Figma file key: `mwpHHcx0VAutpPTIhGYGqC`.
- Target page: `50 · Community & Content` (`261:5`).
- Create only `01 · Community` under that page.
- Default frame is exactly `375×812`; Full Page width is exactly `375`.
- Use 16px page padding, 4px base grid, and even layout dimensions except required 1px borders.
- Keep existing PetCare brand, semantic, and component token values; do not introduce orange, pink, purple, or high-saturation community themes.
- Use Noto Sans SC for all visible Chinese text.
- Bottom TabBar is fixed, Community active, with one top 1px divider and no dividers between items.
- Floating publish button is fixed at right 16px and 16px above the TabBar.
- Do not add public component masters during this task.
- Use real-feeling, visually varied pet-owner and pet-life photography; do not use cartoons, commercial studio images, or repeated uniform AI styling.

---

### Task 1: Baseline discovery and media preparation

**Files:**

- Read: Figma page `50 · Community & Content` (`261:5`)
- Read: Figma page `02 · Components` (`7:3`)
- Create: `docs/10-brand-system/generated/community-owner-avatar-contact-sheet-v1.png`
- Create: `docs/10-brand-system/generated/community-ugc-contact-sheet-v1.png`

**Interfaces:**

- Consumes: approved Figma variables, `Icon/Search`, `Icon/Plus`, `Icon/Heart`, `Icon/Chat`, `Icon/Send`, and `Icon/Tab Navigation`.
- Produces: image hashes for six owner avatars and six varied UGC media crops.

- [ ] Inspect local variables, text styles, effects, icon component IDs, and existing Home/Profile/Bounty Bottom TabBar geometry.
- [ ] Generate a 3×2 owner-avatar contact sheet with six distinct adult Chinese pet owners, neutral home or outdoor backgrounds, and phone-camera realism.
- [ ] Generate a 3×2 UGC contact sheet covering home feeding, dog park, grooming, cat-at-home, owner-and-pet interaction, and neighborhood pet life, with deliberately varied lighting and camera quality.
- [ ] Upload both PNG files to the Figma file and read back non-empty image hashes.
- [ ] Verify the media is visually varied and contains no text, logo, watermark, collage border, cartoon treatment, or commercial studio styling.

### Task 2: Create the Community section and top structure

**Files:**

- Modify: Figma page `50 · Community & Content` (`261:5`)

**Interfaces:**

- Consumes: existing token IDs, Search icon component, and image hashes from Task 1.
- Produces: `01 · Community`, `Community / Featured / Full Page`, Header, Tabs, and Active Overview nodes.

- [ ] Create `01 · Community` at `(80,80)` with enough width for two 375px frames separated by 80px and at least 160px outer padding.
- [ ] Create `Community / Featured / Full Page` as a 375px-wide vertical frame with Canvas fill and 16px horizontal padding.
- [ ] Build a 40px Header using Horizontal Auto Layout: title `社区` at 22px Medium and one live `Icon/Search` instance in a 40px visual container with a 44px interaction wrapper.
- [ ] Build a 48px three-item Segmented Control with equal-width text-only states: `社区精选` active, `萌宠课堂`, `附近动态` inactive.
- [ ] Build a light 16px-radius Active Overview containing `1,286 人`, `328 新增`, and `2.4k 互动`; bind fills and text colors to existing variables.
- [ ] Screenshot Header, Tabs, and Overview together; verify 16px page alignment, 16px inter-section spacing, centered labels, and no visible shadow.

### Task 3: Build the six-post Full Page feed

**Files:**

- Modify: Figma frame `Community / Featured / Full Page`

**Interfaces:**

- Consumes: avatar and media image hashes, current icon components, token IDs, and top structure from Task 2.
- Produces: a six-item vertical Feed with Text, Single Image, Multi Image, Follow, Following, Default, and Liked states.

- [ ] Create a Feed stack 20px below the Active Overview with 16px card gaps.
- [ ] Build post 1 as a single-image PetCare service-experience card for `小萌 · 2小时前 · 静安区`, default Follow state, 4:3 media, and default interaction state.
- [ ] Build post 2 as a two-image dog-park card for `大壮 · 5小时前 · 浦东新区`, Following state, and different interaction counts.
- [ ] Build post 3 as a three-image grooming-experience card for `小美 · 昨天 · 徐汇区`, using a stable three-column 8px-gap grid.
- [ ] Build post 4 as a text-only discussion card for `阿布的家 · 昨天 · 长宁区`, with no media container.
- [ ] Build post 5 as a long-text beginner-care card for `团子妈妈 · 2天前 · 普陀区`, limited to 4–6 visible lines plus a lightweight `全文` action.
- [ ] Build post 6 as a single-image neighborhood-life card for `豆豆爸爸 · 3天前 · 杨浦区`, with Liked heart and count only; do not show distance in Featured.
- [ ] For every card, verify one-level White Surface, 16px radius, 16px padding, 1px Light Border, no shadow, 12px internal module gaps, and left-aligned interaction items.
- [ ] Screenshot each media type and state at readable resolution; fix cropped text, inconsistent image ratios, misaligned icon/count pairs, oversized Follow controls, or unintended nested cards.

### Task 4: Complete Full Page footer, fixed controls, and Default viewport

**Files:**

- Modify: Figma section `01 · Community`

**Interfaces:**

- Consumes: Full Page content from Task 3 and existing Tab Navigation components.
- Produces: completed Full Page, `Community / Featured` scroll viewport, fixed Community TabBar, and fixed publish FAB.

- [ ] Add at least 96px bottom content padding after the final post, followed by the 24px Bottom Safe Area.
- [ ] Build the five-item Bottom TabBar once per screen using existing navigation icon instances; set Community active and the other four destinations inactive.
- [ ] Build a 56px Primary Blue publish FAB with live `Icon/Plus`, right 16px and 16px above the TabBar.
- [ ] Record the intended destinations `Community / Classroom` and `Community / Nearby` in the Tabs layer description, but do not add prototype reactions until those frames exist; dangling prototype links are forbidden.
- [ ] Create `Community / Featured` at 375×812 by cloning the approved content structure into a real 740px `VERTICAL` scroll viewport, with TabBar and FAB as direct fixed siblings.
- [ ] Ensure the Default first screen contains at least one complete post and visibly starts the next item; do not compress text or media solely to force this condition.
- [ ] Position the two delivery frames left-to-right with an 80px gap and resize the enclosing Section to include both without overlap.

### Task 5: Prototype and final acceptance audit

**Files:**

- Verify: Figma page `50 · Community & Content` (`261:5`)

**Interfaces:**

- Consumes: both delivery frames from Task 4.
- Produces: final screenshot evidence and a machine-readable structural audit result.

- [ ] Verify exactly one `01 · Community`, one `Community / Featured`, and one `Community / Featured / Full Page` exist on the target page.
- [ ] Verify Default is 375×812, has one vertical scroll viewport, one fixed TabBar, and one fixed FAB.
- [ ] Verify Full Page has exactly six post cards and includes at least two single-image, one multi-image, one text-only, one long-text, Follow/Following, and Default/Liked examples.
- [ ] Verify Header contains only Search and Tabs contain exactly three equal-width text labels.
- [ ] Verify all visible fonts are Noto Sans SC, all icon instances retain valid main components, and no instance is detached.
- [ ] Verify each major action has a 44×44 or larger interaction target, with the visual 32px Follow and 40px Search controls wrapped appropriately.
- [ ] Verify no horizontal effective overflow, no visible crop or overlap, no placeholder/specification text, no structural Emoji icons, and no forbidden business modules.
- [ ] Verify each frame contains exactly one Community-active Bottom TabBar and the FAB does not cover the last post interaction area.
- [ ] Capture final screenshots of the Default frame, Full Page, Active Overview, single-image card, multi-image card, text-only card, and Liked state.
- [ ] Record the final node IDs and any remaining implementation risks in the task handoff.
