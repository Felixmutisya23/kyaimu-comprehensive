import { getGrade, getScore, getSiblingStreams, getStreamFromClass, getBaseClass } from '../data/initialData';

function formatDate(dateStr) {
  if (!dateStr) return '___________________________';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const day = d.getDate();
  const suffix = day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th';
  return d.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' }).replace(/^/, `${day}${suffix} `);
}

function getTermDates(exam, data) {
  const terms = data.terms || [];
  const cur = terms.find(t => Number(t.term) === Number(exam.term) && Number(t.year) === Number(exam.year));
  // Next term: same year term+1, or year+1 term 1
  const nextTerm = Number(exam.term) + 1;
  const nextYear = nextTerm > 3 ? Number(exam.year) + 1 : Number(exam.year);
  const nextTermNum = nextTerm > 3 ? 1 : nextTerm;
  const next = terms.find(t => Number(t.term) === nextTermNum && Number(t.year) === nextYear);
  return {
    closingDate: cur?.endDate ? formatDate(cur.endDate) : '___________________________',
    nextTermBegins: next?.startDate ? formatDate(next.startDate) : '___________________________',
  };
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
   COMPUTE RANKINGS — used by both class list and report
═══════════════════════════════════════════════════════ */
export function computeRankings(exam, allStudents, data) {
  const siblingClasses = getSiblingStreams(exam.class, data);
  const hasStreams      = siblingClasses.length > 1;

  function calcStats(studentName) {
    const res   = exam.results[studentName] || {};
    const subs  = Object.keys(res);
    const total = subs.reduce((a, k) => a + (getScore(res[k]) ?? 0), 0);
    const mean  = subs.length ? +(total / subs.length).toFixed(1) : 0;
    return { total, mean, grade: getGrade(Math.round(mean)), results: res, subjects: subs };
  }

  // Overall: across ALL sibling streams
  const allSiblingStudents = allStudents.filter(s => siblingClasses.includes(s.class));
  const overallSorted = [...allSiblingStudents]
    .map(s => ({ name: s.name, ...calcStats(s.name) }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  // Stream: within this exam's class only
  const streamStudents = allStudents.filter(s => s.class === exam.class);
  const streamSorted = [...streamStudents]
    .map(s => ({ name: s.name, ...calcStats(s.name) }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  // Build map: studentName → { overallPos, streamPos }
  const posMap = {};
  overallSorted.forEach((s, i) => { posMap[s.name] = { overallPos: i + 1, overallOf: overallSorted.length }; });
  streamSorted.forEach((s, i) => {
    if (posMap[s.name]) {
      posMap[s.name].streamPos = i + 1;
      posMap[s.name].streamOf  = streamSorted.length;
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

  // Shorten subject names for column headers
  function shortSubject(s) {
    const MAP = {
      'English': 'ENG', 'Kiswahili': 'KISW', 'Mathematics': 'MATH',
      'Integrated Science': 'INTEG', 'Pre-Technical Studies': 'PRETECH',
      'Social Studies': 'SST', 'Creative Arts': 'CA', 'CRE': 'CRE',
      'Agriculture': 'AGRI', 'Physical Education': 'PE',
      'Computer Studies': 'COMP', 'Business Studies': 'BST',
      'Home Science': 'H.SC', 'Music': 'MUS', 'Art': 'ART',
    };
    return MAP[s] || s.substring(0, 6).toUpperCase();
  }

  // Compute positions
  const { posMap } = computeRankings(exam, data.students, data);

  const subHeaders = subjects.map(s =>
    `<th style="${TH}">${shortSubject(s)}</th>`
  ).join('');

  const rows = ranked.map((s, idx) => {
    const bg      = idx % 2 === 0 ? '#ffffff' : '#f0f4ff';
    const pos     = posMap[s.name] || {};
    const streamLbl = stream || getStreamFromClass(s.class, data) || '-';

    const subCells = subjects.map(sub => {
      const cell  = s.results[sub];
      const score = getScore(cell);
      const g     = score !== null && score !== undefined ? getGrade(score) : null;
      return score !== null && score !== undefined
        ? `<td style="${TD}background:${bg}">${score}<sup style="color:#cc0000;font-size:7px;font-weight:900">${g.label}</sup></td>`
        : `<td style="${TD}background:${bg};color:#999">-</td>`;
    }).join('');

    const totalG = getGrade(Math.round(s.mean));
    return `<tr>
      <td style="${TD}background:${bg};font-weight:700;color:#003399">${s.admNo}</td>
      <td style="${TD}background:${bg};font-weight:700;text-align:left;padding-left:8px;white-space:nowrap">${s.name.toUpperCase()}</td>
      ${subCells}
      <td style="${TD}background:${bg};font-weight:900;font-size:11px">${s.total}<sup style="color:#cc0000;font-size:7px;font-weight:900">${totalG.label}</sup></td>
      <td style="${TD}background:${bg};font-weight:700;color:#003399">${pos.overallPos || '-'}</td>
      <td style="${TD}background:${bg};font-weight:700;color:#7c3aed">${pos.streamPos || '-'}</td>
      <td style="${TD}background:${bg};font-weight:700">${streamLbl}</td>
    </tr>`;
  }).join('');

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>Class List — ${exam.name} — ${classLabel}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; padding: 16px; color: #111; }
      @page { size: A4 landscape; margin: 12mm; }
      @media print { body { padding: 0; } .no-print { display: none !important; } }
      .no-print { margin-top: 16px; text-align: center; }
    </style>
  </head><body>
    ${schoolHeader(data)}
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin:8px 0 4px;font-size:12px">
      <div>
        <strong>EXAMS :-</strong> ${exam.name.toUpperCase()}
        &nbsp;&nbsp;&nbsp;&nbsp;
        <strong>TERM:-</strong> ${exam.termLabel || `Term ${exam.term} of Year ${exam.year}`}
      </div>
      <div style="font-size:11px;color:#555">Total Students: ${ranked.length}</div>
    </div>
    <div style="font-size:13px;font-weight:700;margin-bottom:8px;color:#003399">${classLabel}</div>
    <table style="width:100%;border-collapse:collapse;font-size:10px">
      <thead>
        <tr style="background:#cc0000;color:#fff;font-size:10px">
          <th style="${TH}">ADM<br>NO</th>
          <th style="${TH}text-align:left;padding-left:8px">STUDENT</th>
          ${subHeaders}
          <th style="${TH}">TOTAL</th>
          <th style="${TH}">POS</th>
          <th style="${TH}">STRM<br>POS</th>
          <th style="${TH}">STRM</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="display:flex;justify-content:space-between;margin-top:14px;font-size:10px;color:#555;border-top:1px solid #ccc;padding-top:8px">
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

const TH = 'border:1px solid #aaa;padding:5px 3px;text-align:center;font-size:9px;font-weight:700;white-space:nowrap;';
const TD = 'border:1px solid #ccc;padding:4px 3px;text-align:center;font-size:10px;';

/* ═══════════════════════════════════════════════════════
   INDIVIDUAL STUDENT REPORT FORM
═══════════════════════════════════════════════════════ */
export function printReportForm(student, exam, data, { classTeacherComment = '', principalComment = '' } = {}) {
  const res  = exam.results[student.name] || {};
  const subs = Object.keys(res);
  if (!subs.length) { alert('No results recorded for this student in this exam.'); return; }

  const stream    = getStreamFromClass(exam.class, data);
  const baseClass = getBaseClass(exam.class, data);

  // Compute positions
  const { posMap, overallSorted } = computeRankings(exam, data.students, data);
  const pos = posMap[student.name] || {};

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

  // Subject rows
  const subjectRows = subs.map(sub => {
    const cell    = res[sub];
    const score   = getScore(cell);
    const g       = getGrade(score ?? 0);
    const teacher = cell?.submittedBy ? data.teachers?.find(t => t.staffId === cell.submittedBy) : null;
    const remark  = g.points >= 7 ? 'Excellent' : g.points >= 5 ? 'Good' : g.points >= 3 ? 'Average' : 'Below Average';
    return `
      <tr style="background:${subs.indexOf(sub) % 2 === 0 ? '#fff' : '#f8f9ff'}">
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:left;font-weight:600">${sub}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;font-weight:900;font-size:13px">${score ?? '—'}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;font-weight:900;color:#cc0000">${g.label}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:center">${g.points}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:left;font-size:10px;color:#555">${remark}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:left;font-size:10px;color:#777">${teacher?.name || ''}</td>
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
        <td class="lbl">Stream</td>
        <td>${stream || '—'}</td>
      </tr>
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
      </tr>
    </table>

    <table style="margin-bottom:14px">
      <thead>
        <tr style="background:#003399;color:#fff">
          <th style="padding:7px 10px;text-align:left;border:1px solid #003399">Subject</th>
          <th style="padding:7px 10px;border:1px solid #003399">Score</th>
          <th style="padding:7px 10px;border:1px solid #003399">Grade</th>
          <th style="padding:7px 10px;border:1px solid #003399">Points</th>
          <th style="padding:7px 10px;text-align:left;border:1px solid #003399">Remarks</th>
          <th style="padding:7px 10px;text-align:left;border:1px solid #003399">Subject Teacher</th>
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
          <div style="min-height:48px;margin-bottom:16px;font-size:12px;color:#333">\${classTeacherComment || ''}</div>
          <div style="border-top:1px solid #999;padding-top:6px;font-size:10px;color:#555">
            Name: ___________________________ &nbsp; Sign: _______________
          </div>
        </td>
        <td style="width:50%;padding:10px;border:1px solid #ccc;vertical-align:top">
          <div style="font-weight:700;color:#003399;margin-bottom:6px;font-size:11px;text-transform:uppercase">Principal's Comment</div>
          <div style="min-height:48px;margin-bottom:16px;font-size:12px;color:#333">\${principalComment || ''}</div>
          <div style="border-top:1px solid #999;padding-top:6px;font-size:10px;color:#555">
            Sign: ___________________________ &nbsp; Stamp: 
            <span style="border:1px solid #ccc;display:inline-block;width:60px;height:24px"></span>
          </div>
        </td>
      </tr>
      <tr>
        <td colspan="2" style="padding:10px;border:1px solid #ccc;vertical-align:top">
          <div style="font-weight:700;color:#003399;margin-bottom:6px;font-size:11px;text-transform:uppercase">Parent / Guardian Comment &amp; Acknowledgement</div>
          <div style="min-height:36px;margin-bottom:12px"></div>
          <div style="display:flex;justify-content:space-between;border-top:1px solid #999;padding-top:6px;font-size:10px;color:#555">
            <span>Sign: ___________________________</span>
            <span>Date: ___________________________</span>
          </div>
        </td>
      </tr>
    </table>

    <table style="font-size:11px;margin-top:4px">
      <tr>
        <td style="padding:6px 10px;border:1px solid #ccc;background:#f0f4ff">
          <strong>Next Term Begins:</strong> \${getTermDates(exam, data).nextTermBegins}
        </td>
        <td style="padding:6px 10px;border:1px solid #ccc;background:#f0f4ff">
          <strong>Closing Date:</strong> \${getTermDates(exam, data).closingDate}
        </td>
        <td style="padding:6px 10px;border:1px solid #ccc;background:#fff0f0">
          <strong>Fees Balance:</strong> KES ___________________________
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
export function printAllReportForms(exam, data, { defaultCtComment = '', defaultPrincipalComment = '', combined = false } = {}) {
  const siblingClasses = getSiblingStreams(exam.class, data);
  const students = combined
    ? data.students.filter(s => siblingClasses.includes(s.class))
    : data.students.filter(s => s.class === exam.class);
  if (students.length === 0) { alert('No students in this class.'); return; }

  const { posMap } = computeRankings(exam, data.students, data);
  const stream    = getStreamFromClass(exam.class, data);
  const baseClass = getBaseClass(exam.class, data);

  const allPages = students.map(student => {
    const res  = exam.results[student.name] || {};
    const subs = Object.keys(res);
    if (!subs.length) return '';

    const total = subs.reduce((a, k) => a + (getScore(res[k]) ?? 0), 0);
    const mean  = subs.length ? +(total / subs.length).toFixed(1) : 0;
    const grade = getGrade(Math.round(mean));
    const pos   = posMap[student.name] || {};

    const rows = subs.map(sub => {
      const score = getScore(res[sub]);
      const g     = getGrade(score ?? 0);
      const t     = res[sub]?.submittedBy ? data.teachers?.find(x => x.staffId === res[sub].submittedBy) : null;
      return `<tr>
        <td style="padding:5px 8px;border:1px solid #ddd;font-weight:600">${sub}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;text-align:center;font-weight:900">${score ?? '—'}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;text-align:center;font-weight:900;color:#cc0000">${g.label}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;text-align:center">${g.points}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;font-size:10px;color:#777">${t?.name || ''}</td>
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
            <td style="padding:5px 8px;border:1px solid #ddd;background:#f0f4ff;font-weight:700;color:#003399">Stream Position</td>
            <td style="padding:5px 8px;border:1px solid #ddd"><strong style="font-size:16px;color:#003399">${pos.streamPos || '—'}</strong> / ${pos.streamOf || '—'}</td>
          </tr>
        </table>
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:11px">
          <thead><tr style="background:#003399;color:#fff">
            <th style="padding:6px 8px;text-align:left;border:1px solid #003399">Subject</th>
            <th style="padding:6px 8px;border:1px solid #003399">Score</th>
            <th style="padding:6px 8px;border:1px solid #003399">Grade</th>
            <th style="padding:6px 8px;border:1px solid #003399">Points</th>
            <th style="padding:6px 8px;text-align:left;border:1px solid #003399">Subject Teacher</th>
          </tr></thead>
          <tbody>${rows}
            <tr style="background:#e8eeff;font-weight:900">
              <td style="padding:6px 8px;border:1px solid #ddd">TOTAL / MEAN</td>
              <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-size:14px">${total}</td>
              <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;color:#cc0000;font-size:13px">${grade.label}</td>
              <td style="padding:6px 8px;border:1px solid #ddd;text-align:center">${grade.points}</td>
              <td style="padding:6px 8px;border:1px solid #ddd"></td>
            </tr>
          </tbody>
        </table>
        <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:10px">
          <tr>
            <td style="padding:8px;border:1px solid #ccc;width:50%;vertical-align:top">
              <strong style="color:#003399">Class Teacher's Comment:</strong>
              <div style="min-height:32px;font-size:12px;color:#333;padding:4px 0">\${exam.studentComments?.[student.name]?.classTeacher || defaultCtComment || ''}</div>
              <div style="border-top:1px solid #ccc;padding-top:4px;font-size:10px">Sign: _____________________ Date: ____________</div>
            </td>
            <td style="padding:8px;border:1px solid #ccc;width:50%;vertical-align:top">
              <strong style="color:#003399">Principal's Comment:</strong>
              <div style="min-height:32px;font-size:12px;color:#333;padding:4px 0">\${exam.studentComments?.[student.name]?.principal || defaultPrincipalComment || ''}</div>
              <div style="border-top:1px solid #ccc;padding-top:4px;font-size:10px">Sign: ___________________ Stamp: <span style="border:1px solid #ccc;display:inline-block;width:40px;height:18px"></span></div>
            </td>
          </tr>
        </table>
        <table style="width:100%;border-collapse:collapse;font-size:10px">
          <tr>
            <td style="padding:5px 8px;border:1px solid #ccc;background:#f0f4ff"><strong>Next Term Begins:</strong> \${getTermDates(exam, data).nextTermBegins}</td>
            <td style="padding:5px 8px;border:1px solid #ccc;background:#fff0f0"><strong>Fees Balance:</strong> KES ___________________</td>
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
  const students = data.students.filter(s => s.class === exam.class);
  // Gather all subjects in this exam
  const allSubjects = [...new Set(
    Object.values(exam.results).flatMap(r => Object.keys(r))
  )];

  // Compute stats per subject
  const subjectStats = allSubjects.map(sub => {
    const scores = students
      .map(s => {
        const cell = exam.results[s.name]?.[sub];
        return getScore(cell);
      })
      .filter(v => v !== null && v !== undefined);
    const avg   = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const max   = scores.length ? Math.max(...scores) : 0;
    const min   = scores.length ? Math.min(...scores) : 0;
    const above50 = scores.filter(s => s >= 43).length; // AE or above
    return {
      subject: sub, avg: Math.round(avg * 10) / 10, max, min,
      count: scores.length, above50, grade: getGrade(Math.round(avg)),
      percent: scores.length ? Math.round((above50 / scores.length) * 100) : 0,
    };
  }).sort((a, b) => b.avg - a.avg);

  const rows = subjectStats.map((s, i) => {
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

  // Student scores per subject sorted best→worst
  const studentRows = students.map(student => {
    const cells = subjectStats.map(({ subject }) => {
      const cell  = exam.results[student.name]?.[subject];
      const score = getScore(cell);
      const g     = score !== null ? getGrade(score) : null;
      return `<td style="padding:4px 6px;border:1px solid #ddd;text-align:center;font-size:11px">
        ${score !== null ? `<strong>${score}</strong><sup style="color:#cc0000;font-size:7px">${g.label}</sup>` : '—'}
      </td>`;
    }).join('');
    const total = subjectStats.reduce((a, {subject}) => {
      const cell  = exam.results[student.name]?.[subject];
      const score = getScore(cell);
      return a + (score ?? 0);
    }, 0);
    const mean = subjectStats.length ? Math.round(total / subjectStats.length) : 0;
    return `<tr>
      <td style="padding:4px 6px;border:1px solid #ddd;font-weight:700;font-size:11px">${student.admNo}</td>
      <td style="padding:4px 6px;border:1px solid #ddd;font-weight:700;text-align:left;font-size:11px">${student.name.toUpperCase()}</td>
      ${cells}
      <td style="padding:4px 6px;border:1px solid #ddd;font-weight:900;text-align:center;color:#003399">${mean}</td>
    </tr>`;
  }).join('');

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Subject Performance — ${exam.name} — ${exam.class}</title>
  <style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px}@page{size:A4 landscape;margin:12mm}@media print{body{padding:0}.np{display:none}}</style>
  </head><body>
  ${schoolHeader(data)}
  <h3 style="text-align:center;color:#003399;text-transform:uppercase;font-size:14px;margin:8px 0">
    Subject Performance Analysis — ${exam.name} — ${exam.class}
  </h3>
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
    <thead><tr style="background:#003399;color:#fff">
      <th style="padding:7px;border:1px solid #003399">#</th>
      <th style="padding:7px;border:1px solid #003399;text-align:left">Subject</th>
      <th style="padding:7px;border:1px solid #003399">Class Average</th>
      <th style="padding:7px;border:1px solid #003399">Grade</th>
      <th style="padding:7px;border:1px solid #003399">Highest</th>
      <th style="padding:7px;border:1px solid #003399">Lowest</th>
      <th style="padding:7px;border:1px solid #003399">Count</th>
      <th style="padding:7px;border:1px solid #003399">Pass Rate</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <h4 style="color:#003399;margin-bottom:8px">Student Scores (Subjects ordered: Best → Weakest)</h4>
  <table style="width:100%;border-collapse:collapse;font-size:10px">
    <thead><tr style="background:#cc0000;color:#fff">
      <th style="padding:5px;border:1px solid #cc0000">ADM</th>
      <th style="padding:5px;border:1px solid #cc0000;text-align:left">STUDENT</th>
      ${subjectStats.map(s => `<th style="padding:5px;border:1px solid #cc0000;white-space:nowrap">${s.subject.substring(0,8)}</th>`).join('')}
      <th style="padding:5px;border:1px solid #cc0000">MEAN</th>
    </tr></thead>
    <tbody>${studentRows}</tbody>
  </table>
  <div class="np" style="margin-top:16px;text-align:center">
    <button onclick="window.print()" style="padding:10px 28px;background:#003399;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600">🖨 Print Report</button>
  </div>
  </body></html>`);
  w.document.close();
}

export function printFeeReceipt(payment, student, data) {
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
        <tr><td style="padding:7px 0;color:#555">Term:</td><td>Term ${payment.term}</td></tr>
        <tr><td style="padding:7px 0;color:#555">Payment Method:</td><td>${payment.method}</td></tr>
        <tr style="border-top:2px solid #003399">
          <td style="padding:12px 0;font-weight:700;font-size:14px;color:#003399">Amount Paid:</td>
          <td style="font-weight:900;font-size:20px;color:#10b981">KES ${Number(payment.amount).toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding:7px 0;color:#555">Total Fee:</td>
          <td>KES ${student.fees.total.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding:7px 0;color:#555">Balance:</td>
          <td style="font-weight:700;color:${student.fees.paid >= student.fees.total ? '#10b981' : '#ef4444'}">
            KES ${(student.fees.total - student.fees.paid).toLocaleString()}
            ${student.fees.paid >= student.fees.total ? ' ✓ FULLY PAID' : ''}
          </td>
        </tr>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:40px;font-size:12px;color:#555">
      <div style="text-align:center">
        <div style="border-top:1px solid #333;padding-top:6px;width:160px">Received By</div>
      </div>
      <div style="text-align:center">
        <div style="border-top:1px solid #333;padding-top:6px;width:160px">Accounts / Bursar</div>
      </div>
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
    <div style="display:flex;justify-content:space-between;margin-top:60px">
      <div style="text-align:center">
        <div style="border-top:1px solid #333;padding-top:8px;width:200px;font-size:12px;color:#555">Class Teacher</div>
      </div>
      <div style="text-align:center">
        <div style="border-top:1px solid #333;padding-top:8px;width:200px;font-size:12px;color:#555">
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
