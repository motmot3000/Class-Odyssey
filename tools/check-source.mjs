import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

// Parse authored code without executing browser modules or requiring Blender.
// Generated bundles/assets are deliberately outside these source roots.
const roots = ["src", "server", "admin-console", "tools", "tests"];
function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith(".") || entry.name === "__pycache__") return [];
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(filename) : [filename];
  });
}

const files = roots.flatMap(filesIn).sort();
const modules = files.filter(filename => filename.endsWith(".mjs") || filename.endsWith(".js"));
const python = files.filter(filename => filename.endsWith(".py"));
for (const filename of modules) {
  const result = spawnSync(process.execPath, ["--check", filename], { encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || String(result.error));
    process.exit(1);
  }
}
if (python.length) {
  const result = spawnSync("python3", ["-c", "import ast,sys,pathlib; [(ast.parse(pathlib.Path(p).read_text(), filename=p)) for p in sys.argv[1:]]", ...python], { encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || String(result.error));
    process.exit(1);
  }
}
console.log(`Syntax OK: ${modules.length} JavaScript modules, ${python.length} Python scripts.`);
