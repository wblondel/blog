import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

import icon from 'astro-icon';

// Auto-generate french fallback redirects to preserve localized routing exactly without causing 404s
import fs from 'node:fs';
import path from 'node:path';

function getLocaleRedirects() {
    const redirects = {};
    const base = '';
    
    try {
        const parseLanguageDir = (lang) => {
            const blogDir = path.resolve(`./src/content/blog/${lang}`);
            if (fs.existsSync(blogDir)) {
                const files = fs.readdirSync(blogDir);
                for (const file of files) {
                    if (file.endsWith('.md')) {
                        const slug = file.replace('.md', '');
                        // Map lang route. (English defaults might get overwritten by FR intentionally if we reverse the loop, but we do EN first then FR overwrites.)
                        redirects[`/${slug}`] = `${base}/${lang}/${slug}/`;
                        
                        const content = fs.readFileSync(path.join(blogDir, file), 'utf-8');
                        const tagsMatch = content.match(/tags:\s*\[([^\]]+)\]/);
                        if (tagsMatch) {
                            const tags = tagsMatch[1].split(',').map(t => t.replace(/['"]/g, '').trim().toLowerCase().replace(/\s+/g, '-'));
                            for (const tag of tags) {
                                redirects[`/tag/${tag}`] = `${base}/${lang}/tag/${tag}/`;
                            }
                        }
                    }
                }
            }
            const seriesDir = path.resolve(`./src/content/series/${lang}`);
            if (fs.existsSync(seriesDir)) {
                const files = fs.readdirSync(seriesDir);
                for (const file of files) {
                    if (file.endsWith('.md')) {
                        const slug = file.replace('.md', '');
                        redirects[`/series/${slug}`] = `${base}/${lang}/series/${slug}/`;
                    }
                }
            }
        };

        // Parse English first.
        parseLanguageDir('en');
        // Parse French second (so identical slugs get directed to French if explicitly requested by someone reading FR? Wait, actually we usually want EN as default. Let's do FR first, then EN overwrites).
        parseLanguageDir('fr');
        parseLanguageDir('en');
        
        redirects['/tags'] = `${base}/en/tags/`;
        redirects['/archive'] = `${base}/en/archive/`;
        redirects['/series'] = `${base}/en/series/`;
        
    } catch (e) {
        console.error("Error generating redirects:", e);
    }
    return redirects;
}

// 301 redirects for renamed slugs — maintained by scripts/rename-numbered-posts.mjs --audit --fix
function getSlugRedirects() {
    const redirectsFile = path.resolve('./src/redirects/slug-redirects.json');
    if (!fs.existsSync(redirectsFile)) return {};
    try {
        const map = JSON.parse(fs.readFileSync(redirectsFile, 'utf-8'));
        const result = {};
        for (const [oldUrl, newUrl] of Object.entries(map)) {
            result[oldUrl] = { status: 301, destination: newUrl };
        }
        return result;
    } catch (e) {
        console.error('Error reading slug-redirects.json:', e);
        return {};
    }
}

function getTagRedirects() {
    const redirectsFile = path.resolve('./src/redirects/tag-redirects.json');
    if (!fs.existsSync(redirectsFile)) return {};
    try {
        const map = JSON.parse(fs.readFileSync(redirectsFile, 'utf-8'));
        const result = {};
        for (const [oldUrl, newUrl] of Object.entries(map)) {
            result[oldUrl] = { status: 301, destination: newUrl };
        }
        return result;
    } catch (e) {
        console.error('Error reading tag-redirects.json:', e);
        return {};
    }
}

function getCustomRedirects() {
    const redirectsFile = path.resolve('./src/redirects/custom-redirects.json');
    if (!fs.existsSync(redirectsFile)) return {};
    try {
        const map = JSON.parse(fs.readFileSync(redirectsFile, 'utf-8'));
        const result = {};
        for (const [oldUrl, newUrl] of Object.entries(map)) {
            result[oldUrl] = { status: 301, destination: newUrl };
        }
        return result;
    } catch (e) {
        console.error('Error reading custom-redirects.json:', e);
        return {};
    }
}

// https://astro.build/config
export default defineConfig({
  site: 'https://williamblondel.fr',
  //base: '/blog/', 
  image: {
    domains: ["cdn.hashnode.com"]
  },
  vite: {
    server: {
      allowedHosts: ['411f-2a01-e0a-517-2360-35d9-a79-9f78-3366.ngrok-free.app']
    },
    plugins: [tailwindcss()]
  },
  integrations: [
    mdx(),
    sitemap({
      i18n: {
        defaultLocale: 'en',
        locales: {
          en: 'en',
          fr: 'fr',
        }
      }
    }),
    icon({
      include: {
        "fa6-solid": ["*"],
        "fa6-brands": ["*"],
        "fa6-regular": ["*"]
      }
    })
  ],
  i18n: {
    defaultLocale: "en",
    locales: ["en", "fr"],
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false
    }
  },
  redirects: {
    ...getLocaleRedirects(),
    ...getSlugRedirects(),
    ...getTagRedirects(),
    ...getCustomRedirects(),
  }
});