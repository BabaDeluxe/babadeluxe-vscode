# babadeluxe-vscode

<p align="left">
  <img src="https://img.shields.io/badge/license-EUPL%201.2-6a5acd?style=flat-rounded" alt="license">
  <img src="https://img.shields.io/badge/code_style-XO-8a2be2?style=flat-rounded" alt="code style: xo">
  <img src="https://img.shields.io/badge/vscode-%3E%3D1.104-9a56bf?style=flat-rounded" alt="vscode version">
  <img src="https://img.shields.io/badge/node-%3E%3D20-b06ab3?style=flat-rounded" alt="node version">
</p>

> **The VS Code extension for the BabaDeluxe AI Coder.** Provides an AI-powered coding assistant directly within your IDE, featuring intelligent context management, Git integration, and seamless communication with the babadeluxe-webview.

## Overview

This extension brings the power of the BabaDeluxe AI Coder into Visual Studio Code. It serves as the bridge between your IDE and the AI backend, providing:

- **Intelligent Context Management**: Add files, folders, and code selections to the AI context with a single click.
- **Git Integration**: Generate commit messages automatically based on your staged changes.
- **Deep Webview Integration**: Embed the full-featured chat interface directly in VS Code's activity bar.
- **Native IDE Experience**: Full support for commands, context menus, and keyboard shortcuts.

## Features

### Auto-Context (BM25)

When no context is manually pinned, the extension automatically selects the most relevant files for every prompt using a BM25 full-text search index over your workspace. The ranking is a composite score of three signals:

- **BM25 relevance** — term frequency/inverse document frequency against the prompt text
- **Git recency** — recently modified files score higher
- **Session recency** — files accessed earlier in the current session score higher

The number of candidates fed to the model adapts based on total token budget. The index is built incrementally on workspace open and updated on file saves.

### BabaContext™ — Manual Pinning

For precise control, pin any file, folder, or selection to the context explicitly. Pinned items are always included regardless of the BM25 ranking and persist across prompts until cleared.

- **Add File to BabaContext™**: Add individual files via explorer context menu.
- **Add Folder to BabaContext™**: Add entire folders for comprehensive codebase coverage.
- **Add Code to BabaContext™**: Add selected code snippets directly from the editor.
- **Set Context Root**: Define the root folder for auto-context search scope.
- **Clear Context Root**: Reset the context root folder.

### Git Integration

- **Generate Commit Message**: Automatically generates a semantic commit message from staged changes in the SCM view.

### Chat Interface

- **Integrated Chat Panel**: Access the full AI coding assistant from VS Code's activity bar.
- **Settings Management**: Configure the extension through VS Code settings.

## Commands

| Command | Description |
| :--- | :--- |
| `babadeluxe-ai-coder.context.addFileToBabaContext` | Add file to context |
| `babadeluxe-ai-coder.context.addFolderToBabaContext` | Add folder to context |
| `babadeluxe-ai-coder.context.addSelectionToBabaContext` | Add selection to context |
| `babadeluxe-ai-coder.clearContextRoot` | Clear context root folder |
| `babadeluxe-ai-coder.git.generateCommitMessage` | Generate commit message |
| `babadeluxe-ai-coder.openSettings` | Open extension settings |
| `babadeluxe-ai-coder.setContextRoot` | Set context root folder |
| `babadeluxe-ai-coder.showChat` | Show chat panel |

## Prerequisites

- **VS Code**: >= 1.104.0
- **Node.js**: >= 20.19.0
- **npm**: >= 10.8.0

## Installation & Development

### Installation

```bash
npm install
```

### Development

```bash
npm run watch
```

### Building

```bash
npm run build
```

Package for distribution:

```bash
npm run package
```

## NPM Scripts

| Script | Description |
| :--- | :--- |
| `generate:commands-registry` | Generate the commands registry from package.json |
| `compile` | Compile with TypeScript and Vite |
| `build` | Build the extension |
| `watch` | Build in watch mode for development |
| `test` | Run tests with Vitest |
| `format` | Fix linting issues with XO and Prettier |
| `typecheck` | Run TypeScript type checking |
| `package` | Package the extension with vsce |

## Architecture

The extension is built using:

- **reactive-vscode** — reactive VS Code API integration
- **Hono** — lightweight HTTP server for webview communication
- **@babadeluxe/shared** — shared types and utilities
- **@supabase/supabase-js** — authentication integration
- **wink-bm25-text-search** — full-text search for auto-context indexing
- **stopword** — text processing for search optimization

### Project Structure

| Directory | Purpose |
| :--- | :--- |
| `src/commands/` | VS Code command implementations |
| `src/webview/` | Webview communication and Hono server |
| `src/context/` | Auto-context BM25 pipeline and BabaContext™ management |
| `src/git/` | Git integration and commit message generation |

## License

This project is licensed under the **European Union Public License 1.2 (EUPL-1.2)**.

---

**BabaDeluxe** — _Redefining the Future of Software Development._
