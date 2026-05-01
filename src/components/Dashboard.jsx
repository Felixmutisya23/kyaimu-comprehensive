import React from 'react';
import { Card, SectionTitle, Alert, ProgressBar, Tag, Icon } from './UI';
import { canSeeKitchenAlerts, canSeeFees } from '../data/initialData';

export default function Dashboard({ data, user }) {
  const isPrincipal    = user.role === 'principal';
  const isClassTeacher = user.isClassTeacher;
  const myClass        = user.classTeacherOf;
  const showKitchen    = canSeeKitchenAlerts(user, data);
  const showFees       = canSeeFees(user, data);
  const isTeaching     = user.role === 'class_teacher' || user.role === 'subject_teacher';

  const lowInv      = data.inventory.filter(i => i.current <= i.min);
  const totalFees   = data.students.reduce((s, st) => s + st.fees.total, 0);
  const paidFees    = data.students.reduce((s, st) => s + st.fees.paid, 0);
  const unreadMsgs  = data.messages.filter(m => !m.read && (isPrincipal || m.dept === user.dept)).length;
  const myStudents  = isClassTeacher ? data.students.filter(s => s.class === myClass) : data.students;
  const pendingReqs = (data.editRequests || []).filter(r => r.status === 'pending');

  const myNotifUnread = (data.notifications || []).filter(n => !n.read && (n.to === user.staffId || n.to === 'ALL')).length;
  const myApprovalsPending = pendingReqs.filter(r => {
    if (isPrincipal && r.approvals.principal === null) return true;
    const staff = data.teachers.find(t => t.staffId === user.staffId);
    if (staff?.classTeacherOf) {
      const exam = data.exams.find(e => e.id === r.examId);
      return exam?.class === staff.classTeacherOf && r.approvals.classTeacher === null;
    }
    return false;
  }).length;

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
          Welcome back, {user.name.split(' ')[0]} 👋
        </h2>
        <p style={{ color: '#64748b', fontSize: 13 }}>
          {new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          {myClass && <span style={{ marginLeft: 10 }}>· Class Teacher: <strong style={{ color: '#4f8ef7' }}>{myClass}</strong></span>}
        </p>
      </div>

      {/* Kitchen alert — restricted */}
      {showKitchen && lowInv.length > 0 && (
        <Alert type="warning">
          <Icon name="alert" size={16} />
          <div><strong>Kitchen Alert: </strong>{lowInv.map(i => `${i.name} (${i.current}${i.unit})`).join(', ')} running low. Please restock.</div>
        </Alert>
      )}

      {/* Unread messages */}
      {unreadMsgs > 0 && (
        <Alert type="info">
          <Icon name="messages" size={14} />
          <span>You have <strong>{unreadMsgs} unread message{unreadMsgs > 1 ? 's' : ''}</strong> for your department.</span>
        </Alert>
      )}

      {/* Pending approvals */}
      {myApprovalsPending > 0 && (
        <Alert type="warning">
          <Icon name="alert" size={14} />
          <span>You have <strong>{myApprovalsPending} score edit request{myApprovalsPending > 1 ? 's' : ''}</strong> awaiting your approval. Go to Notifications.</span>
        </Alert>
      )}

      {/* ── Stat cards ──────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 14, marginBottom: 20 }}>
        {/* Students — teaching staff see their class only */}
        {(isPrincipal || isTeaching) && (
          <StatCard
            icon="students" value={isClassTeacher ? myStudents.length : data.students.length}
            label={isClassTeacher ? `Students (${myClass})` : 'Total Students'} color="#4f8ef7" />
        )}

        {/* Fee collection — only finance/principal */}
        {showFees && (
          <StatCard icon="fees" value={`KES ${(paidFees / 1000).toFixed(0)}K`} label="Fees Collected" color="#10b981" />
        )}

        {/* Staff — principal only */}
        {isPrincipal && (
          <StatCard icon="teachers" value={data.teachers.filter(t => !t.admin).length} label="Teaching Staff" color="#f59e0b" />
        )}

        {/* Departments */}
        {isPrincipal && (
          <StatCard icon="dept" value={data.departments.length} label="Departments" color="#7c3aed" />
        )}

        {/* Notifications */}
        {myNotifUnread > 0 && (
          <StatCard icon="bell" value={myNotifUnread} label="Notifications" color="#ef4444" />
        )}

        {/* My exams */}
        {(isPrincipal || isTeaching) && (
          <StatCard icon="exams" value={data.exams.filter(e => isClassTeacher ? e.class === myClass : true).length} label="Exams on Record" color="#ec4899" />
        )}
      </div>

      {/* ── Main grid ───────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: isPrincipal ? '1fr 1fr' : '1fr', gap: 16 }}>

        {/* Fee breakdown — principal + finance */}
        {showFees && isPrincipal && (
          <Card>
            <SectionTitle icon="fees">Fee Collection Overview</SectionTitle>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 5 }}>
                <span>Overall</span>
                <span>KES {paidFees.toLocaleString()} / {totalFees.toLocaleString()}</span>
              </div>
              <ProgressBar pct={Math.round(paidFees / totalFees * 100)} color="#10b981" />
            </div>
            {data.students.slice(0, 6).map(s => {
              const pct = Math.round(s.fees.paid / s.fees.total * 100);
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #2a3350' }}>
                  <div style={{ width: 100, fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                  <ProgressBar pct={pct} />
                  <span style={{ fontSize: 11, color: '#64748b', minWidth: 32 }}>{pct}%</span>
                </div>
              );
            })}
          </Card>
        )}

        {/* Kitchen — admin/kitchen/finance only */}
        {showKitchen && (
          <Card>
            <SectionTitle icon="kitchen">Kitchen Inventory Status</SectionTitle>
            {data.inventory.map(i => {
              const pct = Math.round(i.current / i.max * 100);
              const low = i.current <= i.min;
              return (
                <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #2a3350' }}>
                  <div style={{ width: 120, fontSize: 12, color: low ? '#ef4444' : '#94a3b8', fontWeight: low ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {low ? '⚠ ' : ''}{i.name}
                  </div>
                  <ProgressBar pct={pct} color={low ? '#ef4444' : pct > 60 ? '#10b981' : '#f59e0b'} />
                  <span style={{ fontSize: 11, color: '#64748b', minWidth: 48, textAlign: 'right' }}>{i.current}{i.unit}</span>
                </div>
              );
            })}
          </Card>
        )}

        {/* Class teacher: my class students */}
        {isClassTeacher && (
          <Card>
            <SectionTitle icon="students">My Class — {myClass}</SectionTitle>
            {myStudents.length === 0
              ? <p style={{ color: '#64748b', fontSize: 13 }}>No students in {myClass} yet. Add them from Students.</p>
              : myStudents.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #2a3350', fontSize: 13, alignItems: 'center' }}>
                  <span style={{ fontWeight: 500 }}>{s.name}</span>
                  <span style={{ color: '#64748b', fontSize: 12 }}>{s.admNo}</span>
                  {s.cases.length > 0 ? <Tag color="red">{s.cases.length} case{s.cases.length > 1 ? 's' : ''}</Tag> : <Tag color="green">Clear</Tag>}
                </div>
              ))}
          </Card>
        )}

        {/* Subject teacher: my teaching schedule */}
        {!isPrincipal && !isClassTeacher && isTeaching && (
          <Card>
            <SectionTitle icon="timetable">My Teaching Schedule</SectionTitle>
            {(user.teacherSubjects || []).length === 0
              ? <p style={{ color: '#64748b', fontSize: 13 }}>No subjects assigned to you yet.</p>
              : (user.teacherSubjects || []).map((s, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #2a3350', fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: '#4f8ef7' }}>{s.subject}</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {s.classes.map(c => <Tag key={c} color="green">{c}</Tag>)}
                  </div>
                </div>
              ))}
          </Card>
        )}

        {/* Non-teaching: just department info */}
        {user.role === 'non_teaching' && !showKitchen && (
          <Card>
            <SectionTitle icon="dept">Your Department</SectionTitle>
            <div style={{ fontSize: 32, marginBottom: 10 }}>{
              user.dept === 'Finance' ? '💰' : user.dept === 'Library' ? '📖' : user.dept === 'Security' ? '🔒' : user.dept === 'Sports' ? '⚽' : '🏢'
            }</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{user.dept} Department</div>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              {data.teachers.filter(t => t.dept === user.dept).length} staff members
            </div>
            {unreadMsgs > 0 && (
              <div style={{ marginTop: 12 }}>
                <Tag color="red">{unreadMsgs} unread message{unreadMsgs > 1 ? 's' : ''}</Tag>
              </div>
            )}
          </Card>
        )}

        {/* Principal: quick overview */}
        {isPrincipal && (
          <Card>
            <SectionTitle icon="report">Quick Overview</SectionTitle>
            {[
              ['Total Students',   data.students.length,                            '#4f8ef7'],
              ['Total Staff',      data.teachers.filter(t => !t.admin).length,      '#10b981'],
              ['Exams on Record',  data.exams.length,                               '#f59e0b'],
              ['Pending Approvals',pendingReqs.length,                              pendingReqs.length > 0 ? '#ef4444' : '#64748b'],
              ['Low Stock Items',  lowInv.length,                                   lowInv.length > 0 ? '#ef4444' : '#64748b'],
              ['Unread Messages',  unreadMsgs,                                       unreadMsgs > 0 ? '#f59e0b' : '#64748b'],
            ].map(([l, v, c]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #2a3350', fontSize: 13 }}>
                <span style={{ color: '#94a3b8' }}>{l}</span>
                <span style={{ fontWeight: 700, color: c }}>{v}</span>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, value, label, color }) {
  return (
    <div style={{ background: '#171b26', border: '1px solid #2a3350', borderRadius: 12, padding: 16, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: 14, top: 14, width: 34, height: 34, borderRadius: 8, background: color + '20', color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={17} />
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{label}</div>
    </div>
  );
}
