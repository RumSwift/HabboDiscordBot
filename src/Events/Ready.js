import { Events } from 'discord.js';

export default {
    Name: Events.ClientReady,
    Once: true,
    async Execute(Client, { Logger }) {
        Logger.Info(`Logged in to Discord as ${Client.user.tag} (in ${Client.guilds.cache.size} server(s)).`);
    },
};
