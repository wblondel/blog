import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
    type: 'content',
    schema: z.object({
        title: z.string(),
        description: z.string().optional(),
        pubDate: z.date(),
        coverImage: z.string().optional(),
        tags: z.array(z.string()).default([]),
        series: z.string().optional(),
        seriesOrder: z.number().optional(),
        readTime: z.number().default(3),
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

export const collections = { blog, series };
