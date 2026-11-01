import fs from 'node:fs';
import path from 'node:path';
const output=path.resolve(process.argv[2]??'dist-preview');
if(!fs.existsSync(path.join(output,'index.html')))throw new Error('Export Expo absent : index.html introuvable');
// Vercel ignore les dossiers nommés node_modules, y compris ceux des assets exportés.
const source=path.join(output,'assets','node_modules'),target=path.join(output,'assets','vendor');
if(fs.existsSync(source))fs.cpSync(source,target,{recursive:true});
function update(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const name=path.join(dir,item.name);if(item.isDirectory()){if(item.name!=='.vercel'&&item.name!=='node_modules')update(name);}else if(/\.(js|json|html|css)$/.test(name)){let text=fs.readFileSync(name,'utf8').replaceAll('assets/node_modules/','assets/vendor/');if(item.name==='index.html')text=text.replace('<html lang="en">','<html lang="fr">').replace(/<title>.*?<\/title>/,'<title>IMMORTAL · Démo interactive</title>');fs.writeFileSync(name,text);}}}
update(output);
fs.writeFileSync(path.join(output,'vercel.json'),JSON.stringify({framework:null,buildCommand:'',installCommand:'',outputDirectory:'.',rewrites:[{source:'/(.*)',destination:'/index.html'}],headers:[{source:'/(.*)',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Permissions-Policy',value:'camera=(self), microphone=(self)'}]}]},null,2));
console.log('Démo statique préparée : '+output);
