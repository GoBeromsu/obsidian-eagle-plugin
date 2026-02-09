export default {
  buildCommand: ['pnpm', 'run', 'dev:build'],
  deploy: {
    mode: 'copy',
    staticFiles: [{ from: 'manifest.json', to: 'manifest.json' }],
    watchFiles: [{ from: 'main.js', to: 'main.js' }],
  },
}
