const { test, expect } = require("@playwright/test");

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
