const Prefix = 'HV';
const Separator = ':';
const MaxCustomIdLength = 100; // Discord limit

export function BuildCustomId(Action, OwnerDiscordUserId, ...Arguments) {
    const CustomId = [Prefix, Action, OwnerDiscordUserId, ...Arguments.map(String)].join(Separator);
    if (CustomId.length > MaxCustomIdLength) {
        throw new Error(`Custom ID is too long (${CustomId.length} characters): ${Action}`);
    }
    return CustomId;
}

export function ParseCustomId(CustomId) {
    if (typeof CustomId !== 'string') {
        return null;
    }
    const Parts = CustomId.split(Separator);
    if (Parts.length < 3 || Parts[0] !== Prefix || !Parts[1] || !/^\d{1,20}$/.test(Parts[2])) {
        return null;
    }
    return { Action: Parts[1], OwnerDiscordUserId: Parts[2], Arguments: Parts.slice(3) };
}
