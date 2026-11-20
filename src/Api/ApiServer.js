import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { CreateInternalApiAuthentication } from './Middleware/InternalApiAuthentication.js';
import { CreateErrorHandler, NotFoundHandler } from './Middleware/ErrorHandler.js';
import { CreateHealthRoutes } from './Routes/HealthRoutes.js';
import { CreateHabboLinkRoutes } from './Routes/HabboLinkRoutes.js';
import { CreateVerificationRoutes } from './Routes/VerificationRoutes.js';
import { AdminPrefix, CreateAdminRouter } from '../Admin/AdminRoutes.js';

export const ApiPrefix = '/api/v1';

export function CreateApiApp({ Config, Services, Logger }) {
    const App = express();

    App.disable('x-powered-by');
    App.set('trust proxy', false);

    App.use(
        rateLimit({
            windowMs: 60000,
            limit: 120,
            standardHeaders: 'draft-7',
            legacyHeaders: false,
            handler: (Request, Response) => Response.status(429).json({ Success: false, Error: { Code: 'RATE_LIMITED', Message: 'Too many requests.' } }),
        }),
    );
    App.use(express.json({ limit: '10kb' }));

    App.use(ApiPrefix, CreateHealthRoutes());

    const ProtectedRouter = express.Router();
    ProtectedRouter.use(CreateInternalApiAuthentication(Config.Api.InternalApiKey));
    ProtectedRouter.use(CreateHabboLinkRoutes({ Services }));
    ProtectedRouter.use(CreateVerificationRoutes({ Services }));
    App.use(ApiPrefix, ProtectedRouter);

    App.use(AdminPrefix, CreateAdminRouter({ Password: Config.Admin?.Password, AdminService: Services.AdminService, Logger }));

    App.use(NotFoundHandler);
    App.use(CreateErrorHandler(Logger));

    return App;
}

export function StartApiServer(App, { Host, Port, Logger }) {
    return new Promise((Resolve, Reject) => {
        const Server = App.listen(Port, Host);
        Server.requestTimeout = 15000;
        Server.headersTimeout = 10000;
        Server.keepAliveTimeout = 5000;
        Server.once('listening', () => {
            Logger?.Info(`Internal API listening on http://${Host}:${Server.address().port}${ApiPrefix}`);
            Resolve(Server);
        });
        Server.once('error', Reject);
    });
}

export function StopApiServer(Server) {
    return new Promise((Resolve) => {
        if (!Server?.listening) {
            Resolve();
            return;
        }
        Server.close(() => Resolve());
        Server.closeIdleConnections?.();
        setTimeout(() => {
            Server.closeAllConnections?.();
        }, 5000).unref();
    });
}
