const fs = require('fs');
const hud = JSON.parse(fs.readFileSync('packs/resource/ui/hud_screen.json', 'utf8'));
const orig = JSON.parse(fs.readFileSync('hud_screen_original.json', 'utf8'));

let match = 0;
try {
  // Check subtitle properties
  if (hud.anim_subtitle_text_alpha_in) match++;

  // Check if cursor exists somewhere
  const str = JSON.stringify(hud);
  if (str.includes("cursor_renderer")) match++;
  if (str.includes("subtitle_container_host")) match++;

  console.log("Checks passed: " + match);
} catch (e) {
  console.error(e);
}
