import {mkdir, cp, stat} from 'node:fs/promises';
await mkdir('dist', {recursive:true});
await cp('index.html', 'dist/index.html');
await cp('src', 'dist/src', {recursive:true});
console.log('Static application built in dist/. No runtime dependencies.');
