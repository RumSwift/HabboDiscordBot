import { ApplicationEmoji, FormatEmoji } from './ApplicationEmojis.js';

export const Games = Object.freeze({ Habbo: 'HABBO', Origins: 'ORIGINS' });

export const GameLabels = Object.freeze({ [Games.Habbo]: 'Habbo', [Games.Origins]: 'Habbo Origins' });

const FlagEmojis = {
    ComFlag: ApplicationEmoji('ComFlag', '1558779213396574279', '🇬🇧'),
    BrazillianFlag: ApplicationEmoji('BrazillianFlag', '1558779029446852678', '🇧🇷'),
    SpannishFlag: ApplicationEmoji('SpannishFlag', '1558779031464185896', '🇪🇸'),
    FinishFlag: ApplicationEmoji('FinishFlag', '1558779028117262409', '🇫🇮'),
    FrenchFlag: ApplicationEmoji('FrenchFlag', '1558779027068821634', '🇫🇷'),
    GermanFlag: ApplicationEmoji('GermanFlag', '1558779025743282216', '🇩🇪'),
    ItalianFlag: ApplicationEmoji('ItalianFlag', '1558779024401240098', '🇮🇹'),
    NetherlandsFlag: ApplicationEmoji('NetherlandsFlag', '1558779023339946065', '🇳🇱'),
    TurkishFlag: ApplicationEmoji('TurkishFlag', '1558779033334980618', '🇹🇷'),
};

export const Hotels = Object.freeze([
    { HotelCode: 'COM', Emoji: FlagEmojis.ComFlag, Game: Games.Habbo, Label: 'Habbo.com (English)', Hostname: 'www.habbo.com', NicknameTag: 'COM', ShortName: 'COM', RoleType: 'VERIFIED_COM' },
    { HotelCode: 'COM_BR', Emoji: FlagEmojis.BrazillianFlag, Game: Games.Habbo, Label: 'Habbo.com.br (Português)', Hostname: 'www.habbo.com.br', NicknameTag: 'BR', ShortName: 'COM_BR', RoleType: 'VERIFIED_COM_BR' },
    { HotelCode: 'ES', Emoji: FlagEmojis.SpannishFlag, Game: Games.Habbo, Label: 'Habbo.es (Español)', Hostname: 'www.habbo.es', NicknameTag: 'ES', ShortName: 'ES', RoleType: 'VERIFIED_ES' },
    { HotelCode: 'FI', Emoji: FlagEmojis.FinishFlag, Game: Games.Habbo, Label: 'Habbo.fi (Suomi)', Hostname: 'www.habbo.fi', NicknameTag: 'FI', ShortName: 'FI', RoleType: 'VERIFIED_FI' },
    { HotelCode: 'FR', Emoji: FlagEmojis.FrenchFlag, Game: Games.Habbo, Label: 'Habbo.fr (Français)', Hostname: 'www.habbo.fr', NicknameTag: 'FR', ShortName: 'FR', RoleType: 'VERIFIED_FR' },
    { HotelCode: 'DE', Emoji: FlagEmojis.GermanFlag, Game: Games.Habbo, Label: 'Habbo.de (Deutsch)', Hostname: 'www.habbo.de', NicknameTag: 'DE', ShortName: 'DE', RoleType: 'VERIFIED_DE' },
    { HotelCode: 'IT', Emoji: FlagEmojis.ItalianFlag, Game: Games.Habbo, Label: 'Habbo.it (Italiano)', Hostname: 'www.habbo.it', NicknameTag: 'IT', ShortName: 'IT', RoleType: 'VERIFIED_IT' },
    { HotelCode: 'NL', Emoji: FlagEmojis.NetherlandsFlag, Game: Games.Habbo, Label: 'Habbo.nl (Nederlands)', Hostname: 'www.habbo.nl', NicknameTag: 'NL', ShortName: 'NL', RoleType: 'VERIFIED_NL' },
    { HotelCode: 'COM_TR', Emoji: FlagEmojis.TurkishFlag, Game: Games.Habbo, Label: 'Habbo.com.tr (Türkçe)', Hostname: 'www.habbo.com.tr', NicknameTag: 'TR', ShortName: 'COM_TR', RoleType: 'VERIFIED_COM_TR' },
    { HotelCode: 'ORIGINS_COM', Emoji: FlagEmojis.ComFlag, Game: Games.Origins, Label: 'Origins .com (English)', Hostname: 'origins.habbo.com', ImageHotel: 'COM', NicknameTag: 'COM', ShortName: 'Origins COM', RoleType: 'VERIFIED_COM' },
    { HotelCode: 'ORIGINS_ES', Emoji: FlagEmojis.SpannishFlag, Game: Games.Origins, Label: 'Origins .es (Español)', Hostname: 'origins.habbo.es', ImageHotel: 'ES', NicknameTag: 'ES', ShortName: 'Origins ES', RoleType: 'VERIFIED_ES' },
    { HotelCode: 'ORIGINS_BR', Emoji: FlagEmojis.BrazillianFlag, Game: Games.Origins, Label: 'Origins .com.br (Português)', Hostname: 'origins.habbo.com.br', ImageHotel: 'BR', NicknameTag: 'BR', ShortName: 'Origins BR', RoleType: 'VERIFIED_BR' },
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
    return Emoji ? FormatEmoji(Emoji) : '';
}

export function FormatHotelWithFlag(HotelCode) {
    return [FormatHotelEmoji(HotelCode), FormatHotel(HotelCode)].filter(Boolean).join(' ');
}
