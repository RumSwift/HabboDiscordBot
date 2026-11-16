import { Colours } from '../../Components/ComponentStyles.js';
import { LogChannelTypes } from '../../Repositories/GuildConfigurationRepository.js';
import { BuildLogCard, FormatDate, FormatRoles } from './LogCard.js';

export function BuildMemberLeftCard(Member, { Now = new Date() } = {}) {
    const { user: User } = Member;
    return BuildLogCard({
        Title: `📤 ${User.bot ? 'Bot Removed' : 'Member Left'}`,
        User,
        Colour: Colours.Danger,
        Fields: [
            { Label: 'Joined Server', Value: FormatDate(Member.joinedAt) },
            { Label: 'Account Created', Value: FormatDate(User.createdAt) },
            { Label: 'Roles', Value: FormatRoles(Member.roles?.cache?.values() ?? [], Member.guild.id) },
            { Label: 'Member Count', Value: Member.guild.memberCount.toLocaleString('en-GB') },
        ],
        Now,
    });
}

export class MemberLeaveLogService {
    constructor({ GuildLogService }) {
        this.GuildLogService = GuildLogService;
    }

    async HandleMemberLeave(Member) {
        // Members the bot never cached have no join date or roles to show.
        if (Member.partial) {
            return false;
        }
        return this.GuildLogService.Send({
            GuildId: Member.guild.id,
            ChannelType: LogChannelTypes.MemberLeave,
            SourceChannel: null,
            Build: async () => ({ Card: BuildMemberLeftCard(Member) }),
        });
    }
}
