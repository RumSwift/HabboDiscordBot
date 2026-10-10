import { CreateDatabasePool, TestDatabaseConnection } from './Database/DatabaseConnection.js';
import { RunMigrations } from './Database/MigrationRunner.js';
import { LoadCommands, RegisterGlobalCommands } from './Handlers/CommandHandler.js';
import { InteractionHandler } from './Handlers/InteractionHandler.js';
import { CreateApiApp, StartApiServer, StopApiServer } from './Api/ApiServer.js';
import { CreateDiscordClient, LoginDiscordClient, RegisterEvents } from './Bot.js';
import { GetConfigurationWarnings } from './Config/Environment.js';
import { HabboLinkRepository } from './Repositories/HabboLinkRepository.js';
import { VerificationChallengeRepository } from './Repositories/VerificationChallengeRepository.js';
import { HabboLinkAuditRepository } from './Repositories/HabboLinkAuditRepository.js';
import { AuditNotificationRepository } from './Repositories/AuditNotificationRepository.js';
import { RoleOperationRepository } from './Repositories/RoleOperationRepository.js';
import { HabboApiService } from './Services/HabboApiService.js';
import { HabboLinkService } from './Services/HabboLinkService.js';
import { VerificationService } from './Services/VerificationService.js';
import { VerificationSessionService } from './Services/VerificationSessionService.js';
import { DiscordRoleService } from './Services/DiscordRoleService.js';
import { RoleRecoveryService } from './Services/RoleRecoveryService.js';
import { DiscordAuditLogService } from './Services/DiscordAuditLogService.js';
import { AuditNotificationWorker } from './Services/AuditNotificationWorker.js';
import { AuditHistoryService } from './Services/AuditHistoryService.js';
import { NicknameService } from './Services/NicknameService.js';
import { IntervalTask } from './Utils/IntervalTask.js';

const DefaultDependencies = {
    CreateDatabasePool,
    TestDatabaseConnection,
    RunMigrations,
    LoadCommands,
    RegisterGlobalCommands,
    CreateDiscordClient,
    RegisterEvents,
    LoginDiscordClient,
    StartApiServer,
    StopApiServer,
};

export class Application {
    constructor({ Config, Logger, Dependencies = {} }) {
        this.Config = Config;
        this.Logger = Logger;
        this.Dependencies = { ...DefaultDependencies, ...Dependencies };
        this.IsStarted = false;
        this.IsStopping = false;
        this.Pool = null;
        this.DiscordClient = null;
        this.ApiServer = null;
        this.BackgroundTasks = [];
        this.Services = null;
    }

    async Start() {
        if (this.IsStarted) {
            throw new Error('Application has already been started.');
        }
        this.IsStarted = true;

        const { Config, Logger } = this;
        const Deps = this.Dependencies;

        try {
            for (const Warning of GetConfigurationWarnings(Config)) {
                Logger.Warn(Warning);
            }

            Logger.Info('Connecting to MariaDB...');
            this.Pool = Deps.CreateDatabasePool(Config.Database);
            await Deps.TestDatabaseConnection(this.Pool);
            Logger.Info('Database connection OK.');
            await Deps.RunMigrations(this.Pool, { Logger });

            this.DiscordClient = Deps.CreateDiscordClient();
            this.Services = this.CreateServices();

            const { Commands, ComponentHandlers, ModalHandlers } = await Deps.LoadCommands({ Logger });
            await Deps.RegisterGlobalCommands({ Commands, Token: Config.Discord.Token, ClientId: Config.Discord.ClientId, Logger });

            const ApiApp = CreateApiApp({ Config, Services: this.Services, Logger });
            this.ApiServer = await Deps.StartApiServer(ApiApp, { Host: Config.Api.Host, Port: Config.Api.Port, Logger });

            const Handler = new InteractionHandler({
                Commands,
                ComponentHandlers,
                ModalHandlers,
                Context: { Config, Logger, Services: this.Services },
                Logger,
            });
            await Deps.RegisterEvents(this.DiscordClient, { Logger, InteractionHandler: Handler, Services: this.Services, NicknameService: this.Services.NicknameService });
            Logger.Info('Connecting to Discord...');
            await Deps.LoginDiscordClient(this.DiscordClient, Config.Discord.Token);

            this.StartBackgroundTasks();

            Logger.Info('HabboVerifyBot is ready.');
        } catch (StartupError) {
            Logger.Error('Startup failed; cleaning up', { Error: StartupError });
            await this.Stop();
            throw StartupError;
        }
    }

    CreateServices() {
        const { Config, Logger, Pool, DiscordClient } = this;

        const LinkRepository = new HabboLinkRepository(Pool);
        const ChallengeRepository = new VerificationChallengeRepository(Pool);
        const AuditRepository = new HabboLinkAuditRepository(Pool);
        const NotificationRepository = new AuditNotificationRepository(Pool);
        const RoleOperationRepositoryInstance = new RoleOperationRepository(Pool);

        const HabboApi = new HabboApiService({ TimeoutMs: Config.HabboApi.TimeoutMs, MaxRetries: Config.HabboApi.MaxRetries, Logger });

        const LinkService = new HabboLinkService({
            Pool,
            LinkRepository,
            AuditRepository,
            NotificationRepository,
            RoleOperationRepository: RoleOperationRepositoryInstance,
            ChallengeRepository,
            HotelRoleIds: Config.Discord.HotelRoleIds,
            Logger,
        });

        const Verification = new VerificationService({
            Pool,
            HabboApiService: HabboApi,
            HabboLinkService: LinkService,
            ChallengeRepository,
            LinkRepository,
            VerificationConfig: Config.Verification,
            Logger,
        });

        return {
            HabboApiService: HabboApi,
            HabboLinkService: LinkService,
            VerificationService: Verification,
            SessionService: new VerificationSessionService({ VerificationService: Verification, Logger }),
            AuditHistoryService: new AuditHistoryService({ LinkRepository, AuditRepository, NotificationRepository }),
            // null when ENFORCE_NICKNAMES=false; every caller treats it as optional.
            NicknameService: Config.Discord.EnforceNicknames ? new NicknameService({ Client: DiscordClient, LinkRepository, Logger, IntervalMs: Config.Discord.NicknameSweepIntervalSeconds * 1000 }) : null,
            RoleRecoveryService: new RoleRecoveryService({
                RoleOperationRepository: RoleOperationRepositoryInstance,
                LinkRepository,
                DiscordRoleService: new DiscordRoleService({ Client: DiscordClient, Logger }),
                Logger,
            }),
            AuditNotificationWorker: new AuditNotificationWorker({
                NotificationRepository,
                DiscordAuditLogService: new DiscordAuditLogService({ Client: DiscordClient, LogThreadId: Config.Discord.LogThreadId, Logger }),
                Logger,
            }),
        };
    }

    StartBackgroundTasks() {
        const { Services, Logger } = this;

        const ChallengeCleanup = new IntervalTask({
            Name: 'ChallengeCleanup',
            IntervalMs: 60000,
            Task: () => Services.VerificationService.ExpireOverdueChallenges(),
            Logger,
        });

        this.BackgroundTasks = [Services.AuditNotificationWorker, Services.RoleRecoveryService, Services.SessionService, ChallengeCleanup];
        if (Services.NicknameService) {
            this.BackgroundTasks.push(Services.NicknameService);
        }
        for (const Task of this.BackgroundTasks) {
            Task.Start();
        }
        Logger.Info('Background workers started.');
    }

    async Stop() {
        if (this.IsStopping) {
            return;
        }
        this.IsStopping = true;
        const { Logger } = this;

        if (this.ApiServer) {
            await this.Dependencies.StopApiServer(this.ApiServer).catch((StopError) => Logger.Warn('Error stopping internal API', { Error: StopError }));
            this.ApiServer = null;
        }

        for (const Task of this.BackgroundTasks) {
            await Task.Stop().catch((StopError) => Logger.Warn('Error stopping background task', { Error: StopError }));
        }
        this.BackgroundTasks = [];

        if (this.DiscordClient) {
            await Promise.resolve(this.DiscordClient.destroy()).catch((StopError) => Logger.Warn('Error closing Discord client', { Error: StopError }));
            this.DiscordClient = null;
        }

        // Last, after everything that uses it.
        if (this.Pool) {
            await this.Pool.end().catch((StopError) => Logger.Warn('Error closing database pool', { Error: StopError }));
            this.Pool = null;
        }

        Logger.Info('Shutdown complete.');
    }
}
