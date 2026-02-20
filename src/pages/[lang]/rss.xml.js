import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { languages } from '../../i18n/ui';

export function getStaticPaths() {
    return Object.keys(languages).map((lang) => ({ params: { lang } }));
}

export async function GET(context) {
    const { lang } = context.params;

    // Only get posts for the requested language
    const blog = await getCollection('blog', ({ id }) => id.startsWith(`${lang}/`));

    // Sort posts by publication date
    blog.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

    return rss({
        title: lang === 'fr' ? 'Le Blog de William Blondel' : 'William Blondel’s Blog',
        description: lang === 'fr'
            ? 'Développeur web full-stack senior et généalogiste amateur. Né geek avec un Amstrad CPC 6128. Expert PHP & Laravel.'
            : 'Senior full-stack web developer and amateur genealogist. Born geek with an Amstrad CPC 6128. PHP & Laravel Expert.',
        site: context.site,
        items: blog.map((post) => {
            const slug = post.slug.split('/').pop();
            return {
                title: post.data.title,
                pubDate: post.data.pubDate,
                description: post.data.description,
                link: `/${lang}/${slug}/`,
            };
        }),
        // Dynamically set the correct language tag
        customData: `<language>${lang === 'en' ? 'en-us' : 'fr-fr'}</language>`,
    });
}
