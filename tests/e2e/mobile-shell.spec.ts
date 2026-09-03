import { expect, test } from "@playwright/test";

const mobileProjects = [
  "webkit-iphone-13-pro-max-portrait",
  "webkit-iphone-13-pro-max-landscape",
] as const;

test.beforeEach(async ({ page }, testInfo) => {
  expect(mobileProjects).toContain(
    testInfo.project.name as (typeof mobileProjects)[number],
  );
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Tu dinero, con calma." }),
  ).toBeVisible();
});

test("keeps the mobile shell within the viewport with accessible primary targets", async ({
  page,
}) => {
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );

  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth - window.innerWidth,
    document: document.documentElement.scrollWidth - window.innerWidth,
  }));
  expect(overflow.body).toBeLessThanOrEqual(0);
  expect(overflow.document).toBeLessThanOrEqual(0);

  const bottomNav = page.locator(".bottom-nav");
  await expect(bottomNav).toBeVisible();
  const targetBoxes = await bottomNav.locator("a, button").evaluateAll((elements) =>
    elements
      .filter((element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && box.width > 0;
      })
      .map((element) => {
        const box = element.getBoundingClientRect();
        return {
          label: element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "",
          x: box.x,
          right: box.right,
          width: box.width,
          height: box.height,
        };
      })
      .sort((left, right) => left.x - right.x),
  );

  expect(targetBoxes).toHaveLength(5);
  for (const target of targetBoxes) {
    expect(target.width, `${target.label} target width`).toBeGreaterThanOrEqual(44);
    expect(target.height, `${target.label} target height`).toBeGreaterThanOrEqual(44);
  }
  for (let index = 1; index < targetBoxes.length; index += 1) {
    const horizontalGap = Number(
      (targetBoxes[index].x - targetBoxes[index - 1].right).toFixed(2),
    );
    expect(horizontalGap, `gap before ${targetBoxes[index].label}`).toBeGreaterThanOrEqual(
      8,
    );
  }

  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    "content",
    /width=device-width.*initial-scale=1.*viewport-fit=cover/,
  );
  const navSafeArea = await bottomNav.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      bottom: box.bottom,
      paddingBottom: Number.parseFloat(getComputedStyle(element).paddingBottom),
      viewportHeight: window.innerHeight,
    };
  });
  expect(navSafeArea.paddingBottom).toBeGreaterThanOrEqual(6);
  expect(Math.abs(navSafeArea.viewportHeight - navSafeArea.bottom)).toBeLessThanOrEqual(1);
});

test("traps dialog focus and restores the exact mobile invoker on Escape", async ({
  page,
}) => {
  const bottomNav = page.locator(".bottom-nav");
  const invokingButton = bottomNav.getByRole("button", {
    name: "Añadir transacción",
  });

  await invokingButton.click();
  await expect(page.getByRole("dialog", { name: "Nueva transacción" })).toBeVisible();

  const amountInput = page.getByLabel("Monto");
  const closeButton = page.getByRole("button", { name: "Cerrar" });
  await expect(amountInput).toBeFocused();
  const inputFontSize = await amountInput.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
  expect(inputFontSize).toBeGreaterThanOrEqual(16);

  const sheetSafeAreaPadding = await page.locator(".quick-add-sheet").evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).paddingBottom),
  );
  expect(sheetSafeAreaPadding).toBeGreaterThanOrEqual(24);

  await page.keyboard.press("Tab");
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(amountInput).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Nueva transacción" })).toBeHidden();
  await expect(invokingButton).toBeFocused();
});

test("reduces computed transition and animation behavior", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });

  const motion = await page.locator(".bottom-nav .nav-link").first().evaluate((element) => {
    const style = getComputedStyle(element);
    const toMilliseconds = (value: string) =>
      Math.max(
        ...value.split(",").map((duration) => {
          const normalized = duration.trim();
          return normalized.endsWith("ms")
            ? Number.parseFloat(normalized)
            : Number.parseFloat(normalized) * 1_000;
        }),
      );

    return {
      animationDuration: toMilliseconds(style.animationDuration),
      animationIterationCount: style.animationIterationCount,
      transitionDuration: toMilliseconds(style.transitionDuration),
    };
  });

  expect(motion.transitionDuration).toBeLessThanOrEqual(0.01);
  expect(motion.animationDuration).toBeLessThanOrEqual(0.01);
  expect(motion.animationIterationCount).toBe("1");
});
