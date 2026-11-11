// voicein.js — Dictation (❖D): press once to record from the microphone, again to stop.
// whisper.cpp transcribes the recording locally (root admin action `dictate-transcribe`,
// which only reads the WAV) and the text lands on the clipboard and is pasted into the
// app in front — like macOS's dictation, but everything stays on this computer.
import { notify } from './notify.js';
import { clipboard } from './clipboard.js';
import { admin } from './admin.js';
import * as media from './media.js';

let recId = 0, guard = 0, seq = 0, busyTranscribing = false;

const say = (body) => { try { notify({ app: 'settings', title: 'Dictation', body, sound: false }); } catch { /* headless */ } };
const dir = () => `${lord.fs.home()}/.cache/lordos/dictation`;

export const dictating = () => !!recId;

export function toggleDictation() {
  if (busyTranscribing) return;
  if (recId) {                                       // second press: stop and transcribe
    const id = recId;
    recId = 0;
    try { media.stop(id); } catch (e) { say(e.message); }
    return;
  }
  let path;
  try {
    seq++;
    path = `${dir()}/dict-${seq}.wav`;
    const id = media.audioRecord('desktop', path, {});
    if (!id) throw new Error('microphone unavailable');
    recId = id;
    media.on(id, (data) => {
      if (recId !== id) return;
      recId = 0;
      if (data?.error) say(`recording failed: ${data.error}`);
      else transcribe(path);
    });
  } catch (e) {
    recId = 0;
    say(e.message);
    return;
  }
  clearTimeout(guard);                               // a stuck recording stops itself after 30 s
  guard = setTimeout(() => { if (recId) toggleDictation(); }, 30000);
}

async function transcribe(path) {
  busyTranscribing = true;
  const lines = [];
  try {
    await admin.run('dictate-transcribe', path, (line) => lines.push(line));
  } catch (e) {
    busyTranscribing = false;
    say(e.message);
    return;
  }
  busyTranscribing = false;
  const all = lines.join('\n');
  const at = all.indexOf('__DICTATE_BEGIN__');
  const text = (at >= 0 ? all.slice(at + '__DICTATE_BEGIN__'.length) : all)
    .split('\n').map((l) => l.trim()).filter(Boolean).join(' ').trim();
  if (!text) { say('nothing heard (or whisper.cpp is missing — see Settings → AI → Dictation)'); return; }
  try { clipboard.set(text); } catch { /* clipboard refused */ }
  try { lord.wayland.paste(); } catch { /* nothing focused */ }
}
