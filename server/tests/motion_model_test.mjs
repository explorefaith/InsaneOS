// motion_model_test.mjs — moving wallpapers without a screen (sdk/motionmodel.js).
import { motionCodecs, hwCodecs, pickVariant, pauseReason, displayCovered, appsOpen, userVideoProblem, nextRandom, adaptiveCap, memoryPressure, PRESSURE, CAP_STEADY_MS } from '../../sdk/motionmodel.js';

let ok = 0, bad = 0;
const eq = (name, a, b) => {
  if (JSON.stringify(a) === JSON.stringify(b)) ok++;
  else { bad++; console.error(`FAIL ${name}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); }
};

eq('gpu and hevc', motionCodecs({ hevc: true, h264: false }, 'gpu'), ['hevc']);
eq('gpu and both, hevc first', motionCodecs({ hevc: true, h264: true }, 'gpu'), ['hevc', 'h264']);
eq('h264 only when in hardware', motionCodecs({ hevc: false, h264: true }, 'gpu'), ['h264']);
eq('vp9 and av1 when in hardware, after the catalog\'s', motionCodecs({ hevc: true, h264: true, vp9: true, av1: true }, 'gpu'), ['hevc', 'h264', 'vp9', 'av1']);
eq('vp9 without the probe: nothing extra', motionCodecs({ hevc: true, h264: true }, 'gpu'), ['hevc', 'h264']);
eq('no decoder: nothing', motionCodecs({ hevc: false, h264: false, vp9: true }, 'gpu'), ['vp9']);
eq('no gpu composition: nothing', motionCodecs({ hevc: true, h264: true }, 'gpu-off'), []);
eq('a virtual gpu: nothing', motionCodecs({ hevc: true, virtualGpu: true }, 'gpu'), []);
eq('unknown yet: nothing', motionCodecs(null, 'gpu'), []);
// hwCodecs: what the login screen asks for — the decode only, no composition requirement
eq('hw: hevc', hwCodecs({ hevc: true, h264: false }), ['hevc']);
eq('hw: all four, catalog order first', hwCodecs({ hevc: true, h264: true, vp9: true, av1: true }), ['hevc', 'h264', 'vp9', 'av1']);
eq('hw: a virtual gpu: nothing', hwCodecs({ hevc: true, virtualGpu: true }), []);
eq('hw: unknown yet: nothing', hwCodecs(null), []);
eq('hw: none of the four: nothing', hwCodecs({ hevc: false, h264: false, vp9: false, av1: false }), []);

// adaptiveCap: the wallpaper's frame cap steps down under load and climbs back slowly
let st = null, now = 1000;
const step = (busy, dr) => { const r = adaptiveCap(30, { busy, dropRatio: dr }, st, now); st = r.state; now += 5000; return r.cap; };
eq('clear: stays at the cap', step(false, 0), 30);
eq('one busy sample: down a rung', step(true, 0), 15);
eq('still busy: down to the floor', step(true, 0), 10);
eq('clear but not steady yet: stays', step(false, 0), 10);
eq('drops alone count as load', (() => { st = null; now = 1000; return adaptiveCap(30, { busy: false, dropRatio: 0.9 }, st, now).cap; })(), 15);
for (let i = 0; i < 2; i++) step(true, 0);                    // back to the floor
for (let i = 0; i < 2; i++) step(false, 0);                   // clear samples, not steady yet
now += CAP_STEADY_MS;                                          // ... now it is
const r1 = adaptiveCap(30, { busy: false, dropRatio: 0 }, st, now); st = r1.state; now += 1000;
eq('steady: one rung back', r1.cap, 15);
const r2 = adaptiveCap(30, { busy: false, dropRatio: 0 }, st, now);
eq('right after a step: no second rung', r2.cap, 15);
st = r2.state; now += CAP_STEADY_MS;
const r3 = adaptiveCap(30, { busy: false, dropRatio: 0 }, st, now);
eq('steady again: back at the cap', r3.cap, 30);
const r4 = adaptiveCap(30, { busy: true, dropRatio: 0 }, r3.state, now + CAP_STEADY_MS);
eq('a burst drops one rung and resets the recovery clock', adaptiveCap(30, { busy: false, dropRatio: 0 }, r4.state, now + CAP_STEADY_MS + 5000).cap, 15);
const r5 = adaptiveCap(30, { busy: true, dropRatio: 0 }, r4.state, now + CAP_STEADY_MS + 10000);
eq('a second busy sample: to the floor', r5.cap, 10);
eq('clear again: the clock starts over', adaptiveCap(30, { busy: false, dropRatio: 0 }, r5.state, now + CAP_STEADY_MS + 15000).cap, 10);
eq('no cap: stays uncapped', adaptiveCap(0, { busy: true, dropRatio: 1 }, null, 0).cap, 0);

const item = { variants: [{ name: '2160.hevc', codec: 'hevc', w: 3840, h: 2160 }, { name: '1080.hevc', codec: 'hevc', w: 1920, h: 1080 }, { name: '1080.h264', codec: 'h264', w: 1920, h: 1080 }] };
eq('1080 screen', pickVariant(item, ['hevc', 'h264'], 1920, 1080).name, '1080.hevc');
eq('4K screen', pickVariant(item, ['hevc'], 3840, 2160).name, '2160.hevc');
eq('small screen: smallest', pickVariant(item, ['hevc'], 1280, 800).name, '1080.hevc');
eq('above the largest', pickVariant(item, ['hevc'], 5120, 2880).name, '2160.hevc');
eq('h264 machine', pickVariant(item, ['h264'], 3840, 2160).name, '1080.h264');
eq('no format', pickVariant(item, [], 1920, 1080), null);
eq('no matching format', pickVariant({ variants: [item.variants[2]] }, ['hevc'], 1920, 1080), null);

const base = { idleSec: 0 };
eq('plays', pauseReason(base), null);
eq('reduce motion', pauseReason({ ...base, reduceMotion: true }), 'reduceMotion');
eq('screen off', pauseReason({ ...base, screenOff: true }), 'screenOff');
eq('fullscreen', pauseReason({ ...base, fullscreen: true }), 'fullscreen');
eq('covered', pauseReason({ ...base, covered: true }), 'covered');
eq('idle', pauseReason({ ...base, idleSec: 300 }), 'idle');
eq('battery low', pauseReason({ ...base, battery: { discharging: true, percent: 20 } }), 'battery');
eq('battery charging', pauseReason({ ...base, battery: { discharging: false, percent: 5 } }), null);
eq('load', pauseReason({ ...base, busy: true }), 'busy');
eq('memory pressure', pauseReason({ ...base, pressure: true }), 'pressure');
eq('pressure is not optional', pauseReason({ ...base, pressure: true, pauseWhen: { busy: false, fullscreen: false, covered: false, idle: false, battery: false, locked: false } }), 'pressure');
eq('pressure beats busy, reports itself', pauseReason({ ...base, pressure: true, busy: true }), 'pressure');
eq('reduce motion beats pressure', pauseReason({ ...base, pressure: true, reduceMotion: true }), 'reduceMotion');

// desktopCovered (round 4): an app window in the view pauses; the switch composes with the others
const A = (over) => pauseReason({ ...base, desktopCovered: true, ...over });
eq('an app window open: pauses', A({}), 'desktopCovered');
eq('the switch can turn it off', A({ pauseWhen: { desktopCovered: false } }), null);
eq('fullscreen wins the reason', A({ fullscreen: true }), 'fullscreen');
eq('fullscreen off falls back to desktopCovered', A({ fullscreen: true, pauseWhen: { fullscreen: false } }), 'desktopCovered');
eq('screen off beats apps open', A({ screenOff: true }), 'screenOff');
eq('pressure beats apps open', A({ pressure: true }), 'pressure');
eq('locked beats apps open', A({ locked: true }), 'locked');
eq('apps open with every other switch off', A({ pauseWhen: { desktopCovered: true, locked: false, fullscreen: false, covered: false, idle: false, battery: false, busy: false } }), 'desktopCovered');

// appsOpen: what counts as a normal application window (desktopmodel's defaults: FIRST_DESKTOP = 1)
const W = (over) => ({ desktop: 1, ...over });
eq('a plain window: open', appsOpen([W({})], 1), true);
eq('minimized: desktop visible', appsOpen([W({ minimized: true })], 1), false);
eq('fullscreen window: not counted', appsOpen([W({ fullscreen: true })], 1), false);
eq('picture-in-picture: not counted', appsOpen([W({ pip: true })], 1), false);
eq('another desktop: not in view', appsOpen([W({ desktop: 2 })], 1), false);
eq('the same window after switching to its desktop', appsOpen([W({ desktop: 2 })], 2), true);
eq('a window that never named a desktop', appsOpen([{ minimized: false }], 1), true);
eq('an empty desktop', appsOpen([], 1), false);
eq('one window of many closed: still open', appsOpen([W({}), W({ minimized: true })], 1), true);

// acceptance: 100 open/close/minimize/restore cycles — the reason follows the desktop every time,
// nothing sticks, and the answer to "should it play" is the exact inverse of "is it covered"
let stuck = 0, cycles = 0;
for (let i = 0; i < 100; i++) {
  for (const state of [[false], [true], [true, true], [true, true, false]]) {
    const ws = state.map((min, k) => ({ id: k, desktop: 1, minimized: min }));
    const hidden = appsOpen(ws, 1);
    const why = pauseReason({ ...base, desktopCovered: hidden });
    cycles++;
    if ((why === 'desktopCovered') !== hidden) stuck++;
    if ((why === null) !== !hidden) stuck++;
  }
}
eq(`100 open/close/minimize/restore cycles, no stuck state (${cycles} transitions)`, stuck, 0);

// memoryPressure: the wallpaper stops on real pressure and returns only when it is clearly over
eq('quiet system: plays', memoryPressure({ some10: 0, some60: 0, availKB: 3e6 }, {}).on, false);
eq('sustained stall: stops', memoryPressure({ some10: 30, some60: 26, availKB: 3e6 }, {}).on, true);
eq('burst with room to spare: plays', memoryPressure({ some10: 45, some60: 5, availKB: 2e6 }, {}).on, false);
eq('burst with little free: stops', memoryPressure({ some10: 45, some60: 5, availKB: 300 * 1024 }, {}).on, true);
eq('just under the sustained line: plays', memoryPressure({ some10: 0, some60: PRESSURE.some60 - 0.5, availKB: 1e5 }, {}).on, false);
let ps = memoryPressure({ some60: 30, availKB: 1e5 }, {}).state;
eq('stays hot below the resume line', memoryPressure({ some60: 20, availKB: 3e6 }, ps).on, true);
eq('stays hot with memory still tight', memoryPressure({ some60: 10, availKB: 700 * 1024 }, ps).on, true);
eq('clear of both: back on', memoryPressure({ some60: 10, availKB: 2e6 }, ps).on, false);
eq('empty sample: plays', memoryPressure(undefined, {}).on, false);
eq('no psi on this kernel: plays', memoryPressure({ some10: -1, some60: -1, availKB: 2e6 }, {}).on, false);
eq('locked', pauseReason({ ...base, locked: true }), 'locked');
eq('the switches turn fullscreen off', pauseReason({ ...base, fullscreen: true, pauseWhen: { fullscreen: false } }), null);
eq('the switches turn covered off, fullscreen stays', pauseReason({ ...base, fullscreen: true, covered: true, pauseWhen: { covered: false } }), 'fullscreen');
eq('the switches turn idle off', pauseReason({ ...base, idleSec: 300, pauseWhen: { idle: false } }), null);
eq('the switches turn battery off', pauseReason({ ...base, battery: { discharging: true, percent: 20 }, pauseWhen: { battery: false } }), null);
eq('the switches turn busy off', pauseReason({ ...base, busy: true, pauseWhen: { busy: false } }), null);
eq('the switches turn locked off', pauseReason({ ...base, locked: true, pauseWhen: { locked: false } }), null);
eq('reduce motion is not optional', pauseReason({ ...base, reduceMotion: true, pauseWhen: { fullscreen: false, covered: false, idle: false, battery: false, busy: false, locked: false } }), 'reduceMotion');

const d = { x: 0, y: 0, w: 1920, h: 1080 };
eq('full window', displayCovered(d, [{ x: 0, y: 0, w: 1920, h: 1080 }]), true);
eq('bigger window', displayCovered(d, [{ x: -5, y: -5, w: 2000, h: 1200 }]), true);
eq('smaller window', displayCovered(d, [{ x: 0, y: 30, w: 1920, h: 1050 }]), false);
eq('another display', displayCovered(d, [{ x: 1920, y: 0, w: 1920, h: 1080 }]), false);

eq('hevc of any length', userVideoProblem({ duration: 8, codec: 'hevc' }, ['hevc']), null);
eq('long still plays: no cap', userVideoProblem({ duration: 3600, codec: 'hevc' }, ['hevc']), null);
eq('vp9 when the machine decodes it', userVideoProblem({ duration: 8, codec: 'vp9' }, ['hevc', 'vp9']), null);
eq('vp9 without hardware: format', userVideoProblem({ duration: 8, codec: 'vp9' }, ['hevc']), 'format');
eq('av1 when the machine decodes it', userVideoProblem({ duration: 8, codec: 'av1' }, ['av1']), null);
eq('h264 alias avc', userVideoProblem({ duration: 8, codec: 'avc' }, ['h264']), null);
eq('unreadable', userVideoProblem(null, ['hevc']), 'unreadable');

eq('random skips the last', nextRandom(['a', 'b'], 'a', () => 0), 'b');
eq('random with one', nextRandom(['a'], 'a'), 'a');
eq('random with none', nextRandom([], 'a'), null);

console.log(`motion-model-test: ${ok} ok`);
if (bad) process.exit(1);
