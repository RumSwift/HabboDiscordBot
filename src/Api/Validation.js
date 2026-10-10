import { ApiError } from './Middleware/ErrorHandler.js';
import { IsValidHotelCode } from '../Utils/HotelConfiguration.js';

export function RequireDiscordUserId(Value) {
    if (typeof Value !== 'string' || !/^\d{17,20}$/.test(Value)) {
        throw new ApiError(400, 'INVALID_DISCORD_USER_ID', 'DiscordUserId must be a Discord user ID (17-20 digits).');
    }
    return Value;
}

export function RequireHotelCode(Value) {
    if (typeof Value !== 'string' || !IsValidHotelCode(Value)) {
        throw new ApiError(400, 'INVALID_HOTEL_CODE', 'HotelCode must be one of the supported hotel codes.');
    }
    return Value;
}

export function RequireHabboUniqueId(Value) {
    if (typeof Value !== 'string' || !/^[A-Za-z0-9-]{1,64}$/.test(Value)) {
        throw new ApiError(400, 'INVALID_HABBO_UNIQUE_ID', 'HabboUniqueId must be 1-64 letters, digits or hyphens.');
    }
    return Value;
}

export function OptionalLinkId(Value) {
    if (Value === undefined || Value === null) {
        return null;
    }
    if (!/^\d{1,20}$/.test(String(Value))) {
        throw new ApiError(400, 'INVALID_LINK_ID', 'ExpectedLinkId must be a positive whole number.');
    }
    return String(Value);
}

export function OptionalReason(Value) {
    if (Value === undefined || Value === null) {
        return null;
    }
    if (typeof Value !== 'string' || Value.length > 200) {
        throw new ApiError(400, 'INVALID_REASON', 'Reason must be a string of at most 200 characters.');
    }
    return Value;
}

export function RequireOnlyFields(Body, AllowedFields) {
    if (Body === undefined || Body === null) {
        return {};
    }
    if (typeof Body !== 'object' || Array.isArray(Body)) {
        throw new ApiError(400, 'INVALID_BODY', 'Request body must be a JSON object.');
    }
    const UnknownFields = Object.keys(Body).filter((Field) => !AllowedFields.includes(Field));
    if (UnknownFields.length > 0) {
        throw new ApiError(400, 'UNKNOWN_FIELDS', `Unknown field(s): ${UnknownFields.join(', ')}.`);
    }
    return Body;
}
