# Feedback Command Setup

## What it does
The `BabaDeluxe: Send Feedback` command opens an input box in VS Code and POSTs
the message to `/api/feedback` on the landing server. The landing server fans out
to both Telegram and SMTP email.

## Registration
In your extension's `activate` function, register the command:

```ts
import { sendFeedback } from './commands'

context.subscriptions.push(
  vscode.commands.registerCommand('babadeluxe.sendFeedback', sendFeedback),
)
```

Add to `package.json` under `contributes.commands`:

```json
{
  "command": "babadeluxe.sendFeedback",
  "title": "BabaDeluxe: Send Feedback"
}
```

Optionally add a keyboard shortcut in `contributes.keybindings`:

```json
{
  "command": "babadeluxe.sendFeedback",
  "key": "ctrl+shift+alt+f",
  "mac": "cmd+shift+alt+f"
}
```

## Environment Variable

Set `FEEDBACK_API_URL` at build time (e.g. in your CI/CD pipeline or `.env`):

```
FEEDBACK_API_URL=https://babadeluxe.com
```

Defaults to `https://babadeluxe.com` if unset.
