import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

import icon from 'astro-icon';

// https://astro.build/config
export default defineConfig({
  site: 'https://wblondel.github.io',
  base: '/blog/', 
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
      prefixDefaultLocale: true
    }
  }
});