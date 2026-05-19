import React, { useState } from 'react';
import { Card, Btn, Tag, SectionTitle, GradeBadge, Avatar } from './UI';
import { getGrade, getScore, GRADES_CBC, getSiblingStreams } from '../data/initialData';
import { computeRankings } from '../utils/print';

/* ── Student Academic History ─────────────────────────────────────
   Shows the full journey: every class, every term, every exam.
   Used in Student Portal and Parent Portal.
──────────────────────────────────────────────────────────────────── */
export function StudentHistory({ student, data, compact = false }) {
  const [expandedYear, setExpandedYear] = useState(null);

  if (!student) return null;

  // Build history from promotionHistory + exams
  const history = buildStudentHistory(student, data);

  if (history.length == 0) {
    return (
      <Card>
        <div style={{ color: '#64748b', textAlign: 'center', padding: 24 }}>
          No academic history yet for {student.name}.
        </div>
      </Card>
    );
  }

  return (
    <div>
      {!compact && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <Avatar name={student.name} size={56} color="#4f8ef7" />
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0' }}>{student.name}</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>Adm No: {student.admNo} · Current Class: {student.class}</div>
              <div style={{ fontSize: 12, color: '#10b981', marginTop: 4 }}>Enrolled: {student.dob ? 'DOB ' + student.dob : 'N/A'}</div>
            </div>
          </div>
          {/* Summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Years at School', value: history.length, color: '#4f8ef7' },
              { label: 'Exams Taken', value: history.reduce((a, y) => a + (y.exams||[]).length, 0), color: '#10b981' },
              { label: 'Current Class', value: student.class || '—', color: '#f59e0b' },
              { label: 'Status', value: student.status || 'Active', color: student.status == 'active' || !student.status ? '#10b981' : '#ef4444' },
            ].map(s => (
              <div key={s.label} style={{ background: '#171b26', border: `1px solid ${s.color}20`, borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Year-by-year history */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {history.map((yearData, yi) => (
          <div key={yi} style={{ background: '#171b26', border: '1px solid #2a3350', borderRadius: 12, overflow: 'hidden' }}>
            {/* Year header */}
            <div
              onClick={() => setExpandedYear(expandedYear == yi ? null : yi)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer', background: expandedYear == yi ? '#1e2435' : 'transparent' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#4f8ef720', border: '1px solid #4f8ef730', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#4f8ef7' }}>
                  {yearData.year.toString().slice(-2)}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>{yearData.year} · {yearData.class}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{yearData.exams.length} exam{yearData.exams.length !== 1 ? 's' : ''} recorded</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {yearData.promoted && <Tag color="green">✅ Promoted</Tag>}
                {yearData.overallMean !== null && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#10b981' }}>{yearData.overallMean}%</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>Overall</div>
                  </div>
                )}
                <span style={{ color: '#64748b', fontSize: 14 }}>{expandedYear == yi ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Expanded detail */}
            {expandedYear == yi && (
              <div style={{ padding: '0 18px 18px' }}>
                {yearData.exams.length == 0 ? (
                  <div style={{ color: '#64748b', fontSize: 13, padding: '12px 0' }}>No exam records for this year.</div>
                ) : (
                  [1, 2, 3].map(term => {
                    const termExams = yearData.exams.filter(e => e.term == term);
                    if (termExams.length == 0) return null;
                    return (
                      <div key={term} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, paddingTop: 12, borderTop: '1px solid #2a3350' }}>
                          Term {term}
                        </div>
                        {termExams.map((exam, ei) => (
                          <ExamCard key={ei} exam={exam} student={student} data={data} />
                        ))}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ExamCard({ exam, student, data }) {
  const results = exam.results?.[student.name] || {};
  const subjects = Object.keys(results);
  const scores   = subjects.map(s => getScore(results[s])).filter(v => v !== null);
  const total    = scores.reduce((a, b) => a + b, 0);
  const mean     = scores.length ? Math.round(total / scores.length) : null;

  // Compute positions using the same logic as the staff Exams view
  const { posMap, hasStreams } = subjects.length > 0
    ? computeRankings(exam, data.students || [], data)
    : { posMap: {}, hasStreams: false };
  const pos = posMap[student.name] || {};

  return (
    <div style={{ background: '#1e2435', borderRadius: 8, padding: '12px 14px', marginBottom: 8, border: '1px solid #2a3350' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: subjects.length > 0 ? 10 : 0 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{exam.name}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>{exam.type || ''}</div>
        </div>
        {mean !== null && (
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: mean >= 60 ? '#10b981' : mean >= 40 ? '#f59e0b' : '#ef4444' }}>{mean}%</div>
              <GradeBadge score={mean} />
            </div>
            {pos.overallPos && (
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontSize: 11, background: '#ef444420', color: '#ef4444', borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>
                  Overall: {pos.overallPos}/{pos.overallOf}
                </span>
                {hasStreams && pos.streamPos && (
                  <span style={{ fontSize: 11, background: '#4f8ef720', color: '#4f8ef7', borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>
                    Stream: {pos.streamPos}/{pos.streamOf}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {subjects.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {subjects.map(sub => {
            const score = getScore(results[sub]);
            return (
              <div key={sub} style={{ background: '#0f1117', borderRadius: 6, padding: '4px 10px', display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{sub}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: score !== null ? (score >= 60 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444') : '#64748b' }}>
                  {score !== null ? score : '—'}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {subjects.length == 0 && <div style={{ fontSize: 12, color: '#64748b' }}>No scores recorded yet.</div>}
    </div>
  );
}

/* ── Build structured history from exams + promotionHistory ── */
function buildStudentHistory(student, data) {
  const exams = data.exams || [];
  const promotionHistory = data.promotionHistory || [];

  // Find all classes this student has been in via promotion history
  const studentPromo = promotionHistory.filter(p => p.studentId == student.id || p.studentName == student.name);

  // Group exams by year and class
  const yearMap = {};

  exams.forEach(exam => {
    // Check if this exam has results for this student
    const hasResult = exam.results && (exam.results[student.name] !== undefined);

    // Determine if this exam's class matches the student's class at that time
    let relevantClass = null;

    // First check promotion history for the year
    const promoForYear = studentPromo.find(p => p.year == exam.year && p.fromClass == exam.class);
    if (promoForYear) {
      relevantClass = exam.class;
    } else if (exam.class == student.class) {
      relevantClass = exam.class;
    } else if (hasResult) {
      relevantClass = exam.class;
    }

    if (!relevantClass || !hasResult) return;

    const key = `${exam.year}-${relevantClass}`;
    if (!yearMap[key]) {
      yearMap[key] = { year: exam.year, class: relevantClass, exams: [], promoted: false };
    }
    yearMap[key].exams.push(exam);
  });

  // Current year/class if no exams yet
  const currentYear = data.currentYear || new Date().getFullYear();
  const currentKey  = `${currentYear}-${student.class}`;
  if (!yearMap[currentKey] && student.class) {
    yearMap[currentKey] = { year: currentYear, class: student.class, exams: [], promoted: false };
  }

  // Mark promoted years
  studentPromo.forEach(p => {
    const key = `${p.year}-${p.fromClass}`;
    if (yearMap[key]) yearMap[key].promoted = true;
  });

  // Calculate overall mean per year
  const result = Object.values(yearMap)
    .sort((a, b) => a.year - b.year)
    .map(y => {
      const allScores = (y.exams||[]).flatMap(e => {
        const results = e.results?.[student.name] || {};
        return Object.values(results).map(v => getScore(v)).filter(v => v !== null);
      });
      const overallMean = allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : null;
      return { ...y, overallMean };
    });

  return result;
}

/* ── Student Portal (login as student) ── */
export function StudentPortal({ student, data, onLogout }) {
  const [tab, setTab] = useState('history');

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117' }}>
      {/* Header */}
      <div style={{ background: '#171b26', borderBottom: '1px solid #2a3350', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg,#4f8ef7,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color: '#fff' }}>E</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#4f8ef7' }}>EduManage Pro</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{data.schoolName}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{student.name}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{student.class} · {student.admNo}</div>
          </div>
          <Btn variant="ghost" size="sm" onClick={onLogout}>Logout</Btn>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: '#171b26', borderBottom: '1px solid #2a3350', padding: '0 24px', display: 'flex', gap: 0 }}>
        {[{ id: 'history', label: '📚 My Academic History' }, { id: 'profile', label: '👤 My Profile' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '12px 20px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: tab == t.id ? 700 : 400,
            color: tab == t.id ? '#4f8ef7' : '#64748b', borderBottom: `2px solid ${tab == t.id ? '#4f8ef7' : 'transparent'}`, transition: 'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
        {tab == 'history' && (
          <>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', marginBottom: 20 }}>📚 Academic History</div>
            <StudentHistory student={student} data={data} />
          </>
        )}
        {tab == 'profile' && (
          <Card>
            <SectionTitle icon="student">Student Profile</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { label: 'Full Name', value: student.name },
                { label: 'Admission Number', value: student.admNo },
                { label: 'Current Class', value: student.class },
                { label: 'Gender', value: student.gender },
                { label: 'Date of Birth', value: student.dob },
                { label: 'Status', value: student.status || 'Active' },
                { label: "Parent's Name", value: student.parentName },
                { label: "Parent's Phone", value: student.parentPhone },
              ].map(f => (
                <div key={f.label} style={{ padding: '10px 14px', background: '#1e2435', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{f.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{f.value || '—'}</div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ── Parent Portal ── */
export function ParentPortal({ parent, data, onLogout }) {
  // Find all children of this parent
  const myChildren = (data.students || []).filter(s =>
    (s.parentEmail && s.parentEmail.toLowerCase() == parent.email.toLowerCase()) ||
    (s.parentPhone && s.parentPhone == parent.phone)
  );

  const [selChildId, setSelChildId] = useState(myChildren[0]?.id || null);
  const selChild = myChildren.find(s => s.id == selChildId);

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117' }}>
      {/* Header */}
      <div style={{ background: '#171b26', borderBottom: '1px solid #2a3350', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg,#10b981,#4f8ef7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color: '#fff' }}>E</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981' }}>EduManage Pro</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{data.schoolName} · Parent Portal</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{parent.name}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Parent / Guardian</div>
          </div>
          <Btn variant="ghost" size="sm" onClick={onLogout}>Logout</Btn>
        </div>
      </div>

      <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
        {myChildren.length == 0 ? (
          <Card>
            <div style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>No children found</div>
              <div style={{ fontSize: 13 }}>Your email or phone number doesn't match any student records. Please contact the school office.</div>
            </div>
          </Card>
        ) : (
          <>
            {/* Child selector */}
            {myChildren.length > 1 && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                {myChildren.map(child => (
                  <button key={child.id} onClick={() => setSelChildId(child.id)} style={{
                    padding: '10px 18px', borderRadius: 10, border: `1px solid ${selChildId == child.id ? '#4f8ef7' : '#2a3350'}`,
                    background: selChildId == child.id ? '#4f8ef720' : '#171b26', cursor: 'pointer',
                    color: selChildId == child.id ? '#4f8ef7' : '#94a3b8', fontWeight: selChildId == child.id ? 700 : 400, fontSize: 13,
                  }}>
                    {child.name}<div style={{ fontSize: 10, color: '#64748b' }}>{child.class}</div>
                  </button>
                ))}
              </div>
            )}

            {selChild && (
              <>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', marginBottom: 20 }}>
                  📚 {selChild.name}'s Academic History
                </div>
                <StudentHistory student={selChild} data={data} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
