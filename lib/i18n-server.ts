import 'server-only';
import { cookies } from 'next/headers';
import { dict, isLang, LANG_COOKIE, type Lang } from './i18n';

export function getLang(): Lang {
  const v = cookies().get(LANG_COOKIE)?.value;
  return isLang(v) ? v : 'en';
}

export function getDict() {
  return dict[getLang()];
}
