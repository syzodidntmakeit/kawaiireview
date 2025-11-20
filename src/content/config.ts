import { defineCollection, z } from 'astro:content';

const animeCollection = defineCollection({
    type: 'content',
    schema: ({ image }) => z.object({
        title: z.string(),
        studio: z.string().optional(),
        year: z.number().or(z.string()).optional(),
        genres: z.string().optional(),
        cover: image().optional(), // Astro handles relative images
        source_url: z.string().optional(),
        created: z.string().optional(),
        type: z.literal('anime').optional(),
        synopsis: z.string().optional(),
        seasons: z.number().or(z.string()).optional(),
        episodes: z.number().or(z.string()).optional(),
        runtime: z.string().optional(),
        score: z.number().or(z.string()).nullable().optional(),
        runtime_detail: z.string().optional(),
    })
});

const albumCollection = defineCollection({
    type: 'content',
    schema: ({ image }) => z.object({
        title: z.string(),
        artist: z.string().optional(),
        year: z.number().or(z.string()).optional(),
        genres: z.string().optional(),
        cover: image().optional(),
        source_url: z.string().optional(),
        created: z.string().optional(),
        type: z.literal('album').optional(),
        synopsis: z.string().optional(),
        length_minutes: z.number().or(z.string()).optional(),
        runtime: z.string().optional(),
        score: z.number().or(z.string()).nullable().optional(),
        runtime_detail: z.string().optional(),
    })
});

export const collections = {
    'anime': animeCollection,
    'album': albumCollection,
};
