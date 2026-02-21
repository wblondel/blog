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

export function usePlural(lang: keyof typeof ui) {
    const t = useTranslations(lang);
    return function p(count: number, baseKey: string) {
        let suffix = 'other';
        if (count === 0) suffix = 'zero';
        else if (count === 1) suffix = 'one';
        
        const fullKey = `${baseKey}.${suffix}` as keyof typeof ui[typeof defaultLang];
        let translated = t(fullKey);
        
        // Fallback to English if translation is missing
        if (!translated) {
            const fallbackKey = `${baseKey}.${suffix}` as keyof typeof ui['en'];
            translated = ui['en'][fallbackKey];
        }
        
        // Handle replacing the placeholder `{count}` if it exists
        if (translated && typeof translated === 'string') {
            return translated.replace('{count}', count.toString());
        }
        return '';
    }
}
