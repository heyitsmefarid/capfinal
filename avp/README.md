# ISKONNECT — Audio-Visual Presentation (AVP)

Capstone AVP for **ISKONNECT – Mobile-Based Scholarship Management System for the Calapan City Education Department (CED)**.

## Deliverables (`output/`)

| File | What it is |
|---|---|
| `ISKONNECT_AVP.mp4` | Final video, 1920×1080 · 30 fps · ~9:47 · narration, music, SFX, burned-in captions |
| `ISKONNECT_AVP.srt` | Caption file (upload alongside the video on YouTube/Canva/Drive) |
| `ISKONNECT_AVP_thumbnail.png` | Title frame for thumbnails / Canva cover |
| `stems/` | Narration, music and SFX as separate tracks (for re-editing in Canva or any editor) |

`NARRATION_SCRIPT.md` has the full narration with timestamps and a per-scene storyboard, which is useful if your team wants to re-record the voice-over.

## Structure

1. Opening: the problem (Calapan City/CED context, paper records, a queue whose document stack topples) and the title
2. Current scholarship process (applicant flow and continuing-scholar flow)
3. Existing problems (8 cards)
4. A better way: "What if…?" kinetic questions, then a phone powers on and the music drops out
5. Introducing ISKONNECT: logo slam, the scholar mascot says hi, ISKO + KONNECT (plug-into-socket), features orbiting the logo
6. System overview, "Meet the ISKONNECT squad": four flip-in hero cards (Student App, Backend & Database, CED Admin Dashboard, QR Scanner App) that snap into the architecture diagram
7. The complete process, steps 1–12, following Juan (the mascot) from application to the complete cycle
8. Expected improvements
9. Closing: "Connecting Scholars. Empowering Education."

Content follows the implemented system: requirement statuses *Pending → Submitted → Verified* (or *Rejected* with remarks), applicant statuses *Pending → For Exam → For Interview*, the dashboard's *At-Risk Scholar* alert at 2 absences, the QR scanner's offline Hive storage + sync, and the timeline stages *Applicant → Scholar → Graduated → Board Passer / Employed*. The sample student "Juan Dela Cruz" and the dashboard numbers in Step 10 are illustrative (marked on screen).

## How it is made

Everything is generated from code, so edits are repeatable:

- `src/script.json` — narration lines per scene (single source of truth for timing)
- `src/build_tts.py` — synthesizes the voice (Kokoro TTS, voice `af_heart`), builds `build/timeline.json` + the SRT
- `src/page/` — the animated scenes (HTML/CSS + GSAP, deterministic `seek(t)`), Lucide icons, Poppins/Inter fonts; `fun.js` has the mascot, hero cards and effects
- `src/cues.mjs` — collects the sound-effect cues the scenes register
- `src/mix_audio.py` — original synthesized score + SFX, ducked under the voice, mastered to −16 LUFS
- `src/render.mjs` — captures frames in headless Chromium and encodes with ffmpeg/x264
- `src/preview.mjs` — snapshot any moment, e.g. `node preview.mjs /tmp/pv step3_eval+10`

### Rebuild

```bash
cd avp/src
python3 -m venv venv && . venv/bin/activate
pip install numpy scipy soundfile pyloudnorm kokoro-onnx imageio-ffmpeg
npm i playwright-core gsap                       # gsap.min.js is already vendored in assets/
# Kokoro model files: github.com/thewh1teagle/kokoro-onnx/releases (model-files-v1.0)
python build_tts.py --model kokoro-v1.0.onnx --voices voices-v1.0.bin
node cues.mjs
python mix_audio.py
python make_script_doc.py                       # refreshes NARRATION_SCRIPT.md
FFMPEG=$(python -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())") \
CHROME=/path/to/chrome node render.mjs          # --captions 0 for a caption-free version
```

To change wording, edit `src/script.json` and rerun the steps above. Scenes key their animations off the narration lines, so timing follows automatically.

## Assets and credits

- ISKONNECT wordmark cut out from `scholar-ui11/assets/images/app_logo.png`. The mascot is an SVG redrawing of the scholar in `logo.jpg`. City of Calapan seal from `scholar-ui11/assets/images/calapan_seal.jpg`. CED seal cropped from the admin report letterhead.
- `assets/img/screens/` are crops of the team's own admin-dashboard screenshots (`Screenshots/`), shown as "Actual system screen".
- Icons: [Lucide](https://lucide.dev) (ISC). Fonts: Poppins, Inter (OFL, via @fontsource). Animation: GSAP.
- Voice: Kokoro-82M TTS (Apache-2.0). Music and sound effects are synthesized in `mix_audio.py`, so they are original and royalty-free.
