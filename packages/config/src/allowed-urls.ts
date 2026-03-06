import { env } from './index';

export function isAllowedRedirectUrl(url: string): boolean {
  const appUrl = env.APP_URL;
  if (!appUrl) return false;
  return url.startsWith(appUrl);
}
