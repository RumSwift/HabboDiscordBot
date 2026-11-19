import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { ApiError, SendSuccess } from '../Api/Middleware/ErrorHandler.js';

export const AdminPrefix = '/admin';
export const SessionCookieName = 'HabboVerifyBotAdmin';

const PublicDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'Public');
const SessionLifetimeMs = 12 * 60 * 60 * 1000;
const MaxSessions = 50;

const Digest = (Text) => createHash('sha256').update(Text, 'utf8').digest();

// Signed-in browsers, kept in memory: restarting the bot signs everyone out.
export class AdminSessionStore {
    constructor({ Now = () => Date.now() } = {}) {
        this.Sessions = new Map();
        this.Now = Now;
    }

    Create() {
        this.RemoveExpired();
        while (this.Sessions.size >= MaxSessions) {
            this.Sessions.delete(this.Sessions.keys().next().value);
        }
        const Token = randomBytes(32).toString('base64url');
        // Only a hash of the token is kept, so the map never holds a usable cookie value.
        this.Sessions.set(Digest(Token).toString('hex'), this.Now() + SessionLifetimeMs);
        return Token;
    }

    IsValid(Token) {
        if (typeof Token !== 'string' || Token.length === 0) {
            return false;
        }
        const Key = Digest(Token).toString('hex');
        const ExpiresMs = this.Sessions.get(Key);
        if (!ExpiresMs || ExpiresMs <= this.Now()) {
            this.Sessions.delete(Key);
            return false;
        }
        return true;
    }

    Remove(Token) {
        if (typeof Token === 'string') {
            this.Sessions.delete(Digest(Token).toString('hex'));
        }
    }

    RemoveExpired() {
        for (const [Key, ExpiresMs] of this.Sessions) {
            if (ExpiresMs <= this.Now()) {
                this.Sessions.delete(Key);
            }
        }
    }
}

function ReadCookie(Request, Name) {
    for (const Part of (Request.get('cookie') ?? '').split(';')) {
        const [Key, ...Rest] = Part.trim().split('=');
        if (Key === Name) {
            return Rest.join('=');
        }
    }
    return null;
}

function IsHttps(Request) {
    return Request.secure || Request.get('x-forwarded-proto') === 'https';
}

function SetSessionCookie(Request, Response, Token, MaxAgeSeconds) {
    const Parts = [`${SessionCookieName}=${Token}`, `Path=${AdminPrefix}`, 'HttpOnly', 'SameSite=Strict', `Max-Age=${MaxAgeSeconds}`];
    if (IsHttps(Request)) {
        Parts.push('Secure');
    }
    Response.setHeader('Set-Cookie', Parts.join('; '));
}

function SecurityHeaders(Request, Response, Next) {
    Response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
    Response.setHeader('X-Content-Type-Options', 'nosniff');
    Response.setHeader('X-Frame-Options', 'DENY');
    Response.setHeader('Referrer-Policy', 'no-referrer');
    Response.setHeader('Cache-Control', 'no-store');
    Next();
}

// Requests that change something must be JSON (which a cross-site form cannot send) and, when the browser
// says where they came from, come from this page. The SameSite=Strict cookie is the main defence; this is a second one.
function RequireSameOriginJson(Request, Response, Next) {
    if (Request.method === 'GET' || Request.method === 'HEAD') {
        return Next();
    }
    if (!Request.is('application/json')) {
        return Next(new ApiError(415, 'JSON_REQUIRED', 'Requests must be sent as JSON.'));
    }
    const Origin = Request.get('origin');
    if (Origin) {
        let OriginHost = null;
        try {
            OriginHost = new URL(Origin).host;
        } catch {
            // Treated as a mismatch below.
        }
        if (OriginHost !== Request.get('host')) {
            return Next(new ApiError(403, 'CROSS_ORIGIN', 'Cross-site requests are not allowed.'));
        }
    }
    return Next();
}

export function CreateAdminRouter({ Password, AdminService, Logger, Sessions = new AdminSessionStore() }) {
    const Router = express.Router();
    Router.use(SecurityHeaders);

    if (!Password) {
        Router.use((Request, Response) => Response.status(404).type('text/plain').send('The admin page is switched off. Set ADMIN_PASSWORD in .env and restart the bot.'));
        return Router;
    }
    const ExpectedDigest = Digest(Password);

    // The page loads its files relative to /admin/, so /admin needs the trailing slash.
    Router.get('/', (Request, Response, Next) => (Request.originalUrl.split('?')[0].endsWith('/') ? Next() : Response.redirect(302, `${AdminPrefix}/`)));
    Router.use(express.static(PublicDirectory, { index: 'index.html', redirect: false, dotfiles: 'deny' }));

    const Api = express.Router();
    Api.use(RequireSameOriginJson);

    const RequireSession = (Request, Response, Next) => (Sessions.IsValid(ReadCookie(Request, SessionCookieName)) ? Next() : Next(new ApiError(401, 'SIGNED_OUT', 'Please sign in.')));

    Api.post(
        '/login',
        // Ten wrong passwords per address per 15 minutes; correct ones do not count.
        rateLimit({
            windowMs: 15 * 60 * 1000,
            limit: 10,
            skipSuccessfulRequests: true,
            standardHeaders: 'draft-7',
            legacyHeaders: false,
            handler: (Request, Response) => Response.status(429).json({ Success: false, Error: { Code: 'RATE_LIMITED', Message: 'Too many attempts. Try again in 15 minutes.' } }),
        }),
        (Request, Response, Next) => {
            const Provided = Request.body?.Password;
            // Hash both sides so timingSafeEqual works even when the lengths differ.
            if (typeof Provided !== 'string' || !timingSafeEqual(Digest(Provided), ExpectedDigest)) {
                Logger?.Warn('Failed admin page sign-in', { Ip: Request.ip });
                return Next(new ApiError(401, 'WRONG_PASSWORD', 'Wrong password.'));
            }
            SetSessionCookie(Request, Response, Sessions.Create(), SessionLifetimeMs / 1000);
            Logger?.Info('Signed in to the admin page', { Ip: Request.ip });
            return SendSuccess(Response, { SignedIn: true });
        },
    );

    Api.post('/logout', (Request, Response) => {
        Sessions.Remove(ReadCookie(Request, SessionCookieName));
        SetSessionCookie(Request, Response, '', 0);
        return SendSuccess(Response, { SignedIn: false });
    });

    Api.get('/state', RequireSession, async (Request, Response) => SendSuccess(Response, await AdminService.GetState()));

    Api.put('/servers/:GuildType', RequireSession, async (Request, Response) => {
        await AdminService.SaveServer(Request.params.GuildType, Request.body);
        return SendSuccess(Response, await AdminService.GetState());
    });

    Api.post('/servers/:GuildType/exclusions', RequireSession, async (Request, Response) => {
        await AdminService.AddExclusion(Request.params.GuildType, Request.body?.ChannelId);
        return SendSuccess(Response, await AdminService.GetState());
    });

    Api.delete('/servers/:GuildType/exclusions/:ChannelId', RequireSession, async (Request, Response) => {
        await AdminService.RemoveExclusion(Request.params.GuildType, Request.params.ChannelId);
        return SendSuccess(Response, await AdminService.GetState());
    });

    Router.use('/api', Api);
    return Router;
}
