import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(!process.argv[2])throw new Error('Usage: node scripts/export-web-demo.mjs <dossier de sortie>');
const output=path.resolve(process.argv[2]);
const projectFile=path.join(output,'.vercel','project.json');
const project=fs.existsSync(projectFile)?fs.readFileSync(projectFile,'utf8'):null;
const result=spawnSync(process.execPath,[path.join(root,'node_modules/expo/bin/cli'),'export','--platform','web','--output-dir',output,'--max-workers','2'],{cwd:root,stdio:'inherit',env:{...process.env,EXPO_NO_DOTENV:'1',EXPO_PUBLIC_PREVIEW:'true',EXPO_PUBLIC_SUPABASE_URL:'',EXPO_PUBLIC_SUPABASE_ANON_KEY:''}});
if(result.status!==0)process.exit(result.status??1);
const prepared=spawnSync(process.execPath,[path.join(root,'scripts/prepare-web-demo.mjs'),output],{cwd:root,stdio:'inherit'});
if(prepared.status!==0)process.exit(prepared.status??1);
if(project){fs.mkdirSync(path.dirname(projectFile),{recursive:true});fs.writeFileSync(projectFile,project);}
