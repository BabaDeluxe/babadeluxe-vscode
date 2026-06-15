import * as vscode from 'vscode'

const baseUrl = process.env.FEEDBACK_API_URL
const FEEDBACK_API_URL = baseUrl ? `${baseUrl}/api/feedback` : null

export async function sendFeedback(): Promise<void> {
  if (!FEEDBACK_API_URL) {
    vscode.window.showWarningMessage(
      'BabaDeluxe: Feedback is not configured (FEEDBACK_API_URL not set).',
    )
    return
  }

  const message = await vscode.window.showInputBox({
    title: 'Send Feedback to BabaDeluxe',
    prompt: 'Bug, idea, or anything on your mind?',
    placeHolder: 'e.g. The diff view is missing syntax highlighting',
    ignoreFocusOut: true,
    validateInput: (v) =>
      v.trim().length === 0 ? 'Message cannot be empty' : undefined,
  })

  if (!message?.trim()) return

  try {
    const res = await fetch(FEEDBACK_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message.trim(), source: 'vscode' }),
    })
    if (res.ok) {
      vscode.window.showInformationMessage('BabaDeluxe: Feedback sent — thank you! 🙏')
    } else {
      vscode.window.showWarningMessage(
        `BabaDeluxe: Could not send feedback (HTTP ${res.status}). Please try again.`,
      )
    }
  } catch (err) {
    vscode.window.showWarningMessage(
      'BabaDeluxe: Network error sending feedback. Check your connection.',
    )
    console.error('[BabaDeluxe] sendFeedback error', err)
  }
}
