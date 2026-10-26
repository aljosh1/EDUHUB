import { test, expect } from "@playwright/test";

const USER_A = { email: "user-a@paperstack.test", password: process.env.E2E_USER_A_PASSWORD ?? "paperstack-a" };
const USER_B = { email: "user-b@paperstack.test", password: process.env.E2E_USER_B_PASSWORD ?? "paperstack-b" };

async function signIn(page: import("@playwright/test").Page, creds: { email: string; password: string }) {
  await page.goto("/login");
  await page.fill("#email", creds.email);
  await page.fill("#password", creds.password);
  await page.click("button[type=submit]");
  await page.waitForURL("**/documents");
}

test.describe.serial("Paperstack E2E", () => {
  test("Scenario A: document lifecycle", async ({ page }) => {
    await signIn(page, USER_A);
    await page.click("text=New Document");
    await page.waitForURL("**/documents/*");

    await page.fill('input[aria-label="Document title"]', "E2E Test Doc");
    await page.click(".ProseMirror");
    await page.keyboard.type("Hello world");
    // bold a word
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
    await page.click('button[aria-label="Bold"]');
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.click('button[aria-label="Heading 1"]');
    await page.keyboard.type("Section");
    await page.keyboard.press("Enter");
    await page.click('button[aria-label="Bulleted list"]');
    await page.keyboard.type("Item one");

    await page.waitForSelector("text=Saved", { timeout: 15_000 });
    await page.reload();
    await expect(page.locator('input[aria-label="Document title"]')).toHaveValue("E2E Test Doc");
    await expect(page.locator(".ProseMirror strong")).toHaveText("Hello world");
    await expect(page.locator(".ProseMirror h1")).toHaveText("Section");
    await expect(page.locator(".ProseMirror ul li")).toHaveCount(1);
  });

  test("Scenario B: sharing as editor", async ({ page }) => {
    await signIn(page, USER_A);
    await page.click("text=New Document");
    await page.waitForURL("**/documents/*");
    await page.fill('input[aria-label="Document title"]', "Shared Doc");
    await page.click(".ProseMirror");
    await page.keyboard.type("Shared content");
    await page.waitForSelector("text=Saved", { timeout: 15_000 });

    await page.click("text=Share");
    await page.fill("#share-email", USER_B.email);
    await page.selectOption("#share-permission", "editor");
    await page.click("button:has-text('Share')");
    await page.waitForSelector("text=Document shared");
    await page.click('button[aria-label="Close share dialog"]');

    await page.click("text=Sign out");
    await signIn(page, USER_B);
    await page.click("text=Shared with Me");
    await page.click("text=Shared Doc");
    await page.click(".ProseMirror");
    await page.keyboard.press("Control+a");
    await page.keyboard.type("Edited by user B");
    await page.waitForSelector("text=Saved", { timeout: 15_000 });
    await page.reload();
    await expect(page.locator(".ProseMirror")).toContainText("Edited by user B");
  });

  test("Scenario C: viewer restrictions", async ({ page }) => {
    await signIn(page, USER_A);
    await page.click("text=New Document");
    await page.waitForURL("**/documents/*");
    const url = page.url();
    const docId = url.split("/").pop()!;
    await page.click("text=Share");
    await page.fill("#share-email", USER_B.email);
    await page.selectOption("#share-permission", "viewer");
    await page.click("button:has-text('Share')");
    await page.waitForSelector("text=Document shared");
    await page.click('button[aria-label="Close share dialog"]');
    await page.click("text=Sign out");

    await signIn(page, USER_B);
    await page.click("text=Shared with Me");
    await page.click("text=Untitled document");
    await page.waitForURL("**/documents/*");
    // Editor must be read-only for viewers
    const editable = await page.locator(".ProseMirror").getAttribute("contenteditable");
    expect(editable).toBe("false");
    // Server must reject the update
    const res = await page.request.patch(`/api/documents/${docId}`, {
      data: { title: "Hacked" },
    });
    expect(res.status()).toBe(403);
  });

  test("Scenario D: markdown import", async ({ page }) => {
    await signIn(page, USER_A);
    await page.click("text=Import Document");
    // Attach a markdown file via the file chooser
    const md = "# Imported Heading\n\nParagraph here.\n\n- Item A\n- Item B";
    await page.setInputFiles('input[type="file"]', {
      name: "import-test.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(md, "utf-8"),
    });
    await page.waitForURL("**/documents/*", { timeout: 30_000 });
    await expect(page.locator(".ProseMirror h1")).toHaveText("Imported Heading");
    await expect(page.locator(".ProseMirror ul li")).toHaveCount(2);
  });
});
