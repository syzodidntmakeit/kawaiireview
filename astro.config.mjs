import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
    site: 'https://review.kawaii-san.org',
    compressHTML: true,
    build: {
        format: 'file'
    }
});
