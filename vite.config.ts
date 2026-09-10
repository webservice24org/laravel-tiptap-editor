import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
    plugins: [
        react(),
    ],

    build: {
        lib: {
            entry: resolve(
                __dirname,
                'resources/js/index.ts'
            ),

            formats: [
                'es',
            ],

            fileName: () =>
                'index.js',

            cssFileName:
                'editor',
        },

        rollupOptions: {
            external: (
                id
            ) =>
                id === 'react'
                || id === 'react-dom'
                || id.startsWith(
                    'react/'
                )
                || id.startsWith(
                    'react-dom/'
                )
                || id.startsWith(
                    '@tiptap/'
                ),

            output: {
                exports: 'named',
            },
        },

        sourcemap: true,
        emptyOutDir: true,
    },
})
