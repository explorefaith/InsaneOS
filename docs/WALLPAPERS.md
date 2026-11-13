# Moving wallpapers

Short loops behind the desktop and the login screen, chosen in Settings → Wallpaper. They exist only with the hardware for
them: there is no software mode.

## The rule

A moving wallpaper plays only when **both** hold:

- the GPU composes the session (`insane.media.composition()` is `gpu`);
- the hardware decodes the file's format (`insane.media.hwDecode()`).

If either is missing, the section is disabled with one line, "Moving wallpapers need a compatible GPU.", and a chosen
wallpaper shows its still poster. H.264 is used only where it is decoded in hardware. The login screen needs the decode
only: its compositor is headless (`insane-server --headless --greeter`), so `composition()` can never answer `gpu` there —
the frame is a plain blit into the greeter's scene, and its poll asks `hwCodecs` (the decode alone). The decisions are in
`sdk/motionmodel.js`, tested without a screen by `server/tests/motion_model_test.mjs`.

A virtual machine's GPU never qualifies (`hwDecode().virtualGpu`). On a V4L2 decoder HEVC counts only if the FFmpeg in use
can drive it (`drmprime` from `lm_hwprobe.c`): Debian's FFmpeg can't, Raspberry Pi's can.

## Format

HEVC first: it is what a Raspberry Pi 5 decodes in hardware. Each item has `1080.hevc`, `2160.hevc` when the source is 4K,
and `1080.h264` for machines that decode only that. `pickVariant` takes HEVC before H.264, then the smallest file that
covers the display.

Clips last 6 to 10 s. The loop is closed by fading the second after the clip's end over its first second. Nothing is
upscaled or interpolated: frame rate and size never exceed the source's. Of the sources chosen, four are real 60 fps and
the rest 12.5 to 30 fps. No 120, 144 or 240 fps source with a clear license was found. Playback holds an ambient ceiling
all the same: a wallpaper presents at most 30 frames a second (`fpsMax: 30` on every `media.play` of a wallpaper), and a
frame beyond it is dropped before its readback and upscale — the two steps that cost.

## When it pauses

`sdk/motion.jsx` pauses the decoder, and `pauseReason` says why: Reduce motion, a fullscreen window, every display showing
it covered by a window, five minutes with no input, the battery at 20 % or less and discharging, or the CPU above 85 % for
two readings 5 s apart. The fullscreen, covered, locked, idle, battery and busy reasons can each be turned off in
Settings → Wallpaper → Live → Pause when; reduce motion and a screen that is off are not optional. "Locked" is the
session not being the one on the monitor (`insane.session.onMonitor()`). The login screen pauses after five minutes with
no input.

The cap is not fixed, either. Settings → Power (and the Control Center's Power Mode tile) picks the
rendering profile's rendering half — `auto` by default, or pinned balanced / performance / low — and
the profile's cap (`30/20/15`) is what the players start with. Under it, `motionmodel.adaptiveCap`
steps the live cap down a rung (half, then 10) when the CPU stays loaded or the decoder itself drops
what it decodes, and back up one rung per 15 steady seconds — through `media.control('fpsmax')`, which
reaches the decode loop between frames, so no decoder restarts and nothing flickers. The ladder and
its hysteresis are in `server/tests/motion_model_test.mjs` (64 checks).

The compositor holds its own backstop, under all of that: when the display goes off (DPMS), `insane-server` pauses the
wallpaper's and the login screen's players itself (`media_display_power`), and resumes them when it comes back — only the
ones it paused, so a player the session's rules had paused stays paused. Music, the camera and recordings are never
touched. With the screen dark nothing shows the frames anyway, and this one works even if the session's JavaScript is
the thing that failed.

One video per file, however many displays show it. The still wallpaper stays drawn underneath, so a failure, a missing
file or a helper crash just shows it.

## Files and downloads

The catalog `assets/wallpapers/motion.json` ships in the package: ids, credits, sizes and a SHA-256 for every file. Its
thumbnails and posters ship next to it (`assets/wallpapers/motion/`, 6.6 MB with the built-in clip).

Videos are downloaded on demand by closed admin actions (`server/src/hw/wallpaper_admin.c`):

| Action | Who | What |
|---|---|---|
| `wallpaper-get "<id> <variant>"` | anyone | downloads a catalog file to `/var/lib/insaneos/wallpapers/<sha256>.mp4` |
| `wallpaper-remove "<id> <variant>"` | admin | deletes it |
| `wallpaper-login "<id> <variant>"` or `default` | admin | the login screen plays it (`login.mp4`) or the built-in one |

JS names an entry, never a URL or a path. The base must be the project's GitHub owner on `raw.githubusercontent.com`, the
bytes go through `fetch_batch` (a child as `nobody`, in the Store's scope, so the firewall sees `insaneos:store`), and a file
whose size or hash isn't the catalog's is deleted. `insane-media` keeps its sandbox and receives an open file, and
`media_open_input` accepts those two system folders besides the user's own files. `server/tests/wallpaper_find_test.c` covers the lookup.

An added video stays in the user's files. It needs a format this machine decodes in hardware — H.264 and HEVC, and VP9
or AV1 too where the probe says the GPU decodes them (webm, mkv). There is no length limit: the cost is per frame, not
per second of source, and a long file loops from its start. Above 1080p or above 30 fps the page warns (it plays anyway).

## The login screen

The greeter can't read a user's settings, so the choice reaches it as files: `/var/lib/insaneos/wallpapers/login.mp4`, else
the built-in `apple.hevc.mp4` or `apple.h264.mp4`. A video of the user's own reaches it with the `wallpaper-login-video`
action: a child running as the user streams the bytes, root checks the container (MP4 or Matroska, up to 100 MB) and
keeps them as `login.mp4`. A still source is `login-still` (a wallpaper id, or `image:<name>`, or a colour:
`solid:rrggbb`, `gradient:rrggbb-rrggbb-deg`, which the greeter draws itself), how it is drawn is `login-fit`
(`fill`=cover, `fit`, `stretch`, `center` — the video always covers) and the playback speed is `login-rate` (1/100).

Before 0.8.7 the login screen composed on the CPU: `insaneos-greeter` couldn't open `/dev/dri/renderD128`. It now joins
`render` and `video` (`install.sh`, the ISO, the Pi image, migration 006). The render node is what the hardware decoder
needs; the greeter's compositor itself keeps composing on the CPU — it runs headless, and its scene is a clock, a few
labels and the video's blit.

## The Raspberry Pi 5

Hardware HEVC needs Raspberry Pi's FFmpeg, pinned in `/etc/apt/preferences.d/raspberrypi` (migration 006 adds the pin on
upgrades, and the next `apt` update brings the packages). That FFmpeg opens the decoder by path, so for this one job,
`MK_PLAY` with `hwaccel=v4l2request`, `insane-media` may open two exact device files found from sysfs before the sandbox,
reads `/sys/class`, `/sys/bus` and `/run/udev`, and gets the V4L2 and media controller ioctl classes.

## Measurements

| Machine | Case | Result |
|---|---|---|
| Pi 5, login, trial build | 1080p60 H.264, software decode, CPU composition | about 156 % of one core |
| Pi 5, login, 0.8.7 | 1080p60 HEVC, hardware decode, the greeter's CPU composition | `insane-media` 41 %, `insane-server` 147 % of one core, 30 s, SoC 52 °C with its case |

Decoding is in hardware; each frame is then read back and converted to BGRA in `insane-media`, and `insane-server` paints it. That copy is why the total stays high. Showing the decoder's buffer directly on the GPU is the next step, planned for a later release.

Settings → Wallpaper has a switch at the top, Desktop or Login screen, and the same tiles choose for that target: a video (`wallpaper-login "<id> <variant>"`) or a still wallpaper (`wallpaper-login "still <id>"`, kept in `/var/lib/insaneos/wallpapers/login-still`, shown with no video at all).

## Your own pictures

Settings → Wallpaper → Your pictures takes a PNG or JPEG, for the desktop or the login screen. Nothing shows the file itself: it is converted once to a baseline JPEG of at most 3840 pixels on its longest side, upright (EXIF orientation applied) and with no metadata, so the session and the login screen load something of a known size. GPS positions and camera details don't reach the login screen. The limits are 64 MB and 100 megapixels, read from the header before any memory is taken. WebP, GIF and BMP are refused.

| Action | Who | What |
|---|---|---|
| `wallpaper-image "<path>"` | anyone | makes the user's copy, `~/.local/share/insaneos/wallpapers/<name>.jpg` and `.thumb.jpg`, and answers its name, 16 hex digits |
| `wallpaper-image "remove <name>"` | anyone | deletes that copy |
| `wallpaper-login-image "<name>"` | admin | the login screen shows that copy: `/var/lib/insaneos/wallpapers/login-<name>.jpg`, with `image:<name>` in `login-still` |

Root never opens the user's file and never decodes it. A child gives up root for good (`setresuid`, no new privileges, a CPU limit, 30 s from the parent) and closes every file of the helper before it reads anything, so a link to a file only root can read fails, as it would for the user. The file must be a regular file and the last step of its path can't be a link (`O_NOFOLLOW`, and `O_NONBLOCK` so a pipe can't hang it). `wallpaper-login-image` takes a name, not a path; the child reconverts the copy and sends the bytes through a pipe, and root only checks that they are a finished JPEG of an allowed size before writing them to a root-owned file, readable by all, with a name that follows its content. So the greeter, a separate user with no access to any home, only reads a system folder, and a new choice is never hidden by an image cached under the old name. Every other choice for the login screen deletes the stored picture.

A file that goes missing costs nothing: the desktop goes back to the default wallpaper, the login screen to its usual background. The remote login page keeps its built-in background. `server/tests/wallpaper_image_test.c` covers the conversion and the refusals.

Settings offers 1×, 0.75×, 0.5× and 0.25×. A slower speed decodes fewer frames per second; it applies to the desktop,
and to the login screen through `login-rate`.

The Wallpaper page draws its previews, the desktop and the greeter's still background through one component
(`sdk/backdrop.jsx`): the picture with the chosen fit (fill/fit/stretch/center — the engine's `objectFit`, "center"
added for this), or the solid colour / gradient (`wallpaperBg`; the greeter's mark). A change crossfades over 450 ms,
unless Reduce motion is on.

Choosing a still wallpaper turns the moving one off, since it would stay in front. A new player can start while the last one still holds the decoder, so a stop nobody asked for is retried four times — half a second, then 1 s, 2 s, 4 s; the tile shows a spinner until the video plays. A file that burned all four tries stays disabled across sessions (settings `motionDisabled`), and its tile in Settings offers *try again*.

A helper that wedges without dying (alive, but no frame, position or stats for 10 s) is killed by the compositor's
watchdog (`media_watchdog`); the session sees the same "closed" event a crash produces, and the retry rules above apply
to it just the same.

A moving wallpaper plays with `hwOnly`: if the hardware decoder doesn't start, or fails, `insane-media` stops rather than decoding in software, and the still image stays. While a wallpaper's MediaView waits for its first frame — and whenever its ring is rebuilt — it draws nothing at all, so the still wallpaper shows through instead of a black flash filling the display (`media_view_reset` keeps the wallpaper's and the greeter's backgrounds transparent; every other player keeps its black).

## The collection

Files live in a separate repository, `Insane OS-wallpapers`, because 353 MB of video doesn't belong in the code's history. Its
README credits each clip; licenses come from each file's own page. Only public domain, CC0, CC BY and CC BY-SA sources are
used.
