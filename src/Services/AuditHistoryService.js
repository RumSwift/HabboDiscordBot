export class AuditHistoryService {
    constructor({ LinkRepository, AuditRepository, NotificationRepository }) {
        this.LinkRepository = LinkRepository;
        this.AuditRepository = AuditRepository;
        this.NotificationRepository = NotificationRepository;
    }

    GetActiveLinkForDiscordUser(DiscordUserId) {
        return this.LinkRepository.FindActiveLinkByDiscordUserId(DiscordUserId);
    }

    HasActiveLink(DiscordUserId) {
        return this.LinkRepository.HasActiveLink(DiscordUserId);
    }

    GetActiveLinkForHabboAccount(HotelCode, HabboUniqueId) {
        return this.LinkRepository.FindActiveLinkByHabboAccount(HotelCode, HabboUniqueId);
    }

    GetLinkHistoryForDiscordUser(DiscordUserId, Options) {
        return this.LinkRepository.GetLinkHistoryByDiscordUserId(DiscordUserId, Options);
    }

    GetLinkHistoryForHabboAccount(HotelCode, HabboUniqueId, Options) {
        return this.LinkRepository.GetLinkHistoryByHabboAccount(HotelCode, HabboUniqueId, Options);
    }

    async GetUserLinkSummary(DiscordUserId) {
        const [ActiveLink, EventSummary] = await Promise.all([
            this.LinkRepository.FindActiveLinkByDiscordUserId(DiscordUserId),
            this.AuditRepository.GetEventSummaryForDiscordUser(DiscordUserId),
        ]);
        return { DiscordUserId, HasActiveLink: Boolean(ActiveLink), ActiveLink, ...EventSummary };
    }

    async GetLinkedAccountsForDiscordUser(DiscordUserId) {
        // Newest first, so the first row seen for each account carries its latest username.
        const Links = await this.LinkRepository.GetLinkHistoryByDiscordUserId(DiscordUserId, { Limit: 1000 });
        const AccountsByKey = new Map();

        for (const Link of Links) {
            const Key = `${Link.HotelCode}:${Link.HabboUniqueId}`;
            let Account = AccountsByKey.get(Key);
            if (!Account) {
                Account = {
                    HotelCode: Link.HotelCode,
                    HabboUniqueId: Link.HabboUniqueId,
                    HabboUsername: Link.HabboUsername,
                    LinkCount: 0,
                    FirstLinkedTimestamp: Link.LinkedTimestamp,
                    LastLinkedTimestamp: Link.LinkedTimestamp,
                    LastUnlinkedTimestamp: Link.UnlinkedTimestamp,
                    IsActive: Link.UnlinkedTimestamp === null,
                };
                AccountsByKey.set(Key, Account);
            }
            Account.LinkCount++;
            Account.FirstLinkedTimestamp = Link.LinkedTimestamp; // rows are newest first, so the last one seen is the oldest
        }

        return [...AccountsByKey.values()];
    }

    async GetAuditEventPage(DiscordUserId, Page, PageSize = 20) {
        const { TotalEventCount } = await this.AuditRepository.GetEventSummaryForDiscordUser(DiscordUserId);
        const TotalPages = Math.max(1, Math.ceil(TotalEventCount / PageSize));
        const SafePage = Math.min(Math.max(1, Math.floor(Number(Page) || 1)), TotalPages);
        const Events = await this.AuditRepository.GetEventsForDiscordUser(DiscordUserId, { Limit: PageSize, Offset: (SafePage - 1) * PageSize });
        return { Events, Page: SafePage, TotalPages, TotalEventCount, PageSize };
    }

    async GetNotificationDeliveryStatus() {
        const [PendingCount, StatusCounts] = await Promise.all([
            this.NotificationRepository.CountPendingNotifications(),
            this.NotificationRepository.GetDeliveryStatusSummary(),
        ]);
        return { PendingCount, StatusCounts };
    }
}
