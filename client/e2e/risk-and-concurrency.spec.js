import { expect, test } from "@playwright/test";

const apiPort = process.env.E2E_API_PORT ?? "5500";
const apiUrl = `http://127.0.0.1:${apiPort}/api/v1`;

const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const registerUser = async (page, uniqueId) => {
    const userName = `Browser User ${uniqueId}`;

    await page.goto("/register");
    await page.getByLabel("Name").fill(userName);
    await page.getByLabel("Email").fill(`browser-${uniqueId}@flowforge.local`);
    await page.getByLabel("Password").fill("BrowserJourneyPassword123");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/app$/);

    return userName;
};

const createProjectAndTask = async (
    page,
    { uniqueId, taskTitle, dueDate, assigneeName }
) => {
    const projectName = `Execution Review ${uniqueId}`;

    await page.getByRole("link", { name: "Projects" }).click();
    await expect(page.getByRole("heading", { name: "Your projects" })).toBeVisible();
    await page.getByRole("button", { name: "Create project" }).click();
    await page.getByLabel("Project name").fill(projectName);
    await page.getByLabel("Description (optional)").fill("Created for browser regression coverage.");

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 30);
    await page.getByLabel("Target date (optional)").fill(formatLocalDate(targetDate));
    await page.getByRole("button", { name: "Create project" }).click();

    await expect(page).toHaveURL(/\/app\/projects\/[a-f\d]{24}$/i);
    await expect(page.getByRole("heading", { name: projectName })).toBeVisible();

    const projectId = page.url().match(/projects\/([a-f\d]{24})/i)?.[1];
    await page.goto(`/app/projects/${projectId}/tasks/new`);
    await expect(page.getByRole("heading", { name: "Create Task" })).toBeVisible();
    await page.getByLabel("Title").fill(taskTitle);
    if (assigneeName) {
        await page.getByLabel("Assignee").selectOption({
            label: assigneeName
        });
    }

    if (dueDate) {
        await page.getByLabel("Due date").fill(dueDate);
    }

    await page.getByRole("button", { name: "Create task" }).click();
    await expect(page).toHaveURL(`/app/projects/${projectId}/tasks`);
    await page.getByRole("link", { name: taskTitle }).click();

    const taskId = page.url().match(/tasks\/([a-f\d]{24})/i)?.[1];

    return { projectId, taskId, projectName };
};

test("risk dashboard explains an overdue task and opens it from the suggested action", async ({ page }) => {
    const uniqueId = `1794503031976-${Math.random().toString(16).slice(2)}`;
    const userName = await registerUser(page, uniqueId);
    const overdueDate = new Date();
    overdueDate.setDate(overdueDate.getDate() - 2);

    const { projectId, taskId } = await createProjectAndTask(page, {
        uniqueId,
        taskTitle: `Overdue risk task ${uniqueId}`,
        dueDate: formatLocalDate(overdueDate),
        assigneeName: userName
    });

    await page.goto(`/app/projects/${projectId}`);

    const riskCard = page.getByRole("region", {
        name: "Priority execution insight"
    });

    await expect(riskCard).toBeVisible();
    await expect(riskCard).toContainText("Task Overdue");
    await expect(riskCard).toContainText("HIGH");
    await expect(riskCard).toContainText("day");
    await expect(riskCard).toContainText("Suggested next step");
    await expect(riskCard).toContainText("recovery date");
    await riskCard.getByRole("link", { name: "Open task" }).click();
    await expect(page).toHaveURL(`/app/tasks/${taskId}`);
    await expect(page.getByRole("heading", {
        name: `Overdue risk task ${uniqueId}`
    })).toBeVisible();
});

test("a stale browser edit is rejected and cannot overwrite the saved task version", async ({ page }) => {
    const uniqueId = `1794503031978-${Math.random().toString(16).slice(2)}`;
    const userName = await registerUser(page, uniqueId);
    const taskTitle = `Concurrent task ${uniqueId}`;
    const { taskId } = await createProjectAndTask(page, {
        uniqueId,
        taskTitle,
        assigneeName: userName
    });

    const stalePage = await page.context().newPage();
    const editUrl = `/app/tasks/${taskId}/edit`;

    await Promise.all([
        page.goto(editUrl),
        stalePage.goto(editUrl)
    ]);

    await Promise.all([
        expect(page.getByLabel("Title")).toHaveValue(taskTitle),
        expect(stalePage.getByLabel("Title")).toHaveValue(taskTitle)
    ]);

    await page.getByLabel("Title").fill(`Accepted edit ${uniqueId}`);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(`/app/tasks/${taskId}`);

    await stalePage.getByLabel("Title").fill(`Stale overwrite ${uniqueId}`);
    await stalePage.getByRole("button", { name: "Save changes" }).click();
    await expect(stalePage.getByText(
        "This task was modified by another user. Reload the task and review the latest changes before editing it again."
    )).toBeVisible();

    const token = await page.evaluate(() =>
        localStorage.getItem("flowforge_token")
    );
    const latestTask = await page.request.get(
        `${apiUrl}/tasks/${taskId}`,
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );
    const responseBody = await latestTask.json();

    expect(latestTask.ok()).toBe(true);
    expect(responseBody.data.task.title).toBe(`Accepted edit ${uniqueId}`);
    expect(responseBody.data.task.version).toBe(2);

    await stalePage.close();
});
