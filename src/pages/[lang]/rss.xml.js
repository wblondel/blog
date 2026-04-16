import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { useTranslations } from '../../i18n/utils';
import { languages } from '../../i18n/ui';

export function getStaticPaths() {
    return Object.keys(languages).map((lang) => ({ params: { lang } }));
}

export async function GET(context) {
    const { lang } = context.params;

    const t = useTranslations(lang);

    // Only get posts for the requested language
    const blog = await getCollection('blog', ({ id }) => id.startsWith(`${lang}/`));

    // Sort posts by publication date
    blog.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

    return rss({
        title: t('rss.title'),
        description: t('home.about'),
        site: context.site,
        items: blog.map((post) => {
            const slug = post.id.split('/').pop();
            return {
                title: post.data.title,
                pubDate: post.data.pubDate,
                description: post.data.description,
                link: `/${lang}/${slug}/`,
            };
        }),
        // Dynamically set the correct language tag
        customData: `<language>${t('site.locale').toLowerCase()}</language>`,
    });
}
