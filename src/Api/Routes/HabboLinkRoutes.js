import { Router } from 'express';
import { ApiError, SendSuccess } from '../Middleware/ErrorHandler.js';
import { OptionalGame, OptionalLinkId, OptionalReason, RequireDiscordUserId, RequireHabboUniqueId, RequireHotelCode, RequireOnlyFields } from '../Validation.js';
import { LinkOutcomes } from '../../Services/HabboLinkService.js';
import { Games } from '../../Utils/HotelConfiguration.js';

function FormatLink(Link) {
    if (!Link) {
        return null;
    }
    return {
        LinkId: String(Link.LinkId),
        DiscordUserId: Link.DiscordUserId,
        Game: Link.Game,
        HabboUniqueId: Link.HabboUniqueId,
        HabboUsername: Link.HabboUsername,
        HotelCode: Link.HotelCode,
        LinkedTimestamp: Link.LinkedTimestamp,
    };
}

export function CreateHabboLinkRoutes({ Services }) {
    const LinkRouter = Router();
    const { AuditHistoryService, HabboLinkService } = Services;

    LinkRouter.get('/links/discord/:DiscordUserId', async (Request, Response) => {
        const DiscordUserId = RequireDiscordUserId(Request.params.DiscordUserId);
        const ActiveLinks = await AuditHistoryService.GetActiveLinksForDiscordUser(DiscordUserId);
        const LinksByGame = Object.fromEntries(Object.values(Games).map((Game) => [Game, FormatLink(ActiveLinks.find((Link) => Link.Game === Game))]));
        SendSuccess(Response, { DiscordUserId, HasActiveLink: ActiveLinks.length > 0, ActiveLinks: LinksByGame });
    });

    LinkRouter.get('/links/habbo/:HotelCode/:HabboUniqueId', async (Request, Response) => {
        const HotelCode = RequireHotelCode(Request.params.HotelCode);
        const HabboUniqueId = RequireHabboUniqueId(Request.params.HabboUniqueId);
        const ActiveLink = await AuditHistoryService.GetActiveLinkForHabboAccount(HotelCode, HabboUniqueId);
        SendSuccess(Response, { HotelCode, HabboUniqueId, IsLinked: Boolean(ActiveLink), ActiveLink: FormatLink(ActiveLink) });
    });

    LinkRouter.post('/links/discord/:DiscordUserId/unlink', async (Request, Response) => {
        const DiscordUserId = RequireDiscordUserId(Request.params.DiscordUserId);
        const Body = RequireOnlyFields(Request.body, ['Game', 'ExpectedLinkId', 'Reason']);
        const Game = OptionalGame(Body.Game);
        const ExpectedLinkId = OptionalLinkId(Body.ExpectedLinkId);
        const Reason = OptionalReason(Body.Reason);

        const Result = await HabboLinkService.UnlinkDiscordUser({ DiscordUserId, Game, ExpectedLinkId, Source: 'INTERNAL_API', Reason });

        if (Result.Outcome === LinkOutcomes.NoActiveLink) {
            throw new ApiError(404, 'NO_ACTIVE_LINK', 'This Discord user has no matching active link.');
        }
        if (Result.Outcome === LinkOutcomes.LinkChanged) {
            throw new ApiError(409, 'LINK_CHANGED', 'The active link does not match ExpectedLinkId.');
        }
        if (Result.Outcome === LinkOutcomes.GameRequired) {
            throw new ApiError(400, 'GAME_REQUIRED', 'This user has a Habbo and a Habbo Origins link. Pass Game (HABBO or ORIGINS) or ExpectedLinkId.');
        }

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
