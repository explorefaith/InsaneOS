// Motion.jsx — Settings → Motion: the desktop's animation studio, after the motion reference's own
// "Animations" page: the active Bézier curve drawn on a grid (the reference's editor, P1 and P2 and
// all), an easing preview that rides the curve (Replay, Loop), the global speed chips and the
// per-directive speeds (window entrance, window closing, panels, the sidebar pill, toggles) —
// every value live through sdk/animation.js (motionScaleNow, easeDefaultNow), Reduce Motion honored
// by the ramps themselves.
import {
  View, Text, Button, useTheme, useLocale, useSettings, tOptional, spacing, typeScale,
} from '@insaneos/sdk';
import { Section, SettingRow, PopUp } from './ui.jsx';
import { useRef, useState } from 'react';
import { DUR, easeElegantBounce, easeOutCubic, motionScaleNow } from '@insaneos/sdk';

const L = (k, fb) => tOptional(`settings.motion.${k}`) || fb;

// The two curves the desktop can land with, exactly as sdk/animation.js defines them.
const CURVES = {
  bounce: { label: 'elegant_bounce', ease: easeElegantBounce, p1: 'P1 (0.35, 1.38)', p2: 'P2 (0.24, 1.02)' },
  smooth: { label: 'smooth', ease: easeOutCubic, p1: '—', p2: '—' },
};

// The curve drawn on a grid: N bottom-aligned bars of the curve's height (the engine has no vector
// paths — the same composition trick the settings glyphs use), the overshoot above the top line
// reads as exactly that.
function CurvePlot({ ease, w = 330, h = 150 }) {
  const t = useTheme();
  const n = 30, bw = 5, gap = (w - n * bw) / (n - 1);
  return (
    <View style={{ width: w, height: h, position: 'relative', backgroundColor: t.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
      borderRadius: 10, border: `1px solid ${t.separator}`, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: Math.round(h * 0.08), height: 1, backgroundColor: t.separator }} />
      <View style={{ position: 'absolute', left: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10 }}>
        {Array.from({ length: n }, (_, i) => {
          const e = ease(i / (n - 1));
          const bh = Math.max(2, Math.round(e * (h - 16)));
          return <View key={i} style={{ width: bw, height: bh, marginRight: i < n - 1 ? gap : 0,
            backgroundColor: i === n - 1 ? t.accent : t.accent, opacity: 0.28 + 0.72 * (i / (n - 1)), borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />;
        })}
      </View>
      <Text style={{ position: 'absolute', right: 8, top: 4, fontSize: 10, color: t.textDim }}>1.0</Text>
    </View>
  );
}

// The easing preview: a dot riding a track with the active curve. playing: the 900 ms run (a touch
// longer than a landing so the shape reads); loop restarts the run the moment it lands.
function PreviewStrip({ curve, playing, loop, onReplay }) {
  const t = useTheme();
  const [p, setP] = useState(1);
  const run = (t0) => {
    const iv = setInterval(() => {
      const q = Math.min(1, (performance.now() - t0) / 900);
      setP(q);
      if (q >= 1) {
        clearInterval(iv);
        if (loop.current) run(performance.now());
        else setP(1);
      }
    }, 16);
  };
  const start = () => run(performance.now());
  return (
    <View style={{ gap: spacing.s }}>
      <View style={{ height: 34, borderRadius: 17, backgroundColor: t.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
        border: `1px solid ${t.separator}`, position: 'relative' }}>
        <View style={{ position: 'absolute', left: 14, top: 15, width: 4, height: 4, borderRadius: 2, backgroundColor: t.textDim }} />
        <View style={{ position: 'absolute', right: 14, top: 15, width: 4, height: 4, borderRadius: 2, backgroundColor: t.textDim }} />
        {playing ? (
          <View style={{ position: 'absolute', left: 10 + CURVES[curve].ease(p) * 148, top: 10, width: 14, height: 14, borderRadius: 7,
            backgroundColor: t.accent, boxShadow: '0 2px 6px rgba(0,0,0,0.35)' }} />
        ) : (
          <View style={{ position: 'absolute', left: 10, top: 10, width: 14, height: 14, borderRadius: 7, backgroundColor: t.accent, opacity: 0.5 }} />
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.s, alignItems: 'center' }}>
        <Button small label={L('replay', 'Replay')} onClick={onReplay} />
        <Text style={{ fontSize: typeScale.caption, color: t.textDim }}>{CURVES[curve].label}</Text>
      </View>
    </View>
  );
}

export default function MotionSettings() {
  const t = useTheme();
  const { t: tr } = useLocale();
  const [s, set] = useSettings();
  const [previewKey, setPreviewKey] = useState(0);      // remount = replay
  const [loopOn, setLoopOn] = useState(false);
  const loop = useRef(false);
  loop.current = loopOn;
  const curve = s.motionCurve === 'smooth' ? 'smooth' : 'bounce';
  const scale = motionScaleNow();
  const DIRECTIVES = [
    ['open', tr('settings.motion.dir.windowIn'), DUR.open],
    ['close', tr('settings.motion.dir.windowOut'), DUR.close],
    ['panel', tr('settings.motion.dir.panel'), DUR.panel],
    ['pill', tr('settings.motion.dir.pill'), DUR.pill],
    ['toggle', tr('settings.motion.dir.toggle'), DUR.toggle],
  ];
  const speedOf = (k) => { const m = Number((s.motionSpeeds || {})[k]); return Number.isFinite(m) && m >= 0.5 && m <= 3 ? m : 1; };
  const SPEEDS = [['0.5', '0.5×'], ['0.8', '0.8×'], ['1', '1×'], ['1.5', '1.5×'], ['2', '2×']];
  return (
    <View style={{ gap: spacing.xl }}>
      <Section title={L('curve', 'Landing curve')} footer={L('curveHint', 'The shape every landing takes: a fast rise that overshoots a little and settles, or a plain fast-out. The whole desktop switches at once.')}>
        <SettingRow stack>
          <View style={{ flexDirection: 'row', gap: spacing.l, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <CurvePlot ease={CURVES[curve].ease} />
            <View style={{ gap: 6, paddingTop: 6 }}>
              <Text style={{ fontSize: typeScale.headline, fontWeight: 600, color: t.text, textAlign: 'start' }}>{CURVES[curve].label}</Text>
              <Text style={{ fontSize: typeScale.caption, color: t.textDim, textAlign: 'start' }}>{CURVES[curve].p1}</Text>
              <Text style={{ fontSize: typeScale.caption, color: t.textDim, textAlign: 'start' }}>{CURVES[curve].p2}</Text>
              <PopUp width={190} value={curve}
                onChange={(motionCurve) => set({ motionCurve })}
                options={[['bounce', L('curve.bounce', 'elegant_bounce')], ['smooth', L('curve.smooth', 'smooth')]]} />
            </View>
          </View>
        </SettingRow>
      </Section>
      <Section title={L('preview', 'Easing preview')} footer={L('previewHint', 'The dot rides the curve from the left mark to the right one — one landing per Replay, or continuously.')}>
        <PreviewStrip key={`${curve}:${previewKey}`} curve={curve} playing loop={loop} onReplay={() => setPreviewKey((k) => k + 1)} />
        <SettingRow label={L('loop', 'Loop the preview')} hint={L('loopHint', 'Keep the dot travelling until you leave the page.')}>
          <PopUp width={130} value={loopOn ? 'on' : 'off'} onChange={(v) => setLoopOn(v === 'on')}
            options={[['off', L('off', 'Off')], ['on', L('on', 'On')]]} />
        </SettingRow>
      </Section>
      <Section title={tOptional('settings.motionSpeed') || 'Motion speed'} footer={tOptional('settings.motionSpeedHint') || 'How long the movement of the desktop takes: windows, panels, toggles. The default is the measured reference.'}>
        <SettingRow label={tOptional('settings.motionSpeed') || 'Motion speed'}
          hint={L('chipsHint', 'The chips multiply every duration at once — the windows, the panels, the pills, the toggles.')}>
          <PopUp width={150} value={String(scale === 1 ? '1' : scale)}
            onChange={(motionScale) => set({ motionScale: Number(motionScale) })}
            options={[['0.8', tOptional('settings.motionSpeed.faster') || 'Faster (0.8×)'], ['1', tOptional('settings.motionSpeed.default') || 'Default (1×)'],
              ['1.5', tOptional('settings.motionSpeed.relaxed') || 'Relaxed (1.5×)'], ['2', tOptional('settings.motionSpeed.slow') || 'Slow (2×)']]} />
        </SettingRow>
      </Section>
      <Section title={L('directives', 'Animation directives')} footer={L('directivesHint', 'How long each family takes, on top of the global speed — the reference gives every directive its own speed slider too.')}>
        {DIRECTIVES.map(([k, label, ms]) => (
          <SettingRow key={k} label={label} hint={`${L('base', 'Base')} ${Math.round(ms)} ms`}>
            <PopUp width={110} value={String(speedOf(k))} onChange={(v) => set({ motionSpeeds: { ...(s.motionSpeeds || {}), [k]: Number(v) } })}
              options={SPEEDS} />
          </SettingRow>
        ))}
        <SettingRow label={L('reset', 'Reset all directives')} hint={L('resetHint', 'Every family back to its measured value.')}>
          <Button small label={L('reset', 'Reset')} onClick={() => set({ motionSpeeds: null })} />
        </SettingRow>
      </Section>
    </View>
  );
}
