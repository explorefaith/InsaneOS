// motion_model_test.mjs — moving wallpapers without a screen (sdk/motionmodel.js).
import { motionCodecs, hwCodecs, pickVariant, pauseReason, displayCovered, userVideoProblem, nextRandom } from '../../sdk/motionmodel.js';

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
