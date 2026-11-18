// theme_studio_store_test.mjs — the Theme Studio store against the real settings store (node:
// `insane` is absent, so settings.load() falls back to the defaults and the debounced save is a
// no-op). Walks activation, the savedAppearance contract, overrides riding theme switches, the
// custom preset lifecycle and the malformed-data guards.
import assert from 'node:assert/strict';
import { settings } from '../sdk/settings.js';
import { THEMES } from '../sdk/themestudio-themes.js';
import {
  tsLive, tsInit, tsApplyTheme, tsDeactivate, tsMutate, tsResetTheme,
  tsSaveCustom, tsDeleteCustom, tsRenameCustom, themeOf, tsAllThemes,
} from '../sdk/themestudio.js';

const AREA = { x: 0, y: 28, w: 1280, h: 692 };
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };

const acid = THEMES.find((t) => t.id === 'acid-press');
const forest = THEMES.find((t) => t.id === 'deep-forest');
ok(!!acid && !!forest, 'the reference themes exist');
ok(THEMES.every((t) => !!themeOf(t.id)), 'every built-in resolves through themeOf');
eq(themeOf('no-such-theme'), null, 'an unknown id resolves to nothing');

// the store starts clean
settings.set({ themeStudio: null });
tsInit(AREA);
eq(tsLive.get().active, null, 'a fresh settings file: no active theme');
eq(tsLive.get().widgets, [], 'and no widgets');
eq(tsMutate((l) => l.map((w) => ({ ...w, x: 0 })), AREA), null, 'edits without an active theme do nothing');
eq(tsApplyTheme('no-such-theme', AREA), false, 'applying an unknown theme is refused');

// ---------------------------------------------------------------- activation
const before = { wallpaper: 'lumo-celestial', wallpaperBg: null, wallpaperFit: 'fill', motion: {}, mode: 'dark', accent: 'auto' };
settings.set(before);
ok(tsApplyTheme('acid-press', AREA), 'Acid Press applies');
eq(tsLive.get().active, 'acid-press', 'the store says so');
ok(tsLive.get().widgets.length === acid.widgets.length, 'the live list matches the plan');
eq(settings.get().wallpaper, 'wallpaper-3', 'the wallpaper followed the theme');
eq(settings.get().mode, 'light', 'the mode followed the theme');
const saved = settings.get().themeStudio;
eq(saved.savedAppearance.wallpaper, 'lumo-celestial', 'the pre-theme look was snapshotted');
eq(saved.savedAppearance.mode, 'dark', '…including the mode');
ok(saved.overrides['acid-press'] === undefined, 'an untouched theme writes no override');

// a user edit persists as an override (and only then)
const w0 = tsLive.get().widgets[0];
const moved = tsMutate((l) => l.map((x) => (x.id === w0.id ? { ...x, x: 400 } : x)), AREA);
eq(moved[0].x, 400, 'the edit lands on the live list');
ok(settings.get().themeStudio.overrides['acid-press'], 'the override is persisted');
eq(settings.get().themeStudio.overrides['acid-press'].widgets.length, moved.length, '…with the whole list');

// re-init reads the same state back (the boot path)
tsInit(AREA);
eq(tsLive.get().widgets[0].x, 400, 'the override survives a reload');

// reset theme drops the override and re-resolves
ok(tsResetTheme(AREA), 'reset works');
eq(settings.get().themeStudio.overrides['acid-press'], undefined, 'the override is gone');
eq(tsLive.get().widgets[0].x, acid.widgets[0].x, 'the plan is back');

// ---------------------------------------------------------------- switching themes
ok(tsApplyTheme('deep-forest', AREA), 'Deep Forest applies over Acid Press');
eq(settings.get().wallpaper, 'wallpaper-2', 'the wallpaper followed');
eq(settings.get().mode, 'light', 'the mode followed');
eq(settings.get().themeStudio.active, 'deep-forest', 'active moved');
eq(settings.get().themeStudio.savedAppearance.wallpaper, 'lumo-celestial', 'the original snapshot survives a switch');
// overrides ride switches per theme: Forest's mark stays Forest's, Acid's stays Acid's
const fw0 = tsLive.get().widgets[0];
tsMutate((l) => l.map((x) => (x.id === fw0.id ? { ...x, x: 500 } : x)), AREA);
ok(tsApplyTheme('acid-press', AREA), 'back to Acid Press');
eq(tsLive.get().widgets[0].x, 48, 'Acid re-resolves its plan (the earlier reset cleared its override)');
const aw0 = tsLive.get().widgets[0];
tsMutate((l) => l.map((x) => (x.id === aw0.id ? { ...x, x: 400 } : x)), AREA);
ok(tsApplyTheme('deep-forest', AREA), 'to Forest again');
eq(tsLive.get().widgets[0].x, 500, 'Forest keeps its own override (500), not Acid\'s mark');
ok(tsApplyTheme('acid-press', AREA), 'and back once more');
eq(tsLive.get().widgets[0].x, 400, 'Acid keeps 400 — each theme carries its own edits');
eq(tsLive.get().active, 'acid-press', 'active is Acid again');

// ---------------------------------------------------------------- deactivation
tsDeactivate(AREA);
eq(tsLive.get().active, null, 'deactivate clears the theme');
eq(tsLive.get().widgets, [], 'and the widget list');
eq(settings.get().wallpaper, 'lumo-celestial', 'the pre-theme wallpaper returned');
eq(settings.get().mode, 'dark', 'the pre-theme mode returned');
eq(settings.get().themeStudio.savedAppearance, null, 'the snapshot is spent');
eq(settings.get().themeStudio.overrides['acid-press'].widgets[0].x, 400, 'the overrides are kept for next time');

// deactivating without a snapshot (an interrupted first apply) must not blank the desktop
settings.set({ themeStudio: { active: null, savedAppearance: null, overrides: {}, customs: {} }, wallpaper: 'crystal-apple' });
tsInit(AREA);
tsApplyTheme('deep-forest', AREA);
settings.set({ themeStudio: { active: 'deep-forest', savedAppearance: null, overrides: {}, customs: {} } });
tsDeactivate(AREA);
eq(settings.get().wallpaper, 'wallpaper-2', 'no snapshot: the current look stays (nothing blanks)');

// ---------------------------------------------------------------- custom presets
settings.set({ themeStudio: null, wallpaper: 'lumo-celestial', mode: 'dark', accent: 'auto', wallpaperBg: null, wallpaperFit: 'fill', motion: {} });
tsInit(AREA);
tsApplyTheme('deep-forest', AREA);
tsMutate((l) => l.map((x) => (x.id === tsLive.get().widgets[0].id ? { ...x, x: 224 } : x)), AREA);
const cid = tsSaveCustom('My Forest');
ok(cid && cid.startsWith('custom-'), 'a custom preset is saved with a namespaced id');
const rec = settings.get().themeStudio.customs[cid];
eq(rec.name, 'My Forest', 'with its name');
eq(rec.base, 'deep-forest', 'and its base');
eq(rec.widgets[0].x, 224, 'and the edited widget list');
eq(rec.appearance.wallpaper, 'wallpaper-2', 'and the appearance of the moment');
ok(themeOf(cid).custom === true, 'the preset resolves as a custom theme');
ok(tsAllThemes().some((t) => t.id === cid), 'and lists in the picker');

// applying the custom: its own list, its own look
tsDeactivate(AREA);
ok(tsApplyTheme(cid, AREA), 'the custom applies');
eq(tsLive.get().widgets[0].x, 224, 'its widget list comes back');
eq(settings.get().wallpaper, 'wallpaper-2', 'its look comes back');
eq(tsLive.get().def.name, 'My Forest', 'the live def is the preset');

// rename
ok(tsRenameCustom(cid, 'Better Forest'), 'rename works');
eq(themeOf(cid).name, 'Better Forest', 'the def follows');

// appearance changes while a custom is active belong to the preset (the sync subscription)
settings.set({ wallpaper: 'anime-1' });
const rec2 = settings.get().themeStudio.customs[cid];
eq(rec2.appearance.wallpaper, 'anime-1', 'the preset recorded the new wallpaper');

// deletion while active deactivates
ok(tsDeleteCustom(cid), 'delete works');
eq(settings.get().themeStudio.active, null, 'the active custom is gone with it');
eq(tsLive.get().widgets, [], 'and the desktop is clear');
eq(tsDeleteCustom(cid), false, 'deleting it again is refused');

// a custom whose widgets are junk is dropped at load
settings.set({ themeStudio: { active: null, savedAppearance: null, overrides: {}, customs: { 'custom-bad': { name: 'x', widgets: 'nope' } } } });
tsInit(AREA);
eq(themeOf('custom-bad'), null, 'a malformed custom never resolves');

console.log(`theme_studio_store: ${checks} checks passed`);
