---

## Running unattended (worker mode)

These rules apply when this studio runs inside the job worker, with no person at the keyboard.
They sit on top of everything above; where they conflict, these win.

**Nobody can answer a question.** Never stop to ask. Where the brief is silent, pick the house
default, and write down every choice you made in `plan.md` under "Assumptions", so the client can
correct it at the approval step. The approval step replaces "stop and ask" from the rules above.

**The job folder is the only source of truth.** Its path is given in your prompt (in the cloud
worker it is `/job`). Inputs are in it, read-only: `brief.md`, `a-roll/`, `b-roll/`, `references/`,
`audio/`, `brand/`. Everything you deliver goes in its `output/` folder. Never write outside the
studio and that `output/` folder.

**Known studio pitfalls — learned on real jobs:**
- `npm run stills -- --file <video> --at ...` is documented above but **not supported** by
  `scripts/stills.mjs`. To pull frames from a rendered file, call the bundled ffmpeg directly
  (`node -e "console.log(require('ffmpeg-static'))"` gives its path).
- Check every source clip's levels before grading. Sony/phone log profiles (S-Log3, HLG, flat
  "cine" looks) show blacks near code 25–35 and almost no saturation: convert from log properly
  (curve + gamut), then grade. A plain contrast/saturation boost on log footage looks wrong.
- Phone clips often carry a rotation flag; ffmpeg auto-rotates, Remotion may not — conform clips
  (rotate, fps, colour) into `processed/` with ffmpeg before using them in a composition.
- `motion-check` renders every frame and is slow on a small machine. Run it at `--scale=1`, only
  on the frame ranges with graphics, and treat hard cuts you made on purpose as `--allow`.
- Render final deliveries as H.264 + AAC **44.1 kHz** stereo, `-movflags +faststart`. Some phone
  players play 48 kHz files silently.
- A dissolve can only borrow as many frames as the incoming shot has handle; plan handles first.
- `interpolate()` without easing fails the motion lint — use `progress()` with an `EASE` curve.

**Shared studio code is not yours to change.** Other clients' videos use the same components,
helpers and design files. For this job's look, change only `src/design/tokens.ts` (and
`src/design/logos.json`); each job keeps its own copy of those. Never edit `motion.ts`, `presets.ts`,
`overlays.ts`, `src/components/` or `src/lib/`. A constant, curve or component only this video
needs goes in `src/videos/<project>/` and is imported from there.

**Work cheaply — every turn costs the client money.** The pass has a hard spend cap; hitting it
stops the job with nothing delivered.
- CLAUDE.md is already in your context. Do not Read it, STYLE.md or this section again.
- Batch commands: probe every clip in one Bash call, make every contact sheet in one call.
- Look at images small: contact sheets at most 12 tiles, 1600 px wide. Read each sheet once.
- Do not re-read a file you just wrote or edited. Do not list folders you already listed.
- Check with stills, not renders: render the full video once, fix from stills, and re-render at
  most twice. Run `motion-check` only on the frame ranges with graphics.
- Do not print long logs; pipe ffmpeg/render output through `tail -n 20`.

**Never invent what the client did not give you:**
- No voiceover unless the job folder contains the voice audio. Do not use text-to-speech.
- Music only if the job folder supplies it, or the brief explicitly asks for an original score
  (then compose it in code from scratch — no samples, no downloads).
- Facts on screen (prices, phone numbers, addresses, claims) only from the brief or `brand/`.

**Deliverables in the job's `output/` folder:** `final.mp4` (picture + sound), `plan.md`, `plan-stills.jpg`
(numbered stills of the planned beats), and where the edit has a mix: `picture-only.mp4`, stems
and a timecoded cue sheet. Before finishing, pull stills from `final.mp4` itself on both sides of
every cut and look at them.
