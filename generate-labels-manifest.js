// Regenerates label_images/manifest.json from the folders on disk.
// Usage: node generate-labels-manifest.js
// - supported_labels/* -> SUPPORTED LABELS section
// - upcoming_labels/* -> UPCOMING LABELS section
// - Section title = folder name with "_" -> " " (e.g. polo_by_ralph_lauren -> "polo by ralph lauren")
// - Captions are derived at runtime in labels.js from file names, so no caption update needed here.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);

// Only "_" becomes " " — dashes, apostrophes and other symbols are preserved.
function folderToTitle(folder) {
  return String(folder).replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
}

function scanGroup(groupDir, urlPrefix) {
  const dir = path.join(ROOT, groupDir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b))
    .map((folder) => {
      const folderDir = path.join(dir, folder);
      const files = fs.readdirSync(folderDir)
        .filter((f) => {
          const full = path.join(folderDir, f);
          return fs.statSync(full).isFile() && IMAGE_EXTS.has(path.extname(f).toLowerCase());
        })
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      return {
        folder,
        title: folderToTitle(folder),
        baseDir: `${urlPrefix}/${folder}`,
        files
      };
    })
    // Skip folders with no images so the page never renders empty sections.
    .filter((g) => g.files.length > 0);
}

const manifest = {
  // Section headings derived from the parent folder names (only "_" -> " ").
  sections: {
    supported: folderToTitle('supported_labels'),
    upcoming: folderToTitle('upcoming_labels')
  },
  supported: scanGroup('label_images/supported_labels', '/label_images/supported_labels'),
  upcoming: scanGroup('label_images/upcoming_labels', '/label_images/upcoming_labels')
};

const outPath = path.join(ROOT, 'label_images', 'manifest.json');
fs.writeFileSync(outPath, JSON.stringify(manifest, null, 1) + '\n', 'utf8');

const counts = [...manifest.supported, ...manifest.upcoming]
  .map((g) => `  ${g.folder}: ${g.files.length}`)
  .join('\n');
console.log(`Wrote ${path.relative(ROOT, outPath)}\n${counts}`);
