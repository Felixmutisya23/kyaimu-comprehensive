import { getGrade, getScore, getSiblingStreams, getStreamFromClass, getBaseClass } from '../data/initialData';

/* ── Fee helpers (mirrors FeesModule logic) ─────────────────────── */
function getFeeExpected(student, term, year, data) {
  const types = data.feeTypes || [];
  return types.reduce((sum, ft) => {
    const sch = (data.feeSchedule || []).find(s =>
      String(s.feeTypeId) === String(ft.id) &&
      (ft.appliesToAll !== false || (ft.applicableClasses || []).includes(student.class)) &&
      String(s.term) === String(term) &&
      String(s.year) === String(year)
    );
    return sum + (sch ? Number(sch.amount) || 0 : 0);
  }, 0);
}

function getFeePaid(studentId, term, year, data) {
  return (data.feePayments || [])
    .filter(p =>
      String(p.studentId) === String(studentId) &&
      String(p.term) === String(term) &&
      String(p.year) === String(year)
    )
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
}

function getFeeBalance(student, term, year, data) {
  const expected = getFeeExpected(student, term, year, data);
  const paid     = getFeePaid(student.id, term, year, data);
  return expected - paid;
}

function getNextTermDate(exam, data) {
  const terms = data.terms || [];
  const nextTerm = exam.term < 3 ? exam.term + 1 : 1;
  const nextYear = exam.term < 3 ? exam.year : (Number(exam.year) || 0) + 1;
  const found = terms.find(t => Number(t.term) === nextTerm && Number(t.year) === nextYear);
  if (found && found.startDate) {
    return new Date(found.startDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return '___________________________';
}

/* ═══════════════════════════════════════════════════════
   AUTO-GENERATED COMMENTS
   — Class Teacher, Principal, Subject Teachers
   Based on CBC grade, mean score, and position.
   No dependency on teachers being configured.
═══════════════════════════════════════════════════════ */
function autoClassTeacherComment(studentName, mean, grade, pos, subCount) {
  const first = (studentName || '').split(' ')[0];
  const pts   = grade?.points || 0;
  if (pts >= 7) return `${first} has demonstrated outstanding academic performance this term. The results reflect exceptional dedication and hard work. Keep it up!`;
  if (pts >= 5) return `${first} has performed commendably this term. There is clear improvement and with continued effort, even greater results are achievable.`;
  if (pts >= 3) return `${first} has shown satisfactory progress this term. More consistent effort and focus on weak areas will help improve the overall performance.`;
  return `${first} needs to put in more effort this term. I encourage ${first} to seek help from subject teachers and dedicate more time to studies.`;
}

function autoPrincipalComment(studentName, mean, grade, pos) {
  const first = (studentName || '').split(' ')[0];
  const pts   = grade?.points || 0;
  if (pts >= 7) return `Excellent performance. ${first} is a credit to the school and family. We encourage the same commitment next term.`;
  if (pts >= 5) return `Good performance. ${first} should aim for even higher standards. We are proud of the progress made.`;
  if (pts >= 3) return `Fair performance. ${first} is encouraged to work harder and utilise all available academic resources.`;
  return `${first} needs to improve significantly. Parents/guardians are encouraged to support ${first} at home. Please see the class teacher for guidance.`;
}

function autoSubjectComment(subject, score, grade) {
  const pts = grade?.points || 0;
  if (pts >= 7) return `Excellent work in ${subject}. Keep it up.`;
  if (pts >= 5) return `Good performance in ${subject}. Aim higher next term.`;
  if (pts >= 3) return `Average in ${subject}. More practice needed.`;
  return `${subject} needs urgent attention. Revise regularly.`;
}

/* ═══════════════════════════════════════════════════════
   SHARED HEADER — used by all printed documents
═══════════════════════════════════════════════════════ */
function schoolHeader(data, { logoUrl } = {}) {
  return `
    <div style="text-align:center;margin-bottom:14px;padding-bottom:12px;border-bottom:3px solid #003399">
      ${logoUrl ? `<img src="${logoUrl}" style="height:70px;margin-bottom:8px" />` : ''}
      <div style="font-size:22px;font-weight:900;color:#003399;text-transform:uppercase;letter-spacing:1.5px;line-height:1.2">
        ${data.schoolName || 'School Name'}
      </div>
      ${data.schoolMotto ? `
        <div style="font-size:14px;font-weight:700;margin-top:4px;color:#333;text-transform:uppercase;letter-spacing:0.5px">
          ${data.schoolMotto}
        </div>` : ''}
      ${(data.schoolPOBox || data.schoolLocation) ? `
        <div style="font-size:13px;font-weight:600;color:#333;margin-top:3px;text-transform:uppercase">
          ${[data.schoolPOBox, data.schoolLocation].filter(Boolean).join(', ')}
        </div>` : ''}
      ${data.schoolCounty ? `<div style="font-size:12px;color:#555;margin-top:2px">${data.schoolCounty} County</div>` : ''}
    </div>
  `;
}

/* ═══════════════════════════════════════════════════════
   OFFICIAL SCHOOL STAMP / SEAL
   — Classic double-ring rubber-stamp style: school name curves along
     the top inside the outer ring, address/location curves along the
     bottom, a 5-point star sits on each side, a small center icon sits
     above today's date (always live — recalculated every render, so
     the stamp shows the real current date whenever a document is
     printed, never a stale one).
   — All text is driven entirely by editable Settings fields (school
     name, P.O. Box, location, colors) — nothing here is randomly
     generated, so saved settings can never be "lost" by this function;
     it only ever reads what's in `data`.
   — Pure inline SVG: stays crisp at any print size, no raster image.
═══════════════════════════════════════════════════════ */
export function renderSchoolStamp(data, { size = 130 } = {}) {
  const cfg = data.schoolStamp || {};
  if (cfg.enabled === false) return '';

  const pri    = cfg.primaryColor || '#0d3fa8';
  const acc    = cfg.accentColor  || '#cc0000';
  const topTxt = (cfg.text    || data.schoolName || 'SCHOOL NAME').toUpperCase();
  const botTxt = (cfg.subtext || [data.schoolPOBox, data.schoolLocation || data.schoolCounty].filter(Boolean).join(', ') || 'KENYA').toUpperCase();

  // Always today's real date — recomputed on every render/print, never stored/stale
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase().replace(/ /g, '  ');

  const cx = size / 2, cy = size / 2;
  const rOuter  = size * 0.49;
  const rOuter2 = size * 0.44;   // inner edge of the outer double-ring
  const rText   = size * 0.355;  // radius the curved text sits on
  const rStar   = size * 0.40;

  // ── Dynamic font sizing so ANY school name/address length fits cleanly
  //    on its curved arc, instead of a fixed size that overflows for long
  //    names and looks too small/sparse for short ones. ──
  // Approximate usable arc length for the top/bottom semicircle text path,
  // then scale font-size down as character count grows so it always wraps
  // to fit within roughly that arc, with sensible min/max clamps.
  const arcLen = Math.PI * rText; // half-circumference of the text path
  function fitFontSize(text, baseFraction, minFraction) {
    const base = size * baseFraction;
    const min  = size * minFraction;
    // Rough average glyph width at this weight/font ≈ 0.62 × font-size
    const estWidth = text.length * base * 0.62;
    if (estWidth <= arcLen) return base;
    const scaled = base * (arcLen / estWidth);
    return Math.max(scaled, min);
  }
  const topFontSize = fitFontSize(topTxt, 0.082, 0.040);
  const botFontSize = fitFontSize(botTxt, 0.058, 0.032);

  function star5(x0, y0, outerR, innerR) {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = (i / 10) * 2 * Math.PI - Math.PI / 2;
      const x = x0 + Math.cos(a) * r, y = y0 + Math.sin(a) * r;
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
    }
    return d + 'Z';
  }

  const uid = Math.random().toString(36).slice(2, 8);
  const topPathId = `stamptop${uid}`;
  const botPathId = `stampbot${uid}`;

  return `
  <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <defs>
      <path id="${topPathId}" d="M ${(cx - rText).toFixed(2)} ${cy.toFixed(2)} A ${rText.toFixed(2)} ${rText.toFixed(2)} 0 1 1 ${(cx + rText).toFixed(2)} ${cy.toFixed(2)}" />
      <path id="${botPathId}" d="M ${(cx - rText).toFixed(2)} ${cy.toFixed(2)} A ${rText.toFixed(2)} ${rText.toFixed(2)} 0 0 0 ${(cx + rText).toFixed(2)} ${cy.toFixed(2)}" />
    </defs>

    <!-- Outer double ring -->
    <circle cx="${cx}" cy="${cy}" r="${rOuter}"  fill="none" stroke="${pri}" stroke-width="${size*0.018}"/>
    <circle cx="${cx}" cy="${cy}" r="${rOuter2}" fill="none" stroke="${pri}" stroke-width="${size*0.012}"/>

    <!-- Stars left/right -->
    <path d="${star5(cx - rStar, cy, size*0.045, size*0.018)}" fill="${pri}"/>
    <path d="${star5(cx + rStar, cy, size*0.045, size*0.018)}" fill="${pri}"/>

    <!-- School name curving along the top -->
    <text font-size="${topFontSize.toFixed(1)}" font-weight="700" fill="${pri}" letter-spacing="0.5" font-family="Georgia, 'Times New Roman', serif">
      <textPath href="#${topPathId}" startOffset="50%" text-anchor="middle">${topTxt}</textPath>
    </text>

    <!-- Address / location curving along the bottom -->
    <text font-size="${botFontSize.toFixed(1)}" font-weight="600" fill="${pri}" letter-spacing="0.3" font-family="Georgia, 'Times New Roman', serif">
      <textPath href="#${botPathId}" startOffset="50%" text-anchor="middle">${botTxt}</textPath>
    </text>

    <!-- Center icon (simple open book / mortarboard mark) -->
    <g transform="translate(${cx},${cy - size*0.10})">
      <path d="M ${-size*0.07},0 L 0,${-size*0.045} L ${size*0.07},0 L 0,${size*0.045} Z" fill="${pri}"/>
      <line x1="0" y1="${-size*0.045}" x2="0" y2="${size*0.045}" stroke="#fff" stroke-width="${size*0.006}"/>
    </g>

    <!-- Today's date — always live, recalculated every print -->
    <text x="${cx}" y="${cy + size*0.075}" font-size="${size * 0.072}" font-weight="700" fill="${acc}" text-anchor="middle" font-family="Arial, sans-serif" letter-spacing="0.5">${dateStr}</text>
  </svg>`;
}

/* ═══════════════════════════════════════════════════════
   COMPUTE RANKINGS — used by both class list and report
═══════════════════════════════════════════════════════ */
export function computeRankings(exam, allStudents, data) {
  const siblingClasses = getSiblingStreams(exam.class, data);
  const hasStreams      = siblingClasses.length > 1;

  // ── Find the matching exam for each sibling stream ──────────────
  // Sibling exams: same name + term + year, different stream of the same base class.
  // This is the correct way to get overall position across all streams.
  function findSiblingExam(cls) {
    if (cls === exam.class) return exam;
    return (data.exams || []).find(e =>
      e.class === cls &&
      e.term  === exam.term &&
      e.year  === exam.year &&
      e.name  === exam.name
    ) || null;
  }

  // Build a merged results map: studentName → results (from their stream's exam)
  const siblingExamMap = {};
  siblingClasses.forEach(cls => {
    const ex = findSiblingExam(cls);
    if (ex) siblingExamMap[cls] = ex.results || {};
  });

  function calcStatsForStudent(student) {
    // Use the correct exam for this student's class
    const resultsObj = siblingExamMap[student.class] || exam.results || {};
    const res   = resultsObj[student.name] || {};
    const subs  = Object.keys(res);
    const total = subs.reduce((a, k) => a + (getScore(res[k]) ?? 0), 0);
    const mean  = subs.length ? +(total / subs.length).toFixed(1) : 0;
    return { total, mean, grade: getGrade(Math.round(mean)), results: res, subjects: subs };
  }

  function calcStatsFromResults(studentName, resultsObj) {
    const res   = resultsObj[studentName] || {};
    const subs  = Object.keys(res);
    const total = subs.reduce((a, k) => a + (getScore(res[k]) ?? 0), 0);
    const mean  = subs.length ? +(total / subs.length).toFixed(1) : 0;
    return { total, mean, grade: getGrade(Math.round(mean)), results: res, subjects: subs };
  }

  // Overall: across ALL sibling streams — each student ranked using their OWN stream's exam
  const allSiblingStudents = allStudents.filter(s => siblingClasses.includes(s.class));
  const overallSorted = [...allSiblingStudents]
    .map(s => ({ name: s.name, class: s.class, ...calcStatsForStudent(s) }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  // Stream: within this exam's class only — uses this exam's results
  const streamStudents = allStudents.filter(s => s.class === exam.class);
  const streamSorted = [...streamStudents]
    .map(s => ({ name: s.name, class: s.class, ...calcStatsFromResults(s.name, exam.results || {}) }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  // Build map: studentName → { overallPos, overallOf, streamPos, streamOf }
  const posMap = {};
  overallSorted.forEach((s, i) => {
    posMap[s.name] = { overallPos: i + 1, overallOf: overallSorted.length };
  });
  streamSorted.forEach((s, i) => {
    if (posMap[s.name]) {
      posMap[s.name].streamPos = i + 1;
      posMap[s.name].streamOf  = streamSorted.length;
    } else {
      posMap[s.name] = { overallPos: i + 1, overallOf: overallSorted.length, streamPos: i + 1, streamOf: streamSorted.length };
    }
  });

  return { streamSorted, overallSorted, posMap, hasStreams, siblingClasses };
}

/* ═══════════════════════════════════════════════════════
   CLASS PERFORMANCE LIST — matches screenshot exactly
═══════════════════════════════════════════════════════ */
export function printClassList(ranked, subjects, exam, data) {
  if (!ranked || ranked.length === 0) { alert('No results to print.'); return; }

  const stream    = getStreamFromClass(exam.class, data);
  const baseClass = getBaseClass(exam.class, data);
  const classLabel = stream
    ? `${data.schoolType || 'Junior School'} ${baseClass} ${stream.toUpperCase()}`
    : baseClass;

  // Compute positions + whether this class actually has sibling streams
  const { posMap, hasStreams } = computeRankings(exam, data.students, data);

  const subHeaders = subjects.map(s =>
    `<th style="${TH}">${s.toUpperCase()}</th>`
  ).join('');

  const rows = ranked.map((s) => {
    const pos = posMap[s.name] || {};

    const subCells = subjects.map(sub => {
      const cell  = s.results[sub];
      const score = getScore(cell);
      const g     = score !== null && score !== undefined ? getGrade(score) : null;
      return score !== null && score !== undefined
        ? `<td style="${TD}"><div style="${SCORE_NUM}">${score}</div><div style="${GRADE_LBL}">${g.label}</div></td>`
        : `<td style="${TD}color:#999">0</td>`;
    }).join('');

    const totalG = getGrade(Math.round(s.mean));
    return `<tr>
      <td style="${TD}text-align:left;font-weight:700;white-space:nowrap">${s.name.toUpperCase()}</td>
      ${subCells}
      <td style="${TD}"><div style="${SCORE_NUM}">${s.total}</div><div style="${GRADE_LBL}">${totalG.label}</div></td>
      <td style="${TD}"><div style="${SCORE_NUM}">${pos.overallPos || '-'}</div></td>
      ${hasStreams ? `<td style="${TD}"><div style="${SCORE_NUM}">${pos.streamPos || '-'}</div></td>` : ''}
    </tr>`;
  }).join('');

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>Class List — ${exam.name} — ${classLabel}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; padding: 12px; color: #111; }
      @page { size: A4 portrait; margin: 8mm; }
      @media print { body { padding: 0; } .no-print { display: none !important; } }
      .no-print { margin-top: 14px; text-align: center; }
    </style>
  </head><body>
    ${schoolHeader(data)}
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin:6px 0 3px;font-size:11px">
      <div>
        <strong>EXAM:</strong> ${exam.name.toUpperCase()}
        &nbsp;&nbsp;
        <strong>TERM:</strong> ${exam.termLabel || `Term ${exam.term} of Year ${exam.year}`}
      </div>
      <div style="font-size:10px;color:#555">Total Students: ${ranked.length}</div>
    </div>
    <div style="font-size:12px;font-weight:700;margin-bottom:5px;color:#003399">${classLabel}</div>
    <table style="width:100%;border-collapse:collapse;font-size:10px">
      <thead>
        <tr>
          <th style="${TH}text-align:left">NAME</th>
          ${subHeaders}
          <th style="${TH}">TOTAL</th>
          <th style="${TH}">POS</th>
          ${hasStreams ? `<th style="${TH}">STRM<br>POS</th>` : ''}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="display:flex;justify-content:space-between;margin-top:10px;font-size:10px;color:#555;border-top:1px solid #ccc;padding-top:6px">
      <span>Class Teacher: _______________________________</span>
      <span>Principal: _______________________________</span>
      <span>Printed: ${new Date().toLocaleDateString('en-KE', { day:'numeric', month:'long', year:'numeric' })}</span>
    </div>
    <div class="no-print">
      <button onclick="window.print()" style="padding:10px 28px;background:#003399;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600">
        🖨 Print Class List
      </button>
    </div>
  </body></html>`);
  w.document.close();
}

const TH = 'border:1px solid #333;padding:4px 3px;text-align:center;font-size:9px;font-weight:700;white-space:nowrap;background:#fff;color:#111;line-height:1.2;';
const TD = 'border:1px solid #333;padding:2px 3px;text-align:center;vertical-align:middle;';
const SCORE_NUM = 'font-weight:700;font-size:10px;line-height:1;color:#111;';
const GRADE_LBL = 'font-weight:700;font-size:8px;line-height:1;color:#cc0000;';

/* ═══════════════════════════════════════════════════════
   INDIVIDUAL STUDENT REPORT FORM
═══════════════════════════════════════════════════════ */
export function printReportForm(student, exam, data) {
  const res  = exam.results[student.name] || {};
  const subs = Object.keys(res);
  if (!subs.length) { alert('No results recorded for this student in this exam.'); return; }

  const stream    = getStreamFromClass(exam.class, data);
  const baseClass = getBaseClass(exam.class, data);

  // Compute positions
  const { posMap, overallSorted, hasStreams } = computeRankings(exam, data.students, data);
  const pos = posMap[student.name] || {};

  // Fee balance for this exam's term/year
  const feeBalance  = getFeeBalance(student, exam.term, exam.year, data);
  const feeExpected = getFeeExpected(student, exam.term, exam.year, data);
  const feePaid     = getFeePaid(student.id, exam.term, exam.year, data);
  const feeBalanceStr = feeExpected > 0
    ? (feeBalance > 0
        ? `KES ${feeBalance.toLocaleString()} (Balance)`
        : feeBalance < 0
          ? `KES ${Math.abs(feeBalance).toLocaleString()} (Overpaid)`
          : 'CLEARED ✓')
    : 'N/A';
  const feeCellColor = feeBalance > 0 ? '#cc0000' : '#10b981';

  // Next term start date
  const nextTermDate = getNextTermDate(exam, data);

  // Student's scores
  const total = subs.reduce((a, k) => a + (getScore(res[k]) ?? 0), 0);
  const mean  = subs.length ? +(total / subs.length).toFixed(1) : 0;
  const grade = getGrade(Math.round(mean));

  // Previous exams in same class for trend
  const prevExams = (data.exams || [])
    .filter(e => e.class === exam.class && e.id !== exam.id)
    .map(ex => {
      const r  = ex.results[student.name] || {};
      const ks = Object.keys(r);
      if (!ks.length) return null;
      const t = ks.reduce((a, k) => a + (getScore(r[k]) ?? 0), 0);
      const m = +(t / ks.length).toFixed(1);
      return { name: ex.name, total: t, mean: m, grade: getGrade(Math.round(m)) };
    }).filter(Boolean);

  // Subject rows — with auto subject teacher comment
  const subjectRows = subs.map(sub => {
    const cell    = res[sub];
    const score   = getScore(cell);
    const g       = getGrade(score ?? 0);
    const remark  = g.points >= 7 ? 'Excellent' : g.points >= 5 ? 'Good' : g.points >= 3 ? 'Average' : 'Below Average';
    const subComment = autoSubjectComment(sub, score, g);
    return `
      <tr style="background:${subs.indexOf(sub) % 2 === 0 ? '#fff' : '#f8f9ff'}">
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:left;font-weight:600">${sub}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;font-weight:900;font-size:13px">${score ?? '—'}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;font-weight:900;color:#cc0000">${g.label}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:center">${g.points}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:left;font-size:10px;color:#555">${remark}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:left;font-size:10px;color:#444;font-style:italic">${subComment}</td>
      </tr>`;
  }).join('');

  // Grade summary totals
  const totalPoints = subs.reduce((a, k) => a + getGrade(getScore(res[k]) ?? 0).points, 0);

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>Report — ${student.name}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; padding: 24px; max-width: 820px; margin: 0 auto; color: #111; }
      @page { size: A4 portrait; margin: 12mm; }
      @media print { body { padding: 0; } .no-print { display: none !important; } }
      h3 { color: #003399; text-align: center; text-transform: uppercase; letter-spacing: 1px; margin: 12px 0 10px; font-size: 14px; }
      table { border-collapse: collapse; width: 100%; }
      .info-table td { padding: 5px 8px; border: 1px solid #ddd; font-size: 12px; }
      .info-table .lbl { background: #f0f4ff; font-weight: 700; color: #003399; width: 150px; }
      .no-print { margin-top: 16px; text-align: center; }
    </style>
  </head><body>
    ${schoolHeader(data)}
    <h3>Student Academic Report Form</h3>

    <table class="info-table" style="margin-bottom:14px">
      <tr>
        <td class="lbl">Student Name</td>
        <td style="font-weight:700;font-size:14px">${student.name.toUpperCase()}</td>
        <td class="lbl">Adm Number</td>
        <td style="font-weight:700">${student.admNo}</td>
      </tr>
      <tr>
        <td class="lbl">Class</td>
        <td>${baseClass}${stream ? ' ' + stream : ''}</td>
        ${hasStreams ? `
        <td class="lbl">Stream</td>
        <td>${stream || '—'}</td>` : `
        <td class="lbl">Exam</td>
        <td>${exam.name}</td>`}
      </tr>
      ${!hasStreams ? `
      <tr>
        <td class="lbl">Term</td>
        <td colspan="3">${exam.termLabel || `Term ${exam.term} of Year ${exam.year}`}</td>
      </tr>
      <tr>
        <td class="lbl">Position</td>
        <td colspan="3"><span style="font-size:18px;font-weight:900;color:#cc0000">${pos.overallPos || '—'}</span>
          <span style="font-size:11px;color:#555"> out of ${pos.overallOf || '—'} students</span></td>
      </tr>` : `
      <tr>
        <td class="lbl">Exam</td>
        <td>${exam.name}</td>
        <td class="lbl">Term</td>
        <td>${exam.termLabel || `Term ${exam.term} of Year ${exam.year}`}</td>
      </tr>
      <tr>
        <td class="lbl">Overall Position</td>
        <td><span style="font-size:18px;font-weight:900;color:#cc0000">${pos.overallPos || '—'}</span>
          <span style="font-size:11px;color:#555"> out of ${pos.overallOf || '—'} students</span></td>
        <td class="lbl">Stream Position</td>
        <td><span style="font-size:18px;font-weight:900;color:#003399">${pos.streamPos || '—'}</span>
          <span style="font-size:11px;color:#555"> out of ${pos.streamOf || '—'} in ${stream || 'class'}</span></td>
      </tr>`}
    </table>

    <table style="margin-bottom:14px">
      <thead>
        <tr style="background:#003399;color:#fff">
          <th style="padding:7px 10px;text-align:left;border:1px solid #003399">Subject</th>
          <th style="padding:7px 10px;border:1px solid #003399">Score</th>
          <th style="padding:7px 10px;border:1px solid #003399">Grade</th>
          <th style="padding:7px 10px;border:1px solid #003399">Points</th>
          <th style="padding:7px 10px;text-align:left;border:1px solid #003399">Remarks</th>
          <th style="padding:7px 10px;text-align:left;border:1px solid #003399">Subject Teacher Comment</th>
        </tr>
      </thead>
      <tbody>
        ${subjectRows}
        <tr style="background:#e8eeff;font-weight:700">
          <td style="padding:7px 10px;border:1px solid #ddd;font-weight:900">TOTAL / MEAN</td>
          <td style="padding:7px 10px;border:1px solid #ddd;text-align:center;font-size:15px;font-weight:900">${total}</td>
          <td style="padding:7px 10px;border:1px solid #ddd;text-align:center;font-size:14px;font-weight:900;color:#cc0000">${grade.label}</td>
          <td style="padding:7px 10px;border:1px solid #ddd;text-align:center;font-weight:900">${totalPoints}</td>
          <td colspan="2" style="padding:7px 10px;border:1px solid #ddd;font-size:11px;color:#555">
            Mean Score: ${mean} | CBC Grade: ${grade.label} (${grade.points} pts)
          </td>
        </tr>
      </tbody>
    </table>

    ${prevExams.length > 0 ? `
    <div style="background:#fffbe6;border:1px solid #f59e0b;border-radius:4px;padding:10px 14px;margin-bottom:14px;font-size:11px">
      <strong style="color:#b45309">Performance Trend: </strong>
      ${prevExams.map(p => `${p.name}: <strong style="color:${p.grade.color}">${p.grade.label} (${p.total})</strong>`).join(' → ')}
      → <strong style="color:${grade.color}">Current: ${grade.label} (${total})</strong>
    </div>` : ''}

    <table style="margin-bottom:14px">
      <tr>
        <td style="width:50%;padding:10px;border:1px solid #ccc;vertical-align:top">
          <div style="font-weight:700;color:#003399;margin-bottom:6px;font-size:11px;text-transform:uppercase">Class Teacher's Comment</div>
          <div style="min-height:48px;font-size:11px;color:#222;line-height:1.6">${autoClassTeacherComment(student.name, mean, grade, pos, subs.length)}</div>
        </td>
        <td style="width:50%;padding:10px;border:1px solid #ccc;vertical-align:top">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div style="flex:1">
              <div style="font-weight:700;color:#003399;margin-bottom:6px;font-size:11px;text-transform:uppercase">Principal's Comment</div>
              <div style="min-height:48px;font-size:11px;color:#222;line-height:1.6">${autoPrincipalComment(student.name, mean, grade, pos)}</div>
            </div>
            ${data.schoolStamp?.enabled !== false ? `<div style="flex-shrink:0">${renderSchoolStamp(data, { size: 78 })}</div>` : ''}
          </div>
        </td>
      </tr>
    </table>

    <table style="font-size:11px;margin-top:4px">
      <tr>
        <td style="padding:6px 10px;border:1px solid #ccc;background:#f0f4ff">
          <strong>Next Term Begins:</strong> ${nextTermDate}
        </td>
        <td style="padding:6px 10px;border:1px solid #ccc;background:#f0f4ff">
          <strong>Closing Date:</strong> ___________________________
        </td>
        <td style="padding:6px 10px;border:1px solid #ccc;background:#fff0f0;color:${feeCellColor};font-weight:700">
          <strong style="color:#333">Fees Balance:</strong> ${feeBalanceStr}
          ${feeExpected > 0 ? `<div style="font-size:9px;color:#777;font-weight:400">Expected: KES ${feeExpected.toLocaleString()} · Paid: KES ${feePaid.toLocaleString()}</div>` : ''}
        </td>
        <td style="padding:6px 10px;border:1px solid #ccc;background:#f0fff4;color:#555;font-size:10px">
          Printed: ${new Date().toLocaleDateString('en-KE', { day:'numeric', month:'long', year:'numeric' })}
        </td>
      </tr>
    </table>

    <div class="no-print">
      <button onclick="window.print()" style="padding:10px 28px;background:#003399;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600">
        🖨 Print Report Form
      </button>
    </div>
  </body></html>`);
  w.document.close();
}

/* ═══════════════════════════════════════════════════════
   BULK: PRINT ALL REPORT FORMS FOR A CLASS
═══════════════════════════════════════════════════════ */
export function printAllReportForms(exam, data) {
  const students = data.students.filter(s => s.class === exam.class);
  if (students.length === 0) { alert('No students in this class.'); return; }

  const { posMap, hasStreams } = computeRankings(exam, data.students, data);
  const stream    = getStreamFromClass(exam.class, data);
  const baseClass = getBaseClass(exam.class, data);
  const nextTermDate = getNextTermDate(exam, data);

  const allPages = students.map(student => {
    const res  = exam.results[student.name] || {};
    const subs = Object.keys(res);
    if (!subs.length) return '';

    const total = subs.reduce((a, k) => a + (getScore(res[k]) ?? 0), 0);
    const mean  = subs.length ? +(total / subs.length).toFixed(1) : 0;
    const grade = getGrade(Math.round(mean));
    const pos   = posMap[student.name] || {};

    // Fee balance for this student
    const feeBalance  = getFeeBalance(student, exam.term, exam.year, data);
    const feeExpected = getFeeExpected(student, exam.term, exam.year, data);
    const feePaid     = getFeePaid(student.id, exam.term, exam.year, data);
    const feeBalanceStr = feeExpected > 0
      ? (feeBalance > 0
          ? `KES ${feeBalance.toLocaleString()} (Balance)`
          : feeBalance < 0
            ? `KES ${Math.abs(feeBalance).toLocaleString()} (Overpaid)`
            : 'CLEARED ✓')
      : 'N/A';
    const feeCellColor = feeBalance > 0 ? '#cc0000' : '#10b981';

    const rows = subs.map(sub => {
      const score = getScore(res[sub]);
      const g     = getGrade(score ?? 0);
      const subComment = autoSubjectComment(sub, score, g);
      return `<tr>
        <td style="padding:5px 8px;border:1px solid #ddd;font-weight:600">${sub}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;text-align:center;font-weight:900">${score ?? '—'}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;text-align:center;font-weight:900;color:#cc0000">${g.label}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;text-align:center">${g.points}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;font-size:10px;color:#444;font-style:italic">${subComment}</td>
      </tr>`;
    }).join('');

    return `
      <div style="page-break-after:always;max-width:780px;margin:0 auto;padding:16px 0">
        ${schoolHeader(data)}
        <h3 style="color:#003399;text-align:center;text-transform:uppercase;font-size:13px;margin:10px 0">Student Academic Report Form</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:11px">
          <tr>
            <td style="padding:5px 8px;border:1px solid #ddd;background:#f0f4ff;font-weight:700;color:#003399;width:140px">Student Name</td>
            <td style="padding:5px 8px;border:1px solid #ddd;font-weight:900;font-size:13px">${student.name.toUpperCase()}</td>
            <td style="padding:5px 8px;border:1px solid #ddd;background:#f0f4ff;font-weight:700;color:#003399;width:120px">Adm No</td>
            <td style="padding:5px 8px;border:1px solid #ddd;font-weight:700">${student.admNo}</td>
          </tr>
          <tr>
            <td style="padding:5px 8px;border:1px solid #ddd;background:#f0f4ff;font-weight:700;color:#003399">Class / Stream</td>
            <td style="padding:5px 8px;border:1px solid #ddd">${baseClass}${stream ? ' ' + stream : ''}</td>
            <td style="padding:5px 8px;border:1px solid #ddd;background:#f0f4ff;font-weight:700;color:#003399">Exam</td>
            <td style="padding:5px 8px;border:1px solid #ddd">${exam.name} · ${exam.termLabel || `Term ${exam.term} ${exam.year}`}</td>
          </tr>
          <tr>
            <td style="padding:5px 8px;border:1px solid #ddd;background:#f0f4ff;font-weight:700;color:#003399">Overall Position</td>
            <td style="padding:5px 8px;border:1px solid #ddd"><strong style="font-size:16px;color:#cc0000">${pos.overallPos || '—'}</strong> / ${pos.overallOf || '—'}</td>
            ${hasStreams ? `
            <td style="padding:5px 8px;border:1px solid #ddd;background:#f0f4ff;font-weight:700;color:#003399">Stream Position</td>
            <td style="padding:5px 8px;border:1px solid #ddd"><strong style="font-size:16px;color:#003399">${pos.streamPos || '—'}</strong> / ${pos.streamOf || '—'}</td>` : `
            <td style="padding:5px 8px;border:1px solid #ddd;background:#f0f4ff;font-weight:700;color:#003399">Term</td>
            <td style="padding:5px 8px;border:1px solid #ddd">${exam.termLabel || `Term ${exam.term} of Year ${exam.year}`}</td>`}
          </tr>
        </table>
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:11px">
          <thead><tr style="background:#003399;color:#fff">
            <th style="padding:6px 8px;text-align:left;border:1px solid #003399">Subject</th>
            <th style="padding:6px 8px;border:1px solid #003399">Score</th>
            <th style="padding:6px 8px;border:1px solid #003399">Grade</th>
            <th style="padding:6px 8px;border:1px solid #003399">Points</th>
            <th style="padding:6px 8px;text-align:left;border:1px solid #003399">Subject Teacher Comment</th>
          </tr></thead>
          <tbody>${rows}
            <tr style="background:#e8eeff;font-weight:900">
              <td style="padding:6px 8px;border:1px solid #ddd">TOTAL / MEAN</td>
              <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-size:14px">${total}</td>
              <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;color:#cc0000;font-size:13px">${grade.label}</td>
              <td style="padding:6px 8px;border:1px solid #ddd;text-align:center">${grade.points}</td>
              <td style="padding:6px 8px;border:1px solid #ddd;font-size:10px;color:#555">Mean Score: ${mean} | CBC Grade: ${grade.label} (${grade.points} pts)</td>
            </tr>
          </tbody>
        </table>
        <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:10px">
          <tr>
            <td style="padding:8px;border:1px solid #ccc;width:50%;vertical-align:top">
              <strong style="color:#003399;font-size:11px;text-transform:uppercase">Class Teacher's Comment</strong>
              <div style="margin:6px 0;font-size:11px;color:#222;line-height:1.6">${autoClassTeacherComment(student.name, mean, grade, pos, subs.length)}</div>
            </td>
            <td style="padding:8px;border:1px solid #ccc;width:50%;vertical-align:top">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                <div style="flex:1">
                  <strong style="color:#003399;font-size:11px;text-transform:uppercase">Principal's Comment</strong>
                  <div style="margin:6px 0;font-size:11px;color:#222;line-height:1.6">${autoPrincipalComment(student.name, mean, grade, pos)}</div>
                </div>
                ${data.schoolStamp?.enabled !== false ? `<div style="flex-shrink:0">${renderSchoolStamp(data, { size: 64 })}</div>` : ''}
              </div>
            </td>
          </tr>
        </table>
        <table style="width:100%;border-collapse:collapse;font-size:10px">
          <tr>
            <td style="padding:5px 8px;border:1px solid #ccc;background:#f0f4ff"><strong>Next Term Begins:</strong> ${nextTermDate}</td>
            <td style="padding:5px 8px;border:1px solid #ccc;background:#fff0f0;color:${feeCellColor};font-weight:700"><strong style="color:#333">Fees Balance:</strong> ${feeBalanceStr}${feeExpected > 0 ? ` <span style="font-size:8px;color:#777;font-weight:400">(Exp: KES ${feeExpected.toLocaleString()} · Paid: KES ${feePaid.toLocaleString()})</span>` : ''}</td>
            <td style="padding:5px 8px;border:1px solid #ccc;font-size:9px;color:#888">Printed: ${new Date().toLocaleDateString('en-KE')}</td>
          </tr>
        </table>
      </div>`;
  }).join('');

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>All Report Forms — ${exam.name} — ${exam.class}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; margin: 0; padding: 16px; }
      @page { size: A4 portrait; margin: 10mm; }
      @media print { body { padding: 0; } .no-print { display: none !important; } }
      .no-print { text-align: center; padding: 16px; position: sticky; top: 0; background: #fff; border-bottom: 1px solid #eee; z-index: 10; }
    </style>
  </head><body>
    <div class="no-print">
      <button onclick="window.print()" style="padding:10px 28px;background:#003399;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600">
        🖨 Print All ${students.length} Report Forms
      </button>
      <span style="margin-left:16px;font-size:13px;color:#555">${exam.class} · ${exam.name}</span>
    </div>
    ${allPages}
  </body></html>`);
  w.document.close();
}

/* ═══════════════════════════════════════════════════════
   FEE RECEIPT
═══════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════
   SUBJECT PERFORMANCE REPORT — Best to Worst Subject
   Shows class averages per subject, ranked best → last
═══════════════════════════════════════════════════════ */
export function printSubjectPerformance(exam, data) {
  if (!exam) return;

  // Use the same correct, school-configured stream detection as everywhere
  // else (computeRankings, the class list, etc.) instead of guessing from
  // the class name string — the old version assumed every class name's
  // last word was a stream letter to strip off, which silently merged
  // unrelated classes together (e.g. "Grade 1" → baseClass "Grade", which
  // then incorrectly matched "Grade 2", "Grade 3" via startsWith).
  const baseClass     = getBaseClass(exam.class, data);
  const siblingClasses = getSiblingStreams(exam.class, data);
  const hasStreams     = siblingClasses.length > 1;

  // Find each sibling stream's matching exam (same name, term, year)
  const siblingExams = siblingClasses
    .map(cls => (data.exams || []).find(e =>
      e.class === cls && e.term === exam.term && e.year === exam.year && e.name === exam.name
    ))
    .filter(Boolean);

  // Build stats for a given set of exams (for overall or per-stream)
  function buildStats(exams) {
    const allSubjects = [...new Set(
      exams.flatMap(ex => Object.values(ex.results || {}).flatMap(r => Object.keys(r)))
    )];
    const allStudents = (data.students || []).filter(s =>
      exams.some(ex => ex.class === s.class)
    );
    return allSubjects.map(sub => {
      const scores = allStudents.map(s => {
        const ex = exams.find(e => e.class === s.class);
        if (!ex) return null;
        const cell = ex.results?.[s.name]?.[sub];
        return getScore(cell);
      }).filter(v => v !== null && v !== undefined);
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const max = scores.length ? Math.max(...scores) : 0;
      const min = scores.length ? Math.min(...scores) : 0;
      const above = scores.filter(s => s >= 43).length;
      return {
        subject: sub, avg: Math.round(avg * 10) / 10, max, min,
        count: scores.length, above, grade: getGrade(Math.round(avg)),
        percent: scores.length ? Math.round((above / scores.length) * 100) : 0,
      };
    }).sort((a, b) => b.avg - a.avg);
  }

  function renderStatsTable(stats, title) {
    if (!stats.length) return '';
    const rows = stats.map((s, i) => {
      const bg = i % 2 === 0 ? '#fff' : '#f8f9ff';
      const barW = Math.round((s.avg / 80) * 100);
      return `<tr style="background:${bg}">
        <td style="padding:6px 8px;border:1px solid #ddd;font-weight:700;color:#003399;text-align:center">${i + 1}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;font-weight:700">${s.subject}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center">
          <span style="display:inline-block;width:${barW}%;min-width:4px;height:12px;background:${s.avg>=60?'#10b981':s.avg>=43?'#4f8ef7':s.avg>=25?'#f59e0b':'#ef4444'};border-radius:2px;vertical-align:middle;margin-right:6px"></span>
          <strong>${s.avg}</strong>
        </td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center">
          <span style="background:${s.grade.color}20;color:${s.grade.color};padding:1px 8px;border-radius:12px;font-weight:700;font-size:12px">${s.grade.label}</span>
        </td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;color:#10b981;font-weight:700">${s.max}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;color:#ef4444;font-weight:700">${s.min}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center">${s.count}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-weight:700;color:${s.percent>=60?'#10b981':s.percent>=40?'#f59e0b':'#ef4444'}">${s.percent}%</td>
      </tr>`;
    }).join('');
    return `
      <h4 style="color:#003399;font-size:13px;margin:18px 0 6px;text-transform:uppercase;border-bottom:2px solid #003399;padding-bottom:4px">${title}</h4>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:12px">
        <thead><tr style="background:#003399;color:#fff">
          <th style="padding:6px 8px;border:1px solid #003399">#</th>
          <th style="padding:6px 8px;border:1px solid #003399;text-align:left">Subject</th>
          <th style="padding:6px 8px;border:1px solid #003399">Mean Score</th>
          <th style="padding:6px 8px;border:1px solid #003399">Grade</th>
          <th style="padding:6px 8px;border:1px solid #003399">Highest</th>
          <th style="padding:6px 8px;border:1px solid #003399">Lowest</th>
          <th style="padding:6px 8px;border:1px solid #003399">Students</th>
          <th style="padding:6px 8px;border:1px solid #003399">Pass Rate</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  // Build overall stats (all streams combined)
  const overallStats = buildStats(siblingExams);
  const overallSection = renderStatsTable(overallStats,
    hasStreams ? `Overall — ${baseClass} (All Streams Combined)` : `Subject Performance — ${exam.class}`
  );

  // Build per-stream sections
  const streamSections = hasStreams
    ? siblingExams.map(ex => {
        const stats = buildStats([ex]);
        return renderStatsTable(stats, `Stream: ${ex.class}`);
      }).join('')
    : '';

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Subject Performance — ${exam.name} — ${baseClass}</title>
  <style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px}@page{size:A4 landscape;margin:12mm}@media print{body{padding:0}.np{display:none}}</style>
  </head><body>
  ${schoolHeader(data)}
  <h3 style="text-align:center;color:#003399;text-transform:uppercase;font-size:14px;margin:8px 0">
    Subject Performance Analysis — ${exam.name} — ${baseClass}${hasStreams ? ' (All Streams)' : ''}
  </h3>
  <div style="text-align:center;font-size:11px;color:#555;margin-bottom:12px">
    Term ${exam.term} · ${exam.year} · Generated: ${new Date().toLocaleDateString('en-KE',{day:'numeric',month:'long',year:'numeric'})}
    ${hasStreams ? ` · <strong>${siblingExams.length} streams</strong>` : ''}
  </div>
  ${overallSection}
  ${streamSections}
  <div class="np" style="margin-top:16px;text-align:center">
    <button onclick="window.print()" style="padding:10px 28px;background:#003399;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px">🖨 Print</button>
  </div>
  </body></html>`);
  w.document.close();
}


export function printFeeReceipt(payment, student, data) {
  const expected = getFeeExpected(student, payment.term, payment.year, data);
  const paid     = getFeePaid(student.id, payment.term, payment.year, data);
  const balance  = expected - paid;

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>Receipt — ${payment.reference}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 32px; max-width: 600px; margin: 0 auto; }
      @media print { body { padding: 16px; } .no-print { display: none !important; } }
    </style>
  </head><body>
    ${schoolHeader(data)}
    <h3 style="text-align:center;color:#003399;text-transform:uppercase;margin:12px 0;font-size:16px;letter-spacing:2px">Official Fee Receipt</h3>
    <div style="border:2px solid #003399;border-radius:4px;padding:20px;margin-bottom:16px">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr><td style="padding:7px 0;color:#555;width:180px">Receipt No:</td><td style="font-weight:700;font-family:monospace;font-size:14px">${payment.reference}</td></tr>
        <tr><td style="padding:7px 0;color:#555">Date:</td><td>${payment.date}</td></tr>
        <tr><td style="padding:7px 0;color:#555">Student Name:</td><td style="font-weight:700">${student.name}</td></tr>
        <tr><td style="padding:7px 0;color:#555">Admission No:</td><td>${student.admNo}</td></tr>
        <tr><td style="padding:7px 0;color:#555">Class:</td><td>${student.class}</td></tr>
        <tr><td style="padding:7px 0;color:#555">Term:</td><td>Term ${payment.term} · ${payment.year}</td></tr>
        <tr><td style="padding:7px 0;color:#555">Fee Type:</td><td>${payment.feeTypeName || 'General'}</td></tr>
        <tr><td style="padding:7px 0;color:#555">Payment Method:</td><td>${payment.method}</td></tr>
        <tr style="border-top:2px solid #003399">
          <td style="padding:12px 0;font-weight:700;font-size:14px;color:#003399">Amount Paid:</td>
          <td style="font-weight:900;font-size:20px;color:#10b981">KES ${Number(payment.amount).toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding:7px 0;color:#555">Total Fee (this term):</td>
          <td>KES ${expected.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding:7px 0;color:#555">Balance:</td>
          <td style="font-weight:700;color:${balance > 0 ? '#ef4444' : '#10b981'}">
            KES ${Math.abs(balance).toLocaleString()}${balance < 0 ? ' CR (Overpaid)' : ''}
            ${balance <= 0 && expected > 0 ? ' ✓ FULLY PAID' : ''}
          </td>
        </tr>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:30px">
      <div style="text-align:center;font-size:12px;color:#555">
        <div style="border-top:1px solid #333;padding-top:6px;width:160px">Received By</div>
      </div>
      ${data.schoolStamp?.enabled !== false ? renderSchoolStamp(data, { size: 88 }) : `
      <div style="text-align:center;font-size:12px;color:#555">
        <div style="border-top:1px solid #333;padding-top:6px;width:160px">Accounts / Bursar</div>
      </div>`}
    </div>
    <p style="text-align:center;font-size:10px;color:#aaa;margin-top:20px">
      This is an official receipt — ${data.schoolName} · ${new Date().toLocaleDateString('en-KE', {day:'numeric',month:'long',year:'numeric'})}
    </p>
    <div class="no-print" style="margin-top:16px;text-align:center">
      <button onclick="window.print()" style="padding:10px 28px;background:#003399;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600">
        🖨 Print Receipt
      </button>
    </div>
  </body></html>`);
  w.document.close();
}

/* ═══════════════════════════════════════════════════════
   LEAVING CERTIFICATE
═══════════════════════════════════════════════════════ */
export function printLeavingCert(student, data) {
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>Leaving Certificate — ${student.name}</title>
    <style>
      body { font-family: Georgia, serif; padding: 48px; max-width: 720px; margin: 0 auto; color: #111; }
      @page { size: A4; margin: 20mm; }
      @media print { body { padding: 0; } .no-print { display: none !important; } }
    </style>
  </head><body>
    ${schoolHeader(data)}
    <h2 style="text-align:center;font-size:20px;letter-spacing:3px;margin:20px 0 6px;color:#003399;text-transform:uppercase">
      School Leaving Certificate
    </h2>
    <p style="text-align:center;color:#555;font-size:13px;margin-bottom:24px">
      This is to certify that the following student has completed their studies at this institution.
    </p>
    <div style="border:2px solid #003399;padding:28px;border-radius:4px">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr><td style="padding:9px 0;color:#555;width:200px">Full Name:</td><td style="font-weight:700;font-size:15px">${student.name}</td></tr>
        <tr><td style="padding:9px 0;color:#555">Admission Number:</td><td style="font-weight:700">${student.admNo}</td></tr>
        <tr><td style="padding:9px 0;color:#555">Class / Stream:</td><td>${student.class}${student.stream ? ` (Stream: ${student.stream})` : ''}</td></tr>
        <tr><td style="padding:9px 0;color:#555">Date of Birth:</td><td>${student.dob || 'Not on record'}</td></tr>
        <tr><td style="padding:9px 0;color:#555">Year of Admission:</td><td>${student.joined}</td></tr>
        <tr><td style="padding:9px 0;color:#555">Parent / Guardian:</td><td>${student.parent}</td></tr>
        <tr><td style="padding:9px 0;color:#555">Date of Issue:</td><td>${new Date().toLocaleDateString('en-KE', {year:'numeric',month:'long',day:'numeric'})}</td></tr>
      </table>
      <p style="font-size:13px;line-height:2;margin-top:20px">
        This certificate confirms that <strong>${student.name}</strong> was a duly registered student at
        <strong>${data.schoolName}</strong> and conducted themselves with good discipline and character
        during their period of study. We wish them every success in their future endeavours.
      </p>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:60px">
      <div style="text-align:center">
        <div style="border-top:1px solid #333;padding-top:8px;width:200px;font-size:12px;color:#555">Class Teacher</div>
      </div>
      <div style="text-align:center">
        ${data.schoolStamp?.enabled !== false ? renderSchoolStamp(data, { size: 100 }) : ''}
        <div style="border-top:1px solid #333;padding-top:8px;width:200px;font-size:12px;color:#555;margin-top:6px">
          Principal &amp; Official Stamp
        </div>
      </div>
    </div>
    <div class="no-print" style="margin-top:24px;text-align:center">
      <button onclick="window.print()" style="padding:10px 28px;background:#003399;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600">
        🖨 Print Certificate
      </button>
    </div>
  </body></html>`);
  w.document.close();
}

/* ═══════════════════════════════════════════════════════
   STUDENT INTAKE / ADMISSION FORM
   Admin prints this, gives to parent/guardian to fill,
   then uses the details to enrol the student in system.
═══════════════════════════════════════════════════════ */
export function printStudentIntakeForm(data, options = {}) {
  const { prefillClass = '' } = options;
  const classes = [];
  (data.classGroups || []).forEach(g => {
    if (!g.streams || g.streams.length === 0) classes.push(g.name);
    else g.streams.forEach(s => classes.push(`${g.name} ${s}`));
  });

  const classOptions = prefillClass
    ? `<strong>${prefillClass}</strong>`
    : `<select style="width:200px;border:none;border-bottom:1px solid #333;font-size:13px;font-family:inherit">${classes.map(c => `<option>${c}</option>`).join('')}</select>`;

  const field = (label, width = '240px', lines = 1) => lines > 1
    ? `<div style="margin-bottom:14px">
        <div style="font-size:11px;color:#555;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px">${label}</div>
        ${Array(lines).fill(`<div style="border-bottom:1px solid #999;margin-bottom:6px;height:20px;width:100%"></div>`).join('')}
       </div>`
    : `<div style="margin-bottom:14px;display:inline-block;width:${width};margin-right:16px;vertical-align:top">
        <div style="font-size:11px;color:#555;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px">${label}</div>
        <div style="border-bottom:1px solid #999;height:22px;width:100%"></div>
       </div>`;

  const section = (title) =>
    `<div style="background:#003399;color:#fff;padding:5px 12px;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:18px 0 12px;border-radius:2px">${title}</div>`;

  const checkbox = (label) =>
    `<span style="display:inline-block;margin-right:20px;font-size:12px">
      <span style="display:inline-block;width:14px;height:14px;border:1.5px solid #333;margin-right:5px;vertical-align:middle"></span>${label}
     </span>`;

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>Student Admission Form — ${data.schoolName}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,Helvetica,sans-serif;font-size:13px;padding:28px;color:#111;max-width:820px;margin:0 auto}
      @page{size:A4 portrait;margin:14mm}
      @media print{body{padding:0}.no-print{display:none!important}}
      .no-print{margin-top:16px;text-align:center}
    </style>
  </head><body>
    ${schoolHeader(data)}

    <h3 style="text-align:center;font-size:16px;text-transform:uppercase;letter-spacing:2px;color:#003399;margin:10px 0 4px">
      Student Admission / Intake Form
    </h3>
    <p style="text-align:center;font-size:11px;color:#555;margin-bottom:18px">
      Please fill in all fields clearly in BLOCK LETTERS &nbsp;·&nbsp; Office use only where indicated
    </p>

    <div style="border:1px solid #ccc;border-radius:3px;padding:10px 14px;margin-bottom:14px;font-size:11px;background:#fffbe6">
      <strong>FOR OFFICE USE:</strong> &nbsp;
      Adm No: <span style="display:inline-block;border-bottom:1px solid #333;width:120px;margin:0 16px 0 4px">&nbsp;</span>
      Date Enrolled: <span style="display:inline-block;border-bottom:1px solid #333;width:120px;margin:0 16px 0 4px">&nbsp;</span>
      Class Assigned: <span style="display:inline-block;border-bottom:1px solid #333;width:120px;margin:0 4px">&nbsp;</span>
    </div>

    ${section('1. Student Details')}
    ${field('Full Name (Surname First)', '100%')}
    <div>
      ${field('Date of Birth (DD/MM/YYYY)', '220px')}
      ${field('Gender', '120px')}
      ${field('Nationality', '180px')}
    </div>
    <div>
      ${field('National ID / Birth Cert No.', '220px')}
      ${field('Class Applying For', '200px')}
      ${field('Previous School (if any)', '260px')}
    </div>
    ${field('Home / Village Address', '100%')}
    <div>
      ${field('Sub-County', '200px')}
      ${field('County', '200px')}
    </div>

    ${section('2. Parent / Guardian Information')}
    <div style="margin-bottom:10px"><strong>Father / Guardian 1</strong></div>
    <div>
      ${field('Full Name', '280px')}
      ${field('Relationship to Student', '200px')}
    </div>
    <div>
      ${field('Phone Number (Primary)', '200px')}
      ${field('Phone Number (Alternative)', '200px')}
      ${field('Email Address', '220px')}
    </div>
    <div>
      ${field('Occupation', '200px')}
      ${field('National ID No.', '200px')}
    </div>

    <div style="margin:14px 0 10px"><strong>Mother / Guardian 2</strong></div>
    <div>
      ${field('Full Name', '280px')}
      ${field('Relationship to Student', '200px')}
    </div>
    <div>
      ${field('Phone Number (Primary)', '200px')}
      ${field('Email Address', '220px')}
    </div>

    <div style="margin:14px 0 10px"><strong>Emergency Contact (if different from above)</strong></div>
    <div>
      ${field('Full Name', '280px')}
      ${field('Phone Number', '200px')}
      ${field('Relationship', '180px')}
    </div>

    ${section('3. Medical & Health Information')}
    <div style="margin-bottom:10px">
      Any known medical conditions? &nbsp;${checkbox('None')}${checkbox('Yes (specify below)')}
    </div>
    ${field('Medical Condition / Disability (if any)', '100%')}
    <div>
      ${field('Blood Group', '140px')}
      ${field('Allergies (if any)', '300px')}
      ${field('Doctor / Hospital Contact', '260px')}
    </div>
    <div style="margin-bottom:10px">
      Is the student on any regular medication? &nbsp;${checkbox('No')}${checkbox('Yes (attach prescription copy)')}
    </div>

    ${section('4. Previous Academic Records')}
    <div>
      ${field('Last School Attended', '320px')}
      ${field('Year', '100px')}
      ${field('Class Completed', '160px')}
    </div>
    <div style="margin-bottom:10px">
      Any special learning needs? &nbsp;${checkbox('None')}${checkbox('Yes (specify below)')}
    </div>
    ${field('Special Needs / Learning Support Required', '100%')}

    ${section('5. Documents Submitted (Office Check)')}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px;font-size:12px">
      ${['Birth Certificate (Copy)','Previous School Leaving Certificate','Transfer Letter','Passport Photo (2 copies)','National ID of Parent/Guardian (Copy)','Medical Certificate (if applicable)','NHIF Card (Copy)','Any Other (specify): _______________'].map(d =>
        `<div>${checkbox(d)}</div>`
      ).join('')}
    </div>

    ${section('6. Fee Information (Office)')}
    <div style="border:1px solid #ccc;padding:10px 14px;border-radius:3px;font-size:12px;margin-bottom:14px">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        <div>
          <div style="font-size:10px;color:#555;text-transform:uppercase;font-weight:700;margin-bottom:4px">Total Fee (Term)</div>
          <div style="border-bottom:1px solid #999;height:22px"></div>
        </div>
        <div>
          <div style="font-size:10px;color:#555;text-transform:uppercase;font-weight:700;margin-bottom:4px">Amount Paid on Admission</div>
          <div style="border-bottom:1px solid #999;height:22px"></div>
        </div>
        <div>
          <div style="font-size:10px;color:#555;text-transform:uppercase;font-weight:700;margin-bottom:4px">Balance Outstanding</div>
          <div style="border-bottom:1px solid #999;height:22px"></div>
        </div>
      </div>
      <div style="margin-top:10px">
        Payment Method: &nbsp;${checkbox('Cash')}${checkbox('M-Pesa')}${checkbox('Bank')}${checkbox('Other')}
        &nbsp;&nbsp; Receipt No: <span style="display:inline-block;border-bottom:1px solid #333;width:140px"></span>
      </div>
    </div>

    ${section('7. Declarations & Signatures')}
    <div style="font-size:12px;line-height:1.8;margin-bottom:14px;border:1px solid #ccc;padding:10px 14px;border-radius:3px;background:#f9f9f9">
      I/We, the parent(s)/guardian(s), confirm that the information provided above is accurate and complete.
      I/We agree to abide by the school's rules and regulations and to support the school in the education of the above-named student.
      I/We consent to the school administering first aid and seeking medical attention as necessary.
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:20px">
      <div>
        <div style="font-size:11px;color:#555;margin-bottom:28px">Parent / Guardian Signature:</div>
        <div style="border-bottom:1px solid #333;margin-bottom:6px"></div>
        <div style="font-size:11px;color:#555">Name: ___________________________ &nbsp; Date: _______________</div>
      </div>
      <div>
        <div style="font-size:11px;color:#555;margin-bottom:28px">Admitted By (Office):</div>
        <div style="border-bottom:1px solid #333;margin-bottom:6px"></div>
        <div style="font-size:11px;color:#555">Name: ___________________________ &nbsp; Date: _______________</div>
      </div>
    </div>
    <div style="text-align:center;border-top:1px solid #ccc;padding-top:10px">
      <div style="display:inline-block;border:1px solid #ccc;width:100px;height:50px;vertical-align:middle;margin-right:20px"></div>
      <span style="font-size:11px;color:#555">Official School Stamp</span>
      &nbsp;&nbsp;&nbsp;
      <span style="font-size:11px;color:#555">Principal's Signature: _________________________________</span>
    </div>

    <div style="font-size:10px;color:#aaa;text-align:center;margin-top:12px">
      ${data.schoolName} · ${[data.schoolPOBox, data.schoolLocation, data.schoolCounty].filter(Boolean).join(' · ')} · Printed: ${new Date().toLocaleDateString('en-KE',{day:'numeric',month:'long',year:'numeric'})}
    </div>

    <div class="no-print">
      <button onclick="window.print()" style="padding:10px 28px;background:#003399;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600">
        🖨 Print Admission Form
      </button>
    </div>
  </body></html>`);
  w.document.close();
}

/* ═══════════════════════════════════════════════════════
   STAFF INTAKE / REGISTRATION FORM
   Admin prints this for new staff to fill in,
   then enters their details into the system.
═══════════════════════════════════════════════════════ */
export function printStaffIntakeForm(data) {
  const depts = data.departments || [];

  const field = (label, width = '240px') =>
    `<div style="margin-bottom:14px;display:inline-block;width:${width};margin-right:16px;vertical-align:top">
      <div style="font-size:11px;color:#555;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px">${label}</div>
      <div style="border-bottom:1px solid #999;height:22px;width:100%"></div>
     </div>`;

  const section = (title) =>
    `<div style="background:#003399;color:#fff;padding:5px 12px;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:18px 0 12px;border-radius:2px">${title}</div>`;

  const checkbox = (label) =>
    `<span style="display:inline-block;margin-right:18px;font-size:12px">
      <span style="display:inline-block;width:14px;height:14px;border:1.5px solid #333;margin-right:5px;vertical-align:middle"></span>${label}
     </span>`;

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>Staff Registration Form — ${data.schoolName}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,Helvetica,sans-serif;font-size:13px;padding:28px;color:#111;max-width:820px;margin:0 auto}
      @page{size:A4 portrait;margin:14mm}
      @media print{body{padding:0}.no-print{display:none!important}}
      .no-print{margin-top:16px;text-align:center}
    </style>
  </head><body>
    ${schoolHeader(data)}

    <h3 style="text-align:center;font-size:16px;text-transform:uppercase;letter-spacing:2px;color:#003399;margin:10px 0 4px">
      Staff Registration Form
    </h3>
    <p style="text-align:center;font-size:11px;color:#555;margin-bottom:18px">
      Please fill in all fields clearly in BLOCK LETTERS &nbsp;·&nbsp; Return completed form to the administration office
    </p>

    <div style="border:1px solid #ccc;border-radius:3px;padding:10px 14px;margin-bottom:14px;font-size:11px;background:#fffbe6">
      <strong>FOR OFFICE USE:</strong> &nbsp;
      Staff ID: <span style="display:inline-block;border-bottom:1px solid #333;width:120px;margin:0 16px 0 4px">&nbsp;</span>
      Date Employed: <span style="display:inline-block;border-bottom:1px solid #333;width:120px;margin:0 16px 0 4px">&nbsp;</span>
      Department: <span style="display:inline-block;border-bottom:1px solid #333;width:140px;margin:0 4px">&nbsp;</span>
    </div>

    ${section('1. Personal Information')}
    ${field('Full Name (Surname First)', '100%')}
    <div>
      ${field('Date of Birth (DD/MM/YYYY)', '220px')}
      ${field('Gender', '120px')}
      ${field('Nationality', '180px')}
    </div>
    <div>
      ${field('National ID Number', '220px')}
      ${field('KRA PIN', '200px')}
      ${field('NSSF Number', '200px')}
    </div>
    <div>
      ${field('NHIF Number', '200px')}
      ${field('TSC Number (if applicable)', '220px')}
    </div>
    ${field('Postal / Home Address', '100%')}
    <div>
      ${field('Sub-County', '200px')}
      ${field('County', '200px')}
    </div>

    ${section('2. Contact Information')}
    <div>
      ${field('Primary Phone Number', '220px')}
      ${field('Alternative Phone', '220px')}
      ${field('Email Address', '260px')}
    </div>

    <div style="margin-bottom:10px"><strong>Emergency Contact</strong></div>
    <div>
      ${field('Name', '240px')}
      ${field('Relationship', '180px')}
      ${field('Phone Number', '200px')}
    </div>

    ${section('3. Employment Details')}
    <div style="margin-bottom:10px">
      Staff Type: &nbsp;${checkbox('Teaching Staff')}${checkbox('Non-Teaching Staff')}${checkbox('Administrative')}
    </div>
    <div style="margin-bottom:10px">
      Employment Type: &nbsp;${checkbox('Permanent')}${checkbox('Contract')}${checkbox('Part-Time')}${checkbox('Volunteer / BOM')}
    </div>
    <div>
      ${field('Department / Section', '260px')}
      ${field('Designation / Title', '260px')}
    </div>
    <div>
      ${field('Date of First Appointment (DD/MM/YYYY)', '280px')}
      ${field('Reporting Date at This School', '280px')}
    </div>

    ${section('4. Teaching Details (Teaching Staff Only)')}
    <div style="margin-bottom:10px">
      Is this staff a Class Teacher? &nbsp;${checkbox('Yes')}${checkbox('No')}
      &nbsp;&nbsp; If yes, Class: <span style="display:inline-block;border-bottom:1px solid #333;width:140px"></span>
    </div>
    <div style="margin-bottom:10px;font-size:12px;color:#555">List subjects and classes you teach:</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:14px">
      <thead>
        <tr style="background:#003399;color:#fff">
          <th style="padding:6px 10px;border:1px solid #003399;text-align:left">Subject</th>
          <th style="padding:6px 10px;border:1px solid #003399;text-align:left">Classes (e.g. Grade 7 East, Grade 8)</th>
          <th style="padding:6px 10px;border:1px solid #003399;text-align:left">Periods / Week</th>
        </tr>
      </thead>
      <tbody>
        ${Array(6).fill(0).map(() => `
          <tr>
            <td style="border:1px solid #ccc;height:28px;padding:4px 8px"></td>
            <td style="border:1px solid #ccc;height:28px;padding:4px 8px"></td>
            <td style="border:1px solid #ccc;height:28px;padding:4px 8px"></td>
          </tr>`).join('')}
      </tbody>
    </table>

    ${section('5. Academic & Professional Qualifications')}
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:14px">
      <thead>
        <tr style="background:#003399;color:#fff">
          <th style="padding:6px 10px;border:1px solid #003399;text-align:left">Qualification / Certificate</th>
          <th style="padding:6px 10px;border:1px solid #003399;text-align:left">Institution</th>
          <th style="padding:6px 10px;border:1px solid #003399;text-align:left">Year</th>
          <th style="padding:6px 10px;border:1px solid #003399;text-align:left">Grade / Class</th>
        </tr>
      </thead>
      <tbody>
        ${Array(5).fill(0).map(() => `
          <tr>
            <td style="border:1px solid #ccc;height:28px;padding:4px 8px"></td>
            <td style="border:1px solid #ccc;height:28px;padding:4px 8px"></td>
            <td style="border:1px solid #ccc;height:28px;padding:4px 8px"></td>
            <td style="border:1px solid #ccc;height:28px;padding:4px 8px"></td>
          </tr>`).join('')}
      </tbody>
    </table>

    ${section('6. Previous Employment')}
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:14px">
      <thead>
        <tr style="background:#003399;color:#fff">
          <th style="padding:6px 10px;border:1px solid #003399;text-align:left">School / Institution</th>
          <th style="padding:6px 10px;border:1px solid #003399;text-align:left">Position Held</th>
          <th style="padding:6px 10px;border:1px solid #003399;text-align:left">From</th>
          <th style="padding:6px 10px;border:1px solid #003399;text-align:left">To</th>
          <th style="padding:6px 10px;border:1px solid #003399;text-align:left">Reason for Leaving</th>
        </tr>
      </thead>
      <tbody>
        ${Array(4).fill(0).map(() => `
          <tr>
            <td style="border:1px solid #ccc;height:28px;padding:4px 8px"></td>
            <td style="border:1px solid #ccc;height:28px;padding:4px 8px"></td>
            <td style="border:1px solid #ccc;height:28px;padding:4px 8px"></td>
            <td style="border:1px solid #ccc;height:28px;padding:4px 8px"></td>
            <td style="border:1px solid #ccc;height:28px;padding:4px 8px"></td>
          </tr>`).join('')}
      </tbody>
    </table>

    ${section('7. Documents Submitted (Office Check)')}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px;font-size:12px">
      ${['National ID (Copy)','KRA PIN Certificate (Copy)','TSC Certificate (Copy)','Academic Certificates (Copies)','Professional Certificates (Copies)','Passport Photo (2 copies)','NSSF Card (Copy)','NHIF Card (Copy)','Certificate of Good Conduct','Bank Account Details (for payroll)'].map(d =>
        `<div>${checkbox(d)}</div>`
      ).join('')}
    </div>

    ${section('8. Declaration & Signature')}
    <div style="font-size:12px;line-height:1.8;margin-bottom:14px;border:1px solid #ccc;padding:10px 14px;border-radius:3px;background:#f9f9f9">
      I declare that the information provided in this form is true and complete to the best of my knowledge.
      I understand that providing false information may lead to termination of employment.
      I agree to abide by the rules, regulations, and professional code of conduct of ${data.schoolName}.
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:20px">
      <div>
        <div style="font-size:11px;color:#555;margin-bottom:28px">Staff Member Signature:</div>
        <div style="border-bottom:1px solid #333;margin-bottom:6px"></div>
        <div style="font-size:11px;color:#555">Name: ___________________________ &nbsp; Date: _______________</div>
      </div>
      <div>
        <div style="font-size:11px;color:#555;margin-bottom:28px">Received By (Principal / HR):</div>
        <div style="border-bottom:1px solid #333;margin-bottom:6px"></div>
        <div style="font-size:11px;color:#555">Name: ___________________________ &nbsp; Date: _______________</div>
      </div>
    </div>
    <div style="text-align:center;border-top:1px solid #ccc;padding-top:10px">
      <div style="display:inline-block;border:1px solid #ccc;width:100px;height:50px;vertical-align:middle;margin-right:20px"></div>
      <span style="font-size:11px;color:#555">Official School Stamp</span>
      &nbsp;&nbsp;&nbsp;
      <span style="font-size:11px;color:#555">Principal's Signature: _________________________________</span>
    </div>

    <div style="font-size:10px;color:#aaa;text-align:center;margin-top:12px">
      ${data.schoolName} · ${[data.schoolPOBox, data.schoolLocation, data.schoolCounty].filter(Boolean).join(' · ')} · Printed: ${new Date().toLocaleDateString('en-KE',{day:'numeric',month:'long',year:'numeric'})}
    </div>

    <div class="no-print">
      <button onclick="window.print()" style="padding:10px 28px;background:#003399;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600">
        🖨 Print Staff Registration Form
      </button>
    </div>
  </body></html>`);
  w.document.close();
}

/* ═══════════════════════════════════════════════════════
   CLASS LIST PRINT
   Admin/Class Teacher prints a list of all students in a class
   with admission numbers, SLC codes, parent details
═══════════════════════════════════════════════════════ */
export function printStudentRegister(students, className, data, options = {}) {
  const { term = '', year = '', classTeacher = '' } = options;
  const sorted = [...students].sort((a, b) => (a.name||'').localeCompare(b.name||''));

  const rows = sorted.map((s, i) => `
    <tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:7px 8px;text-align:center;color:#64748b">${i + 1}</td>
      <td style="padding:7px 8px;font-weight:600">${s.name || ''}</td>
      <td style="padding:7px 8px;color:#1e40af;font-weight:700;font-family:monospace">${s.admNo || '—'}</td>
      <td style="padding:7px 8px;color:#059669;font-weight:700;font-family:monospace">${s.slc || '—'}</td>
      <td style="padding:7px 8px">${s.dob || '—'}</td>
      <td style="padding:7px 8px">${s.parentName || s.parent || '—'}</td>
      <td style="padding:7px 8px">${s.parentPhone || s.phone || '—'}</td>
    </tr>`).join('');

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>Class List — ${className}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; padding: 20px; color: #1e293b; }
      @page { size: A4 landscape; margin: 12mm; }
      @media print { body { padding: 0; } .no-print { display: none !important; } }
      table { width: 100%; border-collapse: collapse; }
      th { background: #1e40af; color: #fff; padding: 8px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
      tr:nth-child(even) { background: #f8fafc; }
    </style>
  </head><body>

    <!-- School Header -->
    <div style="text-align:center; border-bottom:3px solid #1e40af; padding-bottom:10px; margin-bottom:14px">
      <div style="font-size:18px; font-weight:900; color:#1e40af; text-transform:uppercase; letter-spacing:1px">
        ${data.schoolName || 'School Name'}
      </div>
      ${data.schoolMotto ? `<div style="font-size:12px; font-style:italic; color:#64748b; margin-top:2px">${data.schoolMotto}</div>` : ''}
      ${data.schoolPOBox || data.schoolLocation ? `<div style="font-size:11px; color:#64748b">${[data.schoolPOBox, data.schoolLocation, data.schoolCounty].filter(Boolean).join(' · ')}</div>` : ''}
    </div>

    <!-- List Title -->
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px">
      <div>
        <div style="font-size:15px; font-weight:800; color:#1e293b">CLASS LIST — ${className}</div>
        <div style="font-size:11px; color:#64748b; margin-top:3px">
          Total Students: <strong>${sorted.length}</strong>
          ${term ? ` &nbsp;·&nbsp; Term: <strong>${term}</strong>` : ''}
          ${year ? ` &nbsp;·&nbsp; Year: <strong>${year}</strong>` : ''}
          ${classTeacher ? ` &nbsp;·&nbsp; Class Teacher: <strong>${classTeacher}</strong>` : ''}
        </div>
      </div>
      <div style="font-size:11px; color:#94a3b8; text-align:right">
        Printed: ${new Date().toLocaleDateString('en-KE', { day:'numeric', month:'long', year:'numeric' })}<br/>
        <span style="color:#059669; font-size:10px">SLC = Student Login Code (for portal access)</span>
      </div>
    </div>

    <!-- Student Table -->
    <table>
      <thead>
        <tr>
          <th style="width:40px">#</th>
          <th>Full Name</th>
          <th style="width:120px">Adm Number</th>
          <th style="width:110px">Login Code (SLC)</th>
          <th style="width:100px">Date of Birth</th>
          <th>Parent / Guardian</th>
          <th style="width:120px">Parent Phone</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <!-- Footer -->
    <div style="display:flex; justify-content:space-between; margin-top:30px; font-size:11px; color:#64748b; border-top:1px solid #e2e8f0; padding-top:10px">
      <div>
        Class Teacher: _____________________________________ &nbsp;&nbsp; Signature: _____________________
      </div>
      <div style="text-align:right">
        Principal: ________________________________ &nbsp;&nbsp; Date: _____________________
      </div>
    </div>
    <div style="text-align:center; margin-top:8px; font-size:10px; color:#94a3b8">
      ${data.schoolName} · Generated by EduManage Pro · ${new Date().toLocaleDateString('en-KE')}
    </div>

    <div class="no-print" style="margin-top:16px; text-align:center">
      <button onclick="window.print()" style="padding:10px 28px; background:#1e40af; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:14px; font-weight:600">
        🖨 Print Class List
      </button>
    </div>
  </body></html>`);
  w.document.close();
}
