import { Console } from "../core/engine";

/*
 * cs_script has no "print to chat" function. The closest built-in route is the server `say`
 * command, which shows the text to everyone as a console message. Per-player messages need a
 * CustomHudLayout (see ui/hud.ts) or a map entity.
 */

/** Longest message `say` reliably accepts. */
export const MAX_CHAT_LENGTH = 200;

/**
 * Make text safe to embed in a console command. Removes `;` (which would start a new command),
 * quotes, line breaks and other control characters, and trims to `maxLength`.
 * Always use this for text that a player typed.
 */
export function sanitizeCommandText(text: string, maxLength = MAX_CHAT_LENGTH): string {
    return text
        .replace(/[\u0000-\u001f\u007f";]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLength);
}

export const Chat = {
    /** Show a message to everyone, sent by the server console (`say`). The text is sanitised. */
    say(message: string): void {
        const text = sanitizeCommandText(message);
        if (text) Console.ServerCommand(`say ${text}`);
    },

    /** Several lines, one `say` per line. */
    sayLines(lines: readonly string[]): void {
        for (const line of lines) Chat.say(line);
    },
};
