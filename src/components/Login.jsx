import React, { useState } from 'react';

function getRoleLabel(staff) {
  if (staff.admin) return 'Principal / Admin';
  if (staff.staffType === 'teaching') return staff.isClassTeacher ? 'Class Teacher' : 'Subject Teacher';
  return `Non-Teaching Staff (${staff.dept})`;
}

export default function Login({ data, onLogin, onCreateSchool }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPw, setShowPw]     = useState(false);
  const [mode, setMode]         = useState('login'); // 'login' | 'create'
  // Create school form
  const [cForm, setCForm] = useState({ schoolName: '', yourName: '', email: '', password: '', confirm: '' });
  const [cError, setCError] = useState('');
  const [cLoading, setCLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const success = await onLogin(email, password);
      if (!success) {
        setError('Incorrect email or password. Please try again.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Connection error: ' + (err?.message || JSON.stringify(err)));
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
      await onCreateSchool({
        schoolName: cForm.schoolName.trim(),
        principalName: cForm.yourName.trim(),
        principalEmail: cForm.email.trim(),
        principalPassword: cForm.password,
      });
    } catch (err) {
      setCError('Failed to create school: ' + (err?.message || 'Please try again.'));
    } finally {
      setCLoading(false);
    }
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

        {/* Create School Account link */}
        <div style={{ textAlign: 'center', fontSize: 13, color: '#64748b' }}>
          New school?{' '}
          <span style={{ color: '#4f8ef7', cursor: 'pointer', fontWeight: 600 }} onClick={() => { setMode('create'); setError(''); }}>
            Create School Account
          </span>
        </div>

        {/* Create School Modal */}
        {mode === 'create' && (
          <div style={{ position: 'fixed', inset: 0, background: '#000a', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#171b26', border: '1px solid #2a3350', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 24px 64px #000a', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Create School Account</div>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>Set up your school on EduManage Pro</div>
              <form onSubmit={handleCreateSchool}>
                {[
                  { label: 'School Name *', key: 'schoolName', placeholder: 'e.g. Kyaimu Comprehensive', type: 'text' },
                  { label: 'Your Name', key: 'yourName', placeholder: 'e.g. Felix Mutisya', type: 'text' },
                  { label: 'Email Address *', key: 'email', placeholder: 'you@school.ac.ke', type: 'email' },
                  { label: 'Password *', key: 'password', placeholder: 'Min 6 characters', type: 'password' },
                  { label: 'Confirm Password *', key: 'confirm', placeholder: 'Re-enter password', type: 'password' },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8', display: 'block', marginBottom: 5 }}>{f.label}</label>
                    <input type={f.type} value={cForm[f.key]} onChange={e => setCForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}
                      style={{ width: '100%', padding: '10px 13px', background: '#1e2435', border: '1px solid #2a3350', borderRadius: 8, color: '#e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                ))}
                {cError && (
                  <div style={{ background: '#ef444415', border: '1px solid #ef444440', color: '#ef4444', borderRadius: 8, padding: '10px 13px', fontSize: 13, marginBottom: 14 }}>
                    ⚠ {cError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button type="button" onClick={() => setMode('login')} style={{ flex: 1, padding: '11px', borderRadius: 8, border: '1px solid #2a3350', background: 'transparent', color: '#94a3b8', fontSize: 14, cursor: 'pointer' }}>
                    Back to Login
                  </button>
                  <button type="submit" disabled={cLoading} style={{ flex: 2, padding: '11px', borderRadius: 8, border: 'none', background: '#4f8ef7', color: '#fff', fontSize: 14, fontWeight: 600, cursor: cLoading ? 'not-allowed' : 'pointer' }}>
                    {cLoading ? 'Creating...' : 'Create School Account →'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
      <style>{`@keyframes spin { to { transform:rotate(360deg); } } input::placeholder { color:#4a5568; }`}</style>
    </div>
  );
}
