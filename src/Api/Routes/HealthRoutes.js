import { Router } from 'express';
import { SendSuccess } from '../Middleware/ErrorHandler.js';

export function CreateHealthRoutes() {
    const HealthRouter = Router();
    HealthRouter.get('/health', (Request, Response) => SendSuccess(Response, { Status: 'OK' }));
    return HealthRouter;
}
