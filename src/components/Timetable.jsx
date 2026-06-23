import React, { useState, useMemo } from 'react';
import { Card, Modal, Btn, Tag, SectionTitle, Alert, Icon } from './UI';
import { getAllClasses, getSubjectsForClass } from '../data/initialData';

/* ─────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────── */
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const TC = {
  lesson:   { bg: '#4f8ef720', border: '#4f8ef7', text: '#4f8ef7' },
  break:    { bg: '#f59e0b20', border: '#f59e0b', text: '#f59e0b' },
  lunch:    { bg: '#10b98120', border: '#10b981', text: '#10b981' },
  assembly: { bg: '#7c3aed20', border: '#7c3aed', text: '#7c3aed' },
  end:      { bg: '#64748b20', border: 'var(--text-muted)', text: 'var(--text-muted)' },
};

// Subject colour palette — cycles for distinct visual identity per subject
const SUB_COLORS = [
  '#4f8ef7','#10b981','#f59e0b','#ef4444','#7c3aed',
  '#ec4899','#06b6d4','#84cc16','#f97316','#6366f1',
  '#14b8a6','#e11d48','#a855f7','#0ea5e9','#d97706',
];
const subColorCache = {};
let subColorIdx = 0;
function subjectColor(subject) {
  if (!subject) return '#4f8ef7';
  if (!subColorCache[subject]) {
    subColorCache[subject] = SUB_COLORS[subColorIdx % SUB_COLORS.length];
    subColorIdx++;
  }
  return subColorCache[subject];
}

/* ─────────────────────────────────────────────────────────────
   TIMETABLE RULE DEFAULTS
   Stored in data.timetableRules — array of:
   {
     id, cls, subject, freq, allowDouble, pref, teacherId
     freq      : lessons per week (1-10)
     allowDouble: bool — may be placed as two consecutive slots
     pref      : 'any' | 'morning' | 'noon' | 'afternoon'
     teacherId : teacher staffId string or ''
   }
───────────────────────────────────────────────────────────── */
const DEFAULT_RULE = { freq: 5, allowDouble: false, pref: 'any', teacherId: '' };

/* ─────────────────────────────────────────────────────────────
   SLOT HELPERS
───────────────────────────────────────────────────────────── */

/** Returns only lesson-type bells with their original index */
function getLessonSlots(bells) {
  return bells
    .map((b, idx) => ({ ...b, idx }))
    .filter(b => b.type === 'lesson');
}

/**
 * Classify a lesson slot index into morning / noon / afternoon
 * based on its position among lesson-only slots (not raw bell index).
 */
function slotBucket(bellIdx, bells) {
  const ls = getLessonSlots(bells);
  const pos = ls.findIndex(s => s.idx === bellIdx);
  if (pos < 0) return 'any';
  const total = ls.length;
  const third = Math.ceil(total / 3);
  if (pos < third) return 'morning';
  if (pos < third * 2) return 'noon';
  return 'afternoon';
}

/* ─────────────────────────────────────────────────────────────
   COLLISION DETECTION
   Returns array of conflict objects from the *full* timetable
   so we can flag them in every class view.
───────────────────────────────────────────────────────────── */
function detectAllConflicts(timetable, bells) {
  const conflicts = []; // { type, teacherId, day, bellIdx, entries:[{cls,subject}] }
  const map = {};       // key `teacherId:day:bellIdx` → [{cls,subject}]

  Object.entries(timetable).forEach(([cls, clsTT]) => {
    DAYS.forEach(day => {
      (clsTT[day] || []).forEach((slot, idx) => {
        if (!slot || !slot.teacherId || !slot.subject) return;
        if (bells[idx] && bells[idx].type !== 'lesson') return;
        const key = `${slot.teacherId}::${day}::${idx}`;
        if (!map[key]) map[key] = [];
        map[key].push({ cls, subject: slot.subject });
      });
    });
  });

  Object.entries(map).forEach(([key, entries]) => {
    if (entries.length > 1) {
      const [teacherId, day, bellIdx] = key.split('::');
      conflicts.push({ type: 'teacher_collision', teacherId, day, bellIdx: parseInt(bellIdx), entries });
    }
  });

  return conflicts;
}

/* ─────────────────────────────────────────────────────────────
   SMART GENERATOR
   Generates a timetable for one class, respecting:
   - Bell types (only fills 'lesson' slots)
   - Frequency per week per subject
   - Double lessons (two consecutive lesson slots on same day)
   - Time-of-day preference (morning / noon / afternoon)
   - Teacher collision avoidance across already-saved classes
   - Max 2 lessons of same subject per day (spread rule)
───────────────────────────────────────────────────────────── */
function generateForClass(cls, rules, bells, existingTimetable) {
  const clsRules = rules.filter(r => r.cls === cls);
  if (clsRules.length === 0) return null;

  const lessonSlots = getLessonSlots(bells);

  // grid[day][bellIdx] = slot object | null
  const grid = {};
  DAYS.forEach(d => { grid[d] = {}; });

  // Track which (teacherId, day, bellIdx) combos are already occupied
  // across OTHER classes (already generated or pre-existing)
  function teacherOccupied(teacherId, day, bellIdx) {
    if (!teacherId) return false;
    for (const [c, cTT] of Object.entries(existingTimetable)) {
      if (c === cls) continue;
      const slot = (cTT[day] || [])[bellIdx];
      if (slot && slot.teacherId === teacherId) return true;
    }
    return false;
  }

  // Count how many times subject already placed on a given day in current grid
  function countOnDay(subject, day) {
    return Object.values(grid[day]).filter(v => v && v.subject === subject).length;
  }

  // Can we place rule at (day, bellIdx)?
  function canPlace(rule, day, bellIdx) {
    if (grid[day][bellIdx] != null) return false;                         // slot taken
    if (bells[bellIdx] && bells[bellIdx].type !== 'lesson') return false; // not a lesson slot
    if (teacherOccupied(rule.teacherId, day, bellIdx)) return false;      // teacher clash
    if (rule.pref !== 'any' && slotBucket(bellIdx, bells) !== rule.pref) return false; // pref
    if (countOnDay(rule.subject, day) >= 2) return false;                 // spread
    return true;
  }

  // Place a slot
  function place(rule, day, bellIdx) {
    grid[day][bellIdx] = { subject: rule.subject, teacherId: rule.teacherId || '' };
  }

  // Shuffle helper for randomised but deterministic-ish results
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Build all (day, bellIdx) combos once, shuffled
  const allCombos = [];
  DAYS.forEach(day => lessonSlots.forEach(b => allCombos.push({ day, bellIdx: b.idx })));

  for (const rule of clsRules) {
    let remaining = rule.freq;

    // ── PASS 1: Try to place doubles first (on preferred or any days) ──
    if (rule.allowDouble && remaining >= 2) {
      const shuffledDays = shuffle(DAYS);
      for (const day of shuffledDays) {
        if (remaining < 2) break;
        if (countOnDay(rule.subject, day) > 0) continue; // fresh day for doubles
        // Find consecutive lesson-slot pairs
        for (let i = 0; i < lessonSlots.length - 1; i++) {
          const b1 = lessonSlots[i];
          const b2 = lessonSlots[i + 1];
          // Must be truly consecutive bells
          if (b2.idx - b1.idx !== 1) continue;
          if (!canPlace(rule, day, b1.idx)) continue;
          if (!canPlace(rule, day, b2.idx)) continue;
          place(rule, day, b1.idx);
          place(rule, day, b2.idx);
          // Mark double linkage for display
          grid[day][b1.idx].double = true;
          grid[day][b2.idx].double = true;
          grid[day][b2.idx].doubleSecond = true;
          remaining -= 2;
          break;
        }
      }
    }

    // ── PASS 2: Fill remaining with pref-respecting combos ──
    const shuffled = shuffle(allCombos);
    for (const { day, bellIdx } of shuffled) {
      if (remaining <= 0) break;
      if (!canPlace(rule, day, bellIdx)) continue;
      place(rule, day, bellIdx);
      remaining--;
    }

    // ── PASS 3: Relax pref constraint if still unplaced ──
    if (remaining > 0) {
      const relaxed = shuffle(allCombos);
      for (const { day, bellIdx } of relaxed) {
        if (remaining <= 0) break;
        if (grid[day][bellIdx] != null) continue;
        if (bells[bellIdx] && bells[bellIdx].type !== 'lesson') continue;
        if (teacherOccupied(rule.teacherId, day, bellIdx)) continue;
        if (countOnDay(rule.subject, day) >= 2) continue;
        place(rule, day, bellIdx);
        remaining--;
      }
    }
  }

  // Build final day arrays aligned with bells array
  const result = {};
  DAYS.forEach(day => {
    result[day] = bells.map((b, i) => {
      if (b.type !== 'lesson') return { label: b.label, type: b.type };
      return grid[day][i] || null;
    });
  });
  return result;
}

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────── */
export default function Timetable({ data, setData, user }) {
  const isPrincipal = user.role === 'principal';
  const classes = getAllClasses(data);

  const [view,     setView]     = useState('class');   // 'class' | 'personal'
  const [selClass, setSelClass] = useState(user.classTeacherOf || classes[0] || '');
  const [editMode, setEditMode] = useState(false);

  // Generator modal state
  const [showGen,    setShowGen]    = useState(false);
  const [genClass,   setGenClass]   = useState(classes[0] || '');
  const [genAll,     setGenAll]     = useState(false);
  const [genLoading, setGenLoading] = useState(false);

  // Rules editor modal
  const [showRules,    setShowRules]    = useState(false);
  const [rulesForClass, setRulesForClass] = useState('');

  // Conflict detail modal
  const [showConflicts, setShowConflicts] = useState(false);

  const tt = data.timetable[selClass] || {};
  const rules = data.timetableRules || [];

  /* ── Slot resolution: timetable cell value ─────────── */
  // Each slot is now { subject, teacherId, double?, doubleSecond? }
  // Legacy: some cells may still be plain strings — we normalise here.
  function resolveSlot(raw) {
    if (!raw) return null;
    if (typeof raw === 'string') return raw ? { subject: raw } : null;
    return raw;
  }

  /* ── Conflicts ──────────────────────────────────────── */
  const conflicts = useMemo(() => detectAllConflicts(data.timetable, data.bells), [data.timetable, data.bells]);
  const conflictSet = useMemo(() => {
    const s = new Set();
    conflicts.forEach(c => {
      c.entries.forEach(e => { if (e.cls === selClass) s.add(`${c.day}::${c.bellIdx}`); });
    });
    return s;
  }, [conflicts, selClass]);

  /* ── Personal timetable ─────────────────────────────── */
  function buildPersonalTimetable() {
    const mySubjectNames = (user.teacherSubjects || []).map(s => s.subject);
    const myStaffId = user.staffId;
    const sessions = [];

    Object.keys(data.timetable).forEach(cls => {
      DAYS.forEach(day => {
        const daySlots = data.timetable[cls][day] || [];
        daySlots.forEach((rawSlot, idx) => {
          const slot = resolveSlot(rawSlot);
          if (!slot || !slot.subject) return;
          const bell = data.bells[idx];
          if (!bell || bell.type !== 'lesson') return;
          // Match by staffId (new) or by subject name (legacy)
          const isMySlot = (myStaffId && slot.teacherId === myStaffId)
            || mySubjectNames.includes(slot.subject);
          if (isMySlot) {
            sessions.push({ class: cls, day, bellIndex: idx, lesson: slot.subject, bell, slot });
          }
        });
      });
    });
    return sessions;
  }

  const personalSessions = view === 'personal' ? buildPersonalTimetable() : [];

  /* ── Edit cell ──────────────────────────────────────── */
  function updateCell(day, idx, value) {
    const newTT = { ...tt };
    if (!newTT[day]) newTT[day] = data.bells.map(() => null);
    const arr = [...(newTT[day] || [])];
    arr[idx] = value ? { subject: value } : null;
    newTT[day] = arr;
    setData(d => ({ ...d, timetable: { ...d.timetable, [selClass]: newTT } }));
  }

  /* ── Generate timetable ─────────────────────────────── */
  function runGenerate() {
    setGenLoading(true);
    setTimeout(() => { // Let UI update before heavy work
      if (genAll) {
        let newTimetable = { ...data.timetable };
        classes.forEach(cls => {
          const generated = generateForClass(cls, rules, data.bells, newTimetable);
          if (generated) newTimetable[cls] = generated;
        });
        setData(d => ({ ...d, timetable: newTimetable }));
      } else {
        const existing = { ...data.timetable };
        const generated = generateForClass(genClass, rules, data.bells, existing);
        if (generated) {
          setData(d => ({ ...d, timetable: { ...d.timetable, [genClass]: generated } }));
        }
      }
      setGenLoading(false);
      setShowGen(false);
    }, 50);
  }

  /* ── Rules helpers ──────────────────────────────────── */
  function openRulesFor(cls) {
    setRulesForClass(cls);
    setShowRules(true);
  }

  function upsertRule(cls, subject, patch) {
    const existing = rules.find(r => r.cls === cls && r.subject === subject);
    if (existing) {
      setData(d => ({
        ...d,
        timetableRules: (d.timetableRules || []).map(r =>
          r.cls === cls && r.subject === subject ? { ...r, ...patch } : r
        ),
      }));
    } else {
      setData(d => ({
        ...d,
        timetableRules: [...(d.timetableRules || []), {
          id: `rule_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          cls, subject, ...DEFAULT_RULE, ...patch,
        }],
      }));
    }
  }

  function removeRule(cls, subject) {
    setData(d => ({
      ...d,
      timetableRules: (d.timetableRules || []).filter(r => !(r.cls === cls && r.subject === subject)),
    }));
  }

  /* ── Print helpers ──────────────────────────────────── */
  function printClassTT() {
    const w = window.open('', '_blank');
    const rows = data.bells.map((b, i) => {
      const c = TC[b.type] || TC.lesson;
      return `<tr>
        <td style="padding:5px 10px;font-weight:600;white-space:nowrap;color:${c.text}">${b.time}</td>
        <td style="padding:5px 10px;color:#666;font-size:11px">${b.label}${b.duration ? ` (${b.duration}min)` : ''}</td>
        ${DAYS.map(d => {
          const slot = resolveSlot((tt[d] || [])[i]);
          const label = slot ? slot.subject : (b.type !== 'lesson' ? b.label : '—');
          return `<td style="text-align:center;padding:5px 8px;font-size:11px">${label}</td>`;
        }).join('')}
      </tr>`;
    }).join('');
    w.document.write(`<html><body style="font-family:sans-serif;padding:24px">
      <h2 style="text-align:center">${selClass} — Weekly Timetable</h2>
      <p style="text-align:center;color:#777;font-size:12px;margin-bottom:16px">${data.schoolName}</p>
      <table border="1" style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#f5f5f5">
          <th>Time</th><th>Bell</th>${DAYS.map(d => `<th>${d}</th>`).join('')}
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="text-align:right;font-size:10px;color:#aaa;margin-top:8px">
        Printed: ${new Date().toLocaleDateString('en-KE')}
      </p>
    </body></html>`);
    w.print();
  }

  function printPersonalTT() {
    const sorted = [...personalSessions].sort(
      (a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.bell.time.localeCompare(b.bell.time)
    );
    const w = window.open('', '_blank');
    w.document.write(`<html><body style="font-family:sans-serif;padding:24px">
      <h2 style="text-align:center">Personal Timetable — ${user.name}</h2>
      <p style="text-align:center;color:#777;font-size:12px;margin-bottom:16px">${data.schoolName} · All Classes</p>
      <table border="1" style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#f5f5f5">
          <th>Day</th><th>Time</th><th>Subject</th><th>Class</th>
        </tr></thead>
        <tbody>
          ${sorted.map(s => `<tr>
            <td style="padding:5px 10px;font-weight:600">${s.day}</td>
            <td style="padding:5px 10px">${s.bell.time}${s.bell.duration ? ` (${s.bell.duration}min)` : ''}</td>
            <td style="padding:5px 10px;font-weight:600;color:#4f8ef7">${s.lesson}</td>
            <td style="padding:5px 10px">${s.class}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <p style="margin-top:12px;font-size:11px;color:#aaa">Total: ${sorted.length} lessons/week</p>
    </body></html>`);
    w.print();
  }

  /* ─────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────── */
  return (
    <div>

      {/* ── View toggle ──────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--surface2)', padding: 4, borderRadius: 10, marginBottom: 16, width: 'fit-content' }}>
        <button onClick={() => setView('class')}
          style={{ padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, background: view === 'class' ? 'var(--surface)' : 'transparent', color: view === 'class' ? 'var(--text)' : 'var(--text-muted)' }}>
          Class Timetable
        </button>
        {!isPrincipal && (
          <button onClick={() => setView('personal')}
            style={{ padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, background: view === 'personal' ? 'var(--surface)' : 'transparent', color: view === 'personal' ? '#4f8ef7' : 'var(--text-muted)' }}>
            My Timetable
          </button>
        )}
      </div>

      {/* ════════════════════════════════════════════════
          PERSONAL TIMETABLE
      ════════════════════════════════════════════════ */}
      {view === 'personal' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>
              Your teaching schedule across all classes — {personalSessions.length} lessons/week
            </div>
            <Btn variant="ghost" size="sm" onClick={printPersonalTT}>
              <Icon name="print" size={13} /> Print My Timetable
            </Btn>
          </div>

          {personalSessions.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              No lessons found for you in the current timetables.
              {(user.teacherSubjects || []).length > 0 &&
                ` Subjects assigned: ${(user.teacherSubjects || []).map(s => s.subject).join(', ')}`}
            </Card>
          ) : (
            <Card noPad>
              <div style={{ overflowX: 'auto' }}>
                <table style={TS.table}>
                  <thead>
                    <tr>
                      <th style={TS.th}>Day</th>
                      <th style={TS.th}>Time</th>
                      <th style={TS.th}>Duration</th>
                      <th style={TS.th}>Subject</th>
                      <th style={TS.th}>Class</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...personalSessions]
                      .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.bell.time.localeCompare(b.bell.time))
                      .map((s, i) => (
                        <tr key={i}>
                          <td style={{ ...TS.td, fontWeight: 600 }}>{s.day}</td>
                          <td style={{ ...TS.td, fontWeight: 600, color: '#4f8ef7' }}>{s.bell.time}</td>
                          <td style={{ ...TS.td, color: 'var(--text-sub)' }}>{s.bell.duration}min</td>
                          <td style={TS.td}>
                            <span style={{
                              background: `${subjectColor(s.lesson)}20`,
                              color: subjectColor(s.lesson),
                              padding: '2px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                            }}>{s.lesson}</span>
                          </td>
                          <td style={TS.td}><Tag color="green">{s.class}</Tag></td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Summary by class */}
          {personalSessions.length > 0 && (
            <Card style={{ marginTop: 16 }}>
              <SectionTitle>Lessons by Class</SectionTitle>
              {[...new Set(personalSessions.map(s => s.class))].map(cls => {
                const cls_sessions = personalSessions.filter(s => s.class === cls);
                return (
                  <div key={cls} style={{ padding: '8px 0', borderBottom: '1px solid #2a3350', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ fontWeight: 500 }}>{cls}</span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {[...new Set(cls_sessions.map(s => s.lesson))].map(sub => (
                        <Tag key={sub} color="blue">{sub}</Tag>
                      ))}
                    </div>
                    <span style={{ color: 'var(--text-muted)' }}>{cls_sessions.length} lessons/week</span>
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════
          CLASS TIMETABLE
      ════════════════════════════════════════════════ */}
      {view === 'class' && (
        <div>
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={selClass} onChange={e => setSelClass(e.target.value)} style={{ width: 180 }}>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Conflict badge */}
            {conflicts.length > 0 && (
              <button onClick={() => setShowConflicts(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, background: '#ef444420', border: '1px solid #ef444440', color: '#ef4444', fontSize: 12, cursor: 'pointer' }}>
                <Icon name="alert" size={13} />
                {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''}
              </button>
            )}

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              {isPrincipal && (
                <>
                  <Btn variant="ghost" size="sm" onClick={() => openRulesFor(selClass)}>
                    <Icon name="settings" size={13} /> Rules
                  </Btn>
                  <Btn variant="ghost" size="sm" onClick={() => setEditMode(!editMode)}>
                    <Icon name="edit" size={13} /> {editMode ? 'Done' : 'Edit'}
                  </Btn>
                </>
              )}
              <Btn variant="ghost" size="sm" onClick={printClassTT}>
                <Icon name="print" size={13} /> Print
              </Btn>
              {isPrincipal && (
                <Btn onClick={() => { setGenAll(false); setGenClass(selClass); setShowGen(true); }}>
                  <Icon name="wand" size={14} /> Auto-Generate
                </Btn>
              )}
            </div>
          </div>

          {editMode && isPrincipal && (
            <Alert type="info" style={{ marginBottom: 12 }}>
              <Icon name="alert" size={14} /> Edit mode — type directly into any lesson cell.
            </Alert>
          )}

          {/* Conflict banner for this class */}
          {conflictSet.size > 0 && (
            <Alert type="error" style={{ marginBottom: 12 }}>
              <Icon name="alert" size={14} />
              {conflictSet.size} collision{conflictSet.size !== 1 ? 's' : ''} detected in this timetable — a teacher is double-booked at the highlighted slots.
            </Alert>
          )}

          {/* Grid */}
          <Card noPad style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr>
                  <th style={{ ...TH, width: 75 }}>Time</th>
                  <th style={{ ...TH, width: 120 }}>Bell</th>
                  {DAYS.map(d => <th key={d} style={TH}>{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.bells.map((b, i) => {
                  const c = TC[b.type] || TC.lesson;
                  return (
                    <tr key={b.id || i}>
                      <td style={{ ...TD, fontWeight: 600, color: c.text, whiteSpace: 'nowrap' }}>{b.time}</td>
                      <td style={{ ...TD, fontSize: 11, color: 'var(--text-sub)' }}>
                        <div>{b.label}</div>
                        {b.duration > 0 && <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>{b.duration}min</div>}
                      </td>
                      {DAYS.map(day => {
                        const slot     = resolveSlot((tt[day] || [])[i]);
                        const isSpecial = b.type !== 'lesson';
                        const isConflict = conflictSet.has(`${day}::${i}`);
                        const isMyLesson = !isPrincipal && slot && (user.teacherSubjects || []).some(s =>
                          s.subject === slot.subject && s.classes.includes(selClass)
                        );

                        const displayLabel = slot?.subject
                          || (isSpecial ? b.label : '');

                        const col = slot?.subject
                          ? (isMyLesson ? '#10b981' : subjectColor(slot.subject))
                          : c.text;

                        return (
                          <td key={day} style={{
                            ...TD, padding: 5,
                            background: isConflict ? '#ef444412' : 'transparent',
                            outline: isConflict ? '2px solid #ef444460' : 'none',
                            outlineOffset: -2,
                          }}>
                            {editMode && !isSpecial && isPrincipal ? (
                              <input
                                value={slot?.subject || ''}
                                onChange={e => updateCell(day, i, e.target.value)}
                                style={{ width: '100%', padding: '4px 6px', fontSize: 12, background: 'var(--surface2)', color: 'var(--text)', border: '1px solid #2a3350', borderRadius: 4 }}
                              />
                            ) : displayLabel ? (
                              <div style={{
                                background: `${col}20`,
                                borderLeft: `3px solid ${col}`,
                                borderRadius: 4,
                                padding: '4px 8px',
                                fontSize: 11,
                                color: col,
                                fontWeight: isMyLesson ? 700 : 600,
                              }}>
                                {/* Double-lesson indicator */}
                                {slot?.double && !slot?.doubleSecond && (
                                  <span style={{ fontSize: 9, opacity: 0.6, marginRight: 3 }}>◼◼</span>
                                )}
                                {displayLabel}
                                {/* Conflict icon */}
                                {isConflict && (
                                  <span title="Teacher collision" style={{ marginLeft: 4, color: '#ef4444', fontSize: 10 }}>⚠</span>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--border)', fontSize: 10 }}>—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* My-lessons legend (teachers) */}
          {!isPrincipal && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 14, height: 14, background: '#10b98120', borderLeft: '3px solid #10b981', borderRadius: 2 }} />
              <span>Green = your lessons in this class</span>
            </div>
          )}

          {/* Bell-type legend */}
          <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
            {Object.entries(TC).map(([type, c]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-sub)' }}>
                <div style={{ width: 14, height: 14, borderRadius: 2, background: c.bg, borderLeft: `3px solid ${c.border}` }} />
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-sub)' }}>
              <span style={{ fontSize: 9 }}>◼◼</span> Double lesson
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          MODAL: Auto-Generate
      ════════════════════════════════════════════════ */}
      <Modal show={showGen} onClose={() => setShowGen(false)} title="Auto-Generate Timetable">
        <Alert type="warning">
          <Icon name="alert" size={14} /> This will replace the existing timetable for the selected class(es).
        </Alert>

        <div style={{ margin: '14px 0' }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={genAll} onChange={e => setGenAll(e.target.checked)} />
            Generate for ALL classes at once
          </label>

          {!genAll && (
            <>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-sub)', display: 'block', marginBottom: 6 }}>Class</label>
              <select value={genClass} onChange={e => setGenClass(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', background: 'var(--surface2)', border: '1px solid #2a3350', borderRadius: 8, color: 'var(--text)', fontSize: 13 }}>
                {classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </>
          )}
        </div>

        {/* Show rules summary */}
        {(() => {
          const targetClasses = genAll ? classes : [genClass];
          const rulesCount = rules.filter(r => targetClasses.includes(r.cls)).length;
          return rulesCount === 0 ? (
            <Alert type="warning">
              <Icon name="alert" size={14} /> No subject rules configured for {genAll ? 'any class' : genClass}.
              Use the <strong>Rules</strong> button on the timetable to set up subjects and frequencies first.
            </Alert>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 8 }}>
              {rulesCount} subject rule{rulesCount !== 1 ? 's' : ''} will be used to generate the timetable.
            </div>
          );
        })()}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setShowGen(false)} disabled={genLoading}>Cancel</Btn>
          <Btn variant="success" onClick={runGenerate} disabled={genLoading}>
            {genLoading ? 'Generating…' : (genAll ? 'Generate All Classes' : 'Generate')}
          </Btn>
        </div>
      </Modal>

      {/* ════════════════════════════════════════════════
          MODAL: Subject Rules Editor
      ════════════════════════════════════════════════ */}
      <Modal
        show={showRules}
        onClose={() => setShowRules(false)}
        title={`Subject Rules — ${rulesForClass}`}
        wide
      >
        <p style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 14 }}>
          Configure how often each subject appears per week, whether it can run as a double lesson,
          the preferred time of day, and which teacher delivers it.
        </p>
        <RulesEditor
          cls={rulesForClass}
          data={data}
          rules={rules.filter(r => r.cls === rulesForClass)}
          onUpsert={(subject, patch) => upsertRule(rulesForClass, subject, patch)}
          onRemove={(subject) => removeRule(rulesForClass, subject)}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <Btn onClick={() => setShowRules(false)}>Done</Btn>
        </div>
      </Modal>

      {/* ════════════════════════════════════════════════
          MODAL: Conflict Details
      ════════════════════════════════════════════════ */}
      <Modal show={showConflicts} onClose={() => setShowConflicts(false)} title="Scheduling Conflicts">
        <p style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 14 }}>
          The following teacher collisions were detected. Regenerate the affected classes to resolve them.
        </p>
        {conflicts.map((c, i) => {
          if (c.type !== 'teacher_collision') return null;
          const teacher = (data.teachers || []).find(t => t.staffId === c.teacherId || t.id === c.teacherId);
          const bell = data.bells[c.bellIdx];
          return (
            <div key={i} style={{ background: '#ef444412', border: '1px solid #ef444430', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Icon name="alert" size={14} style={{ color: '#ef4444' }} />
                <span style={{ fontWeight: 600, fontSize: 13, color: '#ef4444' }}>
                  {teacher ? teacher.name : c.teacherId}
                </span>
                <Tag color="red">{c.day}</Tag>
                {bell && <Tag color="red">{bell.time}</Tag>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>
                Double-booked in: {c.entries.map(e => `${e.cls} (${e.subject})`).join(' and ')}
              </div>
            </div>
          );
        })}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <Btn onClick={() => setShowConflicts(false)}>Close</Btn>
        </div>
      </Modal>

    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   RULES EDITOR SUB-COMPONENT
   Renders inside the Rules modal — one row per subject for the class.
───────────────────────────────────────────────────────────── */
function RulesEditor({ cls, data, rules, onUpsert, onRemove }) {
  const subjects = getSubjectsForClass(cls, data);
  const teachers = (data.teachers || []).filter(t =>
    t.staffType === 'teaching' || (t.subjects && t.subjects.length > 0)
  );

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {['Subject', 'Per week', 'Allow double', 'Pref. time', 'Teacher', ''].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: 'var(--text-muted)', borderBottom: '1px solid #2a3350', background: 'var(--surface2)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {subjects.map(subject => {
            const rule = rules.find(r => r.subject === subject) || { ...DEFAULT_RULE };
            const active = !!rules.find(r => r.subject === subject);
            return (
              <tr key={subject} style={{ opacity: active ? 1 : 0.45 }}>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #2a3350', color: 'var(--text)', fontWeight: active ? 600 : 400 }}>
                  {subject}
                </td>
                <td style={{ padding: '4px 8px', borderBottom: '1px solid #2a3350' }}>
                  <input
                    type="number" min="1" max="10" value={rule.freq}
                    onChange={e => onUpsert(subject, { freq: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)) })}
                    style={{ width: 54, padding: '4px 6px', background: 'var(--surface2)', border: '1px solid #2a3350', borderRadius: 4, color: 'var(--text)', fontSize: 12 }}
                  />
                </td>
                <td style={{ padding: '4px 8px', borderBottom: '1px solid #2a3350' }}>
                  <select
                    value={rule.allowDouble ? '1' : '0'}
                    onChange={e => onUpsert(subject, { allowDouble: e.target.value === '1' })}
                    style={{ padding: '4px 6px', background: 'var(--surface2)', border: '1px solid #2a3350', borderRadius: 4, color: 'var(--text)', fontSize: 12 }}
                  >
                    <option value="0">No</option>
                    <option value="1">Yes</option>
                  </select>
                </td>
                <td style={{ padding: '4px 8px', borderBottom: '1px solid #2a3350' }}>
                  <select
                    value={rule.pref || 'any'}
                    onChange={e => onUpsert(subject, { pref: e.target.value })}
                    style={{ padding: '4px 6px', background: 'var(--surface2)', border: '1px solid #2a3350', borderRadius: 4, color: 'var(--text)', fontSize: 12 }}
                  >
                    <option value="any">Any</option>
                    <option value="morning">Morning</option>
                    <option value="noon">Midday</option>
                    <option value="afternoon">Afternoon</option>
                  </select>
                </td>
                <td style={{ padding: '4px 8px', borderBottom: '1px solid #2a3350' }}>
                  <select
                    value={rule.teacherId || ''}
                    onChange={e => onUpsert(subject, { teacherId: e.target.value })}
                    style={{ padding: '4px 6px', background: 'var(--surface2)', border: '1px solid #2a3350', borderRadius: 4, color: 'var(--text)', fontSize: 12, maxWidth: 140 }}
                  >
                    <option value="">— None —</option>
                    {teachers.map(t => (
                      <option key={t.staffId || t.id} value={t.staffId || t.id}>{t.name}</option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: '4px 8px', borderBottom: '1px solid #2a3350' }}>
                  {active && (
                    <button
                      onClick={() => onRemove(subject)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 13, padding: '2px 6px' }}
                      title="Remove rule"
                    >✕</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
        Rows dim when no rule is saved. Editing any field auto-saves the rule for that subject.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   STYLE CONSTANTS
───────────────────────────────────────────────────────────── */
const TS = {
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:    { textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid #2a3350', background: 'var(--surface2)', whiteSpace: 'nowrap' },
  td:    { padding: '10px 12px', borderBottom: '1px solid #2a3350', color: 'var(--text)' },
};
const TH = { textAlign: 'left', padding: '10px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid #2a3350', background: 'var(--surface2)' };
const TD = { padding: '8px 8px', borderBottom: '1px solid #2a3350', verticalAlign: 'middle' };
