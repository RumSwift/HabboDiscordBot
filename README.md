# Habbo Discord Bot

A Discord bot for Habbo and Habbo Origins communities. It does three main jobs:

- **Verification:** members link their Discord account to a Habbo account by putting a code in their motto. They get a role per hotel and a matching nickname.
- **Moderation:** `/modpanel` sanctions, history, notes and forgiveness, plus `/dmmod` and mod mail.
- **Logging:** deleted and edited messages, role changes, joins and leaves, bans, staff actions and more, each to its own channel.

It can serve one Habbo server, one Habbo Origins server, or both.

## Requirements

- Node.js 20.10 or newer
- MariaDB 10.6 or newer (the schema uses MariaDB-specific features, so MySQL will not work)
- A Discord application with a bot user

## 1. Create the Discord bot

1. In the [Discord developer portal](https://discord.com/developers/applications), create an application.
2. Under **Bot**, copy the token, then turn on both privileged intents: **Server Members** and **Message Content**.
3. Under **General Information**, copy the **Application ID**.
4. Invite the bot to your server(s) with the `bot` and `applications.commands` scopes. Give it **Manage Roles**, **Manage Nicknames**, **Moderate Members**, **Kick Members**, **Ban Members**, **View Audit Log**, **Manage Threads**, **Create Public Threads**, **Send Messages**, **Send Messages in Threads**, **Embed Links**, **Attach Files** and **Read Message History**. In each server, move the bot's role above the verified roles it hands out. Optionally, also give it **Mention @everyone, @here and All Roles**: without it, `/sayembed` can only tag roles that are set as mentionable.

The bot uploads its own custom emojis (flags, arrows and so on, from `assets/emojis/`) to your application the first time it starts. You don't need to do anything for this.

## 2. Configure

```sh
npm ci
cp .env.example .env
```

Fill in `.env`. Every value is explained in the file. You need:

| Setting | What it is |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Your MariaDB connection. The database is created if it doesn't exist (this needs the CREATE permission; otherwise create an empty database yourself). |
| `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` | From step 1. |
| `INTERNAL_API_KEY`, `VERIFICATION_CODE_SECRET` | Random secrets, at least 32 characters each. |
| `ADMIN_PASSWORD` | The password for the admin page, at least 16 characters. |

To generate a secret:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

The `.env` file holds only secrets and settings. It has no server, role or channel IDs: those are set on the admin page.

## 3. Start

```sh
npm start
```

On every start the bot creates the database and any missing tables or columns. It never changes or deletes existing tables, columns or data. To prepare the database without starting the bot, run `npm run setup-db`.

## 4. Choose your servers, roles and log channels

Open **http://127.0.0.1:3000/admin/** (the address uses `API_HOST` and `API_PORT`) and sign in with `ADMIN_PASSWORD`.

For each server (Habbo and/or Habbo Origins):

1. Enter the Discord server ID. To copy IDs, turn on Developer Mode in Discord (Settings, Advanced), then right-click a server, channel or role and choose **Copy ID**.
2. Tick or untick **Force verified members' nicknames**. When it's on, verified members are renamed to `HabboName (HOTEL)`, and the name is changed back if they edit it. This is set per server, so for example Habbo can have it on and Origins off.
3. Enter the role ID for each hotel's verified role and for the moderator role.
4. Enter a channel ID for each log, or leave it empty to turn that log off. If the bot can see the channel and it is the wrong kind (for example a text channel for the mod mail forum), saving is refused with a message saying which one.
5. Click **Save**. Changes take effect straight away; you don't need to restart the bot.

Below each saved server you can also enter channel or category IDs for the logs to ignore. This is the same list that `/stoplogs` and `/startlogs` edit.

### Reaching the admin page on a server

By default the page only listens on the machine the bot runs on (`API_HOST=127.0.0.1`). From your own computer, open an SSH tunnel:

```sh
ssh -L 3000:127.0.0.1:3000 you@your-server
```

Then browse to http://127.0.0.1:3000/admin/. If you want the page reachable over the internet, put it behind an HTTPS reverse proxy (Caddy, nginx); never expose it over plain HTTP.

How the page is protected:

- **Sign-in:** password only; there are no accounts.
- **Wrong passwords:** after 10 failed attempts, that address is locked out for 15 minutes.
- **Sessions:** last 12 hours and are lost when the bot restarts.
- **Cookie:** HttpOnly and SameSite=Strict, and marked Secure behind HTTPS.
- **Browser headers:** a strict Content Security Policy, and the page can't be framed.
- **Switching it off:** leave `ADMIN_PASSWORD` empty and the page is disabled completely.

## Development

```sh
npm run dev     # restarts on file changes
npm test        # unit tests; database tests run when .env.test is filled in (see .env.test.example)
```

The whole database schema is in `src/Database/Schema.js`, and changes are picked up on the next start:

- **New table:** add it to `Tables`.
- **New column on an existing table:** add it to the table's definition *and* to `AddedColumns`, so existing databases get it too.
- **Changing or removing a column:** this isn't done automatically. Run the `ALTER TABLE` on existing databases yourself.
