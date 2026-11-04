/**
 * Detects in-app browsers (SPEC 5A.4). Most links reach the clan through Zalo
 * or Facebook, whose built-in browsers cannot install a PWA and sometimes block
 * storage or the share sheet.
 */
export type InAppBrowser = 'zalo' | 'facebook' | 'messenger' | 'instagram' | 'tiktok';

export function detectInAppBrowser(ua: string): InAppBrowser | null {
  if (/Zalo/i.test(ua)) return 'zalo';
  if (/Messenger|FBAN\/Messenger|MessengerForiOS|MessengerLite/i.test(ua)) return 'messenger';
  if (/FBAN|FBAV|FB_IAB|FBIOS|FB4A/i.test(ua)) return 'facebook';
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/TikTok|musical_ly|BytedanceWebview/i.test(ua)) return 'tiktok';
  return null;
}

export const IN_APP_NAMES: Record<InAppBrowser, string> = {
  zalo: 'Zalo',
  facebook: 'Facebook',
  messenger: 'Messenger',
  instagram: 'Instagram',
  tiktok: 'TikTok',
};

export function isIos(ua: string): boolean {
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document);
}
