import React, { useState } from 'react';

function getRoleLabel(staff) {
  if (staff.admin) return 'Principal / Admin';
  if (staff.staffType === 'teaching') return staff.isClassTeacher ? 'Class Teacher' : 'Subject Teacher';
  return `Non-Teaching Staff (${staff.dept})`;
}

export default function Login({ data, onLogin }) {
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw]   = useState(false);

  function handleLogin(e) {
    e.preventDefault();
    setError(''); setLoading(true);

    setTimeout(() => {
      setLoading(false);

      // Principal
      const pEmail = (data.principalEmail || 'principal@school.ac.ke').toLowerCase();
      if (email.toLowerCase() === pEmail && password === (data.principalPassword || 'admin123')) {
        const principalStaff = data.teachers.find(t => t.admin);
        onLogin({
          role: 'principal', name: data.principalName || 'Principal',
          email, dept: 'Management',
          staffId: principalStaff?.staffId || 'T000',
          classTeacherOf: null, teacherSubjects: [],
          canSeeFees: true, canSeeKitchenAlerts: true,
        });
        return;
      }

      // Staff
      const staff = data.teachers.find(t => t.email.toLowerCase() === email.toLowerCase());
      if (!staff) { setError('No account found with that email address.'); return; }

      const correctPw = staff.password || staff.staffId;
      if (password !== correctPw) { setError('Incorrect password. Please contact your administrator.'); return; }

      const role = staff.admin ? 'principal'
        : staff.staffType === 'teaching'
          ? (staff.isClassTeacher ? 'class_teacher' : 'subject_teacher')
          : 'non_teaching';

      onLogin({
        role,
        name:               staff.name,
        email:              staff.email,
        dept:               staff.dept,
        staffId:            staff.staffId,
        staffType:          staff.staffType,
        isClassTeacher:     staff.isClassTeacher || false,
        classTeacherOf:     staff.classTeacherOf || null,
        teacherSubjects:    staff.subjects || [],
        canSeeFees:         staff.canSeeFees || false,
        canSeeKitchenAlerts:staff.canSeeKitchenAlerts || false,
      });
    }, 500);
  }



  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at 20% 20%, #4f8ef718 0%, transparent 50%), radial-gradient(circle at 80% 80%, #7c3aed12 0%, transparent 50%)' }} />

      <div style={{ width: '100%', maxWidth: 440, position: 'relative' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 60, height: 60, borderRadius: 14, background: 'linear-gradient(135deg,#4f8ef7,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 26, fontWeight: 800, color: '#fff', boxShadow: '0 8px 24px #4f8ef740' }}>E</div>
          <div style={{ fontSize: 21, fontWeight: 700, color: '#e2e8f0', marginBottom: 3 }}>EduManage Pro</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>{data.schoolName || 'School Management System'}</div>
        </div>

        {/* Card */}
        <div style={{ background: '#171b26', border: '1px solid #2a3350', borderRadius: 16, padding: 28, boxShadow: '0 24px 64px rgba(0,0,0,0.4)', marginBottom: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: '#e2e8f0', marginBottom: 3 }}>Sign in</div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 22 }}>Enter your email and password to continue</div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@school.ac.ke" required autoFocus
                style={{ width: '100%', padding: '10px 13px', background: '#1e2435', border: '1px solid #2a3350', borderRadius: 8, color: '#e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#4f8ef7'} onBlur={e => e.target.style.borderColor = '#2a3350'} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>Password</label>
                <span style={{ fontSize: 12, color: '#4f8ef7', cursor: 'pointer' }} onClick={() => setShowPw(!showPw)}>{showPw ? 'Hide' : 'Show'}</span>
              </div>
              <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required
                style={{ width: '100%', padding: '10px 13px', background: '#1e2435', border: '1px solid #2a3350', borderRadius: 8, color: '#e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#4f8ef7'} onBlur={e => e.target.style.borderColor = '#2a3350'} />
            </div>
            {error && (
              <div style={{ background: '#ef444415', border: '1px solid #ef444440', color: '#ef4444', borderRadius: 8, padding: '10px 13px', fontSize: 13, marginBottom: 14, display: 'flex', gap: 8 }}>
                <span>⚠</span><span>{error}</span>
              </div>
            )}
            <button type="submit" disabled={loading || !email || !password}
              style={{ width: '100%', padding: '11px', borderRadius: 8, border: 'none', background: '#4f8ef7', color: '#fff', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.8 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading ? (<><span style={{ width: 14, height: 14, border: '2px solid #fff4', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Signing in...</>) : 'Sign In →'}
            </button>
          </form>
        </div>


      </div>
      <style>{`@keyframes spin { to { transform:rotate(360deg); } } input::placeholder { color:#4a5568; }`}</style>
    </div>
  );
}
