import fs from "fs/promises";
import path from "path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { getCollection, type CollectionEntry } from "astro:content";

// ─── Static paths ─────────────────────────────────────────────────────────────

export async function getStaticPaths() {
  const blogs = await getCollection("blog");
  return blogs.map((entry) => {
    const [lang, ...slugParts] = entry.slug.split("/");
    const slug = slugParts.join("/");
    return {
      params: { lang, slug },
      props: { entry },
    };
  });
}

// ─── Global singletons (initialized once, reused across all routes) ───────────

let fontBold: Buffer | null = null;
let fontRegular: Buffer | null = null;

async function loadFonts() {
  if (fontBold && fontRegular) return;
  const base = path.join(process.cwd(), "node_modules/@fontsource/inter/files");
  [fontBold, fontRegular] = await Promise.all([
    fs.readFile(path.join(base, "inter-latin-700-normal.woff")),
    fs.readFile(path.join(base, "inter-latin-400-normal.woff")),
  ]);
}

// ─── Concurrency pool: max 3 simultaneous Satori+Resvg workers ───────────────

const MAX_CONCURRENT = 3;
let active = 0;
const waitQueue: (() => void)[] = [];

function acquireLock(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => waitQueue.push(resolve));
}

function releaseLock() {
  const next = waitQueue.shift();
  if (next) {
    setTimeout(next, 10);
  } else {
    active--;
  }
}

// ─── Image helper: resolve Astro image() or string path, then resize ──────────

async function loadCoverAsBase64(coverImage: unknown): Promise<string> {
  if (!coverImage) return "";
  try {
    let fullPath = "";

    if (typeof coverImage === "string") {
      const filename = path.basename(coverImage);
      fullPath = path.join(process.cwd(), "src/assets/post-covers", filename);
    } else {
      // Astro image() object: { src: "/blog/_astro/name.HASH8CH.jpg", width, height, format }
      const img = coverImage as { src: string; format: string };
      const baseName = path.basename(img.src.split("?")[0]);
      const parts = baseName.split(".");
      let originalName: string;
      if (parts.length >= 3) {
        // Strip Astro's 8-char build hash (second-to-last dot segment)
        originalName = [...parts.slice(0, -2), parts[parts.length - 1]].join(".");
      } else {
        originalName = baseName;
      }
      fullPath = path.join(process.cwd(), "src/assets/post-covers", originalName);
    }

    if (!fullPath) return "";
    const raw = await fs.readFile(fullPath);
    // Resize to 480×300 JPEG thumbnail — Satori does NOT support WebP data URIs
    const resized = await sharp(raw)
      .resize(480, 300, { fit: "cover" })
      .jpeg({ quality: 80 })
      .toBuffer();

    return `data:image/jpeg;base64,${resized.toString("base64")}`;
  } catch (e) {
    console.error("[og.png] cover image load failed:", (e as Error).message);
    return "";
  }
}

// ─── Main endpoint ─────────────────────────────────────────────────────────────

const ctaLabels: Record<string, string> = {
  fr: "En savoir plus",
  en: "Learn More",
};

export async function GET({ props, params }: { props: { entry: CollectionEntry<"blog"> }; params: { lang: string } }) {
  await acquireLock();

  try {
    const { title, coverImage } = props.entry.data;
    const ctaLabel = ctaLabels[params.lang] ?? ctaLabels.en;

    const [coverBase64] = await Promise.all([
      loadCoverAsBase64(coverImage),
      loadFonts(),
    ]);

    // Build Satori element tree using native object API
    // (satori-html's html`` tag silently drops conditional nodes that produce full HTML strings)
    const coverElement = coverBase64
      ? {
          type: "div",
          props: {
            style: {
              position: "absolute" as const,
              top: 100,
              left: 40,
              width: 380,
              height: 380,
              borderRadius: 20,
              overflow: "hidden",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              display: "flex",
            },
            children: {
              type: "img",
              props: {
                src: coverBase64,
                style: { width: "100%", height: "100%", objectFit: "cover" as const },
              },
            },
          },
        }
      : {
          type: "div",
          props: {
            style: {
              position: "absolute" as const,
              top: 100,
              left: 40,
              width: 380,
              height: 380,
              background: "#4c1d95",
              borderRadius: 20,
              display: "flex",
            },
          },
        };

    const element = {
      type: "div",
      props: {
        style: {
          display: "flex",
          width: 1200,
          height: 630,
          background: "#ffffff",
          fontFamily: "Inter, sans-serif",
          position: "relative" as const,
          overflow: "hidden",
        },
        children: [
          // Purple diagonal left panel
          {
            type: "div",
            props: {
              style: {
                position: "absolute" as const,
                top: 0,
                left: 0,
                width: 520,
                height: 630,
                background: "#5b21b6",
                clipPath: "polygon(0 0, 80% 0, 100% 100%, 0 100%)",
                display: "flex",
              },
            },
          },
          // Cover image (or placeholder)
          coverElement,
          // Logo badge
          {
            type: "div",
            props: {
              style: {
                position: "absolute" as const,
                top: 36,
                left: 556,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: 64,
                height: 64,
                background: "#1e1b4b",
                borderRadius: 12,
              },
              children: {
                type: "svg",
                props: {
                  width: 36,
                  height: 36,
                  viewBox: "0 0 24 24",
                  fill: "none",
                  children: {
                    type: "path",
                    props: {
                      d: "M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z",
                      fill: "#a78bfa",
                    },
                  },
                },
              },
            },
          },
          // Right content panel
          {
            type: "div",
            props: {
              style: {
                position: "absolute" as const,
                top: 0,
                left: 540,
                width: 620,
                height: 630,
                display: "flex",
                flexDirection: "column" as const,
                justifyContent: "center",
                padding: "60px 60px 60px 60px",
              },
              children: [
                // Title
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: 46,
                      fontWeight: 700,
                      color: "#1e1b4b",
                      lineHeight: 1.2,
                      marginBottom: 40,
                      display: "flex",
                      flexWrap: "wrap" as const,
                    },
                    children: title,
                  },
                },
                // Learn More button
                {
                  type: "div",
                  props: {
                    style: { display: "flex" },
                    children: {
                      type: "div",
                      props: {
                        style: {
                          background: "#5b21b6",
                          color: "#ffffff",
                          fontSize: 22,
                          fontWeight: 700,
                          padding: "16px 36px",
                          borderRadius: 10,
                          display: "flex",
                        },
                        children: ctaLabel,
                      },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    };

    const svg = await satori(element as any, {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Inter", data: fontBold!, weight: 700, style: "normal" },
        { name: "Inter", data: fontRegular!, weight: 400, style: "normal" },
      ],
    });

    const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } });
    const png = resvg.render().asPng();

    return new Response(new Uint8Array(png), {
      headers: { "Content-Type": "image/png" },
    });
  } finally {
    releaseLock();
  }
}
