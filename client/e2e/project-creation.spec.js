import { expect, test } from "@playwright/test";

const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

test("a new user can create a project, milestone, and linked task", async ({ page }) => {
    const uniqueId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const email = `browser-${uniqueId}@flowforge.local`;
    const projectName = `Browser Journey ${uniqueId}`;

    await page.goto("/register");
    await page.getByLabel("Name").fill("Browser Journey User");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("BrowserJourneyPassword123");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/app$/);
    await page.getByRole("link", { name: "Projects" }).click();
    await expect(page.getByRole("heading", { name: "Your projects" })).toBeVisible();
    await page.getByRole("button", { name: "Create project" }).click();

    await expect(page.getByRole("heading", { name: "Create project" })).toBeVisible();
    await page.getByLabel("Project name").fill(projectName);
    await page.getByLabel("Description (optional)").fill("Created in the browser journey test.");

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 21);
    await page.getByLabel("Target date (optional)").fill(formatLocalDate(targetDate));
    await page.getByRole("button", { name: "Create project" }).click();

    await expect(page).toHaveURL(/\/app\/projects\/[a-f\d]{24}$/i);
    await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
    await expect(page.getByText("Created in the browser journey test.")).toBeVisible();

    const milestoneName = `Beta milestone ${uniqueId}`;
    await page.getByRole("button", { name: "Create milestone" }).click();
    await expect(page.getByRole("heading", { name: "Create milestone" })).toBeVisible();
    await page.getByLabel("Milestone name").fill(milestoneName);
    await page.getByLabel("Description (optional)").fill("Browser journey milestone.");
    const milestoneDate = new Date();
    milestoneDate.setDate(milestoneDate.getDate() + 14);
    await page.getByLabel("Due date").fill(formatLocalDate(milestoneDate));
    await page.getByRole("button", { name: "Create milestone" }).click();
    await expect(page).toHaveURL(/\/app\/projects\/[a-f\d]{24}$/i);
    await expect(page.getByRole("heading", { name: milestoneName })).toBeVisible();

    const taskName = `Milestone task ${uniqueId}`;
    const projectId = page.url().match(/projects\/([a-f\d]{24})/i)?.[1];
    await page.goto(`/app/projects/${projectId}/tasks/new`);
    await page.getByLabel("Title").fill(taskName);
    await page.getByLabel("Milestone", { exact: true }).selectOption({ label: milestoneName });
    await page.getByRole("button", { name: "Create task" }).click();
    await expect(page).toHaveURL(`/app/projects/${projectId}/tasks`);
    await page.getByRole("link", { name: taskName }).click();
    await expect(
        page.locator("p").filter({ hasText: `Milestone: ${milestoneName}` })
    ).toBeVisible();
});
