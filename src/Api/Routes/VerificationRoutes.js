import { Router } from 'express';
import { SendSuccess } from '../Middleware/ErrorHandler.js';
import { RequireDiscordUserId } from '../Validation.js';

export function CreateVerificationRoutes({ Services }) {
    const VerificationRouter = Router();

    VerificationRouter.get('/verification/discord/:DiscordUserId', async (Request, Response) => {
        const DiscordUserId = RequireDiscordUserId(Request.params.DiscordUserId);
        const Status = await Services.VerificationService.GetVerificationStatus(DiscordUserId);
        SendSuccess(Response, { DiscordUserId, ...Status });
    });

    return VerificationRouter;
}
