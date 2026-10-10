import { Router } from 'express';
import { ApiError, SendSuccess } from '../Middleware/ErrorHandler.js';
import { OptionalLinkId, OptionalReason, RequireDiscordUserId, RequireHabboUniqueId, RequireHotelCode, RequireOnlyFields } from '../Validation.js';
import { LinkOutcomes } from '../../Services/HabboLinkService.js';

function FormatLink(Link) {
    if (!Link) {
        return null;
    }
    return {
        LinkId: String(Link.LinkId),
        DiscordUserId: Link.DiscordUserId,
        HabboUniqueId: Link.HabboUniqueId,
        HabboUsername: Link.HabboUsername,
        HotelCode: Link.HotelCode,
        LinkedTimestamp: Link.LinkedTimestamp,
    };
}

export function CreateHabboLinkRoutes({ Services }) {
    // Deliberately no route that creates a link: that only happens through the motto check.
    const LinkRouter = Router();
    const { AuditHistoryService, HabboLinkService } = Services;

    LinkRouter.get('/links/discord/:DiscordUserId', async (Request, Response) => {
        const DiscordUserId = RequireDiscordUserId(Request.params.DiscordUserId);
        const ActiveLink = await AuditHistoryService.GetActiveLinkForDiscordUser(DiscordUserId);
        SendSuccess(Response, { DiscordUserId, HasActiveLink: Boolean(ActiveLink), ActiveLink: FormatLink(ActiveLink) });
    });

    LinkRouter.get('/links/habbo/:HotelCode/:HabboUniqueId', async (Request, Response) => {
        const HotelCode = RequireHotelCode(Request.params.HotelCode);
        const HabboUniqueId = RequireHabboUniqueId(Request.params.HabboUniqueId);
        const ActiveLink = await AuditHistoryService.GetActiveLinkForHabboAccount(HotelCode, HabboUniqueId);
        SendSuccess(Response, { HotelCode, HabboUniqueId, IsLinked: Boolean(ActiveLink), ActiveLink: FormatLink(ActiveLink) });
    });

    LinkRouter.post('/links/discord/:DiscordUserId/unlink', async (Request, Response) => {
        const DiscordUserId = RequireDiscordUserId(Request.params.DiscordUserId);
        const Body = RequireOnlyFields(Request.body, ['ExpectedLinkId', 'Reason']);
        const ExpectedLinkId = OptionalLinkId(Body.ExpectedLinkId);
        const Reason = OptionalReason(Body.Reason);

        const Result = await HabboLinkService.UnlinkDiscordUser({ DiscordUserId, ExpectedLinkId, Source: 'INTERNAL_API', Reason });

        if (Result.Outcome === LinkOutcomes.NoActiveLink) {
            throw new ApiError(404, 'NO_ACTIVE_LINK', 'This Discord user has no active Habbo link.');
        }
        if (Result.Outcome === LinkOutcomes.LinkChanged) {
            throw new ApiError(409, 'LINK_CHANGED', 'The active link does not match ExpectedLinkId.');
        }

        // Apply the role removal / audit message in the background (they retry on failure).
        Services.SessionService.ClearSession(DiscordUserId);
        Services.RoleRecoveryService.ProcessDueOperations({ DiscordUserId }).catch(() => {});
        Services.NicknameService?.SyncUser(DiscordUserId, { UnlinkedLink: Result.Link }).catch(() => {});
        Services.AuditNotificationWorker.Wake();

        SendSuccess(Response, {
            DiscordUserId,
            UnlinkedLink: FormatLink(Result.Link),
            UnlinkedTimestamp: Result.UnlinkedTimestamp,
            OperationId: Result.OperationId,
            AuditLogId: String(Result.AuditLogId),
        });
    });

    return LinkRouter;
}
