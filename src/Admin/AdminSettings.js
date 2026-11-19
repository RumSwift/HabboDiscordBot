import { ChannelType } from 'discord.js';
import { DmModPingRoleType, LogChannelTypes } from '../Repositories/GuildConfigurationRepository.js';
import { GameLabels, Games, GetHotelsForGame } from '../Utils/HotelConfiguration.js';

// Everything that can be set per server on the admin page. Add a log channel or role type here to show it on the page.

const TextChannels = [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread];

export const ChannelSettings = Object.freeze(
    [
        { Type: LogChannelTypes.Verification, Group: 'Verification', Label: 'Verification log', Description: 'Every account link and unlink.' },
        { Type: LogChannelTypes.DmMod, Group: 'Mod team', Label: '/dmmod messages', Description: 'Where messages sent with /dmmod arrive.' },
        { Type: LogChannelTypes.ModMailForum, Group: 'Mod team', Label: 'Mod mail forum', Description: 'Forum channel where each mod mail gets its own thread.', ChannelTypes: [ChannelType.GuildForum] },
        { Type: LogChannelTypes.ModActions, Group: 'Moderation logs', Label: 'Mod actions', Description: 'Every /modpanel action, mod mail ban and emergency mute.' },
        { Type: LogChannelTypes.BanLog, Group: 'Moderation logs', Label: 'Bans', Description: 'A short card for every ban and unban.' },
        { Type: LogChannelTypes.DirectMessages, Group: 'Moderation logs', Label: 'Direct messages', Description: 'DMs sent to members from /modpanel.' },
        { Type: LogChannelTypes.Notes, Group: 'Moderation logs', Label: 'Notes', Description: 'Notes added to members from /modpanel.' },
        { Type: LogChannelTypes.Say, Group: 'Staff logs', Label: '/say', Description: 'Messages staff send as the bot.' },
        { Type: LogChannelTypes.SayEmbed, Group: 'Staff logs', Label: '/sayembed', Description: 'Embeds staff send as the bot.' },
        { Type: LogChannelTypes.MessageDelete, Group: 'Server logs', Label: 'Deleted messages', Description: 'Messages that were deleted.' },
        { Type: LogChannelTypes.MessageEdit, Group: 'Server logs', Label: 'Edited messages', Description: 'Messages that were edited.' },
        { Type: LogChannelTypes.RoleAdd, Group: 'Server logs', Label: 'Roles added', Description: 'Roles given to members.' },
        { Type: LogChannelTypes.RoleRemove, Group: 'Server logs', Label: 'Roles removed', Description: 'Roles taken from members.' },
        { Type: LogChannelTypes.MemberJoin, Group: 'Server logs', Label: 'Members joining', Description: 'Members who join the server.' },
        { Type: LogChannelTypes.MemberLeave, Group: 'Server logs', Label: 'Members leaving', Description: 'Members who leave the server.' },
    ].map((Setting) => Object.freeze({ ChannelTypes: TextChannels, ...Setting })),
);

export function GetRoleSettings(Game) {
    return [
        ...GetHotelsForGame(Game).map((Hotel) => ({ Type: Hotel.RoleType, Group: 'Verified roles', Label: Hotel.Label, Description: `Given to members who verify a ${Hotel.ShortName} account.` })),
        { Type: DmModPingRoleType, Group: 'Mod team', Label: 'Moderator role', Description: 'Pinged on new /dmmod messages and mod mail.' },
    ];
}

// Channels a log exclusion can point at: any channel a message can be sent in, or a whole category.
export const ExclusionChannelTypes = Object.freeze([...TextChannels, ChannelType.GuildVoice, ChannelType.GuildForum, ChannelType.GuildCategory]);

export const ServerTypes = Object.freeze(
    [Games.Habbo, Games.Origins].map((GuildType) =>
        Object.freeze({ GuildType, Label: `${GameLabels[GuildType]} server`, Roles: Object.freeze(GetRoleSettings(GuildType)), Channels: ChannelSettings }),
    ),
);
