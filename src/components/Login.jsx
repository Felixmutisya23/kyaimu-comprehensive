import React, { useState } from 'react';

const INPUT_STYLE = {
  width: '100%', padding: '10px 13px', background: '#1e2435', border: '1px solid #2a3350',
  borderRadius: 8, color: '#e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box',
};

export default function Login({ data, onLogin, onCreateSchool, onStudentLogin, onParentLogin, onTeacherRegister, externalError }) {
  const [tab,      setTab]      = useState('staff');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPw,   setShowPw]   = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [cForm,    setCForm]    = useState({ schoolName: '', yourName: '', email: '', password: '', confirm: '' });
  const [cError,   setCError]   = useState('');
  const [cLoading, setCLoading] = useState(false);

  function reset() { setEmail(''); setPassword(''); setError(''); setShowPw(false); }

  async function handleLogin(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      let success = false;
      if (tab == 'staff') {
        success = await onLogin(email, password);
        if (!success) setError('Incorrect email or password. Please try again.');
      } else if (tab == 'student') {
        success = onStudentLogin?.(email);
        if (!success) setError('Student not found. Please check your Admission Number.');
      } else if (tab == 'parent') {
        success = onParentLogin?.(email);
        if (!success) setError('Parent not found. Please check your phone number.');
      }
    } catch (err) {
      setError('Connection error: ' + (err?.message || 'Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSchool(e) {
    e.preventDefault();
    setCError('');
    if (!cForm.schoolName.trim()) { setCError('School name is required.'); return; }
    if (!cForm.email.trim()) { setCError('Email is required.'); return; }
    if (cForm.password.length < 6) { setCError('Password must be at least 6 characters.'); return; }
    if (cForm.password !== cForm.confirm) { setCError('Passwords do not match.'); return; }
    setCLoading(true);
    try {
      await onCreateSchool({ schoolName: cForm.schoolName.trim(), principalName: cForm.yourName.trim(), principalEmail: cForm.email.trim(), principalPassword: cForm.password });
    } catch (err) {
      setCError('Failed to create school: ' + (err?.message || 'Please try again.'));
    } finally { setCLoading(false); }
  }

  const TABS = [
    { id: 'staff',   icon: '👤', label: 'Staff Login',   hint: 'Teachers & Administrators' },
    { id: 'student', icon: '🎒', label: 'Student Login',  hint: 'View your results & history' },
    { id: 'parent',  icon: '👨‍👩‍👧', label: 'Parent Login',   hint: "Track your child's progress" },
  ];

  const hints = {
    staff:   { user: 'Email address',   ph1: 'you@school.ac.ke',   pw: 'Password',  ph2: 'Your password', showPwField: true },
    student: { user: 'Admission Number', ph1: 'e.g. 2024001',      pw: null, ph2: null, showPwField: false },
    parent:  { user: 'Phone Number',    ph1: 'e.g. 0712345678',    pw: null, ph2: null, showPwField: false },
  };
  const h = hints[tab];

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at 20% 20%, #4f8ef718 0%, transparent 50%), radial-gradient(circle at 80% 80%, #7c3aed12 0%, transparent 50%)' }} />
      <div style={{ width: '100%', maxWidth: 460, position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 58, height: 58, borderRadius: 14, background: 'linear-gradient(135deg,#4f8ef7,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 24, fontWeight: 800, color: '#fff', boxShadow: '0 8px 24px #4f8ef740' }}>E</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0' }}>EduManage Pro</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{data.schoolName || 'School Management System'}</div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', background: '#171b26', border: '1px solid #2a3350', borderRadius: 12, padding: 4, marginBottom: 16, gap: 4 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); reset(); }} style={{
              flex: 1, padding: '9px 4px', border: 'none', borderRadius: 8, cursor: 'pointer',
              background: tab == t.id ? '#4f8ef7' : 'transparent',
              color: tab == t.id ? '#fff' : '#64748b',
              fontSize: 11, fontWeight: tab == t.id ? 700 : 400,
            }}>
              <div style={{ fontSize: 18, marginBottom: 2 }}>{t.icon}</div>
              <div>{t.label}</div>
            </button>
          ))}
        </div>

        <div style={{ background: '#171b26', border: '1px solid #2a3350', borderRadius: 16, padding: 28, boxShadow: '0 24px 64px rgba(0,0,0,0.4)', marginBottom: 12 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>{TABS.find(t => t.id == tab)?.label}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{TABS.find(t => t.id == tab)?.hint}</div>
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8', display: 'block', marginBottom: 5 }}>{h.user}</label>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder={h.ph1} required autoFocus
                type={tab == 'parent' ? 'tel' : 'text'} style={INPUT_STYLE}
                onFocus={e => e.target.style.borderColor='#4f8ef7'} onBlur={e => e.target.style.borderColor='#2a3350'} />
            </div>
            {h.showPwField && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>{h.pw}</label>
                  <span style={{ fontSize: 12, color: '#4f8ef7', cursor: 'pointer' }} onClick={() => setShowPw(!showPw)}>{showPw ? 'Hide' : 'Show'}</span>
                </div>
                <input type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder={h.ph2} required style={INPUT_STYLE}
                  onFocus={e => e.target.style.borderColor='#4f8ef7'} onBlur={e => e.target.style.borderColor='#2a3350'} />
              </div>
            )}

            {tab == 'student' && (
              <div style={{ background: '#4f8ef710', border: '1px solid #4f8ef730', borderRadius: 8, padding: '9px 12px', fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>
                📌 Enter your <strong>Admission Number</strong> to sign in
              </div>
            )}
            {tab == 'parent' && (
              <div style={{ background: '#10b98110', border: '1px solid #10b98130', borderRadius: 8, padding: '9px 12px', fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>
                📌 Enter your <strong>Phone Number</strong> (e.g. 0712345678) to sign in
              </div>
            )}

            {(error || externalError) && (
              <div style={{ background: '#ef444415', border: '1px solid #ef444440', color: '#ef4444', borderRadius: 8, padding: '10px 13px', fontSize: 13, marginBottom: 14, display: 'flex', gap: 8 }}>
                <span>⚠</span><span>{externalError || error}</span>
              </div>
            )}
            <button type="submit" disabled={loading || !email || (tab === 'staff' && !password)} style={{
              width: '100%', padding: '11px', borderRadius: 8, border: 'none',
              background: tab == 'parent' ? '#10b981' : '#4f8ef7',
              color: '#fff', fontSize: 14, fontWeight: 600, cursor: (loading||!email||(tab==='staff'&&!password)) ? 'not-allowed' : 'pointer',
              opacity: (loading||!email||(tab==='staff'&&!password)) ? 0.7 : 1,
            }}>
              {loading ? 'Signing in...' : `Sign In as ${tab == 'staff' ? 'Staff' : tab == 'student' ? 'Student' : 'Parent'} →`}
            </button>
          </form>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, fontSize: 12, color: '#64748b', padding: '0 4px' }}>
          <span>New school? <span style={{ color: '#4f8ef7', cursor: 'pointer', fontWeight: 600 }} onClick={() => setShowCreate(true)}>Register your school</span></span>

        </div>
      </div>

      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: '#000a', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#171b26', border: '1px solid #2a3350', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 24px 64px #000a', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>🏫 Register Your School</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>Set up your school on EduManage Pro</div>
            <form onSubmit={handleCreateSchool}>
              {[
                { label: 'School Name *',    key: 'schoolName', ph: 'e.g. Kyaimu Comprehensive', type: 'text' },
                { label: 'Your Name',         key: 'yourName',   ph: 'e.g. Felix Mutisya',        type: 'text' },
                { label: 'Email Address *',   key: 'email',      ph: 'you@school.ac.ke',           type: 'email' },
                { label: 'Password *',        key: 'password',   ph: 'Min 6 characters',           type: 'password' },
                { label: 'Confirm Password *',key: 'confirm',    ph: 'Re-enter password',          type: 'password' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8', display: 'block', marginBottom: 5 }}>{f.label}</label>
                  <input type={f.type} value={cForm[f.key]} onChange={e => setCForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph} style={INPUT_STYLE} />
                </div>
              ))}
              {cError && <div style={{ background: '#ef444415', border: '1px solid #ef444440', color: '#ef4444', borderRadius: 8, padding: '10px 13px', fontSize: 13, marginBottom: 14 }}>⚠ {cError}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button type="button" onClick={() => setShowCreate(false)} style={{ flex: 1, padding: '11px', borderRadius: 8, border: '1px solid #2a3350', background: 'transparent', color: '#94a3b8', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={cLoading} style={{ flex: 2, padding: '11px', borderRadius: 8, border: 'none', background: '#4f8ef7', color: '#fff', fontSize: 14, fontWeight: 600, cursor: cLoading?'not-allowed':'pointer' }}>
                  {cLoading ? 'Creating...' : 'Create School Account →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} input::placeholder{color:#4a5568}`}</style>
    </div>
  );
}
