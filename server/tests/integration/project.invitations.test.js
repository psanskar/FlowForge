const request = require("supertest");

const app = require("../../src/app");
const User = require("../../src/modules/users/user.model");
const Project = require("../../src/modules/projects/project.model");
const ProjectInvitation = require("../../src/modules/projects/projectInvitation.model");

const register = async (name, email) => {
    const response = await request(app).post("/api/v1/auth/register").send({
        name,
        email,
        password: "TestPassword123"
    });
    expect(response.status).toBe(201);
    return response.body.data;
};

describe("Project invitations", () => {
    beforeEach(async () => {
        await ProjectInvitation.deleteMany({});
        await Project.deleteMany({});
        await User.deleteMany({});
    });

    test("keeps an invitee out of the project until they accept", async () => {
        const owner = await register("Project Owner", "owner-invite@flowforge.local");
        const invited = await register("Invited Member", "invitee@flowforge.local");
        const projectResponse = await request(app)
            .post("/api/v1/projects")
            .set("Authorization", `Bearer ${owner.token}`)
            .send({ name: "Invitation workflow" });
        const projectId = projectResponse.body.data.project._id;

        const inviteResponse = await request(app)
            .post(`/api/v1/projects/${projectId}/members`)
            .set("Authorization", `Bearer ${owner.token}`)
            .send({ email: "INVITEE@FLOWFORGE.LOCAL" });

        expect(inviteResponse.status).toBe(201);
        expect(inviteResponse.body.data.invitation.status).toBe("pending");
        expect((await Project.findById(projectId)).members).toHaveLength(1);

        const incomingResponse = await request(app)
            .get("/api/v1/projects/invitations")
            .set("Authorization", `Bearer ${invited.token}`);
        expect(incomingResponse.status).toBe(200);
        expect(incomingResponse.body.data.invitations).toHaveLength(1);

        const acceptResponse = await request(app)
            .post(`/api/v1/projects/invitations/${inviteResponse.body.data.invitation._id}/accept`)
            .set("Authorization", `Bearer ${invited.token}`);
        expect(acceptResponse.status).toBe(200);
        expect(acceptResponse.body.data.status).toBe("accepted");

        const project = await Project.findById(projectId);
        expect(project.members.map(({ user }) => user.toString())).toContain(invited.user.id);
        const accessResponse = await request(app)
            .get(`/api/v1/projects/${projectId}`)
            .set("Authorization", `Bearer ${invited.token}`);
        expect(accessResponse.status).toBe(200);
    });

    test("only the invited account can accept and declined requests do not grant access", async () => {
        const owner = await register("Project Owner", "owner-decline@flowforge.local");
        const invited = await register("Invited Member", "decline@flowforge.local");
        const outsider = await register("Outsider", "outsider@flowforge.local");
        const projectResponse = await request(app)
            .post("/api/v1/projects")
            .set("Authorization", `Bearer ${owner.token}`)
            .send({ name: "Declined invite" });
        const projectId = projectResponse.body.data.project._id;
        const inviteResponse = await request(app)
            .post(`/api/v1/projects/${projectId}/members`)
            .set("Authorization", `Bearer ${owner.token}`)
            .send({ email: "decline@flowforge.local" });
        const invitationId = inviteResponse.body.data.invitation._id;

        const unauthorizedAccept = await request(app)
            .post(`/api/v1/projects/invitations/${invitationId}/accept`)
            .set("Authorization", `Bearer ${outsider.token}`);
        expect(unauthorizedAccept.status).toBe(404);

        const declineResponse = await request(app)
            .post(`/api/v1/projects/invitations/${invitationId}/decline`)
            .set("Authorization", `Bearer ${invited.token}`);
        expect(declineResponse.status).toBe(200);
        expect((await Project.findById(projectId)).members).toHaveLength(1);

        const retryResponse = await request(app)
            .post(`/api/v1/projects/invitations/${invitationId}/accept`)
            .set("Authorization", `Bearer ${invited.token}`);
        expect(retryResponse.status).toBe(404);
    });

    test("prevents duplicate pending requests and lets the owner cancel one", async () => {
        const owner = await register("Project Owner", "owner-cancel@flowforge.local");
        const invited = await register("Invited Member", "cancel@flowforge.local");
        const projectResponse = await request(app)
            .post("/api/v1/projects")
            .set("Authorization", `Bearer ${owner.token}`)
            .send({ name: "Cancelled invite" });
        const projectId = projectResponse.body.data.project._id;
        const inviteResponse = await request(app)
            .post(`/api/v1/projects/${projectId}/members`)
            .set("Authorization", `Bearer ${owner.token}`)
            .send({ email: "cancel@flowforge.local" });

        const duplicateResponse = await request(app)
            .post(`/api/v1/projects/${projectId}/members`)
            .set("Authorization", `Bearer ${owner.token}`)
            .send({ email: "CANCEL@FLOWFORGE.LOCAL" });
        expect(duplicateResponse.status).toBe(409);
        expect(duplicateResponse.body.error.code).toBe("INVITATION_ALREADY_PENDING");

        const cancelResponse = await request(app)
            .delete(`/api/v1/projects/${projectId}/invitations/${inviteResponse.body.data.invitation._id}`)
            .set("Authorization", `Bearer ${owner.token}`);
        expect(cancelResponse.status).toBe(200);
        const incomingResponse = await request(app)
            .get("/api/v1/projects/invitations")
            .set("Authorization", `Bearer ${invited.token}`);
        expect(incomingResponse.body.data.invitations).toHaveLength(0);
    });
});
