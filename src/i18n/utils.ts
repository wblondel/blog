import { ui, defaultLang } from './ui';

export function getLangFromUrl(url: URL) {
    const base = import.meta.env.BASE_URL; // e.g. '/blog/'
    const path = url.pathname.startsWith(base) ? url.pathname.slice(base.length) : url.pathname.replace(/^\//, '');
    const [lang] = path.split('/');
    if (lang in ui) return lang as keyof typeof ui;
    return defaultLang;
}

export function useTranslations(lang: keyof typeof ui) {
    return function t(key: keyof typeof ui[typeof defaultLang]) {
        return ui[lang][key] || ui[defaultLang][key];
    }
}
