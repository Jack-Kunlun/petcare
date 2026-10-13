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
  for (const width of [2560, 1920, 1440, 1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    if (width === 1440 || width === 390) {
      await page.goto(new URL("/", origin).toString(), { waitUntil: "domcontentloaded" });
      const selected = page.locator('.site-header__navigation a[data-current="true"]');
      assert.equal(await selected.count(), 1, `home@${width}: one selected product link`);
      assert.equal(await selected.getAttribute("href"), "/product");
      assert.equal(await selected.getAttribute("aria-current"), null);
      assert.equal(
        await page.locator('.site-header__navigation a[aria-current="page"]').count(),
        0,
        `home@${width}: no false current page`,
      );
      const underline = () =>
        selected.evaluate((link) => ({
          decoration: getComputedStyle(link).textDecorationLine,
          afterContent: getComputedStyle(link, "::after").content,
        }));
      assert.deepEqual(await underline(), { decoration: "none", afterContent: "none" });
      if (width === 1440) {
        await selected.hover();
        assert.deepEqual(await underline(), { decoration: "none", afterContent: "none" });
      }
    }
    for (const route of width === 1440 || width < 1200 ? routes : ["care", "about"]) {
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
      if (["product", "care", "about"].includes(route)) {
        const currentPage = page.locator(
          '.site-header__navigation a:not(.button)[aria-current="page"]',
        );
        assert.equal(await currentPage.count(), 1, `${route}: one current navigation link`);
        assert.equal(await currentPage.getAttribute("href"), `/${route}`);
      }
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
          const scene = hero.querySelector(".interior-page__hero-scene");
          const photo = scene.getBoundingClientRect();
          const washElement = hero.querySelector(".interior-page__hero-wash");
          const wash = washElement.getBoundingClientRect();
          const waveElement = hero.querySelector(".interior-page__hero-wave");
          const wave = waveElement.getBoundingClientRect();
          const heroRect = hero.getBoundingClientRect();
          return {
            padding: getComputedStyle(hero).paddingTop,
            heroColor: getComputedStyle(hero).backgroundColor,
            canvasColor: getComputedStyle(document.querySelector("#main-content")).backgroundColor,
            heroOverflow: getComputedStyle(hero).overflow,
            heroHeight: heroRect.height,
            heroTop: heroRect.top,
            heroLeft: heroRect.left,
            heroRight: heroRect.right,
            photoX: photo.x,
            photoWidth: photo.width,
            photoHeight: photo.height,
            photoMask: getComputedStyle(scene).maskImage,
            photoObjectPosition: getComputedStyle(scene.querySelector("img")).objectPosition,
            washX: wash.x,
            washWidth: wash.width,
            washHeight: wash.height,
            waveTop: wave.top,
            waveHeight: wave.height,
            waveSrc: waveElement.getAttribute("src"),
            transition: getComputedStyle(scene, "::after").backgroundImage,
            wash: getComputedStyle(washElement).display,
            wave: getComputedStyle(waveElement).display,
          };
        });
        assert.equal(background.padding, "0px", `${route}: no legacy hero padding`);
        if (width >= 1200) {
          const photoHeight = Math.max(720, width * 0.4);
          const heroWidth = background.heroRight - background.heroLeft;
          assert.equal(background.heroColor, "rgba(0, 0, 0, 0)", `${route}: transparent hero`);
          assert.equal(background.canvasColor, "rgb(237, 246, 255)", `${route}: blue canvas`);
          assert.equal(background.heroOverflow, "visible", `${route}: scene crosses section edge`);
          assert(Math.abs(background.heroHeight - (photoHeight - 92)) < 1);
          assert(
            Math.abs(background.photoX - background.heroLeft) < 1 &&
              Math.abs(background.photoWidth - heroWidth) < 1,
            `${route}@${width}: full-width photo`,
          );
          assert(
            Math.abs(background.photoHeight - photoHeight) < 1,
            `${route}@${width}: responsive photo height`,
          );
          assert(
            Math.abs(background.washX - background.heroLeft) < 1 &&
              Math.abs(background.washWidth - heroWidth) < 1 &&
              Math.abs(background.washHeight - photoHeight) < 1,
            `${route}@${width}: full-width horizontal wash`,
          );
          assert(
            background.photoMask === "none" && background.photoObjectPosition === "50% 0%",
            `${route}@${width}: top-aligned full-bleed photo`,
          );
          assert.equal(background.wave, "block", `${route}: desktop wave`);
          assert.equal(background.waveSrc, "/brand/home/wave-desktop.svg");
          assert(Math.abs(background.waveTop - (background.heroTop + photoHeight - 120)) < 1);
          assert.equal(background.waveHeight, 240);
        } else {
          assert.equal(background.heroColor, "rgb(237, 246, 255)", `${route}: blue hero`);
          assert.equal(background.photoMask, "none", `${route}: full narrow photo`);
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
