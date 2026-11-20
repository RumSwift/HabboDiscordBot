'use strict';

let State = null;
const Flash = {};

const $ = (Id) => document.getElementById(Id);

function El(Tag, Properties = {}, Children = []) {
    const Element = document.createElement(Tag);
    for (const [Key, Value] of Object.entries(Properties)) {
        if (Key === 'Text') {
            Element.textContent = Value;
        } else if (Key.startsWith('data-') || Key.startsWith('aria-') || Key === 'role') {
            Element.setAttribute(Key, Value);
        } else {
            Element[Key] = Value;
        }
    }
    for (const Child of [].concat(Children)) {
        if (Child !== null && Child !== undefined && Child !== false) {
            Element.append(Child);
        }
    }
    return Element;
}

class SignedOutError extends Error {}

async function Call(Method, Path, Body) {
    const Options = { method: Method, credentials: 'same-origin', headers: {} };
    if (Method !== 'GET') {
        Options.headers['Content-Type'] = 'application/json';
        Options.body = JSON.stringify(Body ?? {});
    }
    const Response = await fetch(`api${Path}`, Options);
    const Json = await Response.json().catch(() => null);
    if (Response.status === 401 && Path !== '/login') {
        ShowSignIn();
        throw new SignedOutError('Please sign in.');
    }
    if (!Response.ok || !Json?.Success) {
        throw new Error(Json?.Error?.Message ?? `Request failed (${Response.status}).`);
    }
    return Json.Data;
}

function ShowSignIn(Message = '') {
    $('App').hidden = true;
    $('SignOut').hidden = true;
    $('SignInForm').hidden = false;
    $('SignInMessage').textContent = Message;
    $('Password').focus();
}

function IdInput(Value, Label) {
    return El('input', { type: 'text', inputMode: 'numeric', placeholder: 'Discord ID', value: Value ?? '', autocomplete: 'off', spellcheck: false, size: 22, 'aria-label': Label });
}

function RenderSettings(Server, Saved, Inputs) {
    const Container = El('div');

    Container.append(El('h3', { Text: 'Nicknames' }));
    Inputs.EnforceNicknames = El('input', { type: 'checkbox', checked: Saved.EnforceNicknames !== false, 'data-setting': 'EnforceNicknames' });
    Container.append(
        El('p', {}, [
            El('label', {}, [Inputs.EnforceNicknames, ' Force verified members\' nicknames to "HabboName (HOTEL)" and change them back if edited']),
            El('br'),
            'When this is off, the bot leaves nicknames alone in this server (nicknames it already set are not changed back).',
        ]),
    );

    const AddSection = (Settings, Kind) => {
        Inputs[Kind] = {};
        const Groups = new Map();
        for (const Setting of Settings) {
            Groups.set(Setting.Group, [...(Groups.get(Setting.Group) ?? []), Setting]);
        }
        for (const [GroupName, GroupSettings] of Groups) {
            Container.append(El('h3', { Text: GroupName }));
            const Table = El('table', { border: 1, cellPadding: 4 }, El('tr', {}, [El('th', { Text: 'Setting' }), El('th', { Text: Kind === 'Roles' ? 'Role ID' : 'Channel ID' }), El('th', { Text: 'What it does' })]));
            for (const Setting of GroupSettings) {
                const Input = IdInput(Saved[Kind][Setting.Type], Setting.Label);
                Inputs[Kind][Setting.Type] = Input;
                Table.append(El('tr', { 'data-setting': Setting.Type }, [El('td', { Text: Setting.Label }), El('td', {}, Input), El('td', { Text: Setting.Description })]));
            }
            Container.append(Table);
        }
    };
    AddSection(Server.Roles, 'Roles');
    AddSection(Server.Channels, 'Channels');
    return Container;
}

function RenderExclusions(Server) {
    const Section = El('div', { 'data-part': 'Exclusions' }, [
        El('h3', { Text: 'Channels the logs ignore' }),
        El('p', { Text: 'Messages in these channels (or whole categories) are not logged. This is the same list /stoplogs and /startlogs change.' }),
    ]);
    const Message = El('span', { role: 'alert' });
    const Run = async (Button, Method, Path, Body) => {
        Button.disabled = true;
        try {
            State = await Call(Method, Path, Body);
            Render();
        } catch (CallError) {
            Button.disabled = false;
            if (!(CallError instanceof SignedOutError)) {
                Message.textContent = CallError.message;
            }
        }
    };

    const List = El('ul');
    for (const Exclusion of Server.Saved.Exclusions) {
        const Remove = El('button', { type: 'button', Text: 'Remove' });
        Remove.addEventListener('click', () => Run(Remove, 'DELETE', `/servers/${Server.GuildType}/exclusions/${Exclusion.ChannelId}`));
        List.append(El('li', {}, [El('span', { Text: Exclusion.ChannelId }), ' ', Remove]));
    }
    if (Server.Saved.Exclusions.length === 0) {
        List.append(El('li', {}, El('span', { Text: 'None. Everything is logged.' })));
    }

    const Input = IdInput('', 'Channel or category ID to ignore');
    const Add = El('button', { type: 'button', Text: 'Ignore', 'data-action': 'AddExclusion' });
    Add.addEventListener('click', () => {
        const ChannelId = Input.value.trim();
        if (!ChannelId) {
            Message.textContent = 'Enter a channel or category ID first.';
            return;
        }
        Run(Add, 'POST', `/servers/${Server.GuildType}/exclusions`, { ChannelId });
    });
    Section.append(List, El('p', {}, [El('label', {}, ['Channel or category ID: ', Input]), ' ', Add, ' ', Message]));
    return Section;
}

function RenderServer(Server) {
    const Section = El('section', { 'data-server': Server.GuildType });
    const IsSetUp = Boolean(Server.Saved);
    const Saved = Server.Saved ?? { Roles: {}, Channels: {}, EnforceNicknames: true };
    Section.append(
        El('hr'),
        El('h2', { Text: Server.Label }),
        El('p', { 'data-part': 'Status', Text: IsSetUp ? `Status: set up (${Server.Saved.Name})` : 'Status: not set up. This is optional: leave it unset if you only run one server.' }),
    );

    const ServerInput = IdInput(Saved.GuildId, `${Server.Label} ID`);
    ServerInput.setAttribute('data-part', 'ServerId');
    Section.append(El('p', {}, El('label', {}, ['Discord server ID: ', ServerInput])));

    const Inputs = {};
    Section.append(RenderSettings(Server, Saved, Inputs));

    const Save = El('button', { type: 'button', Text: `Save ${Server.Label}`, 'data-action': 'Save' });
    const Message = El('span', { role: 'status', 'data-part': 'SaveMessage', Text: Flash[Server.GuildType] ?? '' });
    delete Flash[Server.GuildType];
    Save.addEventListener('click', async () => {
        const GuildId = ServerInput.value.trim();
        if (!GuildId) {
            Message.textContent = 'Enter the Discord server ID first.';
            return;
        }
        const ReadAll = (Map) => Object.fromEntries(Object.entries(Map).map(([Type, Input]) => [Type, Input.value.trim()]));
        Save.disabled = true;
        Message.textContent = 'Saving...';
        try {
            State = await Call('PUT', `/servers/${Server.GuildType}`, {
                GuildId,
                EnforceNicknames: Inputs.EnforceNicknames.checked,
                Roles: ReadAll(Inputs.Roles),
                Channels: ReadAll(Inputs.Channels),
            });
            Flash[Server.GuildType] = 'Saved. The bot uses the new settings straight away.';
            Render();
        } catch (CallError) {
            Save.disabled = false;
            Message.textContent = CallError instanceof SignedOutError ? '' : CallError.message;
        }
    });
    Section.append(El('p', {}, [Save, ' ', Message]));

    if (IsSetUp) {
        Section.append(RenderExclusions(Server));
    }
    return Section;
}

function Render() {
    $('SignInForm').hidden = true;
    $('App').hidden = false;
    $('SignOut').hidden = false;
    $('BotStatus').textContent = State.IsConnected ? `Connected to Discord as ${State.BotName}.` : 'Not connected to Discord.';
    $('Servers').replaceChildren(...State.Servers.map(RenderServer));
}

async function Load() {
    try {
        State = await Call('GET', '/state');
        Render();
    } catch (CallError) {
        if (!(CallError instanceof SignedOutError)) {
            ShowSignIn(CallError.message);
        }
    }
}

$('SignInForm').addEventListener('submit', async (Event) => {
    Event.preventDefault();
    const Button = Event.submitter ?? $('SignInForm').querySelector('button');
    Button.disabled = true;
    try {
        await Call('POST', '/login', { Password: $('Password').value });
        $('Password').value = '';
        await Load();
    } catch (CallError) {
        $('SignInMessage').textContent = CallError.message;
    } finally {
        Button.disabled = false;
    }
});

$('SignOut').addEventListener('click', async () => {
    await Call('POST', '/logout').catch(() => {});
    ShowSignIn();
});

Load();
