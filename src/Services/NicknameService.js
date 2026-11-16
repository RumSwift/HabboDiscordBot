import { IntervalTask } from '../Utils/IntervalTask.js';
import { GetHotel } from '../Utils/HotelConfiguration.js';
import { DescribeError } from '../Utils/RetryPolicy.js';

export const MaxNicknameLength = 32;

export function BuildLinkedNickname(HabboUsername, HotelCode) {
    const Suffix = ` (${GetHotel(HotelCode).NicknameTag})`;
    return `${HabboUsername.slice(0, MaxNicknameLength - Suffix.length)}${Suffix}`;
}

const FullMemberFetchCooldownMs = 30 * 60 * 1000;

export class NicknameService {
    constructor({ Client, LinkRepository, GuildConfigurationRepository, Logger, IntervalMs = 60 * 1000, Clock = () => Date.now() }) {
        this.Client = Client;
        this.LinkRepository = LinkRepository;
        this.GuildConfigurationRepository = GuildConfigurationRepository;
        this.Logger = Logger;
        this.Clock = Clock;
        this.LastFullFetch = new Map();
        this.Task = new IntervalTask({ Name: 'NicknameSweep', IntervalMs, Task: () => this.SweepAllMembers(), Logger });
    }

    Start() {
        this.Task.Start();
    }

    async Stop() {
        await this.Task.Stop();
    }

    // Each server shows the account for its own game; servers not in the Guilds table are left alone.
    async SyncUser(DiscordUserId, { UnlinkedLink = null } = {}) {
        if (!this.Client?.isReady?.()) {
            return;
        }
        const [GuildTypes, ActiveLinks] = await Promise.all([
            this.GuildConfigurationRepository.GetGuildTypesById(),
            this.LinkRepository.FindActiveLinksByDiscordUserId(DiscordUserId),
        ]);
        for (const Guild of this.Client.guilds.cache.values()) {
            const GuildType = GuildTypes.get(Guild.id);
            if (!GuildType) {
                continue;
            }
            const Member = await Guild.members.fetch(DiscordUserId).catch(() => null);
            if (Member) {
                const ActiveLink = ActiveLinks.find((Link) => Link.Game === GuildType) ?? null;
                await this.ApplyNickname(Member, ActiveLink, UnlinkedLink?.Game === GuildType ? UnlinkedLink : null);
            }
        }
    }

    async HandleMemberUpdate(Member) {
        if (Member.user?.bot) {
            return;
        }
        const Guild = await this.GuildConfigurationRepository.FindGuildByGuildId(Member.guild?.id);
        if (!Guild) {
            return;
        }
        const ActiveLink = await this.LinkRepository.FindActiveLinkByDiscordUserId(Member.id, Guild.GuildType);
        await this.ApplyNickname(Member, ActiveLink, null);
    }

    async SweepAllMembers() {
        if (!this.Client?.isReady?.()) {
            return;
        }
        const [GuildTypes, ActiveLinks] = await Promise.all([this.GuildConfigurationRepository.GetGuildTypesById(), this.LinkRepository.GetAllActiveLinks()]);
        if (ActiveLinks.length === 0) {
            return;
        }

        for (const Guild of this.Client.guilds.cache.values()) {
            const GuildType = GuildTypes.get(Guild.id);
            if (!GuildType) {
                continue;
            }
            await this.EnsureMembersCached(Guild);
            for (const Link of ActiveLinks) {
                if (Link.Game !== GuildType) {
                    continue;
                }
                // Not cached means they are not in this server (joins are cached as they happen).
                const Member = Guild.members.cache.get(Link.DiscordUserId);
                if (Member) {
                    await this.ApplyNickname(Member, Link, null);
                }
            }
        }
    }

    async EnsureMembersCached(Guild) {
        if (Guild.members.cache.size >= Guild.memberCount) {
            return;
        }
        const LastFetch = this.LastFullFetch.get(Guild.id);
        if (LastFetch !== undefined && this.Clock() - LastFetch < FullMemberFetchCooldownMs) {
            return;
        }
        this.LastFullFetch.set(Guild.id, this.Clock());
        try {
            await Guild.members.fetch();
            this.Logger?.Debug('Cached server members for nickname enforcement', { GuildId: Guild.id, MemberCount: Guild.members.cache.size });
        } catch (FetchError) {
            this.Logger?.Warn('Could not fetch members for the nickname sweep', { GuildId: Guild.id, Error: FetchError });
        }
    }

    async ApplyNickname(Member, ActiveLink, UnlinkedLink) {
        let Wanted;
        if (ActiveLink) {
            Wanted = BuildLinkedNickname(ActiveLink.HabboUsername, ActiveLink.HotelCode);
        } else if (UnlinkedLink && Member.nickname === BuildLinkedNickname(UnlinkedLink.HabboUsername, UnlinkedLink.HotelCode)) {
            Wanted = null; // remove the nickname we forced; leave anything else alone
        } else {
            return 'UNCHANGED';
        }
        if (Member.nickname === Wanted || (Wanted === null && !Member.nickname)) {
            return 'UNCHANGED';
        }

        try {
            await Member.setNickname(Wanted, ActiveLink ? 'Habbo verification: nickname must match the linked Habbo account' : 'Habbo account unlinked');
            this.Logger?.Info(Wanted ? 'Nickname enforced' : 'Forced nickname removed', { DiscordUserId: Member.id, GuildId: Member.guild?.id });
            return 'CHANGED';
        } catch (NicknameError) {
            // Discord never lets a bot rename the server owner; anything else needs fixing.
            const IsExpected = Member.id === Member.guild?.ownerId || NicknameError?.code === 10007;
            this.Logger?.[IsExpected ? 'Debug' : 'Warn']('Could not set nickname', {
                DiscordUserId: Member.id,
                GuildId: Member.guild?.id,
                Error: DescribeError(NicknameError),
            });
            return 'FAILED';
        }
    }
}
