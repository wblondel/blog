import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
    // Aggregate ALL posts across all languages for readers that hit the root /rss.xml
    const blog = await getCollection('blog');

    // Sort all posts by publication date globally
    blog.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

    return rss({
        title: 'William Blondel’s Blog',
        description: 'Senior full-stack web developer and amateur genealogist. Born geek with an Amstrad CPC 6128. PHP & Laravel Expert.',
        site: context.site,
        items: blog.map((post) => {
            const lang = post.id.startsWith('fr/') ? 'fr' : 'en';
            const slug = post.slug.split('/').pop();

            return {
                title: post.data.title,
                pubDate: post.data.pubDate,
                description: post.data.description,
                // Include exactly which language this post is in the link
                link: `/${lang}/${slug}/`,
                // Explicitly define the language for this specific post
                customData: `<language>${lang === 'en' ? 'en-us' : 'fr-fr'}</language>`,
            };
        }),

        // We can use an XML stylesheet to style the feed, but more importantly:
        // We add atom:link tags to let smart RSS readers know there are alternative language feeds available!
        customData: `
      <language>en-us</language>
      <atom:link href="${context.site}en/rss.xml" rel="alternate" type="application/rss+xml" hreflang="en" />
      <atom:link href="${context.site}fr/rss.xml" rel="alternate" type="application/rss+xml" hreflang="fr" />
    `,
        xmlns: {
            atom: 'http://www.w3.org/2005/Atom',
        },
    });
}
