import { visit } from 'unist-util-visit';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const SUPPORTED_EXT = /\.(jpe?g|png|webp|avif)$/i;
const MAX_WIDTH = 1600;

let groupCounter = 0;

export default function remarkLanguageTabs() {
  return async (tree, file) => {
    const groups = [];

    visit(tree, 'root', (root) => {
      const children = root.children;
      let i = 0;
      while (i < children.length) {
        const first = analyzeParagraph(children[i]);
        if (!first || first.langtabs.length === 0) {
          i++;
          continue;
        }
        const langtabs = [...first.langtabs];
        const trailingNodes = [];
        if (first.others.length > 0) {
          trailingNodes.push({ type: 'paragraph', children: first.others });
        }
        let j = i + 1;
        while (j < children.length) {
          const next = analyzeParagraph(children[j]);
          if (!next || next.langtabs.length === 0) break;
          langtabs.push(...next.langtabs);
          if (next.others.length > 0) {
            trailingNodes.push({ type: 'paragraph', children: next.others });
          }
          j++;
        }
        if (langtabs.length >= 2) {
          groups.push({ startIdx: i, endIdx: j, langtabs, trailingNodes, parent: root });
        }
        i = j;
      }
    });

    for (const group of groups.reverse()) {
      const processed = [];
      for (const item of group.langtabs) {
        const result = await processImage(item, file);
        if (result) processed.push(result);
      }
      if (processed.length < 2) continue;

      group.parent.children.splice(
        group.startIdx,
        group.endIdx - group.startIdx,
        { type: 'html', value: renderTabsHtml(processed) },
        ...group.trailingNodes
      );
    }
  };
}

function parseLangtabImage(node) {
  if (!node || node.type !== 'image') return null;
  const url = node.url || '';
  const hashIdx = url.indexOf('#');
  if (hashIdx === -1) return null;
  const fragment = url.slice(hashIdx + 1);
  const match = fragment.match(/^langtab=([a-z]{2,5})\b/i);
  if (!match) return null;
  return {
    cleanUrl: url.slice(0, hashIdx),
    lang: match[1].toLowerCase(),
    alt: node.alt || '',
  };
}

function analyzeParagraph(node) {
  if (!node || node.type !== 'paragraph') return null;
  const langtabs = [];
  const others = [];
  for (const child of node.children) {
    if (child.type === 'image') {
      const item = parseLangtabImage(child);
      if (item) {
        langtabs.push(item);
        continue;
      }
    }
    if (child.type === 'break') continue;
    if (child.type === 'text' && (child.value || '').trim() === '') continue;
    others.push(child);
  }
  return { langtabs, others };
}

async function processImage({ cleanUrl, lang, alt }, file) {
  if (!SUPPORTED_EXT.test(cleanUrl)) {
    console.warn(`[remark-language-tabs] Unsupported file type: ${cleanUrl}`);
    return null;
  }

  const mdDir = path.dirname(file.history[0]);
  const absoluteImagePath = path.resolve(mdDir, cleanUrl);

  if (!fs.existsSync(absoluteImagePath)) {
    console.warn(`[remark-language-tabs] File not found: ${absoluteImagePath}`);
    return null;
  }

  const stat = fs.statSync(absoluteImagePath);
  const hashInput = `langtab:${absoluteImagePath}-${stat.size}-${stat.mtimeMs}`;
  const hash = crypto.createHash('md5').update(hashInput).digest('hex').slice(0, 8);

  const ext = path.extname(absoluteImagePath).toLowerCase();
  const basename = path.basename(absoluteImagePath, ext);
  const outExt = ext === '.png' ? '.png' : '.jpg';
  const outFileName = `${basename}-${hash}${outExt}`;

  const outDir = path.resolve(process.cwd(), 'public/image-cache');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, outFileName);

  if (!fs.existsSync(outPath)) {
    console.log(`\n[remark-language-tabs] Optimizing ${path.basename(absoluteImagePath)}...`);
    try {
      const pipeline = sharp(absoluteImagePath).resize({
        width: MAX_WIDTH,
        withoutEnlargement: true,
      });
      if (outExt === '.png') {
        await pipeline.png({ compressionLevel: 9 }).toFile(outPath);
      } else {
        await pipeline.jpeg({ quality: 82, mozjpeg: true }).toFile(outPath);
      }
      console.log(`[remark-language-tabs] Wrote ${outFileName}\n`);
    } catch (e) {
      console.error(`[remark-language-tabs] sharp failed on ${absoluteImagePath}`, e);
      return null;
    }
  }

  return { src: `/image-cache/${outFileName}`, lang, alt };
}

function renderTabsHtml(items) {
  groupCounter++;
  const id = `lt-${groupCounter}-${Math.random().toString(36).slice(2, 7)}`;

  const inputs = items
    .map((it, i) => {
      const checked = i === 0 ? ' checked' : '';
      return `<input type="radio" name="${id}" id="${id}-${it.lang}" class="lang-tab-input lang-tab-input-${it.lang}"${checked} />`;
    })
    .join('');

  const labels = items
    .map(
      (it) =>
        `<label for="${id}-${it.lang}" class="lang-tab-label lang-tab-label-${it.lang}">${escapeAttr(it.lang.toUpperCase())}</label>`
    )
    .join('');

  const panels = items
    .map(
      (it) =>
        `<div class="lang-tab-panel lang-tab-panel-${it.lang}"><img src="${it.src}" alt="${escapeAttr(it.alt)}" loading="lazy" /></div>`
    )
    .join('');

  return `<div class="lang-tabs" role="tablist">${inputs}<div class="lang-tab-bar">${labels}</div>${panels}</div>`;
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
