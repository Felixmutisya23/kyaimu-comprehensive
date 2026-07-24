import { getGrade, getScore, getSiblingStreams, getStreamFromClass, getBaseClass, getSubjectsForClass } from '../data/initialData';

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
  const terms    = data.terms || [];
  const nextTerm = exam.term < 3 ? exam.term + 1 : 1;
  const nextYear = exam.term < 3 ? exam.year : (Number(exam.year) || 0) + 1;
  const found    = terms.find(t => Number(t.term) === nextTerm && Number(t.year) === nextYear);

  // Use explicitly set nextTermOpeningDate if available (set in Term Calendar)
  if (found && found.nextTermOpeningDate) {
    return new Date(found.nextTermOpeningDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  // Fall back to the term's startDate
  if (found && found.startDate) {
    return new Date(found.startDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return '___________________________';
}

function getMidtermReportingDate(exam, data) {
  const terms = data.terms || [];
  const found = terms.find(t => Number(t.term) === Number(exam.term) && Number(t.year) === Number(exam.year));
  if (found && found.midtermReportingDate) {
    return new Date(found.midtermReportingDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return null;
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

  // A student only counts toward the class list / ranking once they have a
  // recorded score for EVERY subject set up for their class — a student
  // missing even one subject's mark is excluded entirely (not shown with
  // zeros, not counted in the mean or position of anyone else).
  function hasCompletedAllExams(studentClass, res) {
    const expected = getSubjectsForClass(studentClass, data);
    if (expected.length === 0) return false;
    return expected.every(sub => {
      const cell = res[sub];
      return cell !== undefined && cell !== null && getScore(cell) !== null && getScore(cell) !== undefined;
    });
  }

  // Overall: across ALL sibling streams — each student ranked using their OWN stream's exam
  const allSiblingStudents = allStudents
    .filter(s => siblingClasses.includes(s.class))
    .filter(s => hasCompletedAllExams(s.class, (siblingExamMap[s.class] || exam.results || {})[s.name] || {}));
  const overallSorted = [...allSiblingStudents]
    .map(s => ({ name: s.name, class: s.class, ...calcStatsForStudent(s) }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  // Stream: within this exam's class only — uses this exam's results
  const streamStudents = allStudents
    .filter(s => s.class === exam.class)
    .filter(s => hasCompletedAllExams(s.class, (exam.results || {})[s.name] || {}));
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

/* ═══════════════════════════════════════════════════════
   SCHOOL COLOUR HELPERS
   Reads from schoolStamp settings so every school gets
   its own branded colours on every printed document.
═══════════════════════════════════════════════════════ */
function schoolColors(data) {
  const cfg = data.schoolStamp || {};
  return {
    primary: cfg.primaryColor || '#003399',
    accent:  cfg.accentColor  || '#cc0000',
  };
}

/* ═══════════════════════════════════════════════════════
   SUBJECT ANALYSIS HELPERS
   Pure read-only — never touches exam data
═══════════════════════════════════════════════════════ */
function buildSubjectStats(students, resultsMap, subjects) {
  // resultsMap: { studentName → { subject → cell } }
  return subjects.map(sub => {
    const scores = students
      .map(s => getScore((resultsMap[s.name] || {})[sub]))
      .filter(v => v !== null && v !== undefined);
    if (!scores.length) return { subject: sub, avg: 0, highest: 0, lowest: 0, count: 0, passRate: 0 };
    const avg      = scores.reduce((a, b) => a + b, 0) / scores.length;
    const highest  = Math.max(...scores);
    const lowest   = Math.min(...scores);
    const passing  = scores.filter(s => s >= 50).length; // 50% pass mark
    return {
      subject: sub,
      avg:      Math.round(avg * 10) / 10,
      highest,
      lowest,
      count:    scores.length,
      passRate: Math.round((passing / scores.length) * 100),
    };
  }).sort((a, b) => b.avg - a.avg); // best subject first
}

function subjectAnalysisTable(stats, pri, acc) {
  if (!stats.length) return '';
  const rows = stats.map((s, i) => {
    const g        = getGrade(Math.round(s.avg));
    const barPct   = Math.min(100, Math.round((s.avg / 100) * 100));
    const barColor = s.avg >= 70 ? '#10b981' : s.avg >= 50 ? '#4f8ef7' : s.avg >= 30 ? '#f59e0b' : '#ef4444';
    return `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
        <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center;font-weight:700;color:${pri}">${i + 1}</td>
        <td style="padding:6px 10px;border:1px solid #e2e8f0;font-weight:700">${s.subject}</td>
        <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center">
          <div style="display:flex;align-items:center;gap:6px">
            <div style="flex:1;background:#e2e8f0;border-radius:3px;height:8px">
              <div style="width:${barPct}%;background:${barColor};border-radius:3px;height:8px"></div>
            </div>
            <strong style="font-size:13px;min-width:32px;text-align:right">${s.avg}</strong>
          </div>
        </td>
        <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center">
          <span style="background:${g.color}22;color:${g.color};padding:2px 8px;border-radius:10px;font-weight:700;font-size:12px">${g.label}</span>
        </td>
        <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center;color:#10b981;font-weight:700">${s.highest}</td>
        <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center;color:#ef4444;font-weight:700">${s.lowest}</td>
        <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center">${s.count}</td>
        <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center;font-weight:700;color:${s.passRate >= 60 ? '#10b981' : s.passRate >= 40 ? '#f59e0b' : '#ef4444'}">${s.passRate}%</td>
      </tr>`;
  }).join('');

  return `
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr style="background:${pri};color:#fff">
          <th style="padding:7px 10px;border:1px solid ${pri};text-align:center">#</th>
          <th style="padding:7px 10px;border:1px solid ${pri};text-align:left">Subject</th>
          <th style="padding:7px 10px;border:1px solid ${pri}">Class Average</th>
          <th style="padding:7px 10px;border:1px solid ${pri}">Grade</th>
          <th style="padding:7px 10px;border:1px solid ${pri}">Highest</th>
          <th style="padding:7px 10px;border:1px solid ${pri}">Lowest</th>
          <th style="padding:7px 10px;border:1px solid ${pri}">Students</th>
          <th style="padding:7px 10px;border:1px solid ${pri}">Pass Rate</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/* ═══════════════════════════════════════════════════════
   GRADE COLOUR MAP  (CBC)
═══════════════════════════════════════════════════════ */
function gradeColor(label) {
  if (!label) return '#64748b';
  if (label.startsWith('EE')) return '#10b981';
  if (label.startsWith('ME')) return '#3b82f6';
  if (label.startsWith('AE')) return '#f59e0b';
  return '#ef4444'; // BE
}

/* ═══════════════════════════════════════════════════════
   SHARED PRINT STYLES
═══════════════════════════════════════════════════════ */
const PRINT_BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; }
  @page { size: A4 portrait; margin: 10mm; }
  @media print { .no-print { display: none !important; } }
  .no-print { text-align:center; padding:14px; }
`;

/* ═══════════════════════════════════════════════════════
   STREAM RESULT SHEET  (one stream, sorted by stream pos)
   + OVERALL CLASS RESULT SHEET (all streams combined)

   Both use the same renderer — the caller decides the
   student list and the title.
═══════════════════════════════════════════════════════ */
function renderResultSheet({
  title, subtitle, students, subjects, resultsMap,
  showStream, posLabel, posKey, ofKey,
  subjectStats, pri, acc, data, exam,
}) {
  // Header
  const hdr = schoolHeader(data);
  const { primary: p, accent: a } = { primary: pri, accent: acc };

  // Build table rows — students already sorted by caller
  const subTHs = subjects.map(s =>
    `<th style="padding:5px 4px;border:1px solid #cbd5e1;font-size:9px;text-align:center;white-space:nowrap;max-width:60px;overflow:hidden">${s.toUpperCase()}</th>`
  ).join('');

  const rows = students.map((s, idx) => {
    const res   = resultsMap[s.name] || {};
    const subs  = subjects.filter(k => res[k] !== undefined);
    const total = subs.reduce((a, k) => a + (getScore(res[k]) ?? 0), 0);
    const points = subs.reduce((a, k) => {
      const sc = getScore(res[k]);
      return a + (sc === null || sc === undefined ? 0 : getGrade(sc).points);
    }, 0);
    const mean  = subs.length ? (total / subs.length).toFixed(1) : '—';
    const g     = getGrade(Math.round(parseFloat(mean) || 0));
    const pos   = s[posKey] || (idx + 1);
    const of_   = s[ofKey]  || students.length;

    const subCells = subjects.map(sub => {
      const score = getScore(res[sub]);
      const sg    = score !== null && score !== undefined ? getGrade(score) : null;
      return score !== null && score !== undefined
        ? `<td style="padding:3px 4px;border:1px solid #e2e8f0;text-align:center;vertical-align:middle">
            <div style="font-weight:700;font-size:10px">${score}</div>
            <div style="font-size:8px;font-weight:700;color:${gradeColor(sg?.label)}">${sg?.label || ''}</div>
           </td>`
        : `<td style="padding:3px 4px;border:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:10px">—</td>`;
    }).join('');

    const rowBg = idx % 2 === 0 ? '#fff' : '#f8fafc';
    return `
      <tr style="background:${rowBg}">
        <td style="padding:4px 6px;border:1px solid #e2e8f0;text-align:center;font-weight:900;color:${p};font-size:11px">${pos}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;font-weight:700;font-size:11px;white-space:nowrap">${s.name.toUpperCase()}</td>
        ${showStream ? `<td style="padding:4px 6px;border:1px solid #e2e8f0;text-align:center;font-size:10px;color:#64748b;font-weight:600">${s.stream || s.class || ''}</td>` : ''}
        ${subCells}
        <td style="padding:4px 6px;border:1px solid #e2e8f0;text-align:center;font-weight:900;font-size:11px">${total}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;text-align:center;font-weight:900;color:#7c3aed;font-size:11px">${points}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;text-align:center;font-size:11px">${mean}</td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;text-align:center">
          <span style="background:${gradeColor(g.label)}22;color:${gradeColor(g.label)};padding:1px 6px;border-radius:8px;font-weight:700;font-size:10px">${g.label}</span>
        </td>
        <td style="padding:4px 6px;border:1px solid #e2e8f0;text-align:center;font-weight:900;color:${p};font-size:11px">${pos} / ${of_}</td>
      </tr>`;
  }).join('');

  // Best and weakest subject
  const best    = subjectStats[0];
  const weakest = subjectStats[subjectStats.length - 1];

  // Summary stats — class mean must be the average of each student's
  // per-subject MEAN (0–100 scale), not the average of their totals
  // (sum across all subjects), otherwise it blows past 100 and getGrade()
  // falls through to its last band (BE2) for every student every time.
  const allMeans = students.map(s => {
    const res  = resultsMap[s.name] || {};
    const subs = subjects.filter(k => res[k] !== undefined);
    if (!subs.length) return null;
    const total = subs.reduce((a, k) => a + (getScore(res[k]) ?? 0), 0);
    return total / subs.length;
  }).filter(m => m !== null);
  const classMean = allMeans.length
    ? (allMeans.reduce((a, b) => a + b, 0) / allMeans.length).toFixed(1)
    : '—';
  const classGrade = getGrade(Math.round(parseFloat(classMean) || 0));

  return `
    ${hdr}
    <div style="background:${p};color:#fff;padding:10px 16px;border-radius:6px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:15px;font-weight:900;letter-spacing:0.5px">${title}</div>
        <div style="font-size:11px;opacity:0.85;margin-top:2px">${subtitle}</div>
      </div>
      <div style="text-align:right;font-size:11px;opacity:0.85">
        Total Students: <strong style="font-size:14px">${students.length}</strong><br/>
        Class Mean: <strong style="font-size:14px">${classMean}</strong> &nbsp;
        <span style="background:#fff2;padding:2px 8px;border-radius:8px;font-weight:700">${classGrade.label}</span>
      </div>
    </div>

    <!-- Summary pills -->
    <div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap">
      ${best ? `<div style="background:#10b98115;border:1px solid #10b98140;border-radius:6px;padding:6px 12px;font-size:11px">
        🏆 <strong>Best Subject:</strong> ${best.subject} &nbsp; Avg: <strong>${best.avg}</strong>
      </div>` : ''}
      ${weakest && weakest !== best ? `<div style="background:#ef444415;border:1px solid #ef444440;border-radius:6px;padding:6px 12px;font-size:11px">
        ⚠ <strong>Needs Attention:</strong> ${weakest.subject} &nbsp; Avg: <strong>${weakest.avg}</strong>
      </div>` : ''}
      <div style="background:${p}12;border:1px solid ${p}30;border-radius:6px;padding:6px 12px;font-size:11px">
        📅 <strong>Printed:</strong> ${new Date().toLocaleDateString('en-KE', { day:'numeric', month:'long', year:'numeric' })}
      </div>
    </div>

    <!-- Results table -->
    <div style="overflow-x:auto;margin-bottom:20px">
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead>
          <tr style="background:${p};color:#fff">
            <th style="padding:7px 6px;border:1px solid ${p};text-align:center">${posLabel}</th>
            <th style="padding:7px 6px;border:1px solid ${p};text-align:left">NAME</th>
            ${showStream ? `<th style="padding:7px 6px;border:1px solid ${p};text-align:center">STREAM</th>` : ''}
            ${subTHs}
            <th style="padding:7px 6px;border:1px solid ${p};text-align:center">TOTAL</th>
            <th style="padding:7px 6px;border:1px solid ${p};text-align:center">POINTS</th>
            <th style="padding:7px 6px;border:1px solid ${p};text-align:center">MEAN</th>
            <th style="padding:7px 6px;border:1px solid ${p};text-align:center">GRADE</th>
            <th style="padding:7px 6px;border:1px solid ${p};text-align:center">POSITION</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <!-- Subject Analysis -->
    <div style="margin-top:8px">
      <div style="background:${p};color:#fff;padding:7px 14px;border-radius:4px;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">
        📊 Subject Performance Analysis — Ranked Best to Weakest
      </div>
      ${subjectAnalysisTable(subjectStats, p, acc)}
    </div>

    <!-- Footer -->
    <div style="display:flex;justify-content:space-between;margin-top:16px;padding-top:10px;border-top:2px solid ${p};font-size:10px;color:#64748b">
      <span>Class Teacher: ___________________________________</span>
      <span>Principal: ___________________________________</span>
      <span>${data.schoolName} · EduManage Pro</span>
    </div>`;
}

/* ═══════════════════════════════════════════════════════
   PUBLIC: STREAM CLASS LIST  (what the old printClassList did)
   — prints the current stream only, sorted by stream position
═══════════════════════════════════════════════════════ */
export function printClassList(ranked, subjects, exam, data) {
  if (!ranked || ranked.length === 0) { alert('No results to print.'); return; }

  const { primary: pri, accent: acc } = schoolColors(data);
  const stream    = getStreamFromClass(exam.class, data);
  const baseClass = getBaseClass(exam.class, data);
  const hasStreams = getSiblingStreams(exam.class, data).length > 1;

  // ranked is already sorted by streamPos (lowest first) by rankStudents()
  const streamSorted = [...ranked].sort((a, b) => (a.streamPos || 0) - (b.streamPos || 0));

  // Build a resultsMap: studentName → results object
  const resultsMap = {};
  streamSorted.forEach(s => { resultsMap[s.name] = s.results || {}; });

  // Subject stats for this stream only
  const subjectStats = buildSubjectStats(streamSorted, resultsMap, subjects);

  const title    = `${baseClass}${stream ? ' — ' + stream.toUpperCase() + ' STREAM' : ''} · ${exam.name}`;
  const subtitle = `Term ${exam.term} · ${exam.year}  ·  Stream Result Sheet`;

  const html = renderResultSheet({
    title, subtitle,
    students:    streamSorted,
    subjects,
    resultsMap,
    showStream:  false,
    posLabel:    'STRM POS',
    posKey:      'streamPos',
    ofKey:       'streamOf',
    subjectStats,
    pri, acc, data, exam,
  });

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>Stream List — ${exam.class} — ${exam.name}</title>
    <style>${PRINT_BASE_CSS} body { padding: 14px; font-size: 11px; }</style>
  </head><body>
    ${html}
    <div class="no-print">
      <button onclick="window.print()" style="padding:10px 28px;background:${pri};color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600">
        🖨 Print Stream List
      </button>
    </div>
  </body></html>`);
  w.document.close();
}

/* ═══════════════════════════════════════════════════════
   PUBLIC: OVERALL CLASS LIST  (all streams combined)
   Sorted overall position 1 → last
═══════════════════════════════════════════════════════ */
export function printOverallClassList(exam, data) {
  if (!exam) return;

  const { primary: pri, accent: acc } = schoolColors(data);
  const baseClass     = getBaseClass(exam.class, data);
  const siblingClasses = getSiblingStreams(exam.class, data);
  const hasStreams     = siblingClasses.length > 1;

  // Gather all sibling exams
  function findSiblingExam(cls) {
    if (cls === exam.class) return exam;
    return (data.exams || []).find(e =>
      e.class === cls && e.term === exam.term &&
      e.year  === exam.year && e.name === exam.name
    ) || null;
  }

  // Build merged results map and student list across all streams
  const allStudents = (data.students || []).filter(s => siblingClasses.includes(s.class));
  const resultsMap  = {};
  allStudents.forEach(s => {
    const ex = findSiblingExam(s.class);
    resultsMap[s.name] = ex ? (ex.results[s.name] || {}) : {};
  });

  // ── Canonical subject list from Setup Subjects ──────────────────────
  // Use Setup Subjects (subjectsByClass) as the single source of truth.
  // This prevents duplicate columns when streams use different spellings
  // e.g. "Eng" vs "English", "Kisw" vs "Kiswahili", "MathS" vs "Mathematics"
  const canonicalSubjects = getSubjectsForClass(siblingClasses[0], data);

  // Build normalisation map: result key → canonical name
  function normaliseSubject(key) {
    if (!key) return key;
    const exact = canonicalSubjects.find(s => s === key);
    if (exact) return exact;
    const ci = canonicalSubjects.find(s => s.toLowerCase() === key.toLowerCase());
    if (ci) return ci;
    const kLow = key.toLowerCase();
    const prefix = canonicalSubjects.find(s =>
      s.toLowerCase().startsWith(kLow) ||
      kLow.startsWith(s.toLowerCase().slice(0, Math.min(4, s.length)))
    );
    return prefix || key;
  }

  // Re-build resultsMap with normalised subject keys — no marks lost
  allStudents.forEach(s => {
    const raw = resultsMap[s.name] || {};
    const normalised = {};
    Object.entries(raw).forEach(([k, v]) => {
      const canon = normaliseSubject(k);
      if (!normalised[canon]) {
        normalised[canon] = v;
      } else {
        // Two keys mapped to same canonical — keep the one with actual score
        const oldScore = typeof normalised[canon] === 'object' ? normalised[canon]?.score : normalised[canon];
        const newScore = typeof v === 'object' ? v?.score : v;
        if (newScore != null && (oldScore == null || Number(newScore) > Number(oldScore))) {
          normalised[canon] = v;
        }
      }
    });
    resultsMap[s.name] = normalised;
  });

  // Final subject list: canonical Setup Subjects first (in order), then any
  // leftover subject key that genuinely has marks recorded but isn't part
  // of the current canonical list. That leftover case covers real, already
  // -entered scores under legacy/out-of-sync subject names — e.g. marks
  // entered before Setup Subjects was tidied up. Hiding those would make
  // real recorded scores invisible on the printed sheet even though they
  // still count toward each student's total and mean, which is worse than
  // the sheet showing an extra column. (This does not write anything back
  // to Setup Subjects — a subject deliberately removed there still won't
  // reappear in the Setup Subjects editor or in future new exams.)
  const usedSubjects = new Set();
  Object.values(resultsMap).forEach(r => Object.keys(r).forEach(k => usedSubjects.add(k)));
  const subjects = [
    ...canonicalSubjects.filter(s => usedSubjects.has(s)),
    ...[...usedSubjects].filter(s => !canonicalSubjects.includes(s)),
  ];

  // Rank overall — sorted by total descending
  const withStats = allStudents.map(s => {
    const res   = resultsMap[s.name] || {};
    const subs  = Object.keys(res);
    const total = subs.reduce((a, k) => a + (getScore(res[k]) ?? 0), 0);
    const mean  = subs.length ? (total / subs.length).toFixed(1) : 0;
    const stream = getStreamFromClass(s.class, data) || s.class;
    return { ...s, results: res, total, mean: parseFloat(mean), stream };
  }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  // Assign overall positions
  const overallSorted = withStats.map((s, i) => ({
    ...s,
    overallPos: i + 1,
    overallOf:  withStats.length,
  }));

  const subjectStats = buildSubjectStats(overallSorted, resultsMap, subjects);

  const title    = `${baseClass} — OVERALL CLASS RESULT · ${exam.name}`;
  const subtitle = `Term ${exam.term} · ${exam.year}  ·  All Streams Combined · ${siblingClasses.join(', ')}`;

  const html = renderResultSheet({
    title, subtitle,
    students:    overallSorted,
    subjects,
    resultsMap,
    showStream:  hasStreams,
    posLabel:    'OVR POS',
    posKey:      'overallPos',
    ofKey:       'overallOf',
    subjectStats,
    pri, acc, data, exam,
  });

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>Overall Class List — ${baseClass} — ${exam.name}</title>
    <style>${PRINT_BASE_CSS} body { padding: 14px; font-size: 11px; }</style>
  </head><body>
    ${html}
    <div class="no-print">
      <button onclick="window.print()" style="padding:10px 28px;background:${pri};color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600">
        🖨 Print Overall Class List
      </button>
    </div>
  </body></html>`);
  w.document.close();
}

/* ═══════════════════════════════════════════════════════
   INDIVIDUAL STUDENT REPORT FORM  — redesigned
═══════════════════════════════════════════════════════ */
export function printReportForm(student, exam, data) {
  const res  = exam.results[student.name] || {};
  const subs = Object.keys(res);
  if (!subs.length) { alert('No results recorded for this student in this exam.'); return; }

  const { primary: pri, accent: acc } = schoolColors(data);
  const stream    = getStreamFromClass(exam.class, data);
  const baseClass = getBaseClass(exam.class, data);

  const { posMap, hasStreams } = computeRankings(exam, data.students, data);
  const pos = posMap[student.name] || {};

  const total       = subs.reduce((a, k) => a + (getScore(res[k]) ?? 0), 0);
  const mean        = subs.length ? +(total / subs.length).toFixed(1) : 0;
  const grade       = getGrade(Math.round(mean));
  const totalPoints = subs.reduce((a, k) => a + getGrade(getScore(res[k]) ?? 0).points, 0);

  // Fee info
  const feeBalance  = getFeeBalance(student, exam.term, exam.year, data);
  const feeExpected = getFeeExpected(student, exam.term, exam.year, data);
  const feePaid     = getFeePaid(student.id, exam.term, exam.year, data);
  const feeStr      = feeExpected > 0
    ? (feeBalance > 0
        ? `KES ${feeBalance.toLocaleString()} (Balance Due)`
        : feeBalance < 0
          ? `KES ${Math.abs(feeBalance).toLocaleString()} (Overpaid)`
          : 'FULLY CLEARED ✓')
    : 'N/A';
  const feeColor = feeBalance > 0 ? acc : '#10b981';

  const nextTermDate = getNextTermDate(exam, data);

  // Class averages for each subject (stream only — fair comparison)
  const streamStudents = (data.students || []).filter(s => s.class === exam.class);
  const streamResults  = exam.results || {};
  const classAvgMap    = {};
  subs.forEach(sub => {
    const scores = streamStudents
      .map(s => getScore((streamResults[s.name] || {})[sub]))
      .filter(v => v !== null && v !== undefined);
    classAvgMap[sub] = scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10
      : null;
  });

  // Best and weakest subject for THIS student
  const scored = subs.map(k => ({ sub: k, score: getScore(res[k]) ?? 0 }))
    .sort((a, b) => b.score - a.score);
  const bestSub   = scored[0];
  const weakSub   = scored[scored.length - 1];

  // Previous exams trend
  const prevExams = (data.exams || [])
    .filter(e => e.class === exam.class && e.id !== exam.id)
    .map(ex => {
      const r  = ex.results[student.name] || {};
      const ks = Object.keys(r);
      if (!ks.length) return null;
      const t  = ks.reduce((a, k) => a + (getScore(r[k]) ?? 0), 0);
      const m  = +(t / ks.length).toFixed(1);
      return { name: ex.name, total: t, mean: m, grade: getGrade(Math.round(m)) };
    }).filter(Boolean);

  // Subject rows
  const subjectRows = subs.map((sub, idx) => {
    const score    = getScore(res[sub]);
    const g        = getGrade(score ?? 0);
    const clsAvg   = classAvgMap[sub];
    const vsClass  = clsAvg !== null ? (score >= clsAvg ? '▲' : '▼') : '';
    const vsColor  = clsAvg !== null ? (score >= clsAvg ? '#10b981' : '#ef4444') : '#94a3b8';
    const rowBg    = idx % 2 === 0 ? '#fff' : '#f8fafc';
    return `
      <tr style="background:${rowBg}">
        <td style="padding:7px 10px;border:1px solid #e2e8f0;font-weight:700;font-size:12px">${sub}</td>
        <td style="padding:7px 10px;border:1px solid #e2e8f0;text-align:center;font-weight:900;font-size:14px">${score ?? '—'}</td>
        <td style="padding:7px 10px;border:1px solid #e2e8f0;text-align:center">
          <span style="background:${gradeColor(g.label)}22;color:${gradeColor(g.label)};padding:3px 10px;border-radius:10px;font-weight:800;font-size:12px">${g.label}</span>
        </td>
        <td style="padding:7px 10px;border:1px solid #e2e8f0;text-align:center;font-weight:700">${g.points}</td>
        <td style="padding:7px 10px;border:1px solid #e2e8f0;text-align:center;font-size:11px;color:#64748b">${clsAvg !== null ? clsAvg : '—'}</td>
        <td style="padding:7px 10px;border:1px solid #e2e8f0;text-align:center;font-weight:900;color:${vsColor};font-size:13px">${vsClass}</td>
        <td style="padding:7px 10px;border:1px solid #e2e8f0;text-align:left;font-size:11px;color:#555;font-style:italic">${autoSubjectComment(sub, score, g)}</td>
      </tr>`;
  }).join('');

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>Report — ${student.name}</title>
    <style>
      ${PRINT_BASE_CSS}
      body { padding: 20px; max-width: 820px; margin: 0 auto; font-size: 12px; }
    </style>
  </head><body>

    <!-- School Header -->
    ${schoolHeader(data)}

    <!-- Coloured identity banner -->
    <div style="background:linear-gradient(135deg,${pri},${pri}cc);color:#fff;border-radius:8px;padding:14px 20px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:11px;opacity:0.8;text-transform:uppercase;letter-spacing:1px">Student Academic Report Form</div>
        <div style="font-size:20px;font-weight:900;letter-spacing:0.5px;margin:4px 0">${student.name.toUpperCase()}</div>
        <div style="font-size:12px;opacity:0.9">${baseClass}${stream ? ' · ' + stream : ''} &nbsp;·&nbsp; Adm No: <strong>${student.admNo}</strong></div>
        <div style="font-size:11px;opacity:0.8;margin-top:2px">${exam.name} &nbsp;·&nbsp; ${exam.termLabel || `Term ${exam.term} · ${exam.year}`}</div>
      </div>

      <!-- Position badges -->
      <div style="display:flex;gap:10px;align-items:center">
        ${hasStreams ? `
        <div style="text-align:center">
          <div style="font-size:9px;opacity:0.8;text-transform:uppercase;margin-bottom:4px">Stream Position</div>
          <div style="background:#fff;color:${pri};border-radius:50%;width:64px;height:64px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:900;box-shadow:0 2px 8px #0003">
            <div style="font-size:22px;line-height:1">${pos.streamPos || '—'}</div>
            <div style="font-size:9px;color:#64748b">/ ${pos.streamOf || '—'}</div>
          </div>
        </div>` : ''}
        <div style="text-align:center">
          <div style="font-size:9px;opacity:0.8;text-transform:uppercase;margin-bottom:4px">${hasStreams ? 'Overall Position' : 'Position'}</div>
          <div style="background:${acc};color:#fff;border-radius:50%;width:72px;height:72px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:900;box-shadow:0 2px 8px #0004">
            <div style="font-size:26px;line-height:1">${pos.overallPos || '—'}</div>
            <div style="font-size:10px;opacity:0.85">/ ${pos.overallOf || '—'}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick stats bar -->
    <div style="display:flex;gap:8px;margin-bottom:14px">
      <div style="flex:1;background:#f0f4ff;border:1px solid ${pri}30;border-radius:6px;padding:8px 12px;text-align:center">
        <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700">Total Marks</div>
        <div style="font-size:20px;font-weight:900;color:${pri}">${total}</div>
      </div>
      <div style="flex:1;background:#f0f4ff;border:1px solid ${pri}30;border-radius:6px;padding:8px 12px;text-align:center">
        <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700">Mean Score</div>
        <div style="font-size:20px;font-weight:900;color:${pri}">${mean}</div>
      </div>
      <div style="flex:1;background:${gradeColor(grade.label)}15;border:1px solid ${gradeColor(grade.label)}40;border-radius:6px;padding:8px 12px;text-align:center">
        <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700">CBC Grade</div>
        <div style="font-size:20px;font-weight:900;color:${gradeColor(grade.label)}">${grade.label}</div>
      </div>
      <div style="flex:1;background:#f0f4ff;border:1px solid ${pri}30;border-radius:6px;padding:8px 12px;text-align:center">
        <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700">Total Points</div>
        <div style="font-size:20px;font-weight:900;color:${pri}">${totalPoints}</div>
      </div>
      <div style="flex:1;background:#10b98112;border:1px solid #10b98140;border-radius:6px;padding:8px 12px;text-align:center">
        <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700">Best Subject</div>
        <div style="font-size:11px;font-weight:900;color:#10b981;line-height:1.3;margin-top:4px">${bestSub?.sub || '—'}<br/><span style="font-size:14px">${bestSub?.score ?? ''}</span></div>
      </div>
      <div style="flex:1;background:#ef444412;border:1px solid #ef444440;border-radius:6px;padding:8px 12px;text-align:center">
        <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700">Needs Work</div>
        <div style="font-size:11px;font-weight:900;color:#ef4444;line-height:1.3;margin-top:4px">${weakSub?.sub || '—'}<br/><span style="font-size:14px">${weakSub?.score ?? ''}</span></div>
      </div>
    </div>

    <!-- Subject table -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:12px">
      <thead>
        <tr style="background:${pri};color:#fff">
          <th style="padding:8px 10px;border:1px solid ${pri};text-align:left">Subject</th>
          <th style="padding:8px 10px;border:1px solid ${pri};text-align:center">Score</th>
          <th style="padding:8px 10px;border:1px solid ${pri};text-align:center">Grade</th>
          <th style="padding:8px 10px;border:1px solid ${pri};text-align:center">Points</th>
          <th style="padding:8px 10px;border:1px solid ${pri};text-align:center">Class Avg</th>
          <th style="padding:8px 10px;border:1px solid ${pri};text-align:center">vs Class</th>
          <th style="padding:8px 10px;border:1px solid ${pri};text-align:left">Teacher Remark</th>
        </tr>
      </thead>
      <tbody>
        ${subjectRows}
        <tr style="background:${pri}15;font-weight:900">
          <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:13px">TOTAL / MEAN</td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;text-align:center;font-size:16px;color:${pri}">${total}</td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;text-align:center">
            <span style="background:${gradeColor(grade.label)};color:#fff;padding:3px 10px;border-radius:10px;font-weight:800;font-size:13px">${grade.label}</span>
          </td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;text-align:center;font-size:14px">${totalPoints}</td>
          <td colspan="3" style="padding:8px 10px;border:1px solid #e2e8f0;font-size:11px;color:#555">
            Mean Score: <strong>${mean}</strong> &nbsp;·&nbsp; CBC Grade: <strong>${grade.label}</strong> (${grade.points} pts) &nbsp;·&nbsp; ${subs.length} subject${subs.length !== 1 ? 's' : ''}
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Trend -->
    ${prevExams.length > 0 ? `
    <div style="background:#fffbe6;border:1px solid #f59e0b50;border-radius:6px;padding:8px 14px;margin-bottom:14px;font-size:11px">
      <strong style="color:#b45309">📈 Performance Trend: </strong>
      ${prevExams.map(p => `${p.name}: <strong style="color:${gradeColor(p.grade.label)}">${p.grade.label} (${p.total})</strong>`).join(' → ')}
      → <strong style="color:${gradeColor(grade.label)}">This Exam: ${grade.label} (${total})</strong>
    </div>` : ''}

    <!-- Comments -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
      <tr>
        <td style="width:50%;padding:10px 14px;border:2px solid ${pri}30;border-radius:0;vertical-align:top">
          <div style="font-weight:800;color:${pri};font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Class Teacher's Comment</div>
          <div style="font-size:11px;color:#222;line-height:1.7">${autoClassTeacherComment(student.name, mean, grade, pos, subs.length)}</div>
        </td>
        <td style="width:50%;padding:10px 14px;border:2px solid ${pri}30;border-left:none;vertical-align:top">
          <div style="font-weight:800;color:${pri};font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Principal's Comment</div>
          <div style="font-size:11px;color:#222;line-height:1.7">${autoPrincipalComment(student.name, mean, grade, pos)}</div>
        </td>
      </tr>
    </table>

    <!-- Bottom info + stamp -->
    <div style="display:flex;gap:0;margin-bottom:0">
      <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;padding:8px 12px">
        <div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase">Next Term Begins</div>
        <div style="font-size:12px;font-weight:700;margin-top:2px">${nextTermDate}</div>
      </div>
      <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-left:none;padding:8px 12px">
        <div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase">Fees Balance</div>
        <div style="font-size:12px;font-weight:900;color:${feeColor};margin-top:2px">${feeStr}</div>
        ${feeExpected > 0 ? `<div style="font-size:9px;color:#94a3b8">Expected: KES ${feeExpected.toLocaleString()} · Paid: KES ${feePaid.toLocaleString()}</div>` : ''}
      </div>
      <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-left:none;padding:8px 12px">
        <div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase">Date Issued</div>
        <div style="font-size:12px;font-weight:700;margin-top:2px">${new Date().toLocaleDateString('en-KE', {day:'numeric',month:'long',year:'numeric'})}</div>
      </div>
      <div style="flex-shrink:0;display:flex;align-items:center;justify-content:center;padding:6px 10px;border:1px solid #e2e8f0;border-left:none;background:#f8fafc">
        ${data.schoolStamp?.enabled !== false ? renderSchoolStamp(data, { size: 72 }) : ''}
      </div>
    </div>

    <!-- Grade key -->
    <div style="margin-top:10px;padding:6px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;font-size:10px;color:#64748b;display:flex;gap:16px;flex-wrap:wrap">
      <strong>CBC Grade Key:</strong>
      <span><span style="color:#10b981;font-weight:700">EE (Exceeds Expectation)</span> = 75–100</span>
      <span><span style="color:#3b82f6;font-weight:700">ME (Meets Expectation)</span> = 50–74</span>
      <span><span style="color:#f59e0b;font-weight:700">AE (Approaches Expectation)</span> = 25–49</span>
      <span><span style="color:#ef4444;font-weight:700">BE (Below Expectation)</span> = 0–24</span>
    </div>

    <div class="no-print" style="margin-top:16px">
      <button onclick="window.print()" style="padding:10px 28px;background:${pri};color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600">
        🖨 Print Report Form
      </button>
    </div>
  </body></html>`);
  w.document.close();
}

/* ═══════════════════════════════════════════════════════
   BULK: PRINT ALL REPORT FORMS FOR A CLASS
   Sorted by overall position — position 1 first, last last
═══════════════════════════════════════════════════════ */
export function printAllReportForms(exam, data) {
  const students = (data.students || []).filter(s => s.class === exam.class);
  if (!students.length) { alert('No students in this class.'); return; }

  const { primary: pri, accent: acc } = schoolColors(data);
  const { posMap, hasStreams } = computeRankings(exam, data.students, data);
  const stream    = getStreamFromClass(exam.class, data);
  const baseClass = getBaseClass(exam.class, data);
  const nextTermDate = getNextTermDate(exam, data);

  // Sort students by overall position ascending (1 first)
  const sorted = [...students].sort((a, b) => {
    const pa = (posMap[a.name] || {}).overallPos || 9999;
    const pb = (posMap[b.name] || {}).overallPos || 9999;
    return pa - pb;
  });

  // Class averages per subject (stream)
  const streamStudents = students;
  const streamResults  = exam.results || {};
  const allSubsInExam  = [...new Set(
    Object.values(streamResults).flatMap(r => Object.keys(r))
  )];
  const classAvgMap = {};
  allSubsInExam.forEach(sub => {
    const scores = streamStudents
      .map(s => getScore((streamResults[s.name] || {})[sub]))
      .filter(v => v !== null && v !== undefined);
    classAvgMap[sub] = scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10
      : null;
  });

  const allPages = sorted.map(student => {
    const res  = streamResults[student.name] || {};
    const subs = Object.keys(res);
    if (!subs.length) return '';

    const total       = subs.reduce((a, k) => a + (getScore(res[k]) ?? 0), 0);
    const mean        = subs.length ? +(total / subs.length).toFixed(1) : 0;
    const grade       = getGrade(Math.round(mean));
    const totalPoints = subs.reduce((a, k) => a + getGrade(getScore(res[k]) ?? 0).points, 0);
    const pos         = posMap[student.name] || {};

    const feeBalance  = getFeeBalance(student, exam.term, exam.year, data);
    const feeExpected = getFeeExpected(student, exam.term, exam.year, data);
    const feePaid     = getFeePaid(student.id, exam.term, exam.year, data);
    const feeStr      = feeExpected > 0
      ? (feeBalance > 0 ? `KES ${feeBalance.toLocaleString()} (Balance)` : feeBalance < 0 ? `KES ${Math.abs(feeBalance).toLocaleString()} (Overpaid)` : 'CLEARED ✓')
      : 'N/A';
    const feeColor = feeBalance > 0 ? acc : '#10b981';

    const scored  = subs.map(k => ({ sub: k, score: getScore(res[k]) ?? 0 })).sort((a, b) => b.score - a.score);
    const bestSub = scored[0];
    const weakSub = scored[scored.length - 1];

    const subRows = subs.map((sub, idx) => {
      const score  = getScore(res[sub]);
      const g      = getGrade(score ?? 0);
      const clsAvg = classAvgMap[sub];
      const vs     = clsAvg !== null ? (score >= clsAvg ? '▲' : '▼') : '';
      const vsCol  = clsAvg !== null ? (score >= clsAvg ? '#10b981' : '#ef4444') : '#94a3b8';
      return `<tr style="background:${idx%2===0?'#fff':'#f8fafc'}">
        <td style="padding:5px 8px;border:1px solid #e2e8f0;font-weight:600;font-size:11px">${sub}</td>
        <td style="padding:5px 8px;border:1px solid #e2e8f0;text-align:center;font-weight:900;font-size:13px">${score ?? '—'}</td>
        <td style="padding:5px 8px;border:1px solid #e2e8f0;text-align:center">
          <span style="background:${gradeColor(g.label)}22;color:${gradeColor(g.label)};padding:2px 8px;border-radius:8px;font-weight:800;font-size:11px">${g.label}</span>
        </td>
        <td style="padding:5px 8px;border:1px solid #e2e8f0;text-align:center;font-weight:700">${g.points}</td>
        <td style="padding:5px 8px;border:1px solid #e2e8f0;text-align:center;font-size:10px;color:#64748b">${clsAvg !== null ? clsAvg : '—'}</td>
        <td style="padding:5px 8px;border:1px solid #e2e8f0;text-align:center;font-weight:900;color:${vsCol}">${vs}</td>
        <td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:10px;color:#555;font-style:italic">${autoSubjectComment(sub, score, g)}</td>
      </tr>`;
    }).join('');

    return `
      <div style="page-break-after:always;max-width:780px;margin:0 auto;padding:14px 0">
        ${schoolHeader(data)}

        <!-- Banner -->
        <div style="background:linear-gradient(135deg,${pri},${pri}cc);color:#fff;border-radius:8px;padding:12px 16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:10px;opacity:0.8;text-transform:uppercase">Student Academic Report</div>
            <div style="font-size:17px;font-weight:900;margin:3px 0">${student.name.toUpperCase()}</div>
            <div style="font-size:11px;opacity:0.85">${baseClass}${stream?' · '+stream:''} &nbsp;·&nbsp; Adm: ${student.admNo} &nbsp;·&nbsp; ${exam.name} · Term ${exam.term} · ${exam.year}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            ${hasStreams ? `<div style="text-align:center">
              <div style="font-size:8px;opacity:0.8;margin-bottom:3px">STREAM POS</div>
              <div style="background:#fff;color:${pri};border-radius:50%;width:52px;height:52px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:900">
                <div style="font-size:18px;line-height:1">${pos.streamPos||'—'}</div>
                <div style="font-size:8px;color:#64748b">/${pos.streamOf||'—'}</div>
              </div>
            </div>` : ''}
            <div style="text-align:center">
              <div style="font-size:8px;opacity:0.8;margin-bottom:3px">OVERALL POS</div>
              <div style="background:${acc};color:#fff;border-radius:50%;width:58px;height:58px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:900">
                <div style="font-size:20px;line-height:1">${pos.overallPos||'—'}</div>
                <div style="font-size:9px;opacity:0.85">/${pos.overallOf||'—'}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Stats bar -->
        <div style="display:flex;gap:6px;margin-bottom:10px">
          <div style="flex:1;background:#f0f4ff;border:1px solid ${pri}30;border-radius:5px;padding:6px 8px;text-align:center">
            <div style="font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase">Total</div>
            <div style="font-size:17px;font-weight:900;color:${pri}">${total}</div>
          </div>
          <div style="flex:1;background:#f0f4ff;border:1px solid ${pri}30;border-radius:5px;padding:6px 8px;text-align:center">
            <div style="font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase">Mean</div>
            <div style="font-size:17px;font-weight:900;color:${pri}">${mean}</div>
          </div>
          <div style="flex:1;background:${gradeColor(grade.label)}15;border:1px solid ${gradeColor(grade.label)}40;border-radius:5px;padding:6px 8px;text-align:center">
            <div style="font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase">Grade</div>
            <div style="font-size:17px;font-weight:900;color:${gradeColor(grade.label)}">${grade.label}</div>
          </div>
          <div style="flex:1;background:#f0f4ff;border:1px solid ${pri}30;border-radius:5px;padding:6px 8px;text-align:center">
            <div style="font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase">Points</div>
            <div style="font-size:17px;font-weight:900;color:${pri}">${totalPoints}</div>
          </div>
          <div style="flex:1;background:#10b98112;border:1px solid #10b98140;border-radius:5px;padding:6px 8px;text-align:center">
            <div style="font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase">Best</div>
            <div style="font-size:10px;font-weight:900;color:#10b981;margin-top:2px">${bestSub?.sub||'—'} <span style="font-size:13px">${bestSub?.score??''}</span></div>
          </div>
          <div style="flex:1;background:#ef444412;border:1px solid #ef444440;border-radius:5px;padding:6px 8px;text-align:center">
            <div style="font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase">Needs Work</div>
            <div style="font-size:10px;font-weight:900;color:#ef4444;margin-top:2px">${weakSub?.sub||'—'} <span style="font-size:13px">${weakSub?.score??''}</span></div>
          </div>
        </div>

        <!-- Subject table -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:10px;font-size:11px">
          <thead>
            <tr style="background:${pri};color:#fff">
              <th style="padding:6px 8px;border:1px solid ${pri};text-align:left">Subject</th>
              <th style="padding:6px 8px;border:1px solid ${pri};text-align:center">Score</th>
              <th style="padding:6px 8px;border:1px solid ${pri};text-align:center">Grade</th>
              <th style="padding:6px 8px;border:1px solid ${pri};text-align:center">Pts</th>
              <th style="padding:6px 8px;border:1px solid ${pri};text-align:center">Cls Avg</th>
              <th style="padding:6px 8px;border:1px solid ${pri};text-align:center">vs Cls</th>
              <th style="padding:6px 8px;border:1px solid ${pri};text-align:left">Remark</th>
            </tr>
          </thead>
          <tbody>
            ${subRows}
            <tr style="background:${pri}15;font-weight:900">
              <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:12px">TOTAL / MEAN</td>
              <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center;font-size:14px;color:${pri}">${total}</td>
              <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center">
                <span style="background:${gradeColor(grade.label)};color:#fff;padding:2px 8px;border-radius:8px;font-weight:800;font-size:12px">${grade.label}</span>
              </td>
              <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center;font-size:13px">${totalPoints}</td>
              <td colspan="3" style="padding:6px 8px;border:1px solid #e2e8f0;font-size:10px;color:#555">
                Mean: <strong>${mean}</strong> · Grade: <strong>${grade.label}</strong> (${grade.points} pts) · ${subs.length} subjects
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Comments -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
          <tr>
            <td style="width:50%;padding:8px 12px;border:2px solid ${pri}30;vertical-align:top">
              <div style="font-weight:800;color:${pri};font-size:10px;text-transform:uppercase;margin-bottom:5px">Class Teacher's Comment</div>
              <div style="font-size:11px;color:#222;line-height:1.6">${autoClassTeacherComment(student.name, mean, grade, pos, subs.length)}</div>
            </td>
            <td style="width:50%;padding:8px 12px;border:2px solid ${pri}30;border-left:none;vertical-align:top">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">
                <div style="flex:1">
                  <div style="font-weight:800;color:${pri};font-size:10px;text-transform:uppercase;margin-bottom:5px">Principal's Comment</div>
                  <div style="font-size:11px;color:#222;line-height:1.6">${autoPrincipalComment(student.name, mean, grade, pos)}</div>
                </div>
                <div style="flex-shrink:0">${data.schoolStamp?.enabled!==false?renderSchoolStamp(data,{size:60}):''}</div>
              </div>
            </td>
          </tr>
        </table>

        <!-- Footer bar -->
        <div style="display:flex;gap:0">
          <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;padding:6px 10px">
            <div style="font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase">Next Term Opens</div>
            <div style="font-size:11px;font-weight:700;margin-top:1px">${nextTermDate}</div>
          </div>
          ${getMidtermReportingDate(exam, data) ? `
          <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-left:none;padding:6px 10px">
            <div style="font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase">Midterm Reporting</div>
            <div style="font-size:11px;font-weight:700;margin-top:1px">${getMidtermReportingDate(exam, data)}</div>
          </div>` : ''}
          <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-left:none;padding:6px 10px">
            <div style="font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase">Fees Balance</div>
            <div style="font-size:11px;font-weight:900;color:${feeColor};margin-top:1px">${feeStr}</div>
          </div>
          <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-left:none;padding:6px 10px">
            <div style="font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase">Issued</div>
            <div style="font-size:11px;font-weight:700;margin-top:1px">${new Date().toLocaleDateString('en-KE')}</div>
          </div>
        </div>
      </div>`;
  }).join('');

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>All Reports — ${exam.class} — ${exam.name}</title>
    <style>
      ${PRINT_BASE_CSS}
      body { padding: 0; font-size: 11px; }
      .no-print { padding: 14px; background: #fff; border-bottom: 1px solid #eee; position: sticky; top: 0; z-index: 10; }
    </style>
  </head><body>
    <div class="no-print">
      <button onclick="window.print()" style="padding:10px 28px;background:${pri};color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600">
        🖨 Print All ${sorted.length} Reports (Sorted by Position)
      </button>
      <span style="margin-left:16px;font-size:12px;color:#64748b">${exam.class} · ${exam.name} · Position 1 first</span>
    </div>
    <div style="padding:14px">
      ${allPages}
    </div>
  </body></html>`);
  w.document.close();
}

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
/* ═══════════════════════════════════════════════════════
   TEACHER LOGIN EMAIL SHEET
   Prints a clean list of all teacher login credentials.
   Principal sticks this in the staffroom so teachers
   know their login email and can access the portal.
   Sorted alphabetically by name.
═══════════════════════════════════════════════════════ */
export function printTeacherLoginSheet(data) {
  const teachers = (data.teachers || [])
    .filter(t => t.staffType === 'teaching' || !t.staffType)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!teachers.length) { alert('No teaching staff found.'); return; }

  const { primary: pri, accent: acc } = schoolColors(data);
  const hdr = schoolHeader(data);

  const rows = teachers.map((t, i) => {
    const subjects = (t.subjects || []).map(s => s.subject).join(', ') || '—';
    const classOf  = t.classTeacherOf ? `Class Teacher: ${t.classTeacherOf}` : '';
    return `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
        <td style="padding:8px 10px;border:1px solid #e2e8f0;text-align:center;font-weight:700;color:${pri}">${i + 1}</td>
        <td style="padding:8px 10px;border:1px solid #e2e8f0;font-weight:700;font-size:13px">${t.name}</td>
        <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:12px;color:#1d4ed8;font-weight:600">${t.email || '—'}</td>
        <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:11px;color:#64748b;font-family:monospace">${t.staffId || '—'}</td>
        <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:11px;color:#555">${subjects}</td>
        <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:11px;color:#10b981;font-weight:600">${classOf}</td>
      </tr>`;
  }).join('');

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>Teacher Login Sheet — ${data.schoolName}</title>
    <style>
      ${PRINT_BASE_CSS}
      body { padding: 20px; max-width: 900px; margin: 0 auto; font-size: 12px; }
    </style>
  </head><body>
    ${hdr}

    <!-- Header banner -->
    <div style="background:${pri};color:#fff;border-radius:8px;padding:12px 18px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:16px;font-weight:900">📧 Teacher Login Credentials</div>
        <div style="font-size:11px;opacity:0.85;margin-top:3px">
          Confidential — For Staffroom Notice Board Only · ${teachers.length} Teaching Staff
        </div>
      </div>
      <div style="text-align:right;font-size:11px;opacity:0.85">
        Printed: ${new Date().toLocaleDateString('en-KE', { day:'numeric', month:'long', year:'numeric' })}
      </div>
    </div>

    <!-- Instructions box -->
    <div style="background:#fffbe6;border:1px solid #f59e0b50;border-radius:6px;padding:10px 14px;margin-bottom:16px;font-size:11px;color:#92400e">
      <strong>Instructions for teachers:</strong> Use your email address to log in at the school portal.
      Your default password is your Staff ID. Please change your password after first login.
      Contact the principal if you cannot access your account.
    </div>

    <!-- Login table -->
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr style="background:${pri};color:#fff">
          <th style="padding:8px 10px;border:1px solid ${pri};text-align:center;width:40px">#</th>
          <th style="padding:8px 10px;border:1px solid ${pri};text-align:left">Name</th>
          <th style="padding:8px 10px;border:1px solid ${pri};text-align:left">Login Email</th>
          <th style="padding:8px 10px;border:1px solid ${pri};text-align:left">Staff ID / Default Password</th>
          <th style="padding:8px 10px;border:1px solid ${pri};text-align:left">Subjects</th>
          <th style="padding:8px 10px;border:1px solid ${pri};text-align:left">Role</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <!-- Footer -->
    <div style="margin-top:16px;padding-top:10px;border-top:2px solid ${pri};display:flex;justify-content:space-between;font-size:10px;color:#94a3b8">
      <span>⚠ This document contains login credentials. Keep confidential.</span>
      <span>${data.schoolName} · EduManage Pro</span>
    </div>

    <div class="no-print" style="margin-top:16px;text-align:center">
      <button onclick="window.print()" style="padding:10px 28px;background:${pri};color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600">
        🖨 Print Login Sheet
      </button>
    </div>
  </body></html>`);
  w.document.close();
}

   /* ═══════════════════════════════════════════════════════
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
