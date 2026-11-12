// Vercel drops every "node_modules" folder from uploads: move the vendored fonts/images to assets/vendor
// and re-hash the JS bundle so the URL changes with its content. Usage: node scripts/fix-web-build.mjs [dir]
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const dir = path.resolve(process.argv[2] || "web-build");
const nm = path.join(dir, "assets", "node_modules");
if (fs.existsSync(nm)) { fs.cpSync(nm, path.join(dir, "assets", "vendor"), { recursive: true }); fs.rmSync(nm, { recursive: true, force: true }); }

const jsDir = path.join(dir, "_expo", "static", "js", "web");
const indexPath = path.join(dir, "index.html");
let html = fs.readFileSync(indexPath, "utf8");
for (const f of fs.readdirSync(jsDir).filter((n) => n.endsWith(".js"))) {
  const full = path.join(jsDir, f);
  const code = fs.readFileSync(full, "utf8").split("assets/node_modules/").join("assets/vendor/");
  const hash = crypto.createHash("md5").update(code).digest("hex");
  const next = f.replace(/index-[a-f0-9]+\.js$/, `index-${hash}.js`);
  fs.writeFileSync(path.join(jsDir, next), code);
  if (next !== f) fs.unlinkSync(full);
  html = html.split(f).join(next);
}
fs.writeFileSync(indexPath, html);
if (JSON.stringify([...fs.readdirSync(dir)]).includes("node_modules")) throw new Error("node_modules still present");
console.log("web-build fixed");
