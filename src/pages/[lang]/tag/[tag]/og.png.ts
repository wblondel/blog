import fs from "fs/promises";
import path from "path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { getCollection } from "astro:content";

// ─── Static paths ─────────────────────────────────────────────────────────────

export async function getStaticPaths() {
  const allPosts = await getCollection("blog");

  const tagsByLang: Record<string, Map<string, string>> = { en: new Map(), fr: new Map() };

  allPosts.forEach((post) => {
    const lang = post.slug.split("/")[0];
    if (post.data.tags) {
      post.data.tags.forEach((tag: string) => {
        const id = tag.toLowerCase().replace(/\s+/g, "-");
        if (!tagsByLang[lang]) tagsByLang[lang] = new Map();
        tagsByLang[lang].set(id, tag); // id → original display name
      });
    }
  });

  const paths: { params: { lang: string; tag: string }; props: { originalTag: string } }[] = [];
  for (const [lang, tagMap] of Object.entries(tagsByLang)) {
    for (const [id, originalTag] of tagMap.entries()) {
      paths.push({ params: { lang, tag: id }, props: { originalTag } });
    }
  }
  return paths;
}

// ─── Global singletons ────────────────────────────────────────────────────────

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

// ─── Concurrency pool (max 3) ─────────────────────────────────────────────────

const MAX_CONCURRENT = 3;
let active = 0;
const waitQueue: (() => void)[] = [];

function acquireLock(): Promise<void> {
  if (active < MAX_CONCURRENT) { active++; return Promise.resolve(); }
  return new Promise<void>((resolve) => waitQueue.push(resolve));
}
function releaseLock() {
  const next = waitQueue.shift();
  if (next) setTimeout(next, 10); else active--;
}

// ─── Main endpoint ────────────────────────────────────────────────────────────

export async function GET({ props }: { props: { originalTag: string } }) {
  await acquireLock();
  try {
    await loadFonts();
    const { originalTag } = props;
    // Truncate very long tag names to avoid clipping
    const displayTag = `#${originalTag.length > 28 ? originalTag.slice(0, 27) + "…" : originalTag}`;

    const element = {
      type: "div",
      props: {
        style: {
          display: "flex",
          width: 1200,
          height: 630,
          background: "linear-gradient(135deg, #1e1b4b 0%, #3b0764 50%, #1e1b4b 100%)",
          fontFamily: "Inter, sans-serif",
          position: "relative" as const,
          overflow: "hidden",
        },
        children: [
          // Decorative blurred circle, top-left
          {
            type: "div",
            props: {
              style: {
                position: "absolute" as const,
                top: -120,
                left: -120,
                width: 500,
                height: 500,
                background: "rgba(139, 92, 246, 0.35)",
                borderRadius: "50%",
                filter: "blur(80px)",
                display: "flex",
              },
            },
          },
          // Decorative blurred circle, bottom-right
          {
            type: "div",
            props: {
              style: {
                position: "absolute" as const,
                bottom: -100,
                right: -100,
                width: 420,
                height: 420,
                background: "rgba(236, 72, 153, 0.25)",
                borderRadius: "50%",
                filter: "blur(80px)",
                display: "flex",
              },
            },
          },
          // Subtle grid pattern overlay (vertical lines)
          ...Array.from({ length: 8 }, (_, i) => ({
            type: "div",
            props: {
              style: {
                position: "absolute" as const,
                top: 0,
                left: 120 + i * 140,
                width: 1,
                height: 630,
                background: "rgba(255,255,255,0.04)",
                display: "flex",
              },
            },
          })),
          // Hash "#" watermark, giant and faint, top-right corner
          {
            type: "div",
            props: {
              style: {
                position: "absolute" as const,
                top: -40,
                right: -20,
                fontSize: 500,
                fontWeight: 700,
                color: "rgba(255,255,255,0.04)",
                lineHeight: 1,
                display: "flex",
              },
              children: "#",
            },
          },
          // Main content: vertically and horizontally centred
          {
            type: "div",
            props: {
              style: {
                position: "absolute" as const,
                top: 0,
                left: 0,
                width: 1200,
                height: 630,
                display: "flex",
                flexDirection: "column" as const,
                alignItems: "center",
                justifyContent: "center",
                padding: "80px 100px",
              },
              children: [
                // Small label above the tag
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: 22,
                      fontWeight: 400,
                      color: "rgba(196, 181, 253, 0.9)",
                      letterSpacing: "0.15em",
                      textTransform: "uppercase" as const,
                      marginBottom: 28,
                      display: "flex",
                    },
                    children: "Topic",
                  },
                },
                // The tag name — big and bold
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: displayTag.length > 20 ? 72 : 96,
                      fontWeight: 700,
                      color: "#ffffff",
                      lineHeight: 1.05,
                      textAlign: "center" as const,
                      display: "flex",
                      flexWrap: "wrap" as const,
                      justifyContent: "center",
                    },
                    children: displayTag,
                  },
                },
              ],
            },
          },
          // Branding footer: bottom-right
          {
            type: "div",
            props: {
              style: {
                position: "absolute" as const,
                bottom: 44,
                right: 60,
                display: "flex",
                alignItems: "center",
                gap: 14,
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: {
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      width: 44,
                      height: 44,
                      background: "#ffffff",
                      borderRadius: 10,
                    },
                    children: {
                      type: "svg",
                      props: {
                        width: 26,
                        height: 26,
                        viewBox: "0 0 24 24",
                        fill: "none",
                        children: {
                          type: "path",
                          props: { d: "M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z", fill: "#5b21b6" },
                        },
                      },
                    },
                  },
                },
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: 20,
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.85)",
                      display: "flex",
                    },
                    children: "William Blondel",
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
