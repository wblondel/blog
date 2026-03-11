import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
    type: 'content',
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
    type: 'content',
    schema: ({ image }) => z.object({
        title: z.string(),
        context: z.string(),
        coverImage: z.union([image(), z.string()]).optional(),
        githubLink: z.string().url().optional(),
        liveLink: z.string().url().optional(),
        documentationLink: z.string().url().optional(),
    }),
});

const series = defineCollection({
    type: 'content',
    schema: z.object({
        title: z.string(),
        description: z.string(),
        translationKey: z.string().optional(),
    })
});

export const collections = { blog, series, projects };
