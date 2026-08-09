# PetCare Login Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. The user explicitly requires inline execution with the current model and no subagents.

**Goal:** Replace the current `Auth/Sign In/Default` frame with one polished, photography-led PetCare login screen.

**Architecture:** Update only Figma node `165:2` on page `03 Auth & Main Tabs`. Recompose its children from approved brand artwork, existing semantic variables/styles, and live design-system instances; then validate the actual rendered text and screenshot.

**Tech Stack:** Figma Plugin API through `use_figma`, PetCare local variables/styles/components, approved Logo and Hero artwork.

## Global Constraints

- Target frame remains exactly `375×812`.
- Modify only `Auth/Sign In/Default`; do not modify other Auth states or pages.
- Use approved photography and Logo without redraw, recolor, stretching, or unsafe cropping.
- Use 16px page margins and touch targets at least 44×44px.
- Chinese title must not produce a single-character orphan at 375px or 360px widths.
- Main Button must remain a live component instance with scale factor 1 and no default Plus/Chevron.
- Do not use subagents.

---

### Task 1: Redesign and validate the default login screen

**Files:**

- Modify: Figma file `mwpHHcx0VAutpPTIhGYGqC`, node `165:2`
- Reference: `docs/superpowers/specs/2026-08-09-petcare-login-page-redesign.md`

**Interfaces:**

- Consumes: approved `Brand/Logo Stacked`, approved `Hero/Artwork`, Button component, semantic color variables, Noto Sans SC text styles.
- Produces: one finished `375×812` frame named `Auth/Sign In/Default`.

- [ ] **Step 1: Inspect the current frame and reusable assets**

Read the frame hierarchy, existing component IDs, variables, text styles, and screenshot. Record the approved Logo/Hero variants and Button property keys before mutating anything.

- [ ] **Step 2: Replace the frame composition**

Keep the frame itself and rebuild only its children into: safe top area, photography-led brand region, single-line centered headline, centered supporting copy, one `343×52` live primary Button, agreement copy, and low-emphasis trust note. Use Auto Layout for related text/action groups.

- [ ] **Step 3: Validate structure and rendered content**

Read back: frame `375×812`; one Button instance at scale 1; no TabBar; zero detached instances; zero horizontal overflow; title actual characters exactly `让每一次照护，都更安心`; no line whose only character is `心`; no default Plus/Chevron; approved Logo/Hero instances remain live.

- [ ] **Step 4: Inspect the rendered screenshot and correct visual defects**

Check full-screen balance, photography crop, Logo legibility, headline wrapping, spacing rhythm, Button prominence, agreement readability, and bottom safe area. Make only targeted corrections, then capture the final screenshot again.

- [ ] **Step 5: Stop for user review**

Return the Figma node link and a concise list of the final dimensions and design decisions. Do not modify another screen until the user approves this one.
