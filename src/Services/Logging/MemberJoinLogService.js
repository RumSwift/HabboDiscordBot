import { Colours } from '../../Components/ComponentStyles.js';
import { LogChannelTypes } from '../../Repositories/GuildConfigurationRepository.js';
import { BuildLogCard, FormatDate } from './LogCard.js';

const NewAccountDays = 7;
const DayMs = 24 * 60 * 60 * 1000;

export function BuildMemberJoinedCard(Member, { Now = new Date() } = {}) {
    const { user: User } = Member;
    const Fields = [
        { Label: 'Account Created', Value: FormatDate(User.createdAt) },
        { Label: 'Member Count', Value: Member.guild.memberCount.toLocaleString('en-GB') },
    ];
    if (Now - User.createdAt < NewAccountDays * DayMs) {
        Fields.push({ Label: '⚠️ New Account', Value: `Created less than ${NewAccountDays} days ago` });
    }
    return BuildLogCard({ Title: `📥 ${User.bot ? 'Bot Added' : 'Member Joined'}`, User, Colour: Colours.Success, Fields, Now });
}

export class MemberJoinLogService {
    constructor({ GuildLogService }) {
        this.GuildLogService = GuildLogService;
    }

    async HandleMemberJoin(Member) {
        return this.GuildLogService.Send({
            GuildId: Member.guild.id,
            ChannelType: LogChannelTypes.MemberJoin,
            SourceChannel: null,
            Build: async () => ({ Card: BuildMemberJoinedCard(Member) }),
        });
    }
}
