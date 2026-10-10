export const Hotels = Object.freeze([
    { HotelCode: 'COM', Label: 'Habbo.com (English)', Hostname: 'www.habbo.com', RoleEnvironmentVariable: 'HABBO_ROLE_COM', NicknameTag: 'COM' },
    { HotelCode: 'COM_BR', Label: 'Habbo.com.br (Português)', Hostname: 'www.habbo.com.br', RoleEnvironmentVariable: 'HABBO_ROLE_COM_BR', NicknameTag: 'BR' },
    { HotelCode: 'ES', Label: 'Habbo.es (Español)', Hostname: 'www.habbo.es', RoleEnvironmentVariable: 'HABBO_ROLE_ES', NicknameTag: 'ES' },
    { HotelCode: 'FI', Label: 'Habbo.fi (Suomi)', Hostname: 'www.habbo.fi', RoleEnvironmentVariable: 'HABBO_ROLE_FI', NicknameTag: 'FI' },
    { HotelCode: 'FR', Label: 'Habbo.fr (Français)', Hostname: 'www.habbo.fr', RoleEnvironmentVariable: 'HABBO_ROLE_FR', NicknameTag: 'FR' },
    { HotelCode: 'DE', Label: 'Habbo.de (Deutsch)', Hostname: 'www.habbo.de', RoleEnvironmentVariable: 'HABBO_ROLE_DE', NicknameTag: 'DE' },
    { HotelCode: 'IT', Label: 'Habbo.it (Italiano)', Hostname: 'www.habbo.it', RoleEnvironmentVariable: 'HABBO_ROLE_IT', NicknameTag: 'IT' },
    { HotelCode: 'NL', Label: 'Habbo.nl (Nederlands)', Hostname: 'www.habbo.nl', RoleEnvironmentVariable: 'HABBO_ROLE_NL', NicknameTag: 'NL' },
    { HotelCode: 'COM_TR', Label: 'Habbo.com.tr (Türkçe)', Hostname: 'www.habbo.com.tr', RoleEnvironmentVariable: 'HABBO_ROLE_COM_TR', NicknameTag: 'TR' },
].map((Hotel) => Object.freeze(Hotel)));

const HotelsByCode = new Map(Hotels.map((Hotel) => [Hotel.HotelCode, Hotel]));

export function GetHotelCodes() {
    return Hotels.map((Hotel) => Hotel.HotelCode);
}

export function IsValidHotelCode(HotelCode) {
    return HotelsByCode.has(HotelCode);
}

export function GetHotel(HotelCode) {
    const Hotel = HotelsByCode.get(HotelCode);
    if (!Hotel) {
        throw new Error(`Unknown hotel code: ${HotelCode}`);
    }
    return Hotel;
}
