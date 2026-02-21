# William Blondel — Blog

> 🌐 **[English](#english)** · **[Français](#français)**

---

## English

A bilingual personal blog and portfolio built with [Astro](https://astro.build), hosted on GitHub Pages.

📍 **Live site:** [wblondel.github.io/blog](https://wblondel.github.io/blog/)

### ✨ Features

- 🌍 **Bilingual** — Full English & French support with locale-aware routing (`/en/`, `/fr/`)
- 📝 **MDX** — Write articles in Markdown with embedded components
- 🗂️ **Series** — Group related posts into ordered series
- 🏷️ **Tags** — Tag-based post discovery with cross-language hreflang linking
- 📖 **Archive** — Chronological list of all articles
- 🖼️ **Dynamic OG images** — Per-post and per-tag Open Graph images generated at build time with [Satori](https://github.com/vercel/satori) + [resvg-js](https://github.com/yisibl/resvg-js)
- 📡 **RSS Feed** — Per-language RSS feeds
- 🗺️ **Sitemap** — Auto-generated multilingual sitemap
- 🌑 **Dark mode** — System-aware theme with localStorage persistence
- ⚡ **Static output** — Fully pre-rendered, zero JavaScript required

### 🛠️ Tech Stack

| | |
|---|---|
| Framework | [Astro 5](https://astro.build) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com) |
| Content | MDX via `@astrojs/mdx` |
| OG Images | Satori + resvg-js + sharp |
| Icons | [astro-icon](https://github.com/natemoo-re/astro-icon) + Font Awesome |
| Hosting | GitHub Pages |

### 🚀 Getting Started

**Prerequisites:** Node.js 18+

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Build for production
npm run build

# Preview the production build
npm run preview
```

The site is available at `http://localhost:4321/blog/`.

### 📁 Project Structure

```
src/
├── content/
│   ├── blog/
│   │   ├── en/        # English articles (.md / .mdx)
│   │   └── fr/        # French articles (.md / .mdx)
│   └── series/
│       ├── en/        # English series definitions
│       └── fr/        # French series definitions
├── i18n/
│   ├── ui.ts          # All translation strings
│   └── utils.ts       # useTranslations / getLangFromUrl helpers
├── layouts/
│   └── Layout.astro   # Base HTML layout (SEO, OG, hreflang)
├── pages/
│   ├── [lang]/
│   │   ├── index.astro          # Homepage
│   │   ├── [slug].astro         # Blog post
│   │   ├── [slug]/og.png.ts     # Per-post OG image
│   │   ├── archive.astro        # Archive
│   │   ├── tags/index.astro     # Tag list
│   │   ├── tag/[tag].astro      # Tag page
│   │   └── tag/[tag]/og.png.ts  # Per-tag OG image
│   │   └── series/[slug].astro  # Series page
│   └── rss.xml.js               # RSS feeds
└── public/
    └── og-default.png   # Default OG image (homepage, archive, etc.)
```

### ✍️ Writing Content

Create a `.md` or `.mdx` file in `src/content/blog/en/` (or `/fr/`) with this frontmatter:

```yaml
---
title: "My Article"
description: "A short description."
pubDate: 2026-01-15
coverImage: "../../../assets/post-covers/my-image.jpg"
tags: ["Astro", "Web Development"]
readTime: 5
# Optional — link to a series
series: "my-series-slug"
seriesOrder: 1
---
```

### 🌐 Internationalization

The routing pattern is `/{lang}/{slug}` (e.g., `/en/my-post`, `/fr/mon-article`). Both languages are treated as first-class — there is no "default" language fallback in content. The `hreflang` and `x-default` tags are emitted for all pages.

### 📜 License

MIT

---

## Français

Un blog personnel et portfolio bilingue construit avec [Astro](https://astro.build), hébergé sur GitHub Pages.

📍 **Site en ligne :** [wblondel.github.io/blog](https://wblondel.github.io/blog/)

### ✨ Fonctionnalités

- 🌍 **Bilingue** — Support complet anglais & français avec routage localisé (`/en/`, `/fr/`)
- 📝 **MDX** — Rédigez vos articles en Markdown avec des composants intégrés
- 🗂️ **Séries** — Regroupez des articles liés en séries ordonnées
- 🏷️ **Tags** — Navigation par tag avec linking `hreflang` inter-langues
- 📖 **Archives** — Liste chronologique de tous les articles
- 🖼️ **Images OG dynamiques** — Images Open Graph par article et par tag, générées à la compilation avec [Satori](https://github.com/vercel/satori) + [resvg-js](https://github.com/yisibl/resvg-js)
- 📡 **Flux RSS** — Flux RSS par langue
- 🗺️ **Sitemap** — Sitemap multilingue généré automatiquement
- 🌑 **Mode sombre** — Thème adaptatif au système avec persistance via localStorage
- ⚡ **Sortie statique** — Entièrement pré-rendu, aucun JavaScript requis

### 🛠️ Stack technique

| | |
|---|---|
| Framework | [Astro 5](https://astro.build) |
| Style | [Tailwind CSS 4](https://tailwindcss.com) |
| Contenu | MDX via `@astrojs/mdx` |
| Images OG | Satori + resvg-js + sharp |
| Icônes | [astro-icon](https://github.com/natemoo-re/astro-icon) + Font Awesome |
| Hébergement | GitHub Pages |

### 🚀 Démarrage

**Prérequis :** Node.js 18+

```bash
# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev

# Compiler pour la production
npm run build

# Prévisualiser le build de production
npm run preview
```

Le site est disponible à l'adresse `http://localhost:4321/blog/`.

### 📁 Structure du projet

```
src/
├── content/
│   ├── blog/
│   │   ├── en/        # Articles en anglais (.md / .mdx)
│   │   └── fr/        # Articles en français (.md / .mdx)
│   └── series/
│       ├── en/        # Définitions de séries en anglais
│       └── fr/        # Définitions de séries en français
├── i18n/
│   ├── ui.ts          # Toutes les chaînes de traduction
│   └── utils.ts       # Helpers useTranslations / getLangFromUrl
├── layouts/
│   └── Layout.astro   # Layout HTML de base (SEO, OG, hreflang)
├── pages/
│   ├── [lang]/
│   │   ├── index.astro          # Page d'accueil
│   │   ├── [slug].astro         # Article de blog
│   │   ├── [slug]/og.png.ts     # Image OG par article
│   │   ├── archive.astro        # Archives
│   │   ├── tags/index.astro     # Liste des tags
│   │   ├── tag/[tag].astro      # Page de tag
│   │   └── tag/[tag]/og.png.ts  # Image OG par tag
│   │   └── series/[slug].astro  # Page de série
│   └── rss.xml.js               # Flux RSS
└── public/
    └── og-default.png   # Image OG par défaut (accueil, archives, etc.)
```

### ✍️ Rédiger du contenu

Créez un fichier `.md` ou `.mdx` dans `src/content/blog/fr/` (ou `/en/`) avec ce frontmatter :

```yaml
---
title: "Mon article"
description: "Une courte description."
pubDate: 2026-01-15
coverImage: "../../../assets/post-covers/mon-image.jpg"
tags: ["Astro", "Développement Web"]
readTime: 5
# Optionnel — lier à une série
series: "slug-de-ma-serie"
seriesOrder: 1
---
```

### 🌐 Internationalisation

Le schéma de routage est `/{lang}/{slug}` (ex. `/en/my-post`, `/fr/mon-article`). Les deux langues sont traitées comme « première classe » — il n'y a pas de langue de repli par défaut pour le contenu. Les balises `hreflang` et `x-default` sont émises sur toutes les pages.

### 📜 Licence

MIT
