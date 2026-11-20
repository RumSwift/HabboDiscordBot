import { CreateDatabasePool, TestDatabaseConnection } from './Database/DatabaseConnection.js';
import { CreateSchema, EnsureDatabaseExists } from './Database/Schema.js';
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
import { GuildConfigurationRepository } from './Repositories/GuildConfigurationRepository.js';
import { ModNoteRepository } from './Repositories/ModNoteRepository.js';
import { ModSanctionRepository } from './Repositories/ModSanctionRepository.js';
import { MemberRoleSnapshotRepository } from './Repositories/MemberRoleSnapshotRepository.js';
import { DmModRepository } from './Repositories/DmModRepository.js';
import { ModMailRepository } from './Repositories/ModMailRepository.js';
import { ModMailBanRepository } from './Repositories/ModMailBanRepository.js';
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
import { MemberRoleRestoreService } from './Services/MemberRoleRestoreService.js';
import { GuildLogService } from './Services/Logging/GuildLogService.js';
import { MessageDeleteLogService } from './Services/Logging/MessageDeleteLogService.js';
import { MessageEditLogService } from './Services/Logging/MessageEditLogService.js';
import { RoleChangeLogService } from './Services/Logging/RoleChangeLogService.js';
import { MemberJoinLogService } from './Services/Logging/MemberJoinLogService.js';
import { MemberLeaveLogService } from './Services/Logging/MemberLeaveLogService.js';
import { SayLogService } from './Services/Logging/SayLogService.js';
import { ModActionLogService } from './Services/Logging/ModActionLogService.js';
import { IntervalTask } from './Utils/IntervalTask.js';
import { AdminService } from './Admin/AdminService.js';
import { SyncApplicationEmojis } from './Utils/ApplicationEmojis.js';

const DefaultDependencies = {
    CreateDatabasePool,
    TestDatabaseConnection,
    EnsureDatabaseExists,
    CreateSchema,
    LoadCommands,
    RegisterGlobalCommands,
    CreateDiscordClient,
    RegisterEvents,
    LoginDiscordClient,
    StartApiServer,
    StopApiServer,
    SyncApplicationEmojis,
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
            await Deps.EnsureDatabaseExists(Config.Database, { Logger });
            this.Pool = Deps.CreateDatabasePool(Config.Database);
            await Deps.TestDatabaseConnection(this.Pool);
            Logger.Info('Database connection OK.');
            await Deps.CreateSchema(this.Pool, { Logger });

            this.DiscordClient = Deps.CreateDiscordClient();
            this.Services = this.CreateServices();

            const { Commands, ComponentHandlers, ModalHandlers } = await Deps.LoadCommands({ Logger });
            await Deps.RegisterGlobalCommands({ Commands, Token: Config.Discord.Token, ClientId: Config.Discord.ClientId, Logger });

            const ApiApp = CreateApiApp({ Config, Services: this.Services, Logger });
            this.ApiServer = await Deps.StartApiServer(ApiApp, { Host: Config.Api.Host, Port: Config.Api.Port, Logger });
            if (Config.Admin?.Password) {
                Logger.Info(`Admin page: http://${Config.Api.Host}:${this.ApiServer.address?.()?.port ?? Config.Api.Port}/admin/`);
            }

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
            await Deps.SyncApplicationEmojis(this.DiscordClient, { Logger });

            await this.CheckGuildConfiguration();
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
        const GuildConfiguration = new GuildConfigurationRepository(Pool);

        const HabboApi = new HabboApiService({ TimeoutMs: Config.HabboApi.TimeoutMs, MaxRetries: Config.HabboApi.MaxRetries, Logger });

        const LinkService = new HabboLinkService({
            Pool,
            LinkRepository,
            AuditRepository,
            NotificationRepository,
            RoleOperationRepository: RoleOperationRepositoryInstance,
            ChallengeRepository,
            GuildConfigurationRepository: GuildConfiguration,
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

        const GuildLogs = new GuildLogService({ Client: DiscordClient, GuildConfigurationRepository: GuildConfiguration, Logger });

        return {
            GuildConfigurationRepository: GuildConfiguration,
            AdminService: new AdminService({ GuildConfigurationRepository: GuildConfiguration, Client: DiscordClient, Logger, OnConfigurationChanged: () => this.CheckGuildConfiguration() }),
            DmModRepository: new DmModRepository(Pool),
            ModMailRepository: new ModMailRepository(Pool),
            ModMailBanRepository: new ModMailBanRepository(Pool),
            ModSanctionRepository: new ModSanctionRepository(Pool),
            ModNoteRepository: new ModNoteRepository(Pool),
            ModActionLogService: new ModActionLogService({ GuildLogService: GuildLogs }),
            MessageDeleteLogService: new MessageDeleteLogService({ GuildLogService: GuildLogs }),
            MessageEditLogService: new MessageEditLogService({ GuildLogService: GuildLogs }),
            RoleChangeLogService: new RoleChangeLogService({ GuildLogService: GuildLogs }),
            MemberJoinLogService: new MemberJoinLogService({ GuildLogService: GuildLogs }),
            MemberLeaveLogService: new MemberLeaveLogService({ GuildLogService: GuildLogs }),
            SayLogService: new SayLogService({ GuildLogService: GuildLogs }),
            MemberRoleRestoreService: new MemberRoleRestoreService({ SnapshotRepository: new MemberRoleSnapshotRepository(Pool), GuildConfigurationRepository: GuildConfiguration, Logger }),
            HabboApiService: HabboApi,
            HabboLinkService: LinkService,
            VerificationService: Verification,
            SessionService: new VerificationSessionService({ VerificationService: Verification, Logger }),
            AuditHistoryService: new AuditHistoryService({ LinkRepository, AuditRepository, NotificationRepository }),
            NicknameService: new NicknameService({ Client: DiscordClient, LinkRepository, GuildConfigurationRepository: GuildConfiguration, Logger, IntervalMs: Config.Discord.NicknameSweepIntervalSeconds * 1000 }),
            RoleRecoveryService: new RoleRecoveryService({
                RoleOperationRepository: RoleOperationRepositoryInstance,
                LinkRepository,
                DiscordRoleService: new DiscordRoleService({ Client: DiscordClient, Logger }),
                Logger,
            }),
            AuditNotificationWorker: new AuditNotificationWorker({
                NotificationRepository,
                DiscordAuditLogService: new DiscordAuditLogService({ Client: DiscordClient, Logger }),
                Logger,
            }),
        };
    }

    async CheckGuildConfiguration() {
        const { Logger, DiscordClient } = this;
        const Guilds = await this.Services.GuildConfigurationRepository.GetGuilds();
        if (Guilds.length === 0) {
            Logger.Warn('No servers in the Guilds table: roles, nicknames and audit logs are disabled until one is added.');
        }
        for (const Guild of Guilds) {
            const DiscordGuild = DiscordClient.guilds?.cache?.get(Guild.GuildId);
            if (!DiscordGuild) {
                Logger.Warn('The bot is not in a configured server', { Name: Guild.Name, GuildId: Guild.GuildId });
                continue;
            }
            try {
                await DiscordGuild.members?.fetch?.();
            } catch (FetchError) {
                Logger.Warn('Could not cache server members; roles of members who leave may not be saved', { Name: Guild.Name, GuildId: Guild.GuildId, Error: FetchError });
            }
        }
    }

    StartBackgroundTasks() {
        const { Services, Logger } = this;

        const ChallengeCleanup = new IntervalTask({
            Name: 'ChallengeCleanup',
            IntervalMs: 60000,
            Task: () => Services.VerificationService.ExpireOverdueChallenges(),
            Logger,
        });

        this.BackgroundTasks = [Services.AuditNotificationWorker, Services.RoleRecoveryService, Services.SessionService, ChallengeCleanup, Services.NicknameService];
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

        if (this.Pool) {
            await this.Pool.end().catch((StopError) => Logger.Warn('Error closing database pool', { Error: StopError }));
            this.Pool = null;
        }

        Logger.Info('Shutdown complete.');
    }
}
