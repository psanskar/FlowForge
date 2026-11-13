import { Link } from "react-router-dom";

import useProjectInvitations, { useRespondToProjectInvitation } from "../hooks/useProjectInvitations";

const ProjectInvitationsPage = () => {
    const invitationsQuery = useProjectInvitations();
    const respond = useRespondToProjectInvitation();
    const invitations = invitationsQuery.data?.data?.invitations || [];

    return (
        <section className="page-section invitations-page">
            <div className="page-heading">
                <div>
                    <span className="page-eyebrow">Team access</span>
                    <h1>Project requests</h1>
                    <p>Review invitations before joining a project workspace.</p>
                </div>
            </div>
            {invitationsQuery.isLoading ? (
                <div className="empty-state"><p>Loading project requests…</p></div>
            ) : invitationsQuery.isError ? (
                <div className="empty-state" role="alert"><h2>Could not load requests</h2><p>{invitationsQuery.error?.message}</p></div>
            ) : invitations.length === 0 ? (
                <div className="empty-state"><h2>You’re all caught up</h2><p>New project requests will appear here.</p></div>
            ) : (
                <div className="invitations-list">
                    {invitations.map((invitation) => (
                        <article className="invitation-card" key={invitation._id}>
                            <div className="invitation-card-copy">
                                <span className="page-eyebrow">Project invitation</span>
                                <h2>{invitation.project?.name || "Project"}</h2>
                                <p>{invitation.inviter?.name || invitation.inviter?.email || "A project owner"} invited you to join.</p>
                            </div>
                            <div className="invitation-card-actions">
                                <button type="button" className="secondary-button" disabled={respond.isPending} onClick={() => respond.mutate({ invitationId: invitation._id, projectId: invitation.project?._id, action: "decline" })}>Decline</button>
                                <button type="button" className="primary-button" disabled={respond.isPending || invitation.project?.status === "archived"} onClick={() => respond.mutate({ invitationId: invitation._id, projectId: invitation.project?._id, action: "accept" })}>{invitation.project?.status === "archived" ? "Project archived" : "Accept request"}</button>
                            </div>
                        </article>
                    ))}
                </div>
            )}
            {respond.isError && <p className="invitations-error" role="alert">{respond.error?.message || "Could not respond to the request."}</p>}
            {respond.isSuccess && respond.variables?.action === "accept" && (
                <p className="invitations-success" role="status">Invitation accepted. <Link to={`/app/projects/${respond.data?.data?.projectId}`}>Open project</Link></p>
            )}
            {respond.isSuccess && respond.variables?.action === "decline" && <p className="invitations-success" role="status">Invitation declined.</p>}
        </section>
    );
};

export default ProjectInvitationsPage;
