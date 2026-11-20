export const PanelIdleMs = 60 * 1000;

export function PanelKey(Interaction, TargetId) {
    return `${Interaction.guildId}:${Interaction.user.id}:${TargetId}`;
}

export class OpenPanelRegistry {
    constructor({ IdleMs = PanelIdleMs } = {}) {
        this.IdleMs = IdleMs;
        this.Panels = new Map();
    }

    Open(Key, CommandInteraction, Logger) {
        this.Close(Key, Logger);
        this.Panels.set(Key, { CommandInteraction, Logger, Timer: this.StartTimer(Key) });
    }

    Touch(Key) {
        const Panel = this.Panels.get(Key);
        if (!Panel) {
            return;
        }
        clearTimeout(Panel.Timer);
        Panel.Timer = this.StartTimer(Key);
    }

    Close(Key, Logger) {
        const Panel = this.Panels.get(Key);
        if (!Panel) {
            return;
        }
        clearTimeout(Panel.Timer);
        this.Panels.delete(Key);
        Panel.CommandInteraction.deleteReply().catch((DeleteError) => (Logger ?? Panel.Logger)?.Debug('Could not close Modpanel', { Error: DeleteError }));
    }

    StartTimer(Key) {
        const Timer = setTimeout(() => this.Close(Key), this.IdleMs);
        Timer.unref?.();
        return Timer;
    }
}

export const OpenPanels = new OpenPanelRegistry();

export function ClosePanel(Interaction, TargetId, Logger) {
    OpenPanels.Close(PanelKey(Interaction, TargetId), Logger);
}

export function TouchPanel(Interaction, TargetId) {
    OpenPanels.Touch(PanelKey(Interaction, TargetId));
}
