import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const blog = defineCollection({
    loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: "./src/content/blog" }),
    schema: ({ image }) => z.object({
        title: z.string(),
        seoTitle: z.string().optional(),
        description: z.string().optional(),
        pubDate: z.date(),
        coverImage: z.union([image(), z.string()]).optional(),
        tags: z.array(z.string()).default([]),
        series: z.string().optional(),
        seriesOrder: z.number().optional(),
        readTime: z.number().default(3),
    }),
});

const projects = defineCollection({
    loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: "./src/content/projects" }),
    schema: ({ image }) => z.object({
        title: z.string(),
        context: z.string(),
        draft: z.boolean().default(false).optional(),
        coverImage: z.union([image(), z.string()]).optional(),
        githubLink: z.url().optional(),
        liveLink: z.url().optional(),
        documentationLink: z.url().optional(),
        ficheDescriptiveLink: z.string().optional(),
    }),
});

const series = defineCollection({
    loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: "./src/content/series" }),
    schema: z.object({
        title: z.string(),
        description: z.string(),
        translationKey: z.string().optional(),
    })
});

export const collections = { blog, series, projects };
