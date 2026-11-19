// Open Modpanels, so they can be closed once an action is done or after a minute without use.
// A panel is an ephemeral reply to /modpanel, so it is deleted through that command's interaction (valid for 15 minutes).
export const PanelIdleMs = 60 * 1000;

// One panel per moderator and member in a server: opening another replaces it.
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

    // Something was clicked on the panel: it stays open for another IdleMs.
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

// Called by an action once it has been applied: the panel it came from closes.
export function ClosePanel(Interaction, TargetId, Logger) {
    OpenPanels.Close(PanelKey(Interaction, TargetId), Logger);
}

export function TouchPanel(Interaction, TargetId) {
    OpenPanels.Touch(PanelKey(Interaction, TargetId));
}
