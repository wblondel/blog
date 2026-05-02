import { visit } from 'unist-util-visit';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export default function remarkVideoOptimizer() {
  return (tree, file) => {
    visit(tree, 'image', (node, index, parent) => {
      if (node.url && node.url.match(/\.(mov|mp4|webm|mkv|avi)$/i)) {
        // Resolve absolute path of the original video based on the markdown file's path
        const mdDir = path.dirname(file.history[0]);
        const absoluteVideoPath = path.resolve(mdDir, node.url);

        if (!fs.existsSync(absoluteVideoPath)) {
          console.warn(`[remark-video-optimizer] Video file not found: ${absoluteVideoPath}`);
          return;
        }

        const stat = fs.statSync(absoluteVideoPath);
        // Create a unique hash for caching
        const hashInput = `${absoluteVideoPath}-${stat.size}-${stat.mtimeMs}`;
        const hash = crypto.createHash('md5').update(hashInput).digest('hex').slice(0, 8);

        const basename = path.basename(absoluteVideoPath, path.extname(absoluteVideoPath));
        const outFileName = `${basename}-${hash}.mp4`;
        
        // Output directory is public/video-cache
        const outDir = path.resolve(process.cwd(), 'public/video-cache');
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }

        const outPath = path.join(outDir, outFileName);

        if (!fs.existsSync(outPath)) {
          console.log(`\n[remark-video-optimizer] Compressing ${path.basename(absoluteVideoPath)}...`);
          try {
            // Highly optimized compression for screen recordings
            execSync(`ffmpeg -y -i "${absoluteVideoPath}" -c:v libx264 -crf 28 -preset fast -vf "scale='min(1080,iw)':-2" -an -movflags +faststart "${outPath}"`, { stdio: 'inherit' });
            console.log(`[remark-video-optimizer] Successfully compressed to ${outFileName}\n`);
          } catch (e) {
            console.error(`[remark-video-optimizer] FFmpeg failed on ${absoluteVideoPath}`);
            return; // Fallback to original node if ffmpeg fails
          }
        }

        // Replace the image node with a robust HTML video node
        const videoUrl = `/video-cache/${outFileName}`;
        const html = `<video src="${videoUrl}" autoplay loop muted playsinline width="100%" style="border-radius: 8px; margin: 2rem auto; display: block;"></video>`;

        parent.children[index] = {
          type: 'html',
          value: html
        };
      }
    });
  };
}
