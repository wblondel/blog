#!/usr/bin/env node
/**
 * rename-numbered-posts.mjs
 *
 * Modes:
 *   (default)        Rename numbered files (1.md, 2.md, …) using a slug
 *                    derived from the frontmatter title.
 *   --audit          Show the ideal slug for every existing non-numbered file.
 *                    No files are changed.
 *   --audit --fix    Audit + apply renames + write 301 redirect pairs to
 *                    src/redirects/slug-redirects.json so Astro can serve
 *                    the old URL as a permanent redirect to the new one.
 *
 * Slug rules (aligned with Google best practices):
 *  - Lowercase, words separated by single hyphens
 *  - Accented characters normalised to ASCII
 *  - Parenthetical acronyms like "(SOAR)" become "soar"
 *  - Only [a-z0-9-] kept
 *  - Maximum 70 characters, truncated on a word boundary
 *
 * Usage:
 *   node scripts/rename-numbered-posts.mjs [--dry-run]
 *   node scripts/rename-numbered-posts.mjs --audit [--lang en]
 *   node scripts/rename-numbered-posts.mjs --audit --fix [--lang en]
 */

import fs   from 'node:fs';
import path from 'node:path';

const DRY_RUN     = process.argv.includes('--dry-run');
const AUDIT       = process.argv.includes('--audit');
const FIX         = process.argv.includes('--fix');
const LANG_FILTER = process.argv.includes('--lang')
  ? process.argv[process.argv.indexOf('--lang') + 1]
  : null;

const BLOG_ROOT       = path.resolve('./src/content/blog');
const REDIRECTS_FILE  = path.resolve('./src/redirects/slug-redirects.json');
const MAX_SLUG_LEN    = 70;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse a frontmatter field, handling double/single/unquoted values correctly. */
function parseFrontmatterField(content, key) {
  // Double-quoted value — apostrophes inside are fine
  let m = content.match(new RegExp(`^${key}:\\s*"([^"\\n]*)"\\s*$`, 'm'));
  if (m) return m[1].trim();
  // Single-quoted value
  m = content.match(new RegExp(`^${key}:\\s*'([^'\\n]*)'\\s*$`, 'm'));
  if (m) return m[1].trim();
  // Unquoted value
  m = content.match(new RegExp(`^${key}:\\s*([^\\n"']+?)\\s*$`, 'm'));
  return m ? m[1].trim() : null;
}

/** Convert a post title into a Google-friendly URL slug. */
function titleToSlug(title) {
  const full = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')        // strip diacritics
    .replace(/\(([^)]+)\)/g, ' $1 ')        // expand parentheticals: (SOAR) → soar
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')            // non-alphanumeric → hyphen
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  // Only truncate when slug exceeds the max length
  if (full.length <= MAX_SLUG_LEN) return full;

  return full
    .slice(0, MAX_SLUG_LEN)
    .replace(/-[^-]*$/, '');               // trim word cut mid-way by slice
}

/** Load existing slug redirects from disk (or return empty object). */
function loadRedirects() {
  try {
    return JSON.parse(fs.readFileSync(REDIRECTS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

/** Persist the redirect map to disk. */
function saveRedirects(map) {
  fs.mkdirSync(path.dirname(REDIRECTS_FILE), { recursive: true });
  fs.writeFileSync(REDIRECTS_FILE, JSON.stringify(map, null, 2) + '\n', 'utf-8');
}

// ── Main ──────────────────────────────────────────────────────────────────────

const langs = fs.readdirSync(BLOG_ROOT)
  .filter(d => {
    if (LANG_FILTER && d !== LANG_FILTER) return false;
    return fs.statSync(path.join(BLOG_ROOT, d)).isDirectory();
  });

// Collect all redirect pairs to persist at the end
const newRedirects = loadRedirects();

for (const lang of langs) {
  const dir   = path.join(BLOG_ROOT, lang);
  const files = fs.readdirSync(dir).sort();

  if (AUDIT) {
    // ── AUDIT MODE ──────────────────────────────────────────────────────────
    console.log(`\n── ${lang} ─────────────────────────────────`);
    let changed = 0;

    for (const file of files) {
      if (!file.endsWith('.md') || /^\d+\.md$/.test(file)) continue;

      const content  = fs.readFileSync(path.join(dir, file), 'utf-8');
      const title    = parseFrontmatterField(content, 'title');
      if (!title) {
        console.warn(`⚠️  ${file}: no title found`);
        continue;
      }

      const current  = file.replace(/\.md$/, '');
      const expected = titleToSlug(title);

      if (current === expected) {
        console.log(`✅  ${file}`);
        continue;
      }

      changed++;
      console.log(`🔄  ${file}`);
      console.log(`    title:   "${title}"`);
      console.log(`    ideal:   ${expected}`);

      if (FIX) {
        const srcPath = path.join(dir, file);
        const dstPath = path.join(dir, `${expected}.md`);

        if (fs.existsSync(dstPath)) {
          console.log(`    ❌  target already exists — skipping rename.`);
          continue;
        }

        // Rename the file
        fs.renameSync(srcPath, dstPath);
        console.log(`    ✅  renamed.`);

        // Record the redirect: /lang/old-slug → /lang/new-slug/
        // Astro handles both /slug and /slug/ from a single key.
        const oldUrl = `/${lang}/${current}`;
        const newUrl = `/${lang}/${expected}/`;
        newRedirects[oldUrl] = newUrl;
      }
    }

    console.log(`\n${changed} file(s) differ from the ideal slug.`);

    if (FIX && changed > 0) {
      saveRedirects(newRedirects);
      console.log(`📝  Redirects written to ${REDIRECTS_FILE}`);
    }

  } else {
    // ── RENAME MODE (numbered files only) ────────────────────────────────────
    let renamed = 0, skipped = 0, collisions = 0;

    for (const file of files) {
      if (!/^\d+\.md$/.test(file)) continue;

      const srcPath = path.join(dir, file);
      const content = fs.readFileSync(srcPath, 'utf-8');
      const title   = parseFrontmatterField(content, 'title');

      if (!title) {
        console.warn(`⚠️  ${lang}/${file}: no title found, skipping.`);
        skipped++;
        continue;
      }

      const slug    = titleToSlug(title);
      const newName = `${slug}.md`;
      const dstPath = path.join(dir, newName);

      if (fs.existsSync(dstPath)) {
        console.error(`❌  ${lang}/${file}: "${newName}" already exists, skipping.`);
        collisions++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`[DRY-RUN] ${lang}/${file}  →  ${newName}`);
        console.log(`          title: "${title}"`);
      } else {
        fs.renameSync(srcPath, dstPath);
        console.log(`✅  ${lang}/${file}  →  ${newName}`);
      }
      renamed++;
    }

    console.log('\n────────────────────────────────');
    if (DRY_RUN) {
      console.log(`Would rename ${renamed} file(s).`);
    } else {
      console.log(`Renamed ${renamed} file(s). Skipped ${skipped}. Collisions ${collisions}.`);
    }
  }
}
