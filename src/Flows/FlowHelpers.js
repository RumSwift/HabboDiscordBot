import { ComponentType, MessageFlags } from 'discord.js';

export async function ShowLoading(Interaction, LoadingLabel = 'Loading...') {
    const MessageComponents = Interaction.message?.components ?? [];
    if (MessageComponents.length === 0) {
        await Interaction.deferUpdate();
        return;
    }

    const LoadingComponents = MessageComponents.map((Component) =>
        DisableButtons(Component.toJSON ? Component.toJSON() : Component, Interaction.customId, LoadingLabel),
    );
    const IsComponentsV2 = Boolean(Interaction.message?.flags?.has?.(MessageFlags.IsComponentsV2));
    await Interaction.update(IsComponentsV2 ? { components: LoadingComponents, flags: MessageFlags.IsComponentsV2 } : { components: LoadingComponents });
}

function DisableButtons(Data, ClickedCustomId, LoadingLabel) {
    if (Data.type === ComponentType.Button) {
        const Button = { ...Data, disabled: true };
        if (Data.custom_id === ClickedCustomId) {
            Button.label = LoadingLabel;
            Button.emoji = { name: '⏳' };
        }
        return Button;
    }

    const Copy = { ...Data };
    // Received images carry extra read-only details (size, proxy URL...); send back only the URL.
    if (Copy.media?.url) {
        Copy.media = { url: Copy.media.url };
    }
    if (Copy.accessory) {
        Copy.accessory = DisableButtons(Copy.accessory, ClickedCustomId, LoadingLabel);
    }
    if (Copy.components) {
        Copy.components = Copy.components.map((Child) => DisableButtons(Child, ClickedCustomId, LoadingLabel));
    }
    return Copy;
}

export async function ApplyQueuedDiscordChanges(Context, DiscordUserId, { UnlinkedLink = null } = {}) {
    const { RoleRecoveryService, AuditNotificationWorker, NicknameService } = Context.Services;
    try {
        await RoleRecoveryService.ProcessDueOperations({ DiscordUserId });
    } catch (RoleError) {
        Context.Logger.Warn('Immediate role update failed; it will be retried in the background', { DiscordUserId, Error: RoleError });
    }
    try {
        await NicknameService?.SyncUser(DiscordUserId, { UnlinkedLink });
    } catch (NicknameError) {
        Context.Logger.Warn('Immediate nickname update failed; the background sweep will retry it', { DiscordUserId, Error: NicknameError });
    }
    AuditNotificationWorker.Wake();
}
