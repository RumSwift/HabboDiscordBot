## Requirements

- Node.js 20.10 or newer
- MariaDB 10.6 or newer (the schema uses MariaDB-specific features, so MySQL will not work)

## 1. Create the Discord bot

1. In the [Discord dev portal](https://discord.com/developers/applications), create an application.
2. Under Bot, copy the token, then turn on all privileged intents.
3. Under General Information, copy the Application ID.
4. Invite the bot to both with the bot and applications.commands scopes. Give it **Manage Roles**, **Manage Nicknames**, **Moderate Members**, **Kick Members**, **Ban Members**, **View Audit Log**, **Manage Threads**, **Create Public Threads**, **Send Messages**, **Send Messages in Threads**, **Embed Links**, **Attach Files** and **Read Message History**. In each server, move the bot's role above the verified roles it hands out. Optionally, also give it **Mention @everyone, @here and All Roles**: without it, `/sayembed` can't tag @everyone or @here, and can only tag roles that are set as mentionable.
5. You can cheat and instead of ticking all the perms to generate the link, use https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot+applications.commands&permissions=1426332044486

Fill in `.env`. You need:

| Setting | What it is                                                                                                                                     |
| --- |------------------------------------------------------------------------------------------------------------------------------------------------|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MariaDB conn. The db is created if it doesn't exist (Needs CREATE).                                                                            |
| `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` | From step 1.                                                                                                                                   |
| `INTERNAL_API_KEY`, `VERIFICATION_CODE_SECRET` | Random secrets, at least 32 characters each.                                                                                                   |
| `ADMIN_PASSWORD` | This ones optional - theres an amdin dash for setting roles and log settings theres also a command, so could leave blank. Command is `/setup`. |

## 2. Deploy
The repo has a `Dockerfile`- There's no build step.

```sh
docker build -t habboverifybot .
docker run -d --name habboverifybot --env-file .env --restart unless-stopped habboverifybot
```

- `DB_HOST` must be reachable from inside the container. `localhost` is the container itself..
- The db and tables are created on first start.