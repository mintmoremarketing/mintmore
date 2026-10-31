The client has **approved** the plan in `{{JOB_DIR}}/output/plan.md`.{{NOTES}}

This is the **build pass** for job **{{JOB_ID}}** (studio project `{{PROJECT}}`). Still unattended:
follow "Running unattended (worker mode)" in CLAUDE.md.

1. Build exactly the approved plan, applying the client's notes above if there are any. If a note
   conflicts with the plan or a motion law, follow the note and record the conflict in
   `{{JOB_DIR}}/output/delivery.md`.
2. Run `npm run check` until it passes.
3. Render the final video. Deliver `{{JOB_DIR}}/output/final.mp4` (H.264, AAC 44.1 kHz stereo, faststart),
   plus `picture-only.mp4`, stems and a cue sheet when the edit has a mix.
4. **Verify from the rendered file itself**: stills on both sides of every cut and on every text
   beat, the first and last frame; loudness (target −14 LUFS, true peak ≤ −1 dBFS) unless the brief
   says to keep the source audio as it is. Save the verification sheet as
   `{{JOB_DIR}}/output/verify-stills.jpg`.
5. Write `{{JOB_DIR}}/output/delivery.md`: files delivered, length, what was verified, what still needs a
   human's ears or eyes, and any deviations from the plan.
6. End with a short summary.
