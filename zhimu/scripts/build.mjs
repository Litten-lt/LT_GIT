import {build} from 'esbuild'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const output=path.join(root,'public/vendor')
fs.mkdirSync(output,{recursive:true})
for(const entry of fs.readdirSync(output,{withFileTypes:true}))if(entry.isFile())fs.unlinkSync(path.join(output,entry.name))
await build({absWorkingDir:root,entryPoints:['client/markdown.js'],outdir:'public/vendor',bundle:true,splitting:true,format:'esm',platform:'browser',target:'es2022',minify:true,entryNames:'markdown',chunkNames:'[name]-[hash]',legalComments:'linked'})
