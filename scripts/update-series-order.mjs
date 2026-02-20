import fs from 'fs';
import path from 'path';

const blogDir = path.join(process.cwd(), 'src', 'content', 'blog');
const langs = fs.readdirSync(blogDir).filter(f => fs.statSync(path.join(blogDir, f)).isDirectory());

for (const lang of langs) {
    const langDir = path.join(blogDir, lang);
    const files = fs.readdirSync(langDir).filter(f => f.endsWith('.md') || f.endsWith('.mdx'));

    const seriesMap = new Map(); // seriesName => array of { filePath, pubDate, content }

    for (const file of files) {
        const filePath = path.join(langDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        const seriesMatch = content.match(/^series:\s*(["'])(.+?)\1/m);
        const pubDateMatch = content.match(/^pubDate:\s*(.+)/m);

        if (seriesMatch && pubDateMatch) {
            const seriesName = seriesMatch[2];
            const pubDate = new Date(pubDateMatch[1].trim());

            if (!seriesMap.has(seriesName)) {
                seriesMap.set(seriesName, []);
            }
            seriesMap.get(seriesName).push({ filePath, pubDate, content });
        }
    }

    for (const [seriesName, posts] of seriesMap.entries()) {
        // Sort posts chronologically (oldest first, so oldest gets order 1)
        posts.sort((a, b) => a.pubDate.valueOf() - b.pubDate.valueOf());

        // Write seriesOrder
        posts.forEach((post, index) => {
            const seriesOrder = index + 1;
            let newContent = post.content;

            // Remove existing seriesOrder if present
            newContent = newContent.replace(/^seriesOrder:\s*\d+\s*\n/m, '');

            // Insert seriesOrder right after series
            newContent = newContent.replace(
                /^series:\s*(["']).+?\1/m,
                `$& \nseriesOrder: ${seriesOrder}`
            );

            fs.writeFileSync(post.filePath, newContent, 'utf-8');
            console.log(`Updated ${path.basename(post.filePath)} in ${lang} (${seriesName}) -> Order: ${seriesOrder}`);
        });
    }
}
