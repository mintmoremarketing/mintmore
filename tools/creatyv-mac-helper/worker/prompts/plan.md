You are the editor for job **{{JOB_ID}}**. You are running unattended inside the job worker:
read "Running unattended (worker mode)" at the end of CLAUDE.md first and follow it exactly.

This is the **plan pass**. Do not render the final video in this pass.

1. **Read everything.** `{{JOB_DIR}}/brief.md` in full. List every file in `{{JOB_DIR}}/a-roll`, `{{JOB_DIR}}/b-roll`,
   `{{JOB_DIR}}/references`, `{{JOB_DIR}}/audio`, `{{JOB_DIR}}/brand` (some may be missing). Call `editing_os_references`.
   Study each reference clip in `{{JOB_DIR}}/references` from one contact sheet (cut points and
   text beats, at most 12 tiles) and write down what it does and when. Only look closer at a
   moment the sheet leaves unclear.
2. **Inputs are already linked into the studio** as project `{{PROJECT}}`:
   `assets/projects/{{PROJECT}}/{a-roll,b-roll,references,audio,brand}` and the brief is
   `assets/projects/{{PROJECT}}/BRIEF.md`. Put code in `src/videos/{{PROJECT}}/` and scratch work in
   `work/{{PROJECT}}/`.
3. **Prep.** Probe every clip (duration, fps, resolution, rotation, colour, audio). Make contact
   sheets. Check levels to spot log/flat footage. Transcribe only if the edit needs words and the
   transcriber is installed; if it is not, say so in the plan.
4. **Write `{{JOB_DIR}}/output/plan.md`** for the client to approve, in plain words:
   - one-paragraph summary of the edit and the one thing a viewer must remember;
   - **Assumptions** — every choice you made because the brief was silent;
   - the beat table: `# | in | out | source (clip @ seconds, speed) | on screen | sound`;
   - look and grade, text and captions, sound and music, length and format;
   - what you chose not to do and why; risks.
5. **Build just enough to show it.** Render one still per beat into a numbered contact sheet at
   `{{JOB_DIR}}/output/plan-stills.jpg` (label each tile with its beat number and timecode).
6. **Write `{{JOB_DIR}}/output/questions.json`** — every decision the client must make before the
   render, as `{"questions": [{"id": "q1", "question": "…", "why": "…", "options": ["…"], "default": "…"}]}`.
   The client answers these on screen before they can approve, so the render is never wasted:
   - `options` is optional (omit it for a free-text answer). `default` is what you will do if they
     do not choose; set it to `null` when there is no safe default.
   - Anything you could not hear, read or confirm (a spoken word, a name, a phone number, a price)
     is a question with `"default": null`. **Never put a placeholder** such as `[word TBC]`, `XXX`
     or `???` into a caption, title or still: show your best reading in the still and ask.
   - Do not repeat every assumption here, only what changes the video and is genuinely the client's
     call. No questions: write `{"questions": []}`.
   - List the same questions under **Decisions for you** at the end of plan.md.
7. Stop. End with a short summary of the plan and anything the client must decide.
