import React, { useState } from 'react';
import { Card, Modal, Btn, Tag, SectionTitle, Alert, Icon } from './UI';
import { getAllClasses } from '../data/initialData';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TC = {
  lesson:   { bg: '#4f8ef720', border: '#4f8ef7', text: '#4f8ef7' },
  break:    { bg: '#f59e0b20', border: '#f59e0b', text: '#f59e0b' },
  lunch:    { bg: '#10b98120', border: '#10b981', text: '#10b981' },
  assembly: { bg: '#7c3aed20', border: '#7c3aed', text: '#7c3aed' },
  end:      { bg: '#64748b20', border: '#64748b', text: '#64748b' },
};

export default function Timetable({ data, setData, user }) {
  const isPrincipal = user.role === 'principal';
  const [view, setView]       = useState('class');   // 'class' | 'personal'
  const [selClass, setSelClass] = useState(user.classTeacherOf || getAllClasses(data)[0] || '');
  const [editMode, setEditMode] = useState(false);
  const [showGen, setShowGen]   = useState(false);
  const [genClass, setGenClass] = useState(getAllClasses(data)[0] || '');
  const [genStep, setGenStep]   = useState(1); // 1=class, 2=subject config, 3=options
  const [subjectConfig, setSubjectConfig] = useState({}); // {subjectName: {lessonsPerWeek, isDouble, doublesSeparated}}
  const [genOptions, setGenOptions] = useState({ allowDoubleConsecutive: true });

  const tt = data.timetable[selClass] || {};

  /* ── Personal timetable: sessions where teacher teaches ─ */
  function buildPersonalTimetable() {
    const mySubjects = (user.teacherSubjects || []);
    const mySubjectNames = mySubjects.map(s => s.subject);
    const sessions = [];

    Object.keys(data.timetable).forEach(cls => {
      DAYS.forEach(day => {
        const daySlots = data.timetable[cls][day] || [];
        daySlots.forEach((lesson, idx) => {
          if (mySubjectNames.includes(lesson)) {
            const bell = data.bells[idx];
            if (bell && bell.type === 'lesson') {
              sessions.push({ class: cls, day, bellIndex: idx, lesson, bell });
            }
          }
        });
      });
    });
    return sessions;
  }

  const personalSessions = view === 'personal' ? buildPersonalTimetable() : [];

  /* ── Print class timetable ───────────────────────── */
  function printClassTT() {
    const w = window.open('', '_blank');
    const rows = data.bells.map((b, i) =>
      `<tr><td style="padding:5px 10px;font-weight:600;white-space:nowrap;color:#333">${b.time}</td>
       <td style="padding:5px 10px;color:#666">${b.label}${b.duration ? ` (${b.duration}min)` : ''}</td>
       ${DAYS.map(d => `<td style="text-align:center;padding:5px 8px;font-size:11px">${(tt[d] && tt[d][i]) || '—'}</td>`).join('')}
       </tr>`
    ).join('');
    w.document.write(`<html><body style="font-family:sans-serif;padding:24px">
      <h2 style="text-align:center">${selClass} — Weekly Timetable</h2>
      <p style="text-align:center;color:#777;font-size:12px;margin-bottom:16px">${data.schoolName}</p>
      <table border="1" style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#f5f5f5"><th>Time</th><th>Bell</th>${DAYS.map(d => `<th>${d}</th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="text-align:right;font-size:10px;color:#aaa;margin-top:8px">Printed: ${new Date().toLocaleDateString('en-KE')}</p>
    </body></html>`);
    w.print();
  }

  /* ── Print personal timetable ────────────────────── */
  function printPersonalTT() {
    const grouped = {};
    personalSessions.forEach(s => {
      if (!grouped[s.day]) grouped[s.day] = [];
      grouped[s.day].push(s);
    });
    DAYS.forEach(d => { if (grouped[d]) grouped[d].sort((a, b) => a.bell.time.localeCompare(b.bell.time)); });

    const rows = DAYS.map(day => `
      <tr><td style="padding:6px 10px;font-weight:600">${day}</td>
      ${(grouped[day] || []).length === 0
        ? '<td colspan="3" style="color:#aaa;text-align:center">No lessons</td>'
        : (grouped[day] || []).map(s => `
          <tr>
            <td style="padding:5px 10px;font-weight:600">${day}</td>
            <td style="padding:5px 10px">${s.bell.time}${s.bell.duration ? ` (${s.bell.duration}min)` : ''}</td>
            <td style="padding:5px 10px;font-weight:600">${s.lesson}</td>
            <td style="padding:5px 10px;color:#555">${s.class}</td>
          </tr>`).join('')
      }`
    ).join('');

    const w = window.open('', '_blank');
    w.document.write(`<html><body style="font-family:sans-serif;padding:24px">
      <h2 style="text-align:center">Personal Timetable — ${user.name}</h2>
      <p style="text-align:center;color:#777;font-size:12px;margin-bottom:16px">${data.schoolName} · All Classes</p>
      <table border="1" style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#f5f5f5"><th>Day</th><th>Time</th><th>Subject</th><th>Class</th></tr></thead>
        <tbody>
          ${personalSessions.sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.bell.time.localeCompare(b.bell.time))
            .map(s => `<tr>
              <td style="padding:5px 10px;font-weight:600">${s.day}</td>
              <td style="padding:5px 10px">${s.bell.time}${s.bell.duration ? ` (${s.bell.duration}min)` : ''}</td>
              <td style="padding:5px 10px;font-weight:600;color:#4f8ef7">${s.lesson}</td>
              <td style="padding:5px 10px">${s.class}</td>
            </tr>`).join('')}
        </tbody>
      </table>
      <p style="margin-top:12px;font-size:11px;color:#aaa">Total lessons per week: ${personalSessions.length}</p>
    </body></html>`);
    w.print();
  }

  /* ── Auto-generate ───────────────────────────────── */
  function initSubjectConfig() {
    const subjects = data.subjects || [];
    const cfg = {};
    subjects.forEach(s => {
      cfg[s] = { lessonsPerWeek: 4, isDouble: false, doublesSeparated: false };
    });
    setSubjectConfig(cfg);
    setGenStep(2);
  }

  function generateTimetable() {
    const lessonSlots = []; // [{day, slotIndex}]
    DAYS.forEach(day => {
      data.bells.forEach((b, i) => {
        if (b.type === 'lesson') lessonSlots.push({ day, slotIndex: i });
      });
    });

    // Build list of lessons to place
    const toPlace = [];
    Object.entries(subjectConfig).forEach(([subj, cfg]) => {
      const count = cfg.lessonsPerWeek || 0;
      for (let i = 0; i < count; i++) {
        toPlace.push({ subj, isDouble: cfg.isDouble, doublesSeparated: cfg.doublesSeparated });
      }
    });

    // Shuffle lessons for randomness
    for (let i = toPlace.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [toPlace[i], toPlace[j]] = [toPlace[j], toPlace[i]];
    }

    // Initialize empty timetable
    const generated = {};
    DAYS.forEach(day => {
      generated[day] = data.bells.map(b => {
        if (b.type === 'assembly') return 'Assembly';
        if (b.type === 'break') return 'Break';
        if (b.type === 'lunch') return 'Lunch';
        if (b.type === 'end') return 'End';
        return '';
      });
    });

    // Place double lessons first (consecutive or separated)
    const doubles = toPlace.filter(l => l.isDouble);
    const singles = toPlace.filter(l => !l.isDouble);

    // Place doubles
    doubles.forEach(({ subj, doublesSeparated }) => {
      const daySlots = {};
      DAYS.forEach(d => {
        daySlots[d] = data.bells.map((b, i) => ({ b, i })).filter(({ b }) => b.type === 'lesson');
      });

      if (!doublesSeparated) {
        // Find consecutive free slots
        let placed = false;
        const shuffledDays = [...DAYS].sort(() => Math.random() - 0.5);
        for (const day of shuffledDays) {
          const slots = daySlots[day];
          for (let i = 0; i < slots.length - 1; i++) {
            const s1 = slots[i].i;
            const s2 = slots[i + 1].i;
            if (!generated[day][s1] && !generated[day][s2] && s2 === s1 + 1) {
              generated[day][s1] = subj;
              generated[day][s2] = subj;
              placed = true;
              break;
            }
          }
          if (placed) break;
        }
        if (!placed) singles.push({ subj, isDouble: false });
      } else {
        // Place as two singles on different days
        singles.push({ subj, isDouble: false });
        singles.push({ subj, isDouble: false });
      }
    });

    // Place singles - distribute evenly across days
    const freeSlots = [];
    DAYS.forEach(day => {
      data.bells.forEach((b, i) => {
        if (b.type === 'lesson' && !generated[day][i]) {
          freeSlots.push({ day, i });
        }
      });
    });

    // Shuffle free slots
    for (let i = freeSlots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [freeSlots[i], freeSlots[j]] = [freeSlots[j], freeSlots[i]];
    }

    singles.forEach((lesson, idx) => {
      if (idx < freeSlots.length) {
        const { day, i } = freeSlots[idx];
        generated[day][i] = lesson.subj;
      }
    });

    setData(d => ({ ...d, timetable: { ...d.timetable, [genClass]: generated } }));
    setShowGen(false);
    setGenStep(1);
  }

  function updateCell(day, idx, value) {
    const newTT = { ...tt };
    if (!newTT[day]) newTT[day] = data.bells.map(() => '');
    const arr = [...(newTT[day] || [])];
    arr[idx] = value;
    newTT[day] = arr;
    setData(d => ({ ...d, timetable: { ...d.timetable, [selClass]: newTT } }));
  }

  return (
    <div>
      {/* View toggle */}
      <div style={{ display: 'flex', gap: 4, background: '#1e2435', padding: 4, borderRadius: 10, marginBottom: 16, width: 'fit-content' }}>
        <button onClick={() => setView('class')}
          style={{ padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, background: view === 'class' ? '#171b26' : 'transparent', color: view === 'class' ? '#e2e8f0' : '#64748b' }}>
          Class Timetable
        </button>
        {!isPrincipal && (
          <button onClick={() => setView('personal')}
            style={{ padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, background: view === 'personal' ? '#171b26' : 'transparent', color: view === 'personal' ? '#4f8ef7' : '#64748b' }}>
            My Timetable
          </button>
        )}
      </div>

      {/* ── PERSONAL TIMETABLE ────────────────────────── */}
      {view === 'personal' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>
              Your personal teaching schedule across all classes — {personalSessions.length} lessons/week
            </div>
            <Btn variant="ghost" size="sm" onClick={printPersonalTT}>
              <Icon name="print" size={13} /> Print My Timetable
            </Btn>
          </div>
          {personalSessions.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
              No lessons found for you in the current timetables. Subjects assigned to you: {(user.teacherSubjects || []).map(s => s.subject).join(', ') || 'None'}
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
                    {personalSessions
                      .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.bell.time.localeCompare(b.bell.time))
                      .map((s, i) => (
                        <tr key={i}>
                          <td style={{ ...TS.td, fontWeight: 600 }}>{s.day}</td>
                          <td style={{ ...TS.td, fontWeight: 600, color: '#4f8ef7' }}>{s.bell.time}</td>
                          <td style={{ ...TS.td, color: '#94a3b8' }}>{s.bell.duration}min</td>
                          <td style={TS.td}>
                            <span style={{ background: '#4f8ef720', color: '#4f8ef7', padding: '2px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>{s.lesson}</span>
                          </td>
                          <td style={TS.td}>
                            <Tag color="green">{s.class}</Tag>
                          </td>
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
                const clsSessions = personalSessions.filter(s => s.class === cls);
                return (
                  <div key={cls} style={{ padding: '8px 0', borderBottom: '1px solid #2a3350', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ fontWeight: 500 }}>{cls}</span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {[...new Set(clsSessions.map(s => s.lesson))].map(sub => (
                        <Tag key={sub} color="blue">{sub}</Tag>
                      ))}
                    </div>
                    <span style={{ color: '#64748b' }}>{clsSessions.length} lessons/week</span>
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      )}

      {/* ── CLASS TIMETABLE ───────────────────────────── */}
      {view === 'class' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={selClass} onChange={e => setSelClass(e.target.value)} style={{ width: 160 }}>
              {getAllClasses(data).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              {isPrincipal && (
                <Btn variant="ghost" size="sm" onClick={() => setEditMode(!editMode)}>
                  <Icon name="edit" size={13} /> {editMode ? 'Done' : 'Edit'}
                </Btn>
              )}
              <Btn variant="ghost" size="sm" onClick={printClassTT}>
                <Icon name="print" size={13} /> Print
              </Btn>
              {isPrincipal && (
                <Btn onClick={() => setShowGen(true)}>
                  <Icon name="add" size={14} /> Auto-Generate
                </Btn>
              )}
            </div>
          </div>

          {editMode && isPrincipal && (
            <Alert type="info"><Icon name="alert" size={14} />Edit mode: click any lesson cell to change it.</Alert>
          )}

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
                    <tr key={b.id}>
                      <td style={{ ...TD, fontWeight: 600, color: c.text, whiteSpace: 'nowrap' }}>{b.time}</td>
                      <td style={{ ...TD, fontSize: 11, color: '#94a3b8' }}>
                        <div>{b.label}</div>
                        {b.duration > 0 && <div style={{ color: '#64748b', fontSize: 10 }}>{b.duration}min</div>}
                      </td>
                      {DAYS.map(day => {
                        const lesson = (tt[day] && tt[day][i]) || '';
                        const isSpecial = b.type !== 'lesson';
                        // Highlight cells for this teacher's subjects
                        const isMyLesson = !isPrincipal && (user.teacherSubjects || []).some(s => s.subject === lesson && s.classes.includes(selClass));
                        return (
                          <td key={day} style={{ ...TD, padding: 5 }}>
                            {editMode && !isSpecial && isPrincipal ? (
                              <input value={lesson} onChange={e => updateCell(day, i, e.target.value)}
                                style={{ width: '100%', padding: '4px 6px', fontSize: 12, background: '#1e2435' }} />
                            ) : lesson ? (
                              <div style={{
                                background: isMyLesson ? '#10b98120' : c.bg,
                                borderLeft: `3px solid ${isMyLesson ? '#10b981' : c.border}`,
                                borderRadius: 4, padding: '4px 8px', fontSize: 11,
                                color: isMyLesson ? '#10b981' : c.text,
                                fontWeight: isMyLesson ? 700 : 600,
                              }}>{lesson}</div>
                            ) : <span style={{ color: '#2a3350', fontSize: 10 }}>—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {!isPrincipal && (
            <div style={{ marginTop: 10, fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 14, height: 14, background: '#10b98120', borderLeft: '3px solid #10b981', borderRadius: 2 }} />
              <span>Green = your lessons in this class</span>
            </div>
          )}

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
            {Object.entries(TC).map(([type, c]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8' }}>
                <div style={{ width: 14, height: 14, borderRadius: 2, background: c.bg, borderLeft: `3px solid ${c.border}` }} />
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Smart Auto-Generate Modal */}
      <Modal show={showGen} onClose={() => { setShowGen(false); setGenStep(1); }} title={`Auto-Generate Timetable — Step ${genStep} of 3`}>
        
        {/* Step 1: Select Class */}
        {genStep === 1 && (
          <div>
            <Alert type="warning"><Icon name="alert" size={14} /> This will replace the existing timetable for the selected class.</Alert>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Select Class</label>
              <select value={genClass} onChange={e => setGenClass(e.target.value)} style={{ width: '100%', padding: '9px 12px', background: '#1e2435', border: '1px solid #2a3350', borderRadius: 8, color: '#e2e8f0', fontSize: 13 }}>
                {getAllClasses(data).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn variant="ghost" onClick={() => setShowGen(false)}>Cancel</Btn>
              <Btn onClick={initSubjectConfig}>Next: Configure Subjects →</Btn>
            </div>
          </div>
        )}

        {/* Step 2: Lessons per week + double periods */}
        {genStep === 2 && (
          <div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>
              Set how many lessons per week for each subject, and whether any should have double periods.
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#1e2435' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#64748b' }}>Subject</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', color: '#64748b' }}>Lessons/Week</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', color: '#64748b' }}>Double Period?</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', color: '#64748b' }}>Doubles Separated?</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(subjectConfig).map(([subj, cfg]) => (
                    <tr key={subj} style={{ borderBottom: '1px solid #2a3350' }}>
                      <td style={{ padding: '8px 10px', color: '#e2e8f0', fontWeight: 600 }}>{subj}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <input type="number" min={0} max={10} value={cfg.lessonsPerWeek}
                          onChange={e => setSubjectConfig(p => ({ ...p, [subj]: { ...p[subj], lessonsPerWeek: Number(e.target.value) } }))}
                          style={{ width: 60, padding: '4px 8px', background: '#1e2435', border: '1px solid #2a3350', borderRadius: 6, color: '#e2e8f0', textAlign: 'center' }} />
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <input type="checkbox" checked={cfg.isDouble}
                          onChange={e => setSubjectConfig(p => ({ ...p, [subj]: { ...p[subj], isDouble: e.target.checked } }))}
                          style={{ width: 16, height: 16, cursor: 'pointer' }} />
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        {cfg.isDouble && (
                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            <label><input type="radio" name={`sep-${subj}`} checked={!cfg.doublesSeparated}
                              onChange={() => setSubjectConfig(p => ({ ...p, [subj]: { ...p[subj], doublesSeparated: false } }))} /> Consecutive</label>
                            {' '}
                            <label><input type="radio" name={`sep-${subj}`} checked={cfg.doublesSeparated}
                              onChange={() => setSubjectConfig(p => ({ ...p, [subj]: { ...p[subj], doublesSeparated: true } }))} /> Separated</label>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <Btn variant="ghost" onClick={() => setGenStep(1)}>← Back</Btn>
              <Btn onClick={() => setGenStep(3)}>Next: Review & Generate →</Btn>
            </div>
          </div>
        )}

        {/* Step 3: Review & Generate */}
        {genStep === 3 && (
          <div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>Review your timetable configuration:</div>
            <div style={{ background: '#1e2435', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: '#4f8ef7', marginBottom: 8 }}>Class: {genClass}</div>
              {Object.entries(subjectConfig).filter(([, c]) => c.lessonsPerWeek > 0).map(([subj, cfg]) => (
                <div key={subj} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #2a3350', color: '#e2e8f0' }}>
                  <span>{subj}</span>
                  <span style={{ color: '#64748b' }}>
                    {cfg.lessonsPerWeek} lessons/week
                    {cfg.isDouble ? (cfg.doublesSeparated ? ' · 2 singles' : ' · double period') : ''}
                  </span>
                </div>
              ))}
              <div style={{ marginTop: 8, color: '#64748b' }}>
                Total: {Object.values(subjectConfig).reduce((a, c) => a + (c.lessonsPerWeek || 0), 0)} lessons/week
                · Available: {data.bells.filter(b => b.type === 'lesson').length * DAYS.length} slots
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn variant="ghost" onClick={() => setGenStep(2)}>← Back</Btn>
              <Btn variant="success" onClick={generateTimetable}><Icon name="check" size={13} /> Generate Timetable</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

const TS = { table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 }, th: { textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #2a3350', background: '#1e2435', whiteSpace: 'nowrap' }, td: { padding: '10px 12px', borderBottom: '1px solid #2a3350', color: '#e2e8f0' } };
const TH = { textAlign: 'left', padding: '10px 10px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #2a3350', background: '#1e2435' };
const TD = { padding: '8px 8px', borderBottom: '1px solid #2a3350', verticalAlign: 'middle' };
