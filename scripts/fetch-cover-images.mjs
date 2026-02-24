#!/usr/bin/env node
/**
 * fetch-cover-images.mjs
 *
 * For every blog article that is missing a `coverImage` frontmatter field:
 *   1. Searches Unsplash for the best matching photo (query = article title)
 *   2. Triggers the required Unsplash download endpoint (API attribution rule)
 *   3. Downloads the full-resolution image to src/assets/post-covers/
 *      using the standard naming: {username}-{id}-unsplash.{ext}
 *   4. Writes the `coverImage` property into the file's frontmatter
 *
 * Requirements:
 *   - UNSPLASH_ACCESS_KEY in your .env file
 *     (get a free key at https://unsplash.com/developers)
 *
 * Usage:
 *   node scripts/fetch-cover-images.mjs [--dry-run] [--lang en] [--orientation landscape]
 *
 * Options:
 *   --dry-run           Show what would happen without downloading or writing files
 *   --lang <en|fr|…>    Only process a specific language directory (default: all)
 *   --orientation <landscape|portrait|squarish>  (default: landscape)
 */

import fs   from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { URL } from 'node:url';

// ── Config ────────────────────────────────────────────────────────────────────

const DRY_RUN     = process.argv.includes('--dry-run');
const LANG_FILTER = process.argv.includes('--lang')
  ? process.argv[process.argv.indexOf('--lang') + 1]
  : null;
const ORIENTATION = process.argv.includes('--orientation')
  ? process.argv[process.argv.indexOf('--orientation') + 1]
  : 'landscape';

const BLOG_ROOT   = path.resolve('./src/content/blog');
const COVERS_DIR  = path.resolve('./src/assets/post-covers');
const COVERS_RELATIVE = '../../../assets/post-covers'; // relative from blog/lang/

// ── .env reader (no external dep needed) ─────────────────────────────────────

function loadEnv(filepath = '.env') {
  try {
    const lines = fs.readFileSync(filepath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !(key in process.env)) process.env[key] = val;
    }
  } catch {
    // .env not found — rely on actual env vars
  }
}

loadEnv();

const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;
if (!UNSPLASH_KEY) {
  console.error('❌  UNSPLASH_ACCESS_KEY is not set. Add it to your .env file.');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse a single frontmatter field (handles single/double quoted values). */
function getFrontmatterField(content, key) {
  // Double-quoted value (apostrophes inside are fine)
  let m = content.match(new RegExp(`^${key}:\\s*"([^"\\n]*)"\\s*$`, 'm'));
  if (m) return m[1].trim();
  // Single-quoted value
  m = content.match(new RegExp(`^${key}:\\s*'([^'\\n]*)'\\s*$`, 'm'));
  if (m) return m[1].trim();
  // Unquoted value
  m = content.match(new RegExp(`^${key}:\\s*([^\\n"']+?)\\s*$`, 'm'));
  return m ? m[1].trim() : null;
}

/** Check whether the frontmatter block contains a coverImage line at all. */
function hasCoverImage(content) {
  return /^coverImage:/m.test(content);
}

/** Insert `coverImage: "value"` after the `description:` line in frontmatter. */
function insertCoverImage(content, value) {
  // Strategy: insert after the last frontmatter field before the closing ---
  // We look for pubDate or description as a stable anchor.
  const anchor = content.match(/^(pubDate:[^\n]+)/m);
  if (!anchor) {
    // Fallback: after the opening ---
    return content.replace(/^---\n/, `---\ncoverImage: "${value}"\n`);
  }
  return content.replace(
    anchor[0],
    `${anchor[0]}\ncoverImage: "${value}"`
  );
}

/** Common English stop words to remove before building the search query. */
const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'by','from','up','about','into','through','during','before','after',
  'above','below','between','out','off','over','under','again','then',
  'once','here','there','when','where','why','how','all','each','every',
  'both','few','more','most','other','some','such','no','not','only',
  'own','same','so','than','too','very','can','will','just','beyond',
  'moving','using','reducing','fooling','defending','forecasting',
  'automating','bypassing','defeating','hacking','gathering','stealing',
  'sabotaging','breaking','cracking','rendering','powering','driven',
  'based','enabled','new','next','modern','real','time','age','era',
  'its','their','your','our','this','that','these','those','what','which',
  'who','whom','whose','would','could','should','may','might','must',
  'shall', 'do', 'does', 'did', 'has', 'have', 'had', 'is', 'are', 'was',
  'were', 'be', 'been', 'being', 'end', 'use', 'help','make','come','go',
  'get','give','take','put','set','keep','let','begin','show','hear',
  'play', 'run','move','live','believe','hold','bring','happen','write',
  'provide','start','turn','call','ask','matter', 'become','leave','feel',
  'seem','try','tell','mean','know','need','want','continue','learn',
  'change','lead','stop','follow','create','speak','read','spend',
]);

/**
 * Extract a concise 3-5 keyword search query from the article title + tags.
 * Strategy:
 *  1. Strip parentheticals: "SOAR (Security Orchestration)" → "SOAR"
 *  2. Remove stop words
 *  3. Keep the first 3 most distinctive title words
 *  4. Prepend up to 2 tags (cleaned) as domain context
 *  5. De-duplicate
 */
function titleToQuery(title, tags = []) {
  // 1. Strip parenthetical expansions, punctuation
  const cleanTitle = title
    .replace(/\(([^)]+)\)/g, ' ')
    .replace(/[:"'[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 2. Split + strip stop words → keep meaningful nouns/adjectives
  const titleWords = cleanTitle
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));

  // 3. Take up to 3 important title words
  const keyWords = titleWords.slice(0, 3);

  // 4. Pull first 2 tags — split multi-word tags into individual tokens,
  //    skip pure acronyms (e.g. SIEM, SOC, UEBA, SOAR, IAM) since they return
  //    no Unsplash results and just pollute the query.
  const tagTokens = tags
    .slice(0, 3)
    .flatMap(t =>
      t.replace(/\(.*?\)/g, '')          // strip parenthetical
       .replace(/[^a-zA-Z0-9\s-]/g, '')  // strip special chars
       .trim()
       .split(/[\s-]+/)                  // split "Zero Trust" → ["Zero","Trust"]
       .map(w => w.toLowerCase())
    )
    .filter(w =>
      w.length > 2 &&
      !STOP_WORDS.has(w) &&
      // drop short ALL-CAPS acronyms (SIEM, SOC, EDR, IAM, SOAR, UEBA…)
      !/^[A-Z]{2,5}$/.test(w.toUpperCase().replace(/[^A-Z]/g, ''))
    )
    .slice(0, 3);

  // 5. Combine: tags first (strong domain signal), then title keywords
  const seen = new Set();
  const unique = [...tagTokens, ...keyWords].filter(w => {
    if (seen.has(w)) return false;
    seen.add(w);
    return true;
  });

  return unique.slice(0, 5).join(' ');
}

/** Parse all tags from frontmatter as an array. */
function getFrontmatterTags(content) {
  const m = content.match(/^tags:\s*\[([^\]]+)\]/m);
  if (!m) return [];
  return m[1]
    .split(',')
    .map(t => t.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

/** Fetch JSON from a URL with the Unsplash auth header. */
async function unsplashGet(url) {
  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` }
  });
  if (!res.ok) throw new Error(`Unsplash API ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Download a file from `url` and save it to `destPath`. Returns bytes written. */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const get  = (u) => {
      https.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return get(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} for ${u}`));
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
        file.on('error', reject);
      }).on('error', reject);
    };
    get(url);
  });
}

/** Derive a file extension from a URL (jpg/png/webp, default jpg). */
function extFromUrl(url) {
  try {
    const u    = new URL(url);
    const ext  = path.extname(u.pathname).replace('.', '').toLowerCase();
    return ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
  } catch { return 'jpg'; }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function processFile(filePath, lang) {
  const content = fs.readFileSync(filePath, 'utf-8');

  if (hasCoverImage(content)) return null; // already has one

  const title = getFrontmatterField(content, 'title');
  if (!title) {
    console.warn(`  ⚠️  No title found in ${path.basename(filePath)}, skipping.`);
    return null;
  }

  const tags  = getFrontmatterTags(content);
  const query = titleToQuery(title, tags);
  console.log(`\n📄  ${lang}/${path.basename(filePath)}`);
  console.log(`    title:  "${title}"`);
  console.log(`    tags:   ${tags.slice(0,3).join(', ')}`);
  console.log(`    query:  "${query}"`);

  // 1. Search Unsplash (with fallback if the primary query has no results)
  const makeUrl = (q) =>
    `https://api.unsplash.com/search/photos` +
    `?query=${encodeURIComponent(q)}` +
    `&orientation=${ORIENTATION}` +
    `&per_page=1` +
    `&content_filter=high`;

  let data = await unsplashGet(makeUrl(query));
  let photos = data.results;

  // Fallback: title keywords only (no tags), in case tags polluted the query
  if (!photos || photos.length === 0) {
    const fallbackQuery = titleToQuery(title, []);
    console.log(`    ↩️  Retrying with fallback query: "${fallbackQuery}"`);
    data   = await unsplashGet(makeUrl(fallbackQuery));
    photos = data.results;
  }

  if (!photos || photos.length === 0) {
    console.warn(`    ⚠️  No Unsplash results for "${query}" (or fallback). Skipping.`);
    return null;
  }

  const photo      = photos[0];
  const username   = photo.user.username;
  const photoId    = photo.id;
  const downloadApiUrl = photo.links.download_location; // must be triggered

  // 2. Trigger the Unsplash download endpoint (required by API TOS)
  const dlData = await unsplashGet(downloadApiUrl);
  const imageUrl = dlData.url; // the actual file URL

  const ext      = extFromUrl(imageUrl);
  const filename = `${username}-${photoId}-unsplash.${ext}`;
  const destPath = path.join(COVERS_DIR, filename);
  const frontmatterValue = `${COVERS_RELATIVE}/${filename}`;

  console.log(`    photo:  by @${username} (${photoId})`);
  console.log(`    file:   ${filename}`);
  console.log(`    url:    ${photo.links.html}`);

  if (DRY_RUN) {
    console.log(`    [DRY-RUN] would download and set coverImage: "${frontmatterValue}"`);
    return { filePath, frontmatterValue, filename, dry: true };
  }

  // 3. Download image (skip if already downloaded)
  if (fs.existsSync(destPath)) {
    console.log(`    ℹ️  File already exists, skipping download.`);
  } else {
    process.stdout.write(`    ⬇️  Downloading...`);
    await downloadFile(imageUrl, destPath);
    console.log(` done.`);
  }

  // 4. Update frontmatter
  const updated = insertCoverImage(content, frontmatterValue);
  fs.writeFileSync(filePath, updated, 'utf-8');
  console.log(`    ✅  coverImage written.`);

  return { filePath, frontmatterValue, filename };
}

async function main() {
  if (!fs.existsSync(COVERS_DIR)) {
    fs.mkdirSync(COVERS_DIR, { recursive: true });
  }

  const langs = fs.readdirSync(BLOG_ROOT)
    .filter(d => {
      if (LANG_FILTER && d !== LANG_FILTER) return false;
      return fs.statSync(path.join(BLOG_ROOT, d)).isDirectory();
    });

  let processed = 0;
  let total     = 0;

  for (const lang of langs) {
    const dir   = path.join(BLOG_ROOT, lang);
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      total++;
      const result = await processFile(path.join(dir, file), lang);
      if (result) processed++;

      // Small delay to be polite to the Unsplash API (50 req/hr on free tier)
      if (result && !result.dry) await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log('\n────────────────────────────────────────');
  console.log(`Processed ${processed} file(s) out of ${total} scanned.`);
  if (DRY_RUN) console.log('(DRY-RUN — no files were changed.)');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
