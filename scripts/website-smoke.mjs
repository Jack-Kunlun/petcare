/* global document, getComputedStyle */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { URL } from "node:url";
import process from "node:process";
import { log } from "node:console";
import path from "node:path";

const require = createRequire(new URL("../apps/admin/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const origin = new URL(process.argv[2] ?? "http://127.0.0.1:8080");
const output = process.argv[3];
const routes = [
  "product",
  "care",
  "caregivers",
  "stories",
  "articles",
  "start",
  "help",
  "contact",
  "about",
  "trust",
  "payments",
  "platform-rules",
  "refund-policy",
  "terms",
  "privacy",
];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ reducedMotion: "reduce" });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

try {
  if (output) await mkdir(output, { recursive: true });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      const response = await page.goto(new URL(route, origin).toString(), {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      assert.equal(response.status(), 200, `${route}: HTTP ${response.status()}`);
      await page.evaluate(async () => {
        document.querySelector("astro-dev-toolbar")?.remove();
        document.querySelectorAll('img[loading="lazy"]').forEach((img) => (img.loading = "eager"));
        await Promise.all(Array.from(document.images).map((img) => img.decode().catch(() => {})));
        await document.fonts.ready;
      });
      assert.equal(
        await page.locator("#main-content h1").count(),
        1,
        `${route}: unique page heading`,
      );
      assert.equal(await page.locator(".interior-site").count(), 1, `${route}: public theme`);
      assert.equal(await page.locator(".site-header--interior").count(), 1, `${route}: navigation`);
      assert.equal(await page.locator(".site-footer--home").count(), 1, `${route}: footer`);
      assert.equal(
        await page.locator(".site-header__navigation .button").getAttribute("href"),
        "/product",
      );
      const geometry = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        brokenImages: Array.from(document.images)
          .filter(
            (img) => img.getBoundingClientRect().width > 0 && (!img.complete || !img.naturalWidth),
          )
          .map((img) => img.getAttribute("src")),
        brokenAnchors: Array.from(document.querySelectorAll('a[href^="#"]'))
          .map((a) => a.getAttribute("href"))
          .filter(
            (href) =>
              href.length > 1 && !document.getElementById(decodeURIComponent(href.slice(1))),
          ),
      }));
      assert(
        geometry.overflow <= 1,
        `${route}@${width}: horizontal overflow ${geometry.overflow}px`,
      );
      assert.deepEqual(geometry.brokenImages, [], `${route}@${width}: broken images`);
      assert.deepEqual(geometry.brokenAnchors, [], `${route}@${width}: broken anchors`);
      if (route === "care" || route === "about") {
        const background = await page.locator(".interior-page__hero").evaluate((hero) => {
          const photo = hero.querySelector(".interior-page__hero-scene").getBoundingClientRect();
          const heroRect = hero.getBoundingClientRect();
          return {
            padding: getComputedStyle(hero).paddingTop,
            color: getComputedStyle(hero).backgroundColor,
            heroHeight: heroRect.height,
            heroLeft: heroRect.left,
            heroRight: heroRect.right,
            photoX: photo.x,
            photoWidth: photo.width,
            photoHeight: photo.height,
            transition: getComputedStyle(
              hero.querySelector(".interior-page__hero-scene"),
              "::after",
            ).backgroundImage,
            wash: getComputedStyle(hero.querySelector(".interior-page__hero-wash")).display,
            wave: getComputedStyle(hero.querySelector(".interior-page__hero-wave")).display,
          };
        });
        assert.equal(background.padding, "0px", `${route}: no legacy hero padding`);
        assert.equal(background.color, "rgb(237, 246, 255)", `${route}: blue canvas`);
        if (width === 1440) {
          assert.equal(background.heroHeight, 552, `${route}: desktop scene height`);
          assert.equal(background.photoWidth, 1000, `${route}: desktop photo width`);
          assert.equal(
            background.photoX,
            route === "care" ? background.heroRight - background.photoWidth : background.heroLeft,
          );
        } else {
          assert.equal(background.photoWidth, width, `${route}: narrow photo width`);
          assert.equal(
            background.photoHeight,
            width === 768 ? (route === "care" ? 512 : 360) : 260,
          );
          assert(background.transition.includes("50px") && background.transition.includes("64px"));
          assert.equal(background.wash, "none", `${route}: no horizontal mobile wash`);
          assert.equal(background.wave, "none", `${route}: no mobile curve`);
        }
      }
      if (route === "stories" || route === "trust") {
        const opening = await page.locator(".marketing-page__hero .eyebrow").evaluate((label) => ({
          top: label.getBoundingClientRect().top,
          headerBottom: document.querySelector(".site-header").getBoundingClientRect().bottom,
          fontSize: getComputedStyle(document.querySelector("#marketing-page-title")).fontSize,
        }));
        assert(opening.top >= opening.headerBottom, `${route}: opening clears navigation`);
        if (width <= 680) assert.equal(opening.fontSize, "34px", `${route}: mobile heading`);
      }
      if (route === "payments") {
        assert.equal(await page.locator(".marketing-page__cta .button").count(), 0);
      }
      if (route === "help") {
        const searchStyle = await page.locator("[data-help-search]").evaluate((input) => ({
          padding: getComputedStyle(input).paddingRight,
          height: input.parentElement.getBoundingClientRect().height,
          icon: getComputedStyle(document.querySelector(".help-center__search-icon")).position,
          introMargin: getComputedStyle(document.querySelector(".help-center__intro-copy"))
            .marginTop,
        }));
        assert.equal(searchStyle.padding, "92px", "Help search reserves space for controls");
        assert.equal(searchStyle.height, 56, "Help search height");
        assert.equal(searchStyle.icon, "absolute", "Help search icon position");
        assert.equal(searchStyle.introMargin, "0px", "Help description spacing");
      }
      if (output && width !== 320) {
        await page.screenshot({ path: path.join(output, `${route}-${width}.png`), fullPage: true });
      }
      for (const preview of await page.locator("[data-care-preview]").all()) {
        const tabs = preview.getByRole("tab");
        assert.equal(await tabs.count(), 4, `${route}: care stages`);
        if (route === "trust")
          assert.equal(await tabs.nth(2).getAttribute("aria-selected"), "true");
        await tabs.nth(0).click();
        await tabs.nth(0).press("End");
        assert.equal(await tabs.nth(3).getAttribute("aria-selected"), "true");
        assert.equal(await preview.getByRole("tabpanel").count(), 1);
        await preview.locator("[data-care-next]").click();
        assert.equal(await tabs.nth(0).getAttribute("aria-selected"), "true");
      }
    }
    if (width < 1200) {
      const menu = page.locator("[data-site-menu-button]");
      await menu.click();
      assert.equal(await page.locator(".site-header__navigation li a:visible").count(), 7);
      await page.keyboard.press("Escape");
      assert.equal(await menu.getAttribute("aria-expanded"), "false");
      assert(await menu.evaluate((button) => button === document.activeElement));
      await menu.click();
      await page.locator("[data-site-menu-close]").click();
      assert.equal(await menu.getAttribute("aria-expanded"), "false");
    }
    log(`Public routes passed at ${width}px.`);
  }
  await page.goto(new URL("help", origin).toString(), { waitUntil: "domcontentloaded" });
  const search = page.locator("[data-help-search]");
  await search.fill("没有这个问题123456");
  await page.locator("[data-help-empty]").waitFor({ state: "visible" });
  assert.equal(await page.locator("[data-help-item]:visible").count(), 0);
  await page.locator("[data-help-clear]").click();
  assert((await page.locator("[data-help-item]:visible").count()) > 0);
  const detailHref = await page
    .locator('[data-help-item] a[href^="/help/"]')
    .first()
    .getAttribute("href");
  const detailResponse = await page.goto(new URL(detailHref, origin).toString(), {
    waitUntil: "domcontentloaded",
  });
  assert.equal(detailResponse.status(), 200);
  assert.equal(await page.locator(".interior-site").count(), 1);
  await page.goto(new URL("start", origin).toString(), { waitUntil: "domcontentloaded" });
  assert.equal(
    await page.locator('[role="status"]').count(),
    1,
    "Miniapp entry preserves real availability",
  );
  assert.deepEqual(errors, []);
  log("Public navigation, responsive layouts, images, Help search and entry state passed.");
} finally {
  await browser.close();
}
