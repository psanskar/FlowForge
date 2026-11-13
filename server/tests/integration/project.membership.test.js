const request = require("supertest");

const app = require("../../src/app");
const User = require("../../src/modules/users/user.model");
const Project = require("../../src/modules/projects/project.model");
const Task = require("../../src/modules/tasks/task.model");
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

describe("Project membership removal and leave", () => {
    beforeEach(async () => {
        await ProjectInvitation.deleteMany({});
        await Task.deleteMany({});
        await Project.deleteMany({});
        await User.deleteMany({});
    });

    const createProjectWithMember = async (suffix) => {
        const owner = await register("Owner", `owner-${suffix}@flowforge.local`);
        const member = await register("Member", `member-${suffix}@flowforge.local`);
        const project = await Project.create({
            name: `Membership ${suffix}`,
            owner: owner.user.id,
            members: [{ user: owner.user.id }, { user: member.user.id }],
            status: "active"
        });
        const activeTask = await Task.create({
            project: project._id,
            title: "Active task",
            assignee: member.user.id,
            createdBy: owner.user.id,
            status: "in_progress",
            version: 3
        });
        const completedTask = await Task.create({
            project: project._id,
            title: "Completed task",
            assignee: member.user.id,
            createdBy: owner.user.id,
            status: "completed",
            version: 4
        });
        return { owner, member, project, activeTask, completedTask };
    };

    test("owner removal drops access, unassigns active work, preserves completed history, and cancels pending invites", async () => {
        const { owner, member, project, activeTask, completedTask } =
            await createProjectWithMember("remove");
        await ProjectInvitation.create({
            project: project._id,
            inviter: owner.user.id,
            invitee: member.user.id,
            status: "pending"
        });

        const response = await request(app)
            .delete(`/api/v1/projects/${project._id}/members/${member.user.id}`)
            .set("Authorization", `Bearer ${owner.token}`);

        expect(response.status).toBe(200);
        expect(response.body.data.unassignedTaskCount).toBe(1);
        const updatedProject = await Project.findById(project._id).lean();
        expect(updatedProject.members.map(({ user }) => user.toString()))
            .not.toContain(member.user.id);
        expect(await ProjectInvitation.findOne({ project: project._id }).lean())
            .toMatchObject({ status: "cancelled" });
        expect(await Task.findById(activeTask._id).lean()).toMatchObject({
            assignee: null,
            version: 4
        });
        expect((await Task.findById(completedTask._id).lean()).assignee.toString())
            .toBe(member.user.id);

        const accessResponse = await request(app)
            .get(`/api/v1/projects/${project._id}`)
            .set("Authorization", `Bearer ${member.token}`);
        expect(accessResponse.status).toBe(404);
    });

    test("member leave drops access and unassigns active work; owner cannot leave", async () => {
        const { owner, member, project, activeTask } =
            await createProjectWithMember("leave");

        const leaveResponse = await request(app)
            .delete(`/api/v1/projects/${project._id}/members/me`)
            .set("Authorization", `Bearer ${member.token}`);

        expect(leaveResponse.status).toBe(200);
        expect(leaveResponse.body.data.unassignedTaskCount).toBe(1);
        expect((await Project.findById(project._id).lean()).members
            .map(({ user }) => user.toString())).not.toContain(member.user.id);
        expect((await Task.findById(activeTask._id).lean()).assignee).toBeNull();

        const accessResponse = await request(app)
            .get(`/api/v1/projects/${project._id}`)
            .set("Authorization", `Bearer ${member.token}`);
        expect(accessResponse.status).toBe(404);

        const ownerLeaveResponse = await request(app)
            .delete(`/api/v1/projects/${project._id}/members/me`)
            .set("Authorization", `Bearer ${owner.token}`);
        expect(ownerLeaveResponse.status).toBe(409);
        expect(ownerLeaveResponse.body.error.code).toBe("OWNERSHIP_TRANSFER_REQUIRED");
    });
});
