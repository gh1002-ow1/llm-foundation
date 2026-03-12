const path = require('node:path');
const { importAutoMedia } = require('./lib/import-auto-media-lib');

function main() {
  const sourceDir = path.resolve(process.argv[2] || path.join(process.cwd(), '..', 'auto-media', 'config', 'model-router'));
  const outputDir = path.resolve(process.argv[3] || path.join(process.cwd(), '.local', 'imported-auto-media'));
  console.log(JSON.stringify(importAutoMedia(sourceDir, outputDir), null, 2));
}

main();
