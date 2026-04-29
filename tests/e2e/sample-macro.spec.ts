import { expect, test } from "@playwright/test";

test("sample macro loads into the file list and editor", async ({ page }) => {
  await page.goto("/");

  const sampleFileItem = page.locator(".file-item").filter({
    has: page.locator(".file-name", { hasText: "sample-roomos-macro" }),
  });

  await expect(sampleFileItem).toHaveCount(1);
  await expect(sampleFileItem).toHaveClass(/active/);

  const editor = page.locator("#code-editor");
  await expect(editor.getByText("import xapi from 'xapi';")).toBeVisible();
  await expect(editor.getByText("xapi.Command.UserInterface.Message.Alert.Display({")).toBeVisible();
});

test("navigator footer shows the app major version", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator(".navigator-footer")).toContainText("RoomOS Macro Simulator v1");
  await expect(page.locator(".navigator-footer .momentum-icon")).toBeVisible();
});

test("topbar menu button toggles the macro files panel and resizer", async ({ page }) => {
  await page.goto("/");

  const toggleButton = page.locator("#macro-sidebar-toggle-button");
  const filesPanel = page.locator("#files-panel");
  const filesEditorResizer = page.locator("#files-editor-resizer");

  await expect(toggleButton.locator(".momentum-icon")).toBeVisible();
  await expect(toggleButton).toHaveAttribute("aria-pressed", "true");
  await expect(filesPanel).toBeVisible();
  await expect(filesEditorResizer).toBeVisible();

  await toggleButton.click();
  await expect(toggleButton).toHaveAttribute("aria-pressed", "false");
  await expect(filesPanel).toBeHidden();
  await expect(filesEditorResizer).toBeHidden();

  await toggleButton.click();
  await expect(toggleButton).toHaveAttribute("aria-pressed", "true");
  await expect(filesPanel).toBeVisible();
  await expect(filesEditorResizer).toBeVisible();
});

test("clean macro rows do not reserve save button space, but dirty macros can be saved", async ({ page }) => {
  await page.goto("/");

  const sampleFileItem = page.locator(".file-item").filter({
    has: page.locator(".file-name", { hasText: "sample-roomos-macro" }),
  });

  await expect(page.locator(".file-save-spacer")).toHaveCount(0);
  await expect(sampleFileItem.locator(".file-save-button")).toHaveCount(0);

  await page.getByRole("textbox", { name: "Editor content" }).focus();
  await page.keyboard.type(" // dirty");

  await expect(sampleFileItem.locator(".file-save-button")).toBeVisible();
});

test("osd native calling buttons use local brand icons", async ({ page }) => {
  await page.goto("/");

  const expectedBrandButtons = [
    ["native-webex", "Webex"],
    ["native-zoom", "Zoom"],
    ["native-microsoft-teams", "Microsoft Teams"],
    ["native-google-meet", "Google Meet"],
  ];

  for (const [actionId, label] of expectedBrandButtons) {
    const tile = page.locator(".osd-action-tile").filter({
      has: page.locator(`[data-osd-action="${actionId}"]`),
    });

    await expect(tile.locator(".osd-action-label")).toHaveText(label);
    await expect(tile.locator(`img[data-brand-icon="${label}"]`)).toBeVisible();
  }
});

test("device action buttons and edge handles share the same control surface style", async ({ page }) => {
  await page.goto("/");

  const controlStyles = await page.evaluate(() => {
    const readControlStyle = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) {
        return null;
      }

      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        borderTopColor: style.borderTopColor,
        opacity: style.opacity,
      };
    };

    return {
      osdAction: readControlStyle(".osd-action-button"),
      osdEdge: readControlStyle(".osd-edge-handle"),
      controllerAction: readControlStyle(".controller-action-button"),
      controllerEdge: readControlStyle(".controller-edge-handle"),
    };
  });

  expect(controlStyles.osdEdge).toEqual(controlStyles.osdAction);
  expect(controlStyles.controllerAction).toEqual(controlStyles.osdAction);
  expect(controlStyles.controllerEdge).toEqual(controlStyles.osdAction);
});

test("device alerts use OSD toast and controller modal presentations", async ({ page }) => {
  await page.goto("/");

  await page.evaluate(() => {
    document.querySelector("[data-alert-layer]")?.classList.remove("hidden");
    document.querySelector("[data-controller-alert-layer]")?.classList.remove("hidden");
  });

  const osdAlertLayer = page.locator("[data-alert-layer]");
  const osdAlertCard = page.locator(".osd-alert-card");
  const controllerAlertLayer = page.locator("[data-controller-alert-layer]");
  const controllerAlertCard = page.locator(".controller-alert-card");

  await expect(osdAlertLayer).toBeVisible();
  await expect(osdAlertCard.locator(".osd-alert-icon .momentum-icon")).toBeVisible();
  await expect(osdAlertCard).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(osdAlertCard).toHaveCSS("color", "rgb(15, 15, 15)");
  await expect(controllerAlertLayer).toBeVisible();
  await expect(controllerAlertCard).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await expect(controllerAlertCard).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(controllerAlertCard.getByRole("button", { name: "Dismiss" })).toBeVisible();

  const positions = await page.evaluate(() => {
    const osdLayer = document.querySelector("[data-alert-layer]");
    const osdStage = document.querySelector(".osd-stage");
    const controllerLayer = document.querySelector("[data-controller-alert-layer]");
    const controllerStage = document.querySelector(".controller-stage");

    if (!osdLayer || !osdStage || !controllerLayer || !controllerStage) {
      return null;
    }

    const osdLayerRect = osdLayer.getBoundingClientRect();
    const osdStageRect = osdStage.getBoundingClientRect();
    const controllerLayerRect = controllerLayer.getBoundingClientRect();
    const controllerStageRect = controllerStage.getBoundingClientRect();
    const osdLayerCenterX = osdLayerRect.left + osdLayerRect.width / 2;
    const osdStageCenterX = osdStageRect.left + osdStageRect.width / 2;
    const controllerOverlayTolerance = 2;

    return {
      osdIsTopRight:
        osdLayerRect.top < osdStageRect.top + osdStageRect.height * 0.35 &&
        osdLayerCenterX > osdStageCenterX &&
        osdLayerRect.right <= osdStageRect.right &&
        osdLayerRect.right > osdStageRect.right - osdStageRect.width * 0.12,
      controllerCoversStage:
        Math.abs(controllerLayerRect.top - controllerStageRect.top) <= controllerOverlayTolerance &&
        Math.abs(controllerLayerRect.left - controllerStageRect.left) <= controllerOverlayTolerance &&
        Math.abs(controllerLayerRect.right - controllerStageRect.right) <= controllerOverlayTolerance &&
        Math.abs(controllerLayerRect.bottom - controllerStageRect.bottom) <= controllerOverlayTolerance,
    };
  });

  expect(positions).toEqual({
    osdIsTopRight: true,
    controllerCoversStage: true,
  });
});

test("theme selector defaults to system and switches the app and editor themes", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");

  const root = page.locator("html");
  const themeSelect = page.locator("#theme-select-button");
  const themeLabel = page.locator("#theme-select-label");
  const monacoEditor = page.locator("#code-editor .monaco-editor");
  const chooseTheme = async (theme: "system" | "light" | "dark") => {
    await themeSelect.click();
    const option = page.locator(`[data-theme-choice="${theme}"]`);
    await expect(option.locator(".momentum-icon")).toBeVisible();
    await option.click();
  };
  const getDeviceWallpaperImages = () =>
    page.evaluate(() => {
      const osdStage = document.querySelector(".osd-stage");
      const controllerStage = document.querySelector(".controller-stage");

      return {
        osd: osdStage ? getComputedStyle(osdStage).backgroundImage : "",
        controller: controllerStage ? getComputedStyle(controllerStage, "::before").backgroundImage : "",
      };
    });
  const getChromeBackgrounds = () =>
    page.evaluate(() => {
      const topbar = document.querySelector(".topbar");
      const filesPanel = document.querySelector(".files-panel");
      const fileList = document.querySelector(".file-list");

      return {
        topbar: topbar ? getComputedStyle(topbar).backgroundColor : "",
        filesPanel: filesPanel ? getComputedStyle(filesPanel).backgroundColor : "",
        fileList: fileList ? getComputedStyle(fileList).backgroundColor : "",
      };
    });
  const getDeviceTextColors = () =>
    page.evaluate(() => {
      const osdWorkspaceName = document.querySelector(".osd-workspace-name");
      const osdActionLabel = document.querySelector(".osd-action-label");
      const controllerTime = document.querySelector(".controller-time");
      const controllerActionLabel = document.querySelector(".controller-action-label");

      return {
        osdWorkspaceName: osdWorkspaceName ? getComputedStyle(osdWorkspaceName).color : "",
        osdActionLabel: osdActionLabel ? getComputedStyle(osdActionLabel).color : "",
        controllerTime: controllerTime ? getComputedStyle(controllerTime).color : "",
        controllerActionLabel: controllerActionLabel ? getComputedStyle(controllerActionLabel).color : "",
      };
    });

  await expect(root).toHaveAttribute("data-theme-preference", "system");
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(root).toHaveClass(/mds-theme-stable-darkWebex/);
  await expect(themeLabel).toHaveText("System");
  await expect(page.locator("#theme-select-current-icon .momentum-icon")).toBeVisible();
  await expect(monacoEditor).toHaveClass(/vs-dark/);
  await expect.poll(getChromeBackgrounds).toEqual({
    topbar: "rgb(26, 26, 26)",
    filesPanel: "rgb(26, 26, 26)",
    fileList: "rgb(26, 26, 26)",
  });
  const systemWallpaperImages = await getDeviceWallpaperImages();
  expect(systemWallpaperImages.osd).toContain("eveningfjord");
  expect(systemWallpaperImages.controller).toContain("eveningfjord");
  await expect.poll(getDeviceTextColors).toEqual({
    osdWorkspaceName: "rgb(255, 255, 255)",
    osdActionLabel: "rgb(255, 255, 255)",
    controllerTime: "rgb(255, 255, 255)",
    controllerActionLabel: "rgb(255, 255, 255)",
  });

  await chooseTheme("light");
  await expect(root).toHaveAttribute("data-theme-preference", "light");
  await expect(root).toHaveAttribute("data-theme", "light");
  await expect(root).toHaveClass(/mds-theme-stable-lightWebex/);
  await expect(themeLabel).toHaveText("Light");
  await expect(monacoEditor).toHaveClass(/(^| )vs( |$)/);
  await expect.poll(getChromeBackgrounds).toEqual({
    topbar: "rgb(255, 255, 255)",
    filesPanel: "rgb(255, 255, 255)",
    fileList: "rgb(255, 255, 255)",
  });
  const lightWallpaperImages = await getDeviceWallpaperImages();
  expect(lightWallpaperImages.osd).toContain("firstlight");
  expect(lightWallpaperImages.controller).toContain("firstlight");
  await expect.poll(getDeviceTextColors).toEqual({
    osdWorkspaceName: "rgb(0, 0, 0)",
    osdActionLabel: "rgb(0, 0, 0)",
    controllerTime: "rgb(0, 0, 0)",
    controllerActionLabel: "rgb(0, 0, 0)",
  });

  await chooseTheme("dark");
  await expect(root).toHaveAttribute("data-theme-preference", "dark");
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(root).toHaveClass(/mds-theme-stable-darkWebex/);
  await expect(themeLabel).toHaveText("Dark");
  await expect(monacoEditor).toHaveClass(/vs-dark/);
  const darkWallpaperImages = await getDeviceWallpaperImages();
  expect(darkWallpaperImages.osd).toContain("eveningfjord");
  expect(darkWallpaperImages.controller).toContain("eveningfjord");
  await expect.poll(getDeviceTextColors).toEqual({
    osdWorkspaceName: "rgb(255, 255, 255)",
    osdActionLabel: "rgb(255, 255, 255)",
    controllerTime: "rgb(255, 255, 255)",
    controllerActionLabel: "rgb(255, 255, 255)",
  });

  await chooseTheme("system");
  await expect(root).toHaveAttribute("data-theme-preference", "system");
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(root).toHaveClass(/mds-theme-stable-darkWebex/);
  await expect(themeLabel).toHaveText("System");
  const restoredSystemWallpaperImages = await getDeviceWallpaperImages();
  expect(restoredSystemWallpaperImages.osd).toContain("eveningfjord");
  expect(restoredSystemWallpaperImages.controller).toContain("eveningfjord");
});
