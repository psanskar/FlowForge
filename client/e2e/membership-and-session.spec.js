import { expect, test } from "@playwright/test";

const apiPort = process.env.E2E_API_PORT ?? "5500";
const apiUrl = `http://127.0.0.1:${apiPort}/api/v1`;
const clientPort = process.env.E2E_CLIENT_PORT ?? "5175";
const clientUrl = `http://127.0.0.1:${clientPort}`;

const registerThroughApi = async (request, name, email) => {
    const response = await request.post(`${apiUrl}/auth/register`, {
        data: {
            name,
            email,
            password: "BrowserJourneyPassword123"
        }
    });
    expect(response.status()).toBe(201);
    return response.json();
};

const signIn = async (page, email) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.locator("#password").fill("BrowserJourneyPassword123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/app$/);
};

const acceptInvitation = async (page, email, projectName) => {
    await signIn(page, email);
    await page.getByRole("link", { name: "Project requests" }).click();
    await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
    await page.getByRole("button", { name: "Accept request" }).click();
    await expect(page.getByRole("link", { name: "Open project" })).toBeVisible();
};

test("preserves a saved session through a temporary API failure and retries restoration", async ({ page }) => {
    const uniqueId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const email = `session-${uniqueId}@flowforge.local`;
    const registered = await registerThroughApi(
        page.request,
        "Session Recovery User",
        email
    );
    let restoreCalls = 0;

    await page.addInitScript((token) => {
        localStorage.setItem("flowforge_token", token);
    }, registered.data.token);

    await page.route(/\/auth\/me(?:\?.*)?$/, async (route) => {
        restoreCalls += 1;
        // React Strict Mode validates the session twice on the first mount.
        if (restoreCalls <= 2) {
            await route.fulfill({
                status: 503,
                contentType: "application/json",
                body: JSON.stringify({
                    success: false,
                    error: { message: "Temporary API outage" }
                })
            });
            return;
        }

        await route.fulfill({
            status: 200,
            json: {
                success: true,
                data: { user: registered.data.user }
            }
        });
    });

    await page.goto("/app");
    await expect(page.getByRole("heading", { name: "Connection interrupted" })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("flowforge_token")))
        .toBe(registered.data.token);

    await page.getByRole("button", { name: "Retry connection" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByText("Session Recovery User")).toBeVisible();
    expect(restoreCalls).toBe(3);
    expect(await page.evaluate(() => localStorage.getItem("flowforge_token")))
        .toBe(registered.data.token);
});

test("invited members can accept, owners can remove, and members can leave", async ({ page, browser }) => {
    const uniqueId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const ownerEmail = `owner-${uniqueId}@flowforge.local`;
    const removeEmail = `remove-${uniqueId}@flowforge.local`;
    const leaveEmail = `leave-${uniqueId}@flowforge.local`;
    const projectName = `Membership Journey ${uniqueId}`;

    await registerThroughApi(page.request, "Membership Owner", ownerEmail);
    await registerThroughApi(page.request, "Removed Teammate", removeEmail);
    await registerThroughApi(page.request, "Leaving Teammate", leaveEmail);

    await signIn(page, ownerEmail);
    const ownerToken = await page.evaluate(() => localStorage.getItem("flowforge_token"));
    const projectResponse = await page.request.post(`${apiUrl}/projects`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
        data: { name: projectName, description: "Membership browser regression." }
    });
    expect(projectResponse.status()).toBe(201);
    const { project } = (await projectResponse.json()).data;

    await page.goto(`/app/projects/${project._id}`);
    await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
    await page.locator(".workspace-members-menu > summary").click();
    const inviteEmail = page.getByLabel("Invite an existing account");
    await inviteEmail.fill(removeEmail);
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(page.getByText("Removed Teammate", { exact: true })).toBeVisible();
    await inviteEmail.fill(leaveEmail);
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(page.getByText("Leaving Teammate", { exact: true })).toBeVisible();

    const removeContext = await browser.newContext({ baseURL: clientUrl });
    const leaveContext = await browser.newContext({ baseURL: clientUrl });
    try {
        const removePage = await removeContext.newPage();
        const leavePage = await leaveContext.newPage();
        await Promise.all([
            acceptInvitation(removePage, removeEmail, projectName),
            acceptInvitation(leavePage, leaveEmail, projectName)
        ]);

        await page.reload();
        await page.locator(".workspace-members-menu > summary").click();
        const removedMember = page.getByRole("listitem")
            .filter({ hasText: "Removed Teammate" });
        await expect(removedMember).toContainText("Removed Teammate");
        page.once("dialog", (dialog) => dialog.accept());
        await removedMember.getByRole("button", { name: "Remove" }).click();
        await expect(page.getByText(/Member removed\./)).toBeVisible();
        await expect(page.getByRole("listitem").filter({ hasText: "Removed Teammate" }))
            .toHaveCount(0);

        await leavePage.goto(`/app/projects/${project._id}`);
        await expect(leavePage.getByRole("heading", { name: projectName })).toBeVisible();
        await leavePage.locator(".workspace-members-menu > summary").click();
        leavePage.once("dialog", (dialog) => dialog.accept());
        await leavePage.getByRole("button", { name: "Leave project" }).click();
        await expect(leavePage).toHaveURL(/\/app\/projects$/);
        await expect(leavePage.getByRole("heading", { name: "Your projects" })).toBeVisible();
        await expect(leavePage.getByText(projectName)).toHaveCount(0);
    } finally {
        await removeContext.close();
        await leaveContext.close();
    }
});
