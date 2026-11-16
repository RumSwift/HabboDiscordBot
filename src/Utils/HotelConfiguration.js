export const Games = Object.freeze({ Habbo: 'HABBO', Origins: 'ORIGINS' });

export const GameLabels = Object.freeze({ [Games.Habbo]: 'Habbo', [Games.Origins]: 'Habbo Origins' });

// Emoji is an application emoji (developer portal -> Emojis), usable in every server without extra permissions.
// RoleType is looked up in GuildRoles, only in servers whose GuildType matches the hotel's Game.
// SeedRoleVariable is only read once, when the GuildRoles table is first filled.
export const Hotels = Object.freeze([
    { HotelCode: 'COM', Emoji: { name: 'ComFlag', id: '1558779213396574279' }, Game: Games.Habbo, Label: 'Habbo.com (English)', Hostname: 'www.habbo.com', NicknameTag: 'COM', ShortName: 'COM', RoleType: 'VERIFIED_COM', SeedRoleVariable: 'HABBO_ROLE_COM' },
    { HotelCode: 'COM_BR', Emoji: { name: 'BrazillianFlag', id: '1558779029446852678' }, Game: Games.Habbo, Label: 'Habbo.com.br (Português)', Hostname: 'www.habbo.com.br', NicknameTag: 'BR', ShortName: 'COM_BR', RoleType: 'VERIFIED_COM_BR', SeedRoleVariable: 'HABBO_ROLE_COM_BR' },
    { HotelCode: 'ES', Emoji: { name: 'SpannishFlag', id: '1558779031464185896' }, Game: Games.Habbo, Label: 'Habbo.es (Español)', Hostname: 'www.habbo.es', NicknameTag: 'ES', ShortName: 'ES', RoleType: 'VERIFIED_ES', SeedRoleVariable: 'HABBO_ROLE_ES' },
    { HotelCode: 'FI', Emoji: { name: 'FinishFlag', id: '1558779028117262409' }, Game: Games.Habbo, Label: 'Habbo.fi (Suomi)', Hostname: 'www.habbo.fi', NicknameTag: 'FI', ShortName: 'FI', RoleType: 'VERIFIED_FI', SeedRoleVariable: 'HABBO_ROLE_FI' },
    { HotelCode: 'FR', Emoji: { name: 'FrenchFlag', id: '1558779027068821634' }, Game: Games.Habbo, Label: 'Habbo.fr (Français)', Hostname: 'www.habbo.fr', NicknameTag: 'FR', ShortName: 'FR', RoleType: 'VERIFIED_FR', SeedRoleVariable: 'HABBO_ROLE_FR' },
    { HotelCode: 'DE', Emoji: { name: 'GermanFlag', id: '1558779025743282216' }, Game: Games.Habbo, Label: 'Habbo.de (Deutsch)', Hostname: 'www.habbo.de', NicknameTag: 'DE', ShortName: 'DE', RoleType: 'VERIFIED_DE', SeedRoleVariable: 'HABBO_ROLE_DE' },
    { HotelCode: 'IT', Emoji: { name: 'ItalianFlag', id: '1558779024401240098' }, Game: Games.Habbo, Label: 'Habbo.it (Italiano)', Hostname: 'www.habbo.it', NicknameTag: 'IT', ShortName: 'IT', RoleType: 'VERIFIED_IT', SeedRoleVariable: 'HABBO_ROLE_IT' },
    { HotelCode: 'NL', Emoji: { name: 'NetherlandsFlag', id: '1558779023339946065' }, Game: Games.Habbo, Label: 'Habbo.nl (Nederlands)', Hostname: 'www.habbo.nl', NicknameTag: 'NL', ShortName: 'NL', RoleType: 'VERIFIED_NL', SeedRoleVariable: 'HABBO_ROLE_NL' },
    { HotelCode: 'COM_TR', Emoji: { name: 'TurkishFlag', id: '1558779033334980618' }, Game: Games.Habbo, Label: 'Habbo.com.tr (Türkçe)', Hostname: 'www.habbo.com.tr', NicknameTag: 'TR', ShortName: 'COM_TR', RoleType: 'VERIFIED_COM_TR', SeedRoleVariable: 'HABBO_ROLE_COM_TR' },
    { HotelCode: 'ORIGINS_COM', Emoji: { name: 'ComFlag', id: '1558779213396574279' }, Game: Games.Origins, Label: 'Origins .com (English)', Hostname: 'origins.habbo.com', NicknameTag: 'COM', ShortName: 'Origins COM', RoleType: 'VERIFIED_COM', SeedRoleVariable: 'ORIGINS_VERIFIED_COM' },
    { HotelCode: 'ORIGINS_ES', Emoji: { name: 'SpannishFlag', id: '1558779031464185896' }, Game: Games.Origins, Label: 'Origins .es (Español)', Hostname: 'origins.habbo.es', NicknameTag: 'ES', ShortName: 'Origins ES', RoleType: 'VERIFIED_ES', SeedRoleVariable: 'ORIGINS_VERIFIED_ES' },
    { HotelCode: 'ORIGINS_BR', Emoji: { name: 'BrazillianFlag', id: '1558779029446852678' }, Game: Games.Origins, Label: 'Origins .com.br (Português)', Hostname: 'origins.habbo.com.br', NicknameTag: 'BR', ShortName: 'Origins BR', RoleType: 'VERIFIED_BR', SeedRoleVariable: 'ORIGINS_VERIFIED_BR' },
].map((Hotel) => Object.freeze(Hotel)));

const HotelsByCode = new Map(Hotels.map((Hotel) => [Hotel.HotelCode, Hotel]));

export function GetHotelCodes() {
    return Hotels.map((Hotel) => Hotel.HotelCode);
}

export function IsValidHotelCode(HotelCode) {
    return HotelsByCode.has(HotelCode);
}

export function IsValidGame(Game) {
    return Object.values(Games).includes(Game);
}

export function GetHotel(HotelCode) {
    const Hotel = HotelsByCode.get(HotelCode);
    if (!Hotel) {
        throw new Error(`Unknown hotel code: ${HotelCode}`);
    }
    return Hotel;
}

export function GetHotelsForGame(Game) {
    return Hotels.filter((Hotel) => Hotel.Game === Game);
}

export function GetGameForHotel(HotelCode) {
    return GetHotel(HotelCode).Game;
}

export function FormatHotel(HotelCode) {
    return HotelsByCode.get(HotelCode)?.ShortName ?? HotelCode;
}

export function FormatHotelEmoji(HotelCode) {
    const Emoji = HotelsByCode.get(HotelCode)?.Emoji;
    return Emoji ? `<:${Emoji.name}:${Emoji.id}>` : '';
}

// Flag plus short name, e.g. "<:ComFlag:...> COM", for logs and audits.
export function FormatHotelWithFlag(HotelCode) {
    return [FormatHotelEmoji(HotelCode), FormatHotel(HotelCode)].filter(Boolean).join(' ');
}
