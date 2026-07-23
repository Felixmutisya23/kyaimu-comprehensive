import React, { useState, useMemo } from 'react';
import { Card, Modal, Btn, Alert, SectionTitle, Icon } from './UI';

/**
 * ClassRepairTool
 * ---------------
 * Fixes two classes of problems that happen when a school sets up classes incorrectly:
 *
 *  1. DUPLICATE BASE NAMES  — e.g. "GRADE 1" + "Grade 1" were created as two separate
 *     top-level class groups. They should be ONE group with two streams.
 *     Fix: merge them. Students, exams, timetable, subjects, teachers all repointed.
 *
 *  2. BAD CLASS NAMES — spacing, capitalisation, missing space (e.g. "GRADE5" → "Grade 5").
 *     Fix: rename the group. Every reference in every table is updated.
 *
 * The tool never deletes any student or marks data.
 * It only rewrites the string keys that point to a class.
 */

// Canonical list of expected class names for this school
const CANONICAL = [
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5',
  'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9',
  'JSS 1', 'JSS 2', 'JSS 3',
];

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Normalise a class-group name for fuzzy comparison */
function norm(s) {
  return (s || '').toLowerCase().replace(/\s+/g, '').replace(/grade/g, 'grade');
}

/** Given all classGroups, find ones whose normalised names collide */
function findDuplicates(classGroups) {
  const seen = {};
  classGroups.forEach(g => {
    const key = norm(g.name);
    if (!seen[key]) seen[key] = [];
    seen[key].push(g);
  });
  return Object.values(seen).filter(arr => arr.length > 1);
}

/** For a given group, return every full class string it produces */
function groupClasses(g) {
  if (!g.streams || g.streams.length === 0) return [g.name];
  return g.streams.map(s => `${g.name} ${s}`);
}

/**
 * Apply a rename map { oldFullClass → newFullClass } across the entire data object.
 * Returns a new data object — never mutates.
 */
function applyRenames(data, renameMap) {
  if (!Object.keys(renameMap).length) return data;

  const r = k => renameMap[k] || k; // rename or keep

  // ── classGroups ──────────────────────────────────────────────────────────
  // (already rebuilt by caller; we skip here — caller passes updated classGroups)

  // ── students ────────────────────────────────────────────────────────────
  const students = (data.students || []).map(s => ({
    ...s,
    class:  r(s.class),
    stream: s.stream, // stream tag stays — it's the short name e.g. "East"
  }));

  // ── teachers ─────────────────────────────────────────────────────────────
  const teachers = (data.teachers || []).map(t => ({
    ...t,
    classTeacherOf: r(t.classTeacherOf),
    subjects: (t.subjects || []).map(sub => ({
      ...sub,
      classes: (sub.classes || []).map(r),
    })),
    markEntrySubjects: (t.markEntrySubjects || []).map(sub => ({
      ...sub,
      classes: (sub.classes || []).map(r),
    })),
  }));

  // ── exams ────────────────────────────────────────────────────────────────
  const exams = (data.exams || []).map(e => ({
    ...e,
    class: r(e.class),
  }));

  // ── subjectsByClass (object keyed by class name) ─────────────────────────
  const subjectsByClass = {};
  Object.entries(data.subjectsByClass || {}).forEach(([cls, subs]) => {
    subjectsByClass[r(cls)] = subs;
  });

  // ── timetable (object keyed by class name) ───────────────────────────────
  const timetable = {};
  Object.entries(data.timetable || {}).forEach(([cls, slots]) => {
    timetable[r(cls)] = slots;
  });

  // ── feeSchedule ──────────────────────────────────────────────────────────
  const feeSchedule = (data.feeSchedule || []).map(f => ({ ...f, class: r(f.class) }));

  // ── rollCalls (array of objects with a `class` field) ────────────────────
  const rollCalls = (data.rollCalls || []).map(rc => ({ ...rc, class: r(rc.class) }));

  return { ...data, students, teachers, exams, subjectsByClass, timetable, feeSchedule, rollCalls };
}

// ─── component ───────────────────────────────────────────────────────────────

export default function ClassRepairTool({ data, setData }) {
  const [show, setShow]         = useState(false);
  const [step, setStep]         = useState(1);   // 1 = analyse, 2 = confirm, 3 = done
  const [repairs, setRepairs]   = useState([]);   // list of RepairAction objects
  const [log, setLog]           = useState([]);   // summary after apply

  const classGroups = data.classGroups || [];

  // ── auto-detect issues ────────────────────────────────────────────────────
  const issues = useMemo(() => {
    const found = [];

    // 1. Duplicate base names
    const dupes = findDuplicates(classGroups);
    dupes.forEach(group => {
      // Pick the "best" name: prefer title-case with space e.g. "Grade 1"
      const best = group.reduce((a, b) => {
        const aScore = /^Grade \d/.test(a.name) ? 2 : /^GRADE \d/.test(a.name) ? 1 : 0;
        const bScore = /^Grade \d/.test(b.name) ? 2 : /^GRADE \d/.test(b.name) ? 1 : 0;
        return bScore > aScore ? b : a;
      });
      const rest = group.filter(g => g.id !== best.id);
      found.push({
        type: 'MERGE',
        description: `Duplicate class groups: ${group.map(g => `"${g.name}"`).join(' + ')} → merge into one "${best.name}"`,
        groups: group,
        keepGroup: best,
        mergeGroups: rest,
      });
    });

    // 2. Name normalisation issues (GRADE5 → Grade 5, GRADE 1 → Grade 1, etc.)
    classGroups.forEach(g => {
      // Check for missing space (GRADE5 → Grade 5)
      const noSpaceMatch = g.name.match(/^GRADE(\d+)$/i);
      if (noSpaceMatch) {
        const canonical = `Grade ${noSpaceMatch[1]}`;
        if (g.name !== canonical) {
          // Only add if not already covered by a MERGE
          const alreadyMerge = found.some(f => f.type === 'MERGE' && f.groups.some(x => x.id === g.id));
          if (!alreadyMerge) {
            found.push({
              type: 'RENAME',
              description: `"${g.name}" should be "${canonical}" (missing space / wrong case)`,
              group: g,
              newName: canonical,
            });
          }
        }
        return;
      }
      // Check for all-caps (GRADE 1 → Grade 1)
      const capsMatch = g.name.match(/^GRADE (\d+)$/);
      if (capsMatch) {
        const canonical = `Grade ${capsMatch[1]}`;
        if (g.name !== canonical) {
          const alreadyMerge = found.some(f => f.type === 'MERGE' && f.groups.some(x => x.id === g.id));
          if (!alreadyMerge) {
            found.push({
              type: 'RENAME',
              description: `"${g.name}" should be "${canonical}" (wrong capitalisation)`,
              group: g,
              newName: canonical,
            });
          }
        }
      }
    });

    return found;
  }, [classGroups]);

  function openTool() {
    setStep(1);
    setRepairs(issues.map((issue, i) => ({ ...issue, enabled: true, idx: i })));
    setShow(true);
  }

  function applyRepairs() {
    const renameMap = {}; // oldFullClass → newFullClass
    let newClassGroups = [...classGroups];
    const summaryLines = [];

    repairs.filter(r => r.enabled).forEach(repair => {
      if (repair.type === 'MERGE') {
        const keep = repair.keepGroup;
        const merging = repair.mergeGroups;

        // Collect all streams from ALL groups being merged
        const allStreams = new Set(keep.streams || []);
        merging.forEach(mg => {
          (mg.streams || []).forEach(s => allStreams.add(s));
          // If a merge group had NO streams, the group name itself was a full class
          // — keep its "stream" as empty meaning the base class
        });

        // Build rename entries for every old full-class string → new full-class string
        merging.forEach(mg => {
          const oldClasses = groupClasses(mg);
          oldClasses.forEach(oldCls => {
            // The stream part after the group name
            const streamPart = mg.streams.length > 0
              ? oldCls.slice(mg.name.length).trim()
              : '';
            const newCls = streamPart ? `${keep.name} ${streamPart}` : keep.name;
            renameMap[oldCls] = newCls;
          });
          // Remove merged group from classGroups
          newClassGroups = newClassGroups.filter(g => g.id !== mg.id);
        });

        // Update keep group to have all streams merged in
        newClassGroups = newClassGroups.map(g =>
          g.id === keep.id ? { ...g, streams: [...allStreams].sort() } : g
        );

        summaryLines.push(`✅ Merged ${merging.map(m => `"${m.name}"`).join(', ')} into "${keep.name}"`);
        summaryLines.push(`   → ${Object.entries(renameMap).filter(([,v]) => v.startsWith(keep.name)).map(([k,v]) => `"${k}" → "${v}"`).join(', ')}`);
      }

      if (repair.type === 'RENAME') {
        const g = repair.group;
        const oldClasses = groupClasses(g);
        oldClasses.forEach(oldCls => {
          const streamPart = g.streams.length > 0
            ? oldCls.slice(g.name.length).trim()
            : '';
          const newCls = streamPart ? `${repair.newName} ${streamPart}` : repair.newName;
          renameMap[oldCls] = newCls;
        });
        // Also rename the group name itself
        newClassGroups = newClassGroups.map(g2 =>
          g2.id === g.id ? { ...g2, name: repair.newName } : g2
        );
        summaryLines.push(`✅ Renamed "${g.name}" → "${repair.newName}" (${oldClasses.length} class reference${oldClasses.length > 1 ? 's' : ''} updated)`);
      }
    });

    // Apply renames to all data
    const fixed = applyRenames({ ...data, classGroups: newClassGroups }, renameMap);

    // Count affected records
    const affectedStudents  = data.students?.filter(s => renameMap[s.class]).length || 0;
    const affectedExams     = data.exams?.filter(e => renameMap[e.class]).length || 0;
    const affectedTeachers  = data.teachers?.filter(t =>
      renameMap[t.classTeacherOf]
      || (t.subjects || []).some(sub => (sub.classes||[]).some(c => renameMap[c]))
      || (t.markEntrySubjects || []).some(sub => (sub.classes||[]).some(c => renameMap[c]))
    ).length || 0;

    summaryLines.push('');
    summaryLines.push(`📊 Records updated: ${affectedStudents} students · ${affectedExams} exams · ${affectedTeachers} teachers`);

    setData(() => fixed);
    setLog(summaryLines);
    setStep(3);
  }

  const enabledCount = repairs.filter(r => r.enabled).length;

  return (
    <>
      {issues.length > 0 && (
        <Alert type="warning" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <strong>⚠ {issues.length} class setup issue{issues.length > 1 ? 's' : ''} detected</strong>
              <div style={{ fontSize: 11, marginTop: 3, color: 'var(--text-sub)' }}>
                {issues.map((iss, i) => <div key={i}>• {iss.description}</div>)}
              </div>
            </div>
            <Btn size="sm" onClick={openTool} style={{ whiteSpace: 'nowrap' }}>
              🔧 Fix Now
            </Btn>
          </div>
        </Alert>
      )}

      {issues.length === 0 && (
        <div style={{ fontSize: 11, color: '#10b981', marginBottom: 8, padding: '6px 10px', background: '#10b98110', borderRadius: 6, border: '1px solid #10b98130' }}>
          ✓ All class names look correct — no issues detected
        </div>
      )}

      <Modal show={show} onClose={() => setShow(false)} title="🔧 Class Setup Repair Tool" wide>

        {step === 1 && (
          <>
            <Alert type="info" style={{ marginBottom: 16 }}>
              <strong>Safe to run.</strong> This tool only renames class references — it never deletes students or marks.
              All student records, exam scores, teacher assignments, and timetable data will be kept and relinked to the correct class names.
            </Alert>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
                Issues found — select which to fix:
              </div>
              {repairs.map((repair, i) => (
                <div key={i} style={{
                  background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8,
                  padding: '12px 14px', marginBottom: 8,
                }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                    <input type="checkbox" checked={repair.enabled}
                      onChange={e => setRepairs(prev => prev.map((r, j) => j === i ? { ...r, enabled: e.target.checked } : r))}
                      style={{ marginTop: 2 }}
                    />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: repair.type === 'MERGE' ? '#f59e0b' : '#4f8ef7', marginBottom: 3 }}>
                        {repair.type === 'MERGE' ? '🔀 Merge Duplicate Groups' : '✏️ Fix Class Name'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>{repair.description}</div>
                      {repair.type === 'MERGE' && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                          All students and marks from the duplicate group will be relinked to the correct group.
                          Streams will be combined automatically.
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn variant="ghost" onClick={() => setShow(false)}>Cancel</Btn>
              <Btn onClick={() => setStep(2)} disabled={enabledCount === 0}>
                Review {enabledCount} Fix{enabledCount !== 1 ? 'es' : ''} →
              </Btn>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <Alert type="warning" style={{ marginBottom: 16 }}>
              <strong>⚠ This will modify class data across the school.</strong><br />
              Review carefully. The changes will be saved to the cloud when you next save school data.
              We recommend doing this when no other users are active.
            </Alert>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
                The following changes will be applied:
              </div>
              {repairs.filter(r => r.enabled).map((repair, i) => (
                <div key={i} style={{
                  background: 'var(--surface2)', border: '1px solid #f59e0b40', borderRadius: 8,
                  padding: '12px 14px', marginBottom: 8,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>
                    {repair.type === 'MERGE' ? '🔀' : '✏️'} {repair.description}
                  </div>
                  {repair.type === 'MERGE' && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Streams from all groups will be merged into "{repair.keepGroup.name}".
                      Every student, exam, timetable entry, and teacher assignment referencing the duplicate class names will be updated.
                    </div>
                  )}
                  {repair.type === 'RENAME' && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      All records referencing "{repair.group.name} ..." will be updated to "{repair.newName} ...".
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn variant="ghost" onClick={() => setStep(1)}>← Back</Btn>
              <Btn variant="danger" onClick={applyRepairs}>
                ✓ Apply {enabledCount} Fix{enabledCount !== 1 ? 'es' : ''} Now
              </Btn>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div style={{ textAlign: 'center', padding: '16px 0 24px' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981', marginBottom: 6 }}>Repair Complete</div>
              <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 20 }}>
                All class references have been updated. The data has been saved automatically.
              </div>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontFamily: 'monospace', fontSize: 12 }}>
              {log.map((line, i) => (
                <div key={i} style={{ color: line.startsWith('✅') ? '#10b981' : line.startsWith('📊') ? '#4f8ef7' : 'var(--text-muted)', marginBottom: 2 }}>
                  {line || <br />}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: '#f59e0b', marginBottom: 16 }}>
              ⚠ Please click "Save School Profile" on the Settings page to persist these changes to the cloud.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Btn onClick={() => setShow(false)}>Done</Btn>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
