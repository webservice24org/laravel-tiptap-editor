import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import manifest from './package.json'

const peers = Object.keys(manifest.peerDependencies)
const isPeer = (id: string) => peers.some(name => id === name || id.startsWith(`${name}/`))

// Inspect Rollup's actual rendered modules, not merely the external option.
function enforceLibraryBoundary(): Plugin {
    return {
        name: 'microweb-library-boundary',
        apply: 'build',
        enforce: 'post',
        generateBundle(_options, bundle) {
            const chunks = Object.values(bundle).filter(item => item.type === 'chunk')
            if (chunks.length !== 1) this.error('Expected one ESM library chunk')
            const chunk = chunks[0]
            if (chunk.type !== 'chunk' || chunk.fileName !== 'index.js' || !chunk.isEntry) {
                this.error('Unexpected library entry chunk')
            }
            for (const id of [...chunk.imports, ...chunk.dynamicImports]) {
                if (!isPeer(id)) this.error(`Unexpected external import: ${id}`)
            }
            let sanitizer = false
            for (const [id, module] of Object.entries(chunk.modules)) {
                const normalized = id.replace(/\\/g, '/')
                if (!normalized.includes('/node_modules/')) continue
                const expected = normalized.endsWith('/node_modules/dompurify/dist/purify.es.mjs')
                if (!expected) this.error(`Unexpected bundled dependency: ${id}`)
                if (module.renderedLength > 0) sanitizer = true
            }
            if (!sanitizer) this.error('DOMPurify ESM implementation was not bundled')
            const installed = JSON.parse(readFileSync(resolve(__dirname, 'node_modules/dompurify/package.json'), 'utf8'))
            if (installed.version !== manifest.dependencies.dompurify) this.error('Unexpected installed DOMPurify version')
            // Carry the upstream license texts into the published dist directory.
            for (const filename of ['LICENSE', 'LICENSE-MPL']) {
                this.emitFile({ type: 'asset', fileName: `third-party/dompurify-${filename}.txt`, source: readFileSync(resolve(__dirname, 'node_modules/dompurify', filename)) })
            }
        },
    }
}

export default defineConfig({
    plugins: [react(), enforceLibraryBoundary()],
    esbuild: { legalComments: 'inline' },
    build: {
        lib: {
            entry: resolve(__dirname, 'resources/js/index.ts'),
            formats: ['es'],
            fileName: () => 'index.js',
            cssFileName: 'editor',
        },
        rollupOptions: {
            external: isPeer,
            output: { exports: 'named' },
            onwarn(warning, warn) {
                if (warning.code === 'UNRESOLVED_IMPORT') throw new Error(warning.message)
                warn(warning)
            },
        },
        // Preserve the existing Vite 7 browser target and minification defaults.
        sourcemap: true,
        emptyOutDir: true,
    },
})
