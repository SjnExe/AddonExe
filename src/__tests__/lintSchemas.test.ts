import { describe, expect, it } from 'bun:test';
import path from 'node:path';

import { validateContentJson, validateUiJson } from '../../scripts/lint/schemas.js';

describe('Bedrock JSON & JSON UI Validator (Zero False Positives + Strict Negative Checks)', () => {
  it('validates all existing pack JSON and JSON UI files with zero false positives', async () => {
    const rootDir = process.cwd();
    const glob = new Bun.Glob('packs/**/*.json');
    const files = Array.from(glob.scanSync({ cwd: rootDir, absolute: true }));

    expect(files.length).toBeGreaterThanOrEqual(19);

    for (const filePath of files) {
      const rel = path.relative(rootDir, filePath).replace(/\\/g, '/');
      const json = (await Bun.file(filePath).json()) as Record<string, unknown>;
      const errs = rel.startsWith('packs/resource/ui/') ? validateUiJson(rel, json) : validateContentJson(rel, json);
      expect(errs).toEqual([]);
    }
  });

  it('catches invalid collection_index and collection_name on non-grid/non-factory UI panels', () => {
    const badUi = {
      namespace: 'server_form',
      bad_toolbar: {
        type: 'panel',
        collection_name: 'form_buttons',
        collection_index: 0,
      },
    };
    const errs = validateUiJson('packs/resource/ui/server_form.json', badUi);
    expect(errs.some((e) => e.includes("'collection_index' is not a valid direct JSON UI property"))).toBe(true);
    expect(errs.some((e) => e.includes("'collection_name' is only valid on 'grid' or controls with a 'factory'"))).toBe(
      true,
    );
  });

  it('catches unknown JSON UI control properties and broken local @ references', () => {
    const badUi = {
      namespace: 'server_form',
      my_panel: {
        type: 'panel',
        made_up_property: 123,
        controls: [
          {
            'child@server_form.non_existent_template': {},
          },
        ],
      },
    };
    const errs = validateUiJson('packs/resource/ui/server_form.json', badUi);
    expect(errs.some((e) => e.includes("Unknown JSON UI control property 'made_up_property'"))).toBe(true);
    expect(errs.some((e) => e.includes("Local namespace reference 'server_form.non_existent_template'"))).toBe(true);
  });

  it('catches malformed Bedrock content JSON files (recipes, entities, manifests)', () => {
    const badRecipe = {
      format_version: '1.20.10',
      'minecraft:recipe_shaped': {
        description: {},
      },
    };
    expect(validateContentJson('packs/behavior/recipes/bad.json', badRecipe).length).toBeGreaterThan(0);

    const badManifest = {
      format_version: 2,
      header: { name: 'Test', uuid: 'not-a-uuid' },
      modules: [],
    };
    expect(validateContentJson('packs/behavior/manifest.json', badManifest).length).toBeGreaterThan(0);
  });
});
