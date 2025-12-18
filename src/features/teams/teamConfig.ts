export const teamConfig = {
    enabled: true,
    creationCost: 500,
    maxMembers: 10,
    maxTeamInvites: 10, // Max outgoing invites a team can have pending
    maxPlayerInvites: 5, // Max incoming invites a player can have pending
    maxApplications: 20, // Max incoming applications a team can have
    requestExpirySeconds: 604_800, // 7 days
    nameBlacklist: ['owner', 'admin', 'mod', 'moderator', 'staff', 'server', 'operator', 'null', 'undefined'],
    nameMinLength: 3,
    nameMaxLength: 16,
    teleportWarmupSeconds: 10
};

export default teamConfig;
