import * as XLSX from 'xlsx';
import { generateAdmNo, generateSLC, getStreamFromClass, getScore } from '../data/initialData';

/* ═══════════════════════════════════════════════════════════════
   MARKSHEET DOWNLOAD / UPLOAD
   ───────────────────────────
   Lets a principal or class teacher generate ONE Excel file per
   class+exam with every subject (and Paper 1/2 split columns) as
   columns and every student in the class as a row, hand it out to
   be filled in (by hand, on a phone, printed — whatever works),
   then upload it back. On upload we work out exactly which exam,
   which class and which students it belongs to, and any admission
   number/name on the sheet that isn't already a student gets
   created and slotted into the right class automatically.

   File shape (all in ONE sheet, so it survives round-tripping
   through phone spreadsheet apps that don't preserve multi-sheet
   workbooks):

     Row 1   Title
     Row 2   School:  <name>
     Row 3   Class: <class>   Exam: <name>   Term: <n>   Year: <n>
     Row 4   Exam ID: <id>          <- the anchor used to match the exam back up
     Row 5   Instructions
     Row 6   (blank)
     Row 7   __KEY__ , '' , <col.key for each subject column>      <- machine row, never shown to fill in
     Row 8   Adm No , Name , <col.label for each subject column>   <- human header
     Row 9+  <admNo> , <name> , <scores...>

   Matching the key row and the header/data rows by COLUMN POSITION
   (not by name) means the file still parses correctly even if a
   column gets deleted entirely — deleting a column shifts every
   row in that sheet the same way, key row included.
═══════════════════════════════════════════════════════════════ */

const KEY_MARKER = '__KEY__';

function safeFileName(s) {
  return String(s || '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'sheet';
}

/**
 * Build and trigger download of the marksheet workbook for one exam,
 * one class, and a given set of entry columns (already scoped to
 * whatever subjects the current user is allowed to enter — see
 * getEntryColumns in initialData.js).
 */
export function downloadMarksheet(exam, data, classStudents, cols) {
  if (!cols || cols.length === 0) { alert('No subjects available to include on this marksheet.'); return; }

  const aoa = [];
  aoa.push(['EDUMANAGE MARKSHEET']);
  aoa.push(['School:', data.schoolName || '']);
  aoa.push(['Class:', exam.class, 'Exam:', exam.name, 'Term:', String(exam.term), 'Year:', String(exam.year)]);
  aoa.push(['Exam ID:', String(exam.id)]);
  aoa.push(['Instructions:', 'Fill in scores 0–100 in the columns below. Do NOT rename, reorder or delete columns. To add a new student, add a new row at the bottom with their Admission No (leave blank if none yet) and full Name.']);
  aoa.push([]);
  aoa.push([KEY_MARKER, '', ...cols.map(c => c.key)]);
  aoa.push(['Adm No', 'Name', ...cols.map(c => c.label)]);

  classStudents.forEach(st => {
    const existing = exam.results?.[st.name] || {};
    aoa.push([
      st.admNo || '',
      st.name,
      ...cols.map(c => getScore(existing[c.key]) ?? ''),
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 14 }, { wch: 26 },
    ...cols.map(c => ({ wch: Math.max(String(c.label).length + 2, 12) })),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Marksheet');
  const fname = `${safeFileName(exam.name)}_${safeFileName(exam.class)}_Marksheet.xlsx`;
  XLSX.writeFile(wb, fname);
}

/**
 * Read an uploaded marksheet file (File object) and resolve it into
 * { examId, className, examName, term, year, keys, rows } where rows
 * is [{ rowNum, admNo, name, scores: { [key]: rawValue } }].
 * Returns a Promise; rejects with a plain error message string on
 * anything that isn't a recognisable EduManage marksheet.
 */
export function parseMarksheetFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'binary', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (!aoa.length) { reject('File is empty.'); return; }

        // Pull out labelled meta fields wherever they land in the first
        // ~10 rows, scanning cell-pairs (label, value) across each row —
        // robust to exact column position.
        const meta = {};
        for (let r = 0; r < Math.min(10, aoa.length); r++) {
          const row = aoa[r];
          for (let c = 0; c < row.length - 1; c++) {
            const label = String(row[c] || '').trim().toLowerCase().replace(/:$/, '');
            if (['class', 'exam', 'exam id', 'term', 'year', 'school'].includes(label) && meta[label] === undefined) {
              meta[label] = String(row[c + 1] ?? '').trim();
            }
          }
        }

        const keyRowIdx = aoa.findIndex(row => String(row[0] || '').trim().toUpperCase() === KEY_MARKER);
        if (keyRowIdx === -1) {
          reject('This does not look like a valid EduManage marksheet — the file is missing its key row. Please upload a file that was downloaded from EduManage (do not remove or reorder rows/columns).');
          return;
        }
        const keys = aoa[keyRowIdx].slice(2);
        const dataRows = aoa.slice(keyRowIdx + 2).filter(r => r.some(cell => String(cell).trim() !== ''));

        const rows = dataRows.map((r, i) => {
          const scores = {};
          keys.forEach((k, ci) => { scores[k] = r[2 + ci]; });
          return {
            rowNum: keyRowIdx + 2 + i + 1,
            admNo: String(r[0] ?? '').trim(),
            name: String(r[1] ?? '').trim(),
            scores,
          };
        });

        resolve({
          examId: meta['exam id'] || '',
          className: meta['class'] || '',
          examName: meta['exam'] || '',
          term: meta['term'] || '',
          year: meta['year'] || '',
          keys,
          rows,
        });
      } catch (err) {
        reject('Could not read file: ' + err.message);
      }
    };
    reader.onerror = () => reject('Could not read file.');
    reader.readAsBinaryString(file);
  });
}

/**
 * Reconcile a parsed marksheet against the currently live exam + roster:
 *  - matches each row to an existing student in this exam's class, by
 *    admission number first, then by exact name
 *  - any row that matches neither is treated as a NEW student who came
 *    in through this exam: created and assigned to the exam's class,
 *    with an admission number generated if the sheet didn't carry one
 *    and the school's admission mode allows that
 *  - builds the flat list of { studentName, subject, score, submittedBy,
 *    locked } patches ready for applyExamScorePatch, for every valid
 *    score cell (existing students AND brand-new ones alike)
 *
 * Returns { patches, newStudents, matchedCount, warnings, mismatches }.
 * Nothing here touches the database — it's pure reconciliation so the
 * caller can show a preview before committing anything.
 */
export function reconcileMarksheet(parsed, exam, data, cols, submittedBy) {
  const warnings  = [];
  const mismatches = [];

  if (parsed.examId && String(parsed.examId) !== String(exam.id)) {
    mismatches.push(`This file was downloaded for a different exam (ID ${parsed.examId}). You're about to import it into "${exam.name}" — make sure that's really what you want.`);
  }
  if (parsed.className && parsed.className.toLowerCase() !== String(exam.class).toLowerCase()) {
    mismatches.push(`This file was downloaded for class "${parsed.className}", not "${exam.class}". Marks and new students will be recorded under ${exam.class}.`);
  }

  const colByKey = {};
  cols.forEach(c => { colByKey[c.key] = c; });

  const classStudents = (data.students || []).filter(s => s.class === exam.class);
  const admIndex  = new Map(classStudents.filter(s => s.admNo).map(s => [s.admNo.trim().toLowerCase(), s]));
  const nameIndex = new Map(classStudents.map(s => [String(s.name || '').trim().toLowerCase(), s]));

  const patches = [];
  const newStudents = [];
  let matchedCount = 0;

  function addScorePatches(studentName, row) {
    cols.forEach(col => {
      const raw = row.scores[col.key];
      if (raw === '' || raw === null || raw === undefined) return;
      const v = Number(raw);
      if (isNaN(v) || v < 0 || v > 100) {
        warnings.push(`Row ${row.rowNum} (${studentName || row.name || '—'}): invalid score "${raw}" for ${col.label} — skipped, must be 0–100.`);
        return;
      }
      patches.push({ studentName, subject: col.key, score: v, submittedBy, locked: false });
    });
  }

  parsed.rows.forEach(row => {
    if (!row.admNo && !row.name) return; // blank spacer row

    let existing = row.admNo ? admIndex.get(row.admNo.trim().toLowerCase()) : null;
    if (!existing && row.name) existing = nameIndex.get(row.name.trim().toLowerCase());

    if (existing) {
      matchedCount++;
      addScorePatches(existing.name, row);
      return;
    }

    // New student found on the marksheet.
    if (!row.name) {
      warnings.push(`Row ${row.rowNum}: admission number "${row.admNo}" doesn't match any student in ${exam.class}, and no name was given — skipped.`);
      return;
    }
    // Guard against the same new name appearing twice in this upload.
    if (newStudents.some(s => s.name.toLowerCase() === row.name.toLowerCase())) {
      addScorePatches(row.name, row);
      return;
    }

    // Admission number logic — mirrors the same-named logic in the
    // Students bulk-upload screen so a new student created from a
    // marksheet ends up looking exactly like one created any other way.
    const admMode = data.admissionSetting || 'manual';
    let admNo = row.admNo;
    let internalId = '';
    if (admMode === 'manual') {
      if (!admNo) {
        warnings.push(`Row ${row.rowNum}: "${row.name}" looks like a new student but has no Admission No, and this school requires one — add it to the sheet and re-upload, or add the student manually first.`);
        return;
      }
    } else if (admMode === 'auto') {
      // Auto mode assigns admission numbers itself — ignores anything typed.
      admNo = generateAdmNo(data, [...data.students, ...newStudents]);
    } else {
      // mixed: use what's on the sheet if present, else a hidden internal id.
      if (!admNo) internalId = `INT-${Date.now()}-${newStudents.length}-${Math.random().toString(36).slice(2, 7)}`;
    }

    const stream = getStreamFromClass(exam.class, data) || '';
    const newStudent = {
      id: Date.now() + newStudents.length + Math.random(),
      firstName: row.name, lastName: '', otherName: '',
      name: row.name,
      admNo: admNo || '', internalId,
      slc: generateSLC([...classStudents, ...newStudents]),
      class: exam.class, stream,
      dob: '', parentName: '', parentPhone: '', parentEmail: '',
      joined: String(exam.year || new Date().getFullYear()),
      fees: { paid: 0, total: 0 }, cases: [],
      status: 'active',
    };
    newStudents.push(newStudent);
    addScorePatches(newStudent.name, row);
  });

  return { patches, newStudents, matchedCount, warnings, mismatches };
}
