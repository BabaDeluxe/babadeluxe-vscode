# 🛠 Backend AI API Keys Import (WebSocket)

This document outlines the expected WebSocket communication for importing AI API keys detected in VS Code settings.

## Overview

When the user clicks "OK" on the API key import prompt, the VS Code extension sends the detected keys to the sidebar webview. The webview is then responsible for forwarding these keys to the BabaDeluxe backend via a WebSocket connection.

---

## 1. Extension to Webview Message

The extension sends the following message to the sidebar webview:

```typescript
{
  "type": "import-ai-keys",
  "payload": [
    { "provider": "openai", "key": "sk-..." },
    { "provider": "anthropic", "key": "sk-ant-..." }
  ]
}
```

---

## 2. Webview to Backend WebSocket Message (Expected)

The webview should forward this data to the backend via the existing WebSocket connection. We expect the message format to follow the established backend protocol.

**Recommended Message Structure:**

```json
{
  "event": "settings.import-api-keys",
  "data": {
    "keys": [
      { "provider": "openai", "key": "sk-..." },
      { "provider": "anthropic", "key": "sk-ant-..." }
    ]
  }
}
```

---

## 3. Backend Handling Requirements

Upon receiving the `settings.import-api-keys` event, the backend should:

1. **Validation**: Verify that the provided keys are valid for their respective providers.
2. **Persistence**: Securely store these keys in the user's profile/settings in the database.
3. **Overwrite Policy**: If a key already exists for a provider, the backend should overwrite it with the newly imported key (as the user explicitly accepted the import).
4. **Acknowledgment**: Send an acknowledgment message back to the webview to indicate success or failure.

**Example Success Response:**

```json
{
  "event": "settings.import-api-keys-success",
  "data": {
    "count": 2
  }
}
```

---

## 4. Security Considerations

- **Encryption**: API keys MUST be encrypted at rest in the database.
- **Transport**: All WebSocket communication MUST happen over WSS (WebSocket Secure).
- **Authentication**: Ensure the WebSocket connection is authenticated and the user is authorized to update their settings.
