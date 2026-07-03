import fs from 'fs';

const orig = JSON.parse(fs.readFileSync('hud_screen_original.json', 'utf8').replace(/\/\/.*/g, ''));
const file = JSON.parse(fs.readFileSync('packs/resource/ui/hud_screen.json', 'utf8').replace(/\/\/.*/g, ''));

// Add subtitle parts
file.anim_subtitle_txt_alpha = orig.anim_subtitle_txt_alpha;
file.anim_subtitle_txt_wait = orig.anim_subtitle_txt_wait;
file.anim_subtitle_bg_alpha = orig.anim_subtitle_bg_alpha;
file.anim_subtitle_bg_wait = orig.anim_subtitle_bg_wait;
file.subtitle_direction_label = orig.subtitle_direction_label;
file.subtitle_grid_item = orig.subtitle_grid_item;
file.subtitle_panel = orig.subtitle_panel;
file.subtitle_container_content = orig.subtitle_container_content;

// Add subtitle container host
const rootPanelControls = file.root_panel.controls;
let hasSubtitleHost = rootPanelControls.some(c => c.subtitle_container_host);
if (!hasSubtitleHost) {
  const index = rootPanelControls.findIndex(c => c["right_helpers@hud.right_helpers"]);
  if (index !== -1) {
     rootPanelControls.splice(index + 1, 0, {
        "subtitle_container_host": {
            "type": "panel",
            "size": [ "100%", "100%" ],
            "factory": {
                "name": "subtitle_container_factory",
                "max_children_size": 1,
                "control_ids": {
                    "subtitle_container": "subtitle_container@hud.subtitle_container_content"
                }
            }
        }
    });
  }
}

// Remove cursor_renderer as we use hud_crosshair_overlay.json for it
if (file.cursor_renderer) delete file.cursor_renderer;

const index2 = rootPanelControls.findIndex(c => c["curor_rend@cursor_renderer"]);
if (index2 !== -1) {
  rootPanelControls.splice(index2, 1);
}

fs.writeFileSync("packs/resource/ui/hud_screen.json", JSON.stringify(file, null, 4));
