import { mkdir, cp, copyFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'dist');
await mkdir(output,{recursive:true});
await copyFile(path.join(root,'index.html'),path.join(output,'index.html'));
await mkdir(path.join(output,'src'),{recursive:true});
for(const file of ['main.js','constants.js','wallet.js','styles.css'])
  await copyFile(path.join(root,'src',file),path.join(output,'src',file));
await cp(path.join(root,'public'),path.join(output,'public'),{recursive:true});
const allowed=new Set(['index.html','src','public']);
if((await readdir(output)).some(file=>!allowed.has(file)))throw Error('Unexpected files in dist. Use a clean build directory.');
console.log('Static site built in dist. API is deployed separately from api/index.js.');
