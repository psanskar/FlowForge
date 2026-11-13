import { useState } from "react";
import { useNavigate } from "react-router-dom";

import useProjectMembership from "../hooks/useProjectMembership";
import useProjectInvitations from "../hooks/useProjectInvitations";

const getMemberId = (member) => String(member.user?._id || member.user);

const ProjectMembersMenu = ({ project, currentUserId, isProjectOwner, isArchived }) => {
    const [email, setEmail] = useState("");
    const navigate = useNavigate();
    const membership = useProjectMembership(project._id);
    const invitationsQuery = useProjectInvitations(project._id, isProjectOwner);
    const pendingInvitations = invitationsQuery.data?.data?.invitations || [];
    const members = project.members || [];

    const runAction = (action, memberId) => {
        if (action === "remove" && !window.confirm("Remove this member and unassign their open tasks?")) return;
        if (action === "leave" && !window.confirm("Leave this project? Your assigned tasks will be unassigned.")) return;
        if (action === "transfer" && !window.confirm("Transfer project ownership to this member? You will become a regular member.")) return;
        membership.mutate({ action, memberId }, {
            onSuccess: () => {
                if (action === "leave") {
                    navigate("/app/projects", { replace: true });
                }
            }
        });
    };

    return (
        <details className="workspace-members-menu">
            <summary className="secondary-button">
                Team <span className="workspace-members-count">{members.length}</span>
            </summary>
            <div className="workspace-members-panel">
                <div className="workspace-members-header">
                    <div>
                        <strong>Project members</strong>
                        <span>People who can work in this project</span>
                    </div>
                    <span>{members.length} {members.length === 1 ? "person" : "people"}</span>
                </div>
                <ul className="workspace-members-list">
                    {members.map((member) => {
                        const id = getMemberId(member);
                        const user = member.user || {};
                        const isOwner = String(project.owner?._id || project.owner) === id;
                        return (
                            <li key={id}>
                                <span className="workspace-member-avatar" aria-hidden="true">
                                    {(user.name || user.email || "?").slice(0, 1).toUpperCase()}
                                </span>
                                <span className="workspace-member-identity">
                                    <strong>{user.name || "FlowForge member"}{id === String(currentUserId) ? " (you)" : ""}</strong>
                                    {user.email && <span>{user.email}</span>}
                                </span>
                                <span className={`workspace-member-role${isOwner ? " is-owner" : ""}`}>
                                    {isOwner ? "Owner" : "Member"}
                                </span>
                                {isProjectOwner && !isOwner && !isArchived && (
                                    <div className="workspace-member-actions">
                                        <button type="button" className="workspace-member-action" disabled={membership.isPending} onClick={() => runAction("transfer", id)}>
                                            Make owner
                                        </button>
                                        <button type="button" className="workspace-member-action is-danger" disabled={membership.isPending} onClick={() => runAction("remove", id)}>
                                            Remove
                                        </button>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
                {isProjectOwner && !isArchived ? (
                    <form className="workspace-members-form" onSubmit={(event) => {
                        event.preventDefault();
                        membership.mutate({ action: "invite", email: email.trim() }, { onSuccess: () => {
                            setEmail("");
                            invitationsQuery.refetch();
                        } });
                    }}>
                        <label htmlFor={`member-email-${project._id}`}>Invite an existing account</label>
                        <div>
                            <input id={`member-email-${project._id}`} type="email" autoComplete="off" placeholder="teammate@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
                            <button type="submit" className="primary-button" disabled={membership.isPending || !email.trim()}>
                                {membership.isPending ? "Sending…" : "Send request"}
                            </button>
                        </div>
                        <small>They need a FlowForge account. They join after accepting.</small>
                    </form>
                ) : !isProjectOwner && !isArchived ? (
                    <button type="button" className="workspace-member-leave" disabled={membership.isPending} onClick={() => runAction("leave")}>
                        Leave project
                    </button>
                ) : null}
                {isProjectOwner && pendingInvitations.length > 0 && (
                    <div className="workspace-pending-invitations">
                        <strong>Pending requests</strong>
                        {pendingInvitations.map((invitation) => (
                            <div key={invitation._id}>
                                <span>{invitation.invitee?.name || invitation.invitee?.email || "Account"}</span>
                                <button type="button" className="workspace-member-action is-danger" disabled={membership.isPending} onClick={() => membership.mutate({ action: "cancel-invitation", memberId: invitation._id }, { onSuccess: () => invitationsQuery.refetch() })}>Cancel</button>
                            </div>
                        ))}
                    </div>
                )}
                {membership.isError && <p className="workspace-members-error" role="alert">{membership.error?.message || "Could not update project membership."}</p>}
                {membership.isSuccess && <p className="workspace-members-success" role="status">
                    {membership.variables?.action === "remove"
                        ? `Member removed. ${membership.data?.data?.unassignedTaskCount || 0} active task(s) returned to the unassigned pool.`
                        : membership.variables?.action === "leave"
                            ? "You left the project. Returning to your projects…"
                            : "Membership updated."}
                </p>}
            </div>
        </details>
    );
};

export default ProjectMembersMenu;
