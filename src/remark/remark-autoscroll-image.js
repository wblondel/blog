import { visit } from 'unist-util-visit';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const MARKER = 'autoscroll';
// Viewport aspect ratio mirrors the video plugin's output (1080x566)
const VIEWPORT_W = 1080;
const VIEWPORT_H = 566;
const SUPPORTED_EXT = /\.(jpe?g|png|webp|avif)$/i;

export default function remarkAutoscrollImage() {
  return async (tree, file) => {
    const work = [];

    visit(tree, 'image', (node, index, parent) => {
      if (!node.url) return;

      const hashIdx = node.url.indexOf('#');
      if (hashIdx === -1) return;

      const fragment = node.url.slice(hashIdx + 1);
      if (!fragment.startsWith(MARKER)) return;

      const cleanUrl = node.url.slice(0, hashIdx);
      if (!SUPPORTED_EXT.test(cleanUrl)) {
        console.warn(`[remark-autoscroll-image] Unsupported file type: ${cleanUrl}`);
        return;
      }

      const rawParams = fragment.slice(MARKER.length).replace(/^[&;,?]/, '');
      const params = new URLSearchParams(rawParams);
      const duration = Number.parseFloat(params.get('duration')) || 10;
      const pauseOnHover = params.get('pause') !== 'false';

      work.push({ node, index, parent, cleanUrl, duration, pauseOnHover });
    });

    for (const item of work) {
      await processItem(item, file);
    }
  };
}

async function processItem({ node, index, parent, cleanUrl, duration, pauseOnHover }, file) {
  const mdDir = path.dirname(file.history[0]);
  const absoluteImagePath = path.resolve(mdDir, cleanUrl);

  if (!fs.existsSync(absoluteImagePath)) {
    console.warn(`[remark-autoscroll-image] File not found: ${absoluteImagePath}`);
    return;
  }

  const stat = fs.statSync(absoluteImagePath);
  const hashInput = `${absoluteImagePath}-${stat.size}-${stat.mtimeMs}`;
  const hash = crypto.createHash('md5').update(hashInput).digest('hex').slice(0, 8);

  const basename = path.basename(absoluteImagePath, path.extname(absoluteImagePath));
  const outFileName = `${basename}-${hash}.jpg`;

  const outDir = path.resolve(process.cwd(), 'public/image-cache');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, outFileName);

  let metadata;
  try {
    metadata = await sharp(absoluteImagePath).metadata();
  } catch (e) {
    console.error(`[remark-autoscroll-image] Failed to read metadata: ${absoluteImagePath}`, e);
    return;
  }

  const { width: srcWidth, height: srcHeight } = metadata;
  if (!srcWidth || !srcHeight) {
    console.warn(`[remark-autoscroll-image] Missing dimensions: ${absoluteImagePath}`);
    return;
  }

  if (!fs.existsSync(outPath)) {
    console.log(`\n[remark-autoscroll-image] Optimizing ${path.basename(absoluteImagePath)}...`);
    try {
      await sharp(absoluteImagePath)
        .resize({ width: Math.min(1080, srcWidth), withoutEnlargement: true })
        .jpeg({ quality: 80, mozjpeg: true })
        .toFile(outPath);
      console.log(`[remark-autoscroll-image] Wrote ${outFileName}\n`);
    } catch (e) {
      console.error(`[remark-autoscroll-image] Sharp failed on ${absoluteImagePath}`, e);
      return;
    }
  }

  const viewportRatio = VIEWPORT_H / VIEWPORT_W;
  const imageRatio = srcHeight / srcWidth;

  if (imageRatio <= viewportRatio) {
    console.warn(
      `[remark-autoscroll-image] Image not taller than viewport, falling back to plain image: ${absoluteImagePath}`
    );
    parent.children[index] = {
      type: 'html',
      value: `<img src="/image-cache/${outFileName}" alt="${escapeAttr(node.alt || '')}" style="width:100%;height:auto;display:block;border-radius:8px;margin:2rem auto;" />`
    };
    return;
  }

  const distancePct = (1 - viewportRatio / imageRatio) * 100;
  const imgUrl = `/image-cache/${outFileName}`;
  const alt = escapeAttr(node.alt || '');

  const html =
    `<div class="autoscroll-frame"${pauseOnHover ? ' data-pause-on-hover="true"' : ''} style="aspect-ratio:${VIEWPORT_W}/${VIEWPORT_H};">` +
    `<img src="${imgUrl}" alt="${alt}" class="autoscroll-img" style="--autoscroll-distance:-${distancePct.toFixed(2)}%;--autoscroll-duration:${duration}s;" loading="lazy" />` +
    `</div>`;

  parent.children[index] = { type: 'html', value: html };
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
