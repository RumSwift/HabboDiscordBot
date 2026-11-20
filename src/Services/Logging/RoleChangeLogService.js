import { Colours, Emojis, FormatEmoji } from '../../Components/ComponentStyles.js';
import { LogChannelTypes } from '../../Repositories/GuildConfigurationRepository.js';
import { BuildLogCard, FormatRoles } from './LogCard.js';

const Changes = Object.freeze({
    Added: { Title: 'Roles Added', Emoji: Emojis.Plus, Colour: Colours.Success, ChannelType: LogChannelTypes.RoleAdd },
    Removed: { Title: 'Roles Removed', Emoji: Emojis.Minus, Colour: Colours.Danger, ChannelType: LogChannelTypes.RoleRemove },
});

export function BuildRoleChangeCard(Member, Change, Roles, { Now = new Date() } = {}) {
    const { Title, Emoji, Colour } = Changes[Change];
    return BuildLogCard({
        Title: `${FormatEmoji(Emoji)} ${Roles.length === 1 ? Title.replace('Roles', 'Role') : Title}`,
        User: Member.user,
        Colour,
        Fields: [
            { Label: Change, Value: FormatRoles(Roles, Member.guild.id) },
            { Label: 'Current Roles', Value: FormatRoles(Member.roles.cache.values(), Member.guild.id) },
        ],
        Now,
    });
}

export class RoleChangeLogService {
    constructor({ GuildLogService }) {
        this.GuildLogService = GuildLogService;
    }

    async HandleMemberUpdate(OldMember, NewMember) {
        if (OldMember.partial) {
            return;
        }
        const OldRoles = OldMember.roles.cache;
        const NewRoles = NewMember.roles.cache;
        const Added = [...NewRoles.values()].filter((Role) => !OldRoles.has(Role.id));
        const Removed = [...OldRoles.values()].filter((Role) => !NewRoles.has(Role.id));

        for (const [Change, Roles] of [['Added', Added], ['Removed', Removed]]) {
            if (Roles.length > 0) {
                await this.GuildLogService.Send({
                    GuildId: NewMember.guild.id,
                    ChannelType: Changes[Change].ChannelType,
                    SourceChannel: null,
                    Build: async () => ({ Card: BuildRoleChangeCard(NewMember, Change, Roles) }),
                });
            }
        }
    }
}
