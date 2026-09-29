"""Write NARRATION_SCRIPT.md (narration with timestamps + storyboard) from
build/timeline.json. Run after build_tts.py."""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TITLES = {'problem': '1. Opening — The Problem', 'process': '2. Current Scholarship Process', 'problems': '3. Existing Problems',
          'bridge': '4. A Better Way — "What if…?"', 'intro': '5. Introducing ISKONNECT', 'overview': '6. System Overview — Meet the Squad',
          'journey': '7. The Complete ISKONNECT Process', 'benefits': '8. Expected Improvements', 'closing': '9. Closing'}
VIS = {
    'open_city': 'Night skyline of Calapan City rises; "Education opens doors." City of Calapan and CED seals; a row of graduating students steps in.',
    'open_paper': 'Paper forms fly in and pile up (some stamped RECEIVED); folders, a logbook and a hand-filled spreadsheet join the pile.',
    'open_queue': 'Applicants queue at a CED counter while staff stamp and stack documents; the stack gets too tall and topples over. "More scholars. More paper. More time."',
    'title': 'Document icons converge into a flash and the ISKONNECT wordmark; subtitle; Applicants + Scholars ↔ Centralized Digital Platform ↔ CED.',
    'process_applicant': 'Chapter 01. Flow: Applicant → Requirements Submission → Examination → Interview → Evaluation/Ranking → Selection → Scholar.',
    'process_scholar': 'Row 1 compacts; Scholar → Submit Subjects → Grade Monitoring → Attendance Monitoring → Requirements → Scholarship Monitoring → Graduation → Post-Graduation Tracking.',
    'process_manual': 'Amber tags pop onto the nodes: Printed, Spreadsheet, Face-to-face.',
    'problems': 'Chapter 02. Eight problem cards appear one per line.',
    'whatif': 'Chapter 03. The problems crumple into a paper ball that rolls away; a giant "?" drops in. Kinetic "WHAT IF…" questions: 7 DAYS vs 5 MINUTES tiles with a spinning timer; records fly into a phone with a tap ripple; scattered scholars link into one hub. "Well… now it can." A phone rises, powers on, and flashes into the reveal (music drops out, riser).',
    'intro_logo': 'Logo SLAM with shockwave, particle burst and screen shake; the scholar mascot pops up and waves ("Hi!"). ISKO card (mascot tips his cap) and KONNECT card (a "Scholars" plug snaps into the "CED" socket with sparks). The words merge back into the logo while five feature chips orbit it in 3D: "One platform. Everything connected."',
    'overview_arch': 'Chapter 04. "Meet the ISKONNECT squad": four face-down hero cards. Card 01 Student App ("The Pocket Companion") flips with its 10 abilities; card 02 Backend & Database ("The Brain") flips with a live app ⇄ database ⇄ dashboard sync.',
    'overview_admin': 'Card 03 CED Admin Dashboard ("Mission Control") flips next to the actual admin dashboard screen; ten admin abilities listed.',
    'overview_qr': 'Card 04 QR Scanner App ("The Attendance Hero") flips; offline demo (scan → offline, pending sync → back online, synced). The four cards snap into the architecture: Student App ↕ Backend/Database ↕ Admin Dashboard, QR Scanner ⇄ system.',
    'journey_intro': 'Chapter 05. Juan (the mascot) walks a path through all 12 milestones; a 12-dot progress rail stays up for the steps.',
    'step1_app': 'Phone: splash → login → applicant profile → scholarship application → 8 requirements uploaded → Application Submitted; new row in admin Applications Management.',
    'step2_sched': 'Status stepper Pending → For Exam → For Interview; phone notifications and schedule cards; admin table + October calendar.',
    'step3_eval': 'Examination + Economic Background + Panel Interview → ranking board → Selection slots (annual budget) → "Final selection by CED"; "ISKONNECT assists & records · CED decides".',
    'step4_scholar': 'Celebration screen with confetti and Juan cheering; APPLICANT → ACTIVE SCHOLAR; digital scholar profile card.',
    'step5_semester': 'Circular semester cycle with a travelling dot; subjects; monitoring; Certificate of Grades upload ("scholars cannot encode their own grades"); admin Encode Grade; loops to 2nd Semester.',
    'step6_qr': 'Scholarship ID QR → scanner (beep) → attendance recorded → offline, pending sync → synced → Admin Dashboard.',
    'step7_alert': 'Record reaches 2 absences → "At-Risk Scholar" alert → Attendance Alert → Admin Review → Administrative Decision; "No automatic termination".',
    'step8_req': 'Pending → Submitted → Verified pipeline; admin Requirements Review with Verify/Reject and remarks; Rejected → resubmit loop.',
    'step9_comm': 'Admin posts an announcement → lock-screen notification → Announcements list (4 types) → chat with CED.',
    'step10_reports': 'Admin dashboard (illustrative data): KPIs, scholars per school, status donut; "Total Active Scholars Report" with PDF/Excel export.',
    'step11_history': 'Applicant → Scholar → Active → Graduated → Post-Graduation Tracking (Employed / Board Passer / Post-Graduate Studies); Stopped/Terminated branch; semesters join into one record.',
    'step12_cycle': 'Eleven stages light up along a serpentine path, then collapse into CED ↔ ISKONNECT ↔ SCHOLARS.',
    'benefits': 'Chapter 06. Ten benefit tiles appear in pairs.',
    'benefits_statement': '"ISKONNECT helps make scholarship management more organized. accessible. connected."',
    'closing': 'Particles converge; wordmark reveal; "Connecting Scholars. Empowering Education."; system name and CED with both seals; Juan waves goodbye; fade to black.',
}


def fmt(t):
    return f"{int(t // 60)}:{t % 60:04.1f}"


tl = json.load(open(os.path.join(ROOT, 'build', 'timeline.json'), encoding='utf-8'))
out = ['# ISKONNECT AVP — Narration Script & Storyboard', '',
       f'Total running time: **{fmt(tl["duration"])}** (1920×1080, 30 fps). Timestamps match `output/ISKONNECT_AVP.mp4`.', '',
       'Narration is read exactly as written below. To re-record it with your own voice, read each line at the listed time (or use `output/ISKONNECT_AVP.srt` as a guide).', '']
last = None
for s in tl['scenes']:
    if s['section'] != last:
        out += ['', f"## {TITLES[s['section']]}", '']
        last = s['section']
    head = f"### {fmt(s['start'])}–{fmt(s['end'])} · `{s['id']}`"
    if s.get('step'):
        head += f" — Step {s['step']}: {s['stepTitle']}"
    out += [head, '', f"**Visuals:** {VIS[s['id']]}", '']
    out += [f"- `{fmt(l['start'])}` {l['text']}" for l in s['lines']]
    out.append('')
open(os.path.join(ROOT, 'NARRATION_SCRIPT.md'), 'w', encoding='utf-8').write('\n'.join(out))
print('wrote NARRATION_SCRIPT.md', fmt(tl['duration']))
