// ts-widget-specs.js — the Theme Studio's widget catalog, as data.
//
// Every kind is one spec: { id, label, cat, w, h, v, src, ... } where
//   v    the renderer variant (ThemeWidgets.jsx implements each once; specs reuse them)
//   src  the data provider (a key of the renderer's PROVIDERS map — real sources only)
// and the rest are the variant's hints (which field, the unit, thresholds, default cfg).
//
// Every src below was verified against the code that serves it before it entered the table —
// server/src/monitor/mon.c (sample: cpu, cores[], mem{...}, load[], tasks{}, uptime, temp, net{},
// disk{read,write,disks[]}), js_monitor.c (processes, connections, netTotals, diskTemps, voltage,
// gpu, history), js_sys.c (system.info: hostname/kernel/arch/os/cpu/cores/uptime/bootSeconds/
// version/channel/build/user/fullName/board), insane.disks.list(), insane.system.pressure()
// ({some10, some60, availKB}), useBattery, the sound store, nowPlaying, the weather store
// (current: temperature_2m, relative_humidity_2m, weather_code, wind_speed_10m; daily: min/max ×7),
// Calendar/Reminders, clockAlarms/clockTimer/stopwatch, night/sunTimes, powerPrefs/powerProfiles,
// bluetooth, displays, and Intl for the pure-time derivations. A provider whose data is missing
// (no sensor, no GPU, no swap) renders its quiet state — never a fake number.
// Pure data: tests/theme_studio_specs_test.mjs walks the table.

export const TS_CATS = [
  ['time', 'Time'],
  ['system', 'System'],
  ['power', 'Power'],
  ['media', 'Media'],
  ['network', 'Network'],
  ['work', 'Productivity'],
  ['info', 'Information'],
  ['ambient', 'Ambient'],
];

// The renderer variants (ThemeWidgets.jsx implements exactly these) and the data providers (its
// PROVIDERS map implements exactly these). Declared here so the node test can validate the whole
// table against them, and so a missing implementation is a loud console error at load, never a
// silent blank card.
export const TS_VARIANTS = [
  'clock', 'clock-analog', 'world', 'binary', 'week', 'calendar', 'agenda', 'countdown',
  'value', 'ring', 'chart', 'spark', 'rows', 'text', 'bar', 'image', 'progress',
  'stats', 'battery', 'storage', 'network', 'gauge', 'weather', 'forecast', 'moon',
  'media', 'todo', 'notes', 'quote', 'label', 'headline', 'pomodoro', 'timer', 'stopwatch', 'toggle',
];

export const TS_PROVIDERS = [
  'clockTime', 'clockDate', 'weekNumber', 'nextAlarm', 'eventsCount', 'sunTimes',
  'cpu', 'cpuCores', 'cpuHistory', 'loadAvg', 'load1', 'cpuModel', 'cpuCoresCount',
  'ram', 'ramApps', 'ramCache', 'ramHistory', 'ramRows', 'swap',
  'tasksRunning', 'tasksTotal', 'temp', 'diskTemp', 'pressure', 'voltage',
  'gpuName', 'gpuBusy', 'gpuClients',
  'diskUsed', 'diskFree', 'diskList', 'ioRead', 'ioWrite', 'ioHistory',
  'battery', 'batteryTime', 'batteryState', 'powerMode', 'nightLight',
  'mediaTitle', 'mediaProgress', 'mediaCover', 'volume', 'mute', 'audioOutput',
  'netDown', 'netUp', 'netTotalDown', 'netTotalUp', 'netHistory', 'netIfs', 'connCount', 'wifiState', 'bluetooth',
  'todoCount', 'todoFlagged',
  'osVersion', 'kernel', 'hostname', 'userName', 'arch', 'board', 'build', 'bootTime', 'uptime', 'timezone', 'displayInfo',
  'weatherTemp', 'weatherCond', 'weatherHumidity', 'weatherWind', 'weatherRange', 'weatherForecast',
  'dayProgress', 'yearProgress', 'modeBadge',
];

export const TS_WIDGET_SPECS = [

  // ---------------------------------------------------------------- Time
  { id: 'clock-digital', label: 'Digital clock', cat: 'time', w: 300, h: 132, v: 'clock' },
  { id: 'clock-analog', label: 'Analog clock', cat: 'time', w: 148, h: 148, v: 'clock-analog' },
  { id: 'clock-minimal', label: 'Minimal clock', cat: 'time', w: 168, h: 96, v: 'clock', src: 'clockTime', minimal: true },
  { id: 'clock-world', label: 'World clock', cat: 'time', w: 168, h: 168, v: 'world', cfg: { zones: ['Europe/London', 'Asia/Tokyo'] } },
  { id: 'clock-binary', label: 'Binary clock', cat: 'time', w: 168, h: 108, v: 'binary' },
  { id: 'clock-full', label: 'Date and time', cat: 'time', w: 300, h: 150, v: 'clock', src: 'clockDate' },
  { id: 'calendar', label: 'Calendar', cat: 'time', w: 288, h: 300, v: 'calendar' },
  { id: 'calendar-week', label: 'Week strip', cat: 'time', w: 260, h: 96, v: 'week' },
  { id: 'agenda', label: 'Agenda', cat: 'time', w: 260, h: 128, v: 'agenda' },
  { id: 'agenda-count', label: "Today's events", cat: 'time', w: 148, h: 96, v: 'value', src: 'eventsCount' },
  { id: 'alarm-next', label: 'Next alarm', cat: 'time', w: 220, h: 96, v: 'value', src: 'nextAlarm' },
  { id: 'countdown', label: 'Countdown', cat: 'time', w: 220, h: 110, v: 'countdown', cfg: { target: '' } },
  { id: 'week-number', label: 'Week number', cat: 'time', w: 148, h: 96, v: 'value', src: 'weekNumber' },
  { id: 'moon-phase', label: 'Moon phase', cat: 'time', w: 148, h: 148, v: 'moon' },
  { id: 'sun-times', label: 'Sunrise & sunset', cat: 'time', w: 220, h: 110, v: 'rows', src: 'sunTimes' },

  // ---------------------------------------------------------------- System
  { id: 'stats', label: 'System stats', cat: 'system', w: 168, h: 158, v: 'stats' },
  { id: 'gauge', label: 'CPU gauge', cat: 'system', w: 168, h: 120, v: 'gauge' },
  { id: 'cpu-value', label: 'CPU usage', cat: 'system', w: 148, h: 96, v: 'value', src: 'cpu' },
  { id: 'cpu-ring', label: 'CPU ring', cat: 'system', w: 148, h: 148, v: 'ring', src: 'cpu' },
  { id: 'cpu-bars', label: 'Per-core CPU', cat: 'system', w: 260, h: 150, v: 'chart', src: 'cpuCores' },
  { id: 'cpu-history', label: 'CPU history', cat: 'system', w: 280, h: 120, v: 'spark', src: 'cpuHistory' },
  { id: 'cpu-load', label: 'Load average', cat: 'system', w: 168, h: 120, v: 'rows', src: 'loadAvg' },
  { id: 'cpu-load1', label: 'Load (1 min)', cat: 'system', w: 148, h: 96, v: 'value', src: 'load1' },
  { id: 'cpu-model', label: 'Processor', cat: 'system', w: 300, h: 92, v: 'text', src: 'cpuModel', sub: 'cpuCores' },
  { id: 'ram-value', label: 'Memory', cat: 'system', w: 148, h: 96, v: 'value', src: 'ram' },
  { id: 'ram-ring', label: 'Memory ring', cat: 'system', w: 148, h: 148, v: 'ring', src: 'ram' },
  { id: 'ram-apps', label: 'Memory in use', cat: 'system', w: 168, h: 110, v: 'value', src: 'ramApps' },
  { id: 'ram-cache', label: 'Memory cached', cat: 'system', w: 168, h: 110, v: 'value', src: 'ramCache' },
  { id: 'ram-history', label: 'Memory history', cat: 'system', w: 280, h: 120, v: 'spark', src: 'ramHistory' },
  { id: 'ram-detail', label: 'Memory breakdown', cat: 'system', w: 260, h: 150, v: 'rows', src: 'ramRows' },
  { id: 'swap-value', label: 'Swap', cat: 'system', w: 168, h: 110, v: 'value', src: 'swap' },
  { id: 'swap-ring', label: 'Swap ring', cat: 'system', w: 148, h: 148, v: 'ring', src: 'swap' },
  { id: 'tasks-running', label: 'Running tasks', cat: 'system', w: 148, h: 96, v: 'value', src: 'tasksRunning' },
  { id: 'tasks-total', label: 'Total tasks', cat: 'system', w: 148, h: 96, v: 'value', src: 'tasksTotal' },
  { id: 'temp-cpu', label: 'Temperature', cat: 'system', w: 148, h: 96, v: 'value', src: 'temp' },
  { id: 'temp-ring', label: 'Temperature ring', cat: 'system', w: 148, h: 148, v: 'ring', src: 'temp' },
  { id: 'temp-disk', label: 'Disk temperature', cat: 'system', w: 168, h: 110, v: 'value', src: 'diskTemp' },
  { id: 'pressure-ram', label: 'Memory pressure', cat: 'system', w: 168, h: 110, v: 'value', src: 'pressure' },
  { id: 'voltage-cpu', label: 'Core voltage', cat: 'system', w: 148, h: 96, v: 'value', src: 'voltage' },
  { id: 'gpu-name', label: 'Graphics', cat: 'system', w: 280, h: 92, v: 'text', src: 'gpuName' },
  { id: 'gpu-usage', label: 'GPU usage', cat: 'system', w: 148, h: 148, v: 'ring', src: 'gpuBusy' },
  { id: 'gpu-clients', label: 'GPU clients', cat: 'system', w: 148, h: 96, v: 'value', src: 'gpuClients' },

  // ---------------------------------------------------------------- Storage
  { id: 'storage', label: 'Storage', cat: 'system', w: 208, h: 108, v: 'storage' },
  { id: 'storage-value', label: 'Disk used', cat: 'system', w: 168, h: 110, v: 'value', src: 'diskUsed' },
  { id: 'storage-ring', label: 'Disk ring', cat: 'system', w: 148, h: 148, v: 'ring', src: 'diskUsed' },
  { id: 'storage-free', label: 'Disk free', cat: 'system', w: 168, h: 110, v: 'value', src: 'diskFree' },
  { id: 'storage-list', label: 'All disks', cat: 'system', w: 280, h: 160, v: 'rows', src: 'diskList' },
  { id: 'io-read', label: 'Disk read', cat: 'system', w: 168, h: 110, v: 'value', src: 'ioRead' },
  { id: 'io-write', label: 'Disk write', cat: 'system', w: 168, h: 110, v: 'value', src: 'ioWrite' },
  { id: 'io-spark', label: 'Disk activity', cat: 'system', w: 280, h: 120, v: 'spark', src: 'ioHistory' },

  // ---------------------------------------------------------------- Power
  { id: 'battery', label: 'Battery', cat: 'power', w: 148, h: 148, v: 'battery' },
  { id: 'battery-ring', label: 'Battery ring', cat: 'power', w: 148, h: 148, v: 'ring', src: 'battery' },
  { id: 'battery-time', label: 'Time left', cat: 'power', w: 168, h: 110, v: 'value', src: 'batteryTime' },
  { id: 'battery-state', label: 'Power state', cat: 'power', w: 168, h: 96, v: 'text', src: 'batteryState' },
  { id: 'power-mode', label: 'Power mode', cat: 'power', w: 168, h: 96, v: 'text', src: 'powerMode' },
  { id: 'night-light', label: 'Night Light', cat: 'power', w: 168, h: 96, v: 'toggle', src: 'nightLight' },

  // ---------------------------------------------------------------- Media
  { id: 'media', label: 'Now playing', cat: 'media', w: 300, h: 92, v: 'media' },
  { id: 'media-title', label: 'Playing title', cat: 'media', w: 260, h: 92, v: 'text', src: 'mediaTitle' },
  { id: 'media-progress', label: 'Playback position', cat: 'media', w: 260, h: 96, v: 'bar', src: 'mediaProgress' },
  { id: 'media-cover', label: 'Cover art', cat: 'media', w: 148, h: 148, v: 'image', src: 'mediaCover' },
  { id: 'volume-value', label: 'Volume', cat: 'media', w: 148, h: 96, v: 'value', src: 'volume' },
  { id: 'volume-ring', label: 'Volume ring', cat: 'media', w: 148, h: 148, v: 'ring', src: 'volume' },
  { id: 'volume-mute', label: 'Mute switch', cat: 'media', w: 148, h: 96, v: 'toggle', src: 'mute' },
  { id: 'audio-output', label: 'Audio output', cat: 'media', w: 220, h: 92, v: 'text', src: 'audioOutput' },

  // ---------------------------------------------------------------- Network
  { id: 'network', label: 'Network', cat: 'network', w: 208, h: 128, v: 'network' },
  { id: 'net-down', label: 'Download rate', cat: 'network', w: 168, h: 110, v: 'value', src: 'netDown' },
  { id: 'net-up', label: 'Upload rate', cat: 'network', w: 168, h: 110, v: 'value', src: 'netUp' },
  { id: 'net-total-down', label: 'Downloaded total', cat: 'network', w: 168, h: 110, v: 'value', src: 'netTotalDown' },
  { id: 'net-total-up', label: 'Uploaded total', cat: 'network', w: 168, h: 110, v: 'value', src: 'netTotalUp' },
  { id: 'net-spark', label: 'Network history', cat: 'network', w: 280, h: 120, v: 'spark', src: 'netHistory' },
  { id: 'net-interfaces', label: 'Interfaces', cat: 'network', w: 260, h: 150, v: 'rows', src: 'netIfs' },
  { id: 'net-connections', label: 'Open connections', cat: 'network', w: 148, h: 96, v: 'value', src: 'connCount' },
  { id: 'bluetooth-state', label: 'Bluetooth', cat: 'network', w: 168, h: 96, v: 'toggle', src: 'bluetooth' },
  { id: 'wifi-state', label: 'Wi-Fi', cat: 'network', w: 168, h: 110, v: 'value', src: 'wifiState' },

  // ---------------------------------------------------------------- Productivity
  { id: 'todo', label: 'Task list', cat: 'work', w: 220, h: 196, v: 'todo' },
  { id: 'todo-count', label: 'Open tasks', cat: 'work', w: 148, h: 96, v: 'value', src: 'todoCount' },
  { id: 'todo-flagged', label: 'Flagged tasks', cat: 'work', w: 240, h: 160, v: 'rows', src: 'todoFlagged' },
  { id: 'notes', label: 'Notes', cat: 'work', w: 220, h: 180, v: 'notes' },
  { id: 'quote', label: 'Quote', cat: 'work', w: 240, h: 150, v: 'quote' },
  { id: 'label', label: 'Typography', cat: 'work', w: 420, h: 96, v: 'label' },
  { id: 'headline', label: 'Headline', cat: 'work', w: 400, h: 128, v: 'headline' },
  { id: 'pomodoro', label: 'Pomodoro', cat: 'work', w: 168, h: 180, v: 'pomodoro' },
  { id: 'stopwatch', label: 'Stopwatch', cat: 'work', w: 168, h: 140, v: 'stopwatch' },
  { id: 'timer', label: 'Timer', cat: 'work', w: 168, h: 180, v: 'timer' },

  // ---------------------------------------------------------------- Information
  { id: 'os-version', label: 'OS version', cat: 'info', w: 240, h: 96, v: 'text', src: 'osVersion' },
  { id: 'kernel-version', label: 'Kernel', cat: 'info', w: 240, h: 96, v: 'text', src: 'kernel' },
  { id: 'hostname', label: 'Hostname', cat: 'info', w: 220, h: 92, v: 'text', src: 'hostname' },
  { id: 'user-name', label: 'User', cat: 'info', w: 180, h: 96, v: 'text', src: 'userName' },
  { id: 'machine-arch', label: 'Architecture', cat: 'info', w: 200, h: 92, v: 'text', src: 'arch' },
  { id: 'system-board', label: 'Board', cat: 'info', w: 200, h: 92, v: 'text', src: 'board' },
  { id: 'os-build', label: 'Build', cat: 'info', w: 220, h: 96, v: 'text', src: 'build' },
  { id: 'boot-time', label: 'Boot time', cat: 'info', w: 168, h: 110, v: 'value', src: 'bootTime' },
  { id: 'uptime', label: 'Uptime', cat: 'info', w: 168, h: 110, v: 'value', src: 'uptime' },
  { id: 'timezone', label: 'Time zone', cat: 'info', w: 220, h: 96, v: 'text', src: 'timezone' },
  { id: 'display-info', label: 'Display', cat: 'info', w: 220, h: 96, v: 'text', src: 'displayInfo' },

  // ---------------------------------------------------------------- Weather + Ambient
  { id: 'weather', label: 'Weather', cat: 'ambient', w: 168, h: 168, v: 'weather' },
  { id: 'weather-temp', label: 'Temperature outside', cat: 'ambient', w: 148, h: 96, v: 'value', src: 'weatherTemp' },
  { id: 'weather-cond', label: 'Conditions', cat: 'ambient', w: 200, h: 92, v: 'text', src: 'weatherCond' },
  { id: 'weather-humidity', label: 'Humidity', cat: 'ambient', w: 148, h: 96, v: 'value', src: 'weatherHumidity' },
  { id: 'weather-wind', label: 'Wind', cat: 'ambient', w: 148, h: 96, v: 'value', src: 'weatherWind' },
  { id: 'weather-range', label: "Today's range", cat: 'ambient', w: 200, h: 110, v: 'value', src: 'weatherRange' },
  { id: 'weather-forecast', label: '7-day forecast', cat: 'ambient', w: 320, h: 150, v: 'forecast', src: 'weatherForecast' },
  { id: 'day-progress', label: 'Day progress', cat: 'ambient', w: 220, h: 96, v: 'progress', src: 'dayProgress' },
  { id: 'year-progress', label: 'Year progress', cat: 'ambient', w: 220, h: 96, v: 'progress', src: 'yearProgress' },
  { id: 'mode-badge', label: 'Appearance', cat: 'ambient', w: 168, h: 96, v: 'text', src: 'modeBadge' },
];


// ---------------------------------------------------------------- style routes (the variant engine)
//
// 105 honest kinds × 5 curated looks = 525 selectable widgets. A route is a RELATIVE style patch
// (the theme's baseline stays underneath — resolveStyle merges), so a route looks right on every
// theme while every widget stays fully editable afterwards (paper, blur, transparency, ink…).
export const TS_ROUTES = [
  { id: 'classic', suffix: 'Classic', label: 'Classic', patch: {} },
  { id: 'glass', suffix: 'Glass', label: 'Glass', patch: { alpha: 0.3, blur: 0.9, radius: 22, border: 'rgba(255,255,255,0.18)', shadow: 'soft' } },
  { id: 'solid', suffix: 'Solid', label: 'Solid', patch: { alpha: 0.97, blur: null, radius: 6, border: 'none', shadow: 'lift' } },
  { id: 'outline', suffix: 'Outline', label: 'Outline', patch: { alpha: 0.18, blur: null, radius: 10, border: 'rgba(127,127,127,0.55)', shadow: 'none' } },
  { id: 'vivid', suffix: 'Vivid', label: 'Vivid', patch: { alpha: 0.55, blur: 0.45, radius: 14, border: 'none', shadow: 'lift' } },
];

// The full selectable catalog: kind × route. Every entry carries the kind's real data provider —
// nothing here is a mock; the routes only dress it.
export function variantEntries() {
  const out = [];
  for (const spec of TS_WIDGET_SPECS) {
    for (const route of TS_ROUTES) {
      out.push({
        id: `${spec.id}·${route.id}`,
        kind: spec.id,
        route: route.id,
        label: `${spec.label} · ${route.label}`,
        cat: spec.cat,
        w: spec.w, h: spec.h, v: spec.v, src: spec.src, cfg: spec.cfg,
        style: route.patch,
      });
    }
  }
  return out;
}

export const TS_VARIANT_ROUTES = TS_ROUTES;


// The kind table the model resolves: derived from the specs so the two can never drift.
// (themestudio-model.TS_KINDS keeps this exact shape.)
export const specKinds = () => Object.fromEntries(TS_WIDGET_SPECS.map((s) => [s.id, { label: s.label, defaults: { w: s.w, h: s.h } }]));

export const specOf = (id) => TS_WIDGET_SPECS.find((s) => s.id === id) || null;
export const specsOfCat = (cat) => TS_WIDGET_SPECS.filter((s) => s.cat === cat);
