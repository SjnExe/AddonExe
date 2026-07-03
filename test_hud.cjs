const fs = require('fs');
const hud = JSON.parse(fs.readFileSync('packs/resource/ui/hud_screen.json', 'utf8'));

let match = 0;
try {
  // Check if cursor exists somewhere
  const str = JSON.stringify(hud);
  if (!str.includes("cursor_renderer")) match++;
  if (str.includes("subtitle_container_host")) match++;
  if (str.includes("anim_subtitle_txt_alpha")) match++;

  console.log("Checks passed: " + match);
} catch (e) {
  console.error(e);
}
