export async function HandleMemberJoin(Member, Context) {
    if (Member.user?.bot) {
        return;
    }
    const DiscordUserId = Member.id;
    const { HabboLinkService, RoleRecoveryService, NicknameService } = Context.Services;

    const ActiveLink = await HabboLinkService.QueueRoleRestore(DiscordUserId);
    if (!ActiveLink) {
        return;
    }
    Context.Logger.Info('Verified member joined; restoring role and nickname', { DiscordUserId, HotelCode: ActiveLink.HotelCode });

    try {
        await RoleRecoveryService.ProcessDueOperations({ DiscordUserId });
    } catch (RoleError) {
        Context.Logger.Warn('Role restore failed; it will be retried in the background', { DiscordUserId, Error: RoleError });
    }
    try {
        await NicknameService?.HandleMemberUpdate(Member);
    } catch (NicknameError) {
        Context.Logger.Warn('Nickname restore failed; the background sweep will retry it', { DiscordUserId, Error: NicknameError });
    }
}
