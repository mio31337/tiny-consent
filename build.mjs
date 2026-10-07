// Bundles src/tiny-consent.js into a single synchronous IIFE.
//   node build.mjs          -> dist/tiny-consent.js + dist/tiny-consent.min.js
//   node build.mjs --serve  -> same, rebuilt on change, served at http://localhost:8787/demo/

import * as esbuild from 'esbuild';

const serve = process.argv.includes('--serve');

const common = {
  entryPoints: ['src/tiny-consent.js'],
  bundle: true,
  format: 'iife',
  target: ['es2018'],
  legalComments: 'none',
};

const readable = { ...common, outfile: 'dist/tiny-consent.js' };
const minified = { ...common, outfile: 'dist/tiny-consent.min.js', minify: true };

if (serve) {
  const ctx = await esbuild.context(readable);
  await ctx.watch();
  const { host, port } = await ctx.serve({ servedir: '.', port: 8787 });
  console.log(`Serving demo at http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/demo/`);
} else {
  await Promise.all([esbuild.build(readable), esbuild.build(minified)]);
  console.log('Built dist/tiny-consent.js and dist/tiny-consent.min.js');
}
