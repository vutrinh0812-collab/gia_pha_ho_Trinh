/**
 * Share a link (SPEC 5A.4): the phone's share sheet when available (Zalo,
 * Messenger…), else copy to the clipboard, else hand the link back so the page
 * can show it for manual copying (some in-app browsers block both).
 */
export type ShareResult = { kind: 'shared' } | { kind: 'cancelled' } | { kind: 'copied' } | { kind: 'manual'; url: string };

export async function shareLink(data: { title: string; text?: string; url: string }): Promise<ShareResult> {
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share(data);
      return { kind: 'shared' };
    }
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') return { kind: 'cancelled' };
    // Fall through: some WebViews expose share() but reject it.
  }
  try {
    await navigator.clipboard.writeText(data.url);
    return { kind: 'copied' };
  } catch {
    return { kind: 'manual', url: data.url };
  }
}
