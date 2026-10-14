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
      await page.mouse.move(0, 0);
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
      if (route === "articles") {
        const reading = await page.locator(".reading-page").evaluate((section) => {
          const featured = section.querySelector(".reading-page__featured");
          const image = featured.querySelector(":scope > img");
          const spread = section.querySelector(".reading-page__spread");
          const featuredRect = featured.getBoundingClientRect();
          const imageRect = image?.getBoundingClientRect();
          return {
            category: section.dataset.category,
            headingFontSize: getComputedStyle(section.querySelector("h1")).fontSize,
            headingLineHeight: getComputedStyle(section.querySelector("h1")).lineHeight,
            featuredWidth: featuredRect.width,
            featuredGrid: getComputedStyle(featured).gridTemplateColumns,
            featuredImageWidth: imageRect?.width,
            featuredImageHeight: imageRect?.height,
            featuredImageSrc: image?.getAttribute("src"),
            featuredHref: featured.querySelector(".reading-page__link")?.getAttribute("href"),
            storyGrid: spread && getComputedStyle(spread).gridTemplateColumns,
            storySlots: Array.from(section.querySelectorAll(".reading-page__story")).map(
              (story) => ({
                href: story.querySelector(".reading-page__link")?.getAttribute("href"),
                image: story.querySelector("img")?.getAttribute("src"),
              }),
            ),
            currentCategories: Array.from(
              section.querySelectorAll('.reading-page__categories a[aria-current="true"]'),
            ).map((link) => link.getAttribute("href")),
          };
        });
        const storySlots = new Map(reading.storySlots.map((story) => [story.href, story.image]));
        assert.equal(reading.category, "all");
        assert.equal(reading.featuredHref, "/articles/morning-rhythm");
        assert.equal(reading.featuredImageSrc, "/brand/home/home.png");
        assert.equal(reading.currentCategories.length, 1);
        assert.deepEqual(reading.currentCategories, ["/articles"]);
        assert.equal(
          storySlots.get("/articles/before-leaving-note"),
          "/brand/home/care-record.png",
        );
        assert.equal(storySlots.get("/articles/after-the-walk"), "/brand/home/walk.png");
        assert(reading.storyGrid, `${route}@${width}: story continuation`);
        assert.equal(reading.storyGrid.trim().split(/\s+/u).length, width <= 729 ? 1 : 2);
        if (width >= 1200) {
          assert(Math.abs(reading.featuredWidth - 1200) < 1);
          assert(Math.abs(reading.featuredImageWidth - reading.featuredWidth * 0.64) < 1);
          assert.equal(reading.featuredImageHeight, 464);
          assert.equal(reading.headingFontSize, "40px");
          assert.equal(reading.headingLineHeight, "52px");
        } else if (width <= 729) {
          assert(Math.abs(reading.featuredImageWidth - reading.featuredWidth) < 1);
          assert(Math.abs(reading.featuredImageWidth / reading.featuredImageHeight - 1.5) < 0.01);
          assert.equal(reading.headingFontSize, "34px");
          assert.equal(reading.headingLineHeight, "44px");
          if (width === 390) {
            assert.equal(reading.featuredImageWidth, 342);
            assert.equal(reading.featuredImageHeight, 228);
          }
        } else {
          assert.equal(reading.featuredImageHeight, 400);
          assert.equal(reading.featuredGrid.trim().split(/\s+/u).length, 1);
        }
        if (width === 1440) {
          for (const href of [
            "/articles",
            "/articles?category=companionship",
            "/articles?category=preparation",
          ]) {
            assert.equal(
              await page.locator(`.reading-page__categories a[href="${href}"]`).count(),
              1,
              `reading category link ${href}`,
            );
          }
          await page
            .locator('.reading-page__categories a[href="/articles?category=companionship"]')
            .click();
          assert.equal(
            await page.locator(".reading-page").getAttribute("data-category"),
            "companionship",
          );
          assert.equal(
            await page
              .locator('.reading-page__categories a[aria-current="true"]')
              .getAttribute("href"),
            "/articles?category=companionship",
          );
          assert.equal(
            await page
              .locator(
                '.reading-page__featured .reading-page__link[href="/articles/morning-rhythm"]',
              )
              .count(),
            1,
          );
          assert.equal(
            await page.locator('.reading-page__featured img[src="/brand/home/home.png"]').count(),
            1,
          );
          assert.equal(
            await page
              .locator('.reading-page__story .reading-page__link[href="/articles/after-the-walk"]')
              .count(),
            1,
          );
          await page
            .locator('.reading-page__categories a[href="/articles?category=preparation"]')
            .click();
          assert.equal(
            await page.locator(".reading-page").getAttribute("data-category"),
            "preparation",
          );
          assert.equal(
            await page
              .locator('.reading-page__categories a[aria-current="true"]')
              .getAttribute("href"),
            "/articles?category=preparation",
          );
          assert.equal(
            await page
              .locator(
                '.reading-page__featured .reading-page__link[href="/articles/before-leaving-note"]',
              )
              .count(),
            1,
          );
          assert.equal(
            await page
              .locator('.reading-page__featured img[src="/brand/home/care-record.png"]')
              .count(),
            1,
          );
          assert.equal(await page.locator(".reading-page__continuation").count(), 0);
          await page.locator('.reading-page__categories a[href="/articles"]').click();
          assert.equal(await page.locator(".reading-page").getAttribute("data-category"), "all");
          assert.equal(
            await page
              .locator('.reading-page__categories a[aria-current="true"]')
              .getAttribute("href"),
            "/articles",
          );
        }
      }
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
      if (route === "help" && [1440, 768, 390].includes(width)) {
        const layout = await page.locator(".help-center--task").evaluate((main) => {
          const rect = (element) => {
            const { x, y, width, height, right, bottom } = element.getBoundingClientRect();
            return { x, y, width, height, right, bottom };
          };
          const openingCopy = main.querySelector(".help-center__opening-copy");
          const heroPhoto = main.querySelector(".help-center__hero-photo");
          const heroImage = heroPhoto.querySelector("img");
          const search = main.querySelector(".help-center__search");
          const searchInput = main.querySelector("[data-help-search]");
          const clear = main.querySelector("[data-help-clear]");
          const submit = main.querySelector(".help-center__search-submit");
          const submitImage = main.querySelector(".help-center__search-submit img");
          const answers = main.querySelector(".help-center__answers-layout");
          const card = main.querySelector(".help-center__faq-card");
          const faqList = main.querySelector(".help-center__faq-list--task");
          const sidebar = main.querySelector(".help-center__sidebar");
          const sidebarImage = main.querySelector(".help-center__sidebar-photo");
          return {
            searchHeight: rect(search).height,
            searchMinHeight: getComputedStyle(search).minHeight,
            searchInputPaddingRight: getComputedStyle(searchInput).paddingRight,
            clearPosition: getComputedStyle(clear).position,
            clearRight: getComputedStyle(clear).right,
            submit: rect(submit),
            submitImageSrc: submitImage.getAttribute("src"),
            submitImageWidth: rect(submitImage).width,
            submitImageHeight: rect(submitImage).height,
            heroDisplay: getComputedStyle(heroPhoto).display,
            heroImage: rect(heroImage),
            heroImageSrc: heroImage.getAttribute("src"),
            openingCopy: rect(openingCopy),
            answersColumns: getComputedStyle(answers).gridTemplateColumns,
            cardColor: getComputedStyle(card).backgroundColor,
            faqListBorderTopWidth: getComputedStyle(faqList).borderTopWidth,
            sidebar: rect(sidebar),
            sidebarImageDisplay: getComputedStyle(sidebarImage).display,
            sidebarImage: rect(sidebarImage),
            sidebarImageSrc: sidebarImage.getAttribute("src"),
          };
        });
        assert.equal(await page.locator("[data-help-category]").count(), 3);
        assert.equal(layout.searchHeight, 62, `help@${width}: search height`);
        assert.equal(layout.searchMinHeight, "62px");
        assert.equal(layout.searchInputPaddingRight, "44px");
        assert.equal(layout.clearPosition, "absolute");
        assert.equal(layout.clearRight, "62px");
        assert.equal(layout.submit.width, 44);
        assert.equal(layout.submit.height, 44);
        assert.equal(layout.submitImageSrc, "/brand/help/search.svg");
        assert.equal(layout.submitImageWidth, 24);
        assert.equal(layout.submitImageHeight, 24);
        assert.equal(layout.cardColor, "rgb(255, 255, 255)");
        assert.equal(layout.faqListBorderTopWidth, "0px");
        if (width === 1440) {
          assert.equal(layout.heroDisplay, "flex");
          assert.equal(layout.heroImageSrc, "/brand/home/home.png");
          assert.equal(layout.heroImage.width, 384);
          assert.equal(layout.heroImage.height, 216);
          assert(Math.abs(layout.heroImage.x - layout.openingCopy.right - 48) < 1);
          assert.equal(layout.answersColumns.trim().split(/\s+/u).length, 2);
        } else {
          assert.equal(layout.heroDisplay, "none");
          assert.equal(layout.sidebarImageDisplay, width === 390 ? "block" : "none");
          assert.equal(layout.answersColumns.trim().split(/\s+/u).length, 1);
          if (width === 390) {
            assert.equal(layout.sidebarImageSrc, "/brand/home/home.png");
            assert.equal(layout.sidebarImage.width, 342);
            assert.equal(layout.sidebarImage.height, 192);
            assert(Math.abs(layout.sidebarImage.y - layout.sidebar.y) < 1);
          }
        }
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
  for (const [slug, cover] of [
    ["morning-rhythm", "/brand/home/home.png"],
    ["before-leaving-note", "/brand/home/care-record.png"],
    ["after-the-walk", "/brand/home/walk.png"],
  ]) {
    const response = await page.goto(new URL(`/articles/${slug}`, origin).toString(), {
      waitUntil: "domcontentloaded",
    });
    assert.equal(response.status(), 200, `${slug}: article detail`);
    assert.equal(
      await page.locator(".article-detail--reading").count(),
      1,
      `${slug}: reading detail`,
    );
    assert.equal(await page.locator(".article-detail__cover").getAttribute("src"), cover);
    const paragraphs = await page.locator(".article-detail__body section p").allTextContents();
    assert.equal(paragraphs.length, 4, `${slug}: four article sections`);
    assert(
      paragraphs.every((paragraph) => paragraph.trim().length > 40),
      `${slug}: readable content`,
    );
  }

  const helpResponse = await page.goto(new URL("help", origin).toString(), {
    waitUntil: "domcontentloaded",
  });
  assert.equal(helpResponse.status(), 200, "Help center landing page");
  const search = page.locator("[data-help-search]");
  const items = page.locator("[data-help-item]");
  const visibleItems = page.locator("[data-help-item]:visible");
  const categories = page.locator("[data-help-category]");
  const firstSummary = items.first().locator("summary");
  assert.equal(await items.count(), 8, "Help landing questions");
  assert.equal(await categories.count(), 3, "Help categories");
  assert.equal(
    await items.first().locator("details[open]").count(),
    0,
    "First answer starts collapsed",
  );
  assert.equal(await firstSummary.locator("img").count(), 2);
  assert.deepEqual(
    await firstSummary
      .locator("img")
      .evaluateAll((images) => images.map((image) => image.getAttribute("src"))),
    ["/brand/help/plus.svg", "/brand/help/minus.svg"],
  );
  assert.deepEqual(
    await firstSummary
      .locator("img")
      .evaluateAll((images) => images.map((image) => getComputedStyle(image).display)),
    ["block", "none"],
  );
  assert.equal(await firstSummary.locator("img:visible").count(), 1);
  assert.equal(
    await firstSummary.evaluate((summary) => getComputedStyle(summary, "::after").content),
    "none",
  );
  const directQuestions = page.locator("[data-help-item] .help-center__question-link");
  assert.equal(await directQuestions.count(), 7);
  assert(
    await directQuestions.evaluateAll((links) =>
      links.every((link) => link.getAttribute("href")?.startsWith("/help/")),
    ),
    "Remaining questions link to full guides",
  );
  await firstSummary.press("Enter");
  assert.equal(await items.first().locator("details[open]").count(), 1);
  assert.deepEqual(
    await firstSummary
      .locator("img")
      .evaluateAll((images) => images.map((image) => getComputedStyle(image).display)),
    ["none", "block"],
  );
  assert.equal(await firstSummary.locator("img:visible").count(), 1);
  assert.equal(
    await firstSummary.evaluate((summary) => getComputedStyle(summary, "::after").content),
    "none",
  );
  await firstSummary.press("Enter");
  assert.equal(await items.first().locator("details[open]").count(), 0);

  for (const [category, count] of [
    ["all", 8],
    ["care", 4],
    ["rules", 3],
    ["all", 8],
  ]) {
    const button = page.locator(`[data-help-category="${category}"]`);
    if (category === "care") {
      await button.focus();
      await button.press("Enter");
      assert(await button.evaluate((element) => element === document.activeElement));
    } else {
      await button.click();
    }
    assert.equal(await button.getAttribute("aria-pressed"), "true");
    assert.equal(await visibleItems.count(), count, `${category}: visible questions`);
  }

  await search.fill("档案");
  assert((await visibleItems.count()) > 0, "Help search filters as text changes");
  assert(await search.evaluate((input) => input === document.activeElement));
  await search.press("Enter");
  const firstMatch = page
    .locator(
      "[data-help-item]:not([hidden]) summary, [data-help-item]:not([hidden]) .help-center__question-link",
    )
    .first();
  assert(await firstMatch.evaluate((element) => element === document.activeElement));
  await page.locator('[data-help-category="rules"]').click();
  assert.equal(
    await page.locator('[data-help-category="rules"]').getAttribute("aria-pressed"),
    "true",
  );
  await search.fill("没有这个问题123456");
  assert.equal(await visibleItems.count(), 0);
  await page.locator("[data-help-empty]").waitFor({ state: "visible" });
  const clear = page.locator("[data-help-clear]");
  assert(await clear.isVisible());
  await clear.focus();
  assert(await clear.evaluate((button) => button === document.activeElement));
  await clear.press("Enter");
  assert.equal(await search.inputValue(), "");
  assert(await search.evaluate((input) => input === document.activeElement));
  assert.equal(
    await page.locator('[data-help-category="all"]').getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(await visibleItems.count(), 8, "Clearing search restores all questions");
  assert.equal(await page.locator("[data-help-empty]:visible").count(), 0);
  const detailHref = await page
    .locator("[data-help-item] .help-center__question-link")
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
