import React, { useState } from 'react';

const IS = {
  base: {
    width:'100%', padding:'11px 14px',
    background:'var(--surface2)',
    border:'1.5px solid var(--border)',
    borderRadius:10, color:'var(--text)', fontSize:14,
    outline:'none', boxSizing:'border-box',
    transition:'all 0.15s',
  },
  focused: {
    background:'var(--surface)',
    border:'1.5px solid #1e40af',
  },
};

function Field({ label, value, onChange, type='text', placeholder, hint, autoFocus }) {
  const [focus, setFocus] = useState(false);
  return (
    <div style={{marginBottom:16}}>
      <label style={{fontSize:12,fontWeight:600,color:'var(--text-muted)',display:'block',marginBottom:5}}>{label}</label>
      <input
        value={value} onChange={e=>onChange(e.target.value)}
        type={type} placeholder={placeholder} autoFocus={autoFocus}
        style={focus ? {...IS.base,...IS.focused} : IS.base}
        onFocus={()=>setFocus(true)} onBlur={()=>setFocus(false)}
      />
      {hint && <div style={{fontSize:11,color:'var(--text-sub)',marginTop:4}}>{hint}</div>}
    </div>
  );
}

export default function Login({ data, onLogin, onCreateSchool, onStudentLogin, onParentLogin, onTeacherRegister, externalError }) {
  const [tab,      setTab]      = useState('staff');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [pwFocus,  setPwFocus]  = useState(false);
  const [slc,      setSlc]      = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [cForm,    setCForm]    = useState({ schoolName:'', yourName:'', email:'', password:'', confirm:'' });
  const [cError,   setCError]   = useState('');
  const [cLoading, setCLoading] = useState(false);

  function reset() { setEmail(''); setPassword(''); setSlc(''); setError(''); setShowPw(false); }

  async function handleLogin(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      let success = false;
      if (tab === 'staff') {
        success = await onLogin(email, password);
        if (!success) setError('Incorrect email or password. Please try again.');
      } else if (tab === 'student') {
        success = onStudentLogin?.(slc);
        if (!success) setError('Student not found. Please check your Login Code (SLC) on your report form.');
      } else if (tab === 'parent') {
        success = onParentLogin?.(slc);
        if (!success) setError("Not found. Use your child's Login Code (SLC) printed on their report form.");
      }
    } catch (err) {
      setError('Connection error: ' + (err?.message || 'Please try again.'));
    } finally { setLoading(false); }
  }

  async function handleCreateSchool(e) {
    e.preventDefault(); setCError('');
    if (!cForm.schoolName.trim()) { setCError('School name is required.'); return; }
    if (!cForm.email.trim())      { setCError('Email is required.'); return; }
    if (cForm.password.length < 6){ setCError('Password must be at least 6 characters.'); return; }
    if (cForm.password !== cForm.confirm) { setCError('Passwords do not match.'); return; }
    setCLoading(true);
    try {
      await onCreateSchool({
        schoolName:        cForm.schoolName.trim(),
        principalName:     cForm.yourName.trim(),
        principalEmail:    cForm.email.trim(),
        principalPassword: cForm.password,
      });
    } catch(err) {
      setCError('Failed to create school: ' + (err?.message || 'Please try again.'));
    } finally { setCLoading(false); }
  }

  const TABS = [
    { id:'staff',   emoji:'👤', label:'Staff',   sub:'Teachers & Admin' },
    { id:'student', emoji:'🎒', label:'Student', sub:'View results & history' },
    { id:'parent',  emoji:'👨‍👩‍👧', label:'Parent',  sub:"Track child's progress" },
  ];

  const isStaff   = tab === 'staff';
  const isStudent = tab === 'student';
  const isParent  = tab === 'parent';
  const submitDisabled = loading || (isStaff ? (!email || !password) : !slc);

  return (
    <div style={{
      minHeight:'100vh',
      background:'linear-gradient(135deg,#eff6ff 0%,#f0fdf4 50%,#fefce8 100%)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:20,
      fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    }}>
      {/* Background blobs */}
      <div style={{position:'fixed',inset:0,pointerEvents:'none',overflow:'hidden'}}>
        <div style={{position:'absolute',top:-100,right:-100,width:400,height:400,borderRadius:'50%',background:'radial-gradient(circle,#dbeafe80,transparent 70%)'}}/>
        <div style={{position:'absolute',bottom:-80,left:-80,width:350,height:350,borderRadius:'50%',background:'radial-gradient(circle,#dcfce780,transparent 70%)'}}/>
      </div>

      <div style={{width:'100%', maxWidth:460, position:'relative'}}>

        {/* Logo — never show school name before login */}
        <div style={{textAlign:'center', marginBottom:28}}>
          <div style={{
            width:64, height:64, borderRadius:18,
            background:'linear-gradient(135deg,#1e40af,#7c3aed)',
            display:'flex', alignItems:'center', justifyContent:'center',
            margin:'0 auto 14px', fontSize:26, fontWeight:900, color:'#fff',
            boxShadow:'0 12px 32px #1e40af40',
          }}>E</div>
          <div style={{fontSize:22, fontWeight:800, color:'var(--text)', letterSpacing:-0.5}}>EduManage Pro</div>
          <div style={{fontSize:13, color:'var(--text-sub)', marginTop:3}}>School Management System</div>
        </div>

        {/* Tab switcher */}
        <div style={{
          display:'flex', background:'var(--surface)', border:'1.5px solid var(--border)',
          borderRadius:14, padding:5, marginBottom:20, gap:4,
          boxShadow:'0 2px 8px #0000000a',
        }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); reset(); }} style={{
              flex:1, padding:'10px 6px', border:'none', borderRadius:10, cursor:'pointer',
              background: tab===t.id ? 'linear-gradient(135deg,#1e40af,#7c3aed)' : 'transparent',
              color: tab===t.id ? '#fff' : 'var(--text-muted)',
              transition:'all 0.2s',
            }}>
              <div style={{fontSize:20, marginBottom:2}}>{t.emoji}</div>
              <div style={{fontSize:12, fontWeight:700}}>{t.label}</div>
              <div style={{fontSize:10, opacity:0.8}}>{t.sub}</div>
            </button>
          ))}
        </div>

        {/* Login card */}
        <div style={{
          background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:20,
          padding:32, boxShadow:'0 20px 60px #0000000f', marginBottom:16,
        }}>
          <div style={{marginBottom:22}}>
            <div style={{fontSize:17, fontWeight:800, color:'var(--text)'}}>
              {TABS.find(t=>t.id===tab)?.label} Login
            </div>
            <div style={{fontSize:13, color:'var(--text-sub)', marginTop:3}}>
              {TABS.find(t=>t.id===tab)?.sub}
            </div>
          </div>

          <form onSubmit={handleLogin}>

            {/* STAFF fields */}
            {isStaff && (
              <>
                <Field
                  label="Email Address"
                  value={email} onChange={setEmail}
                  type="email" placeholder="you@school.ac.ke"
                  autoFocus
                />
                <div style={{marginBottom:16}}>
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:5}}>
                    <label style={{fontSize:12, fontWeight:600, color:'var(--text-muted)'}}>Password</label>
                    <span style={{fontSize:12, color:'#1e40af', cursor:'pointer', fontWeight:500}}
                      onClick={() => setShowPw(!showPw)}>
                      {showPw ? 'Hide' : 'Show'}
                    </span>
                  </div>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password} onChange={e=>setPassword(e.target.value)}
                    placeholder="Your password"
                    style={pwFocus ? {...IS.base,...IS.focused} : IS.base}
                    onFocus={()=>setPwFocus(true)} onBlur={()=>setPwFocus(false)}
                  />
                </div>
              </>
            )}

            {/* STUDENT fields */}
            {isStudent && (
              <>
                <Field
                  label="Student Login Code (SLC)"
                  value={slc} onChange={setSlc}
                  placeholder="e.g. 2024-4872"
                  autoFocus
                  hint="Your SLC code is printed on your report form and class list"
                />
                <div style={{
                  background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:10,
                  padding:'10px 14px', fontSize:12, color:'#0369a1', marginBottom:16,
                }}>
                  <strong>Where is my Login Code?</strong> — It is printed on every report form, class list, and leaving certificate. Ask your class teacher if you cannot find it.
                </div>
              </>
            )}

            {/* PARENT fields */}
            {isParent && (
              <>
                <Field
                  label="Student Login Code (SLC)"
                  value={slc} onChange={setSlc}
                  placeholder="e.g. 2024-4872"
                  autoFocus
                  hint="Use your child's SLC code printed on their report form"
                />
                <div style={{
                  background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10,
                  padding:'10px 14px', fontSize:12, color:'#15803d', marginBottom:16,
                }}>
                  <strong>Parent Login:</strong> Use your child's SLC code from their latest report form. Each child has a unique code.
                </div>
              </>
            )}

            {/* Error */}
            {(error || externalError) && (
              <div style={{
                background:'#fef2f2', border:'1px solid #fecaca', color:'#dc2626',
                borderRadius:10, padding:'11px 14px', fontSize:13, marginBottom:16,
                display:'flex', gap:8,
              }}>
                <span>⚠</span><span>{externalError || error}</span>
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={submitDisabled} style={{
              width:'100%', padding:13, borderRadius:12, border:'none',
              background: submitDisabled
                ? 'var(--text)'
                : 'linear-gradient(135deg,#1e40af,#7c3aed)',
              color: submitDisabled ? 'var(--text-sub)' : '#fff',
              fontSize:15, fontWeight:700,
              cursor: submitDisabled ? 'not-allowed' : 'pointer',
              boxShadow: submitDisabled ? 'none' : '0 6px 20px #1e40af40',
              transition:'all 0.2s',
            }}>
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </form>
        </div>

        {/* Footer links */}
        <div style={{
          display:'flex', justifyContent:'space-between', flexWrap:'wrap',
          gap:8, fontSize:12, color:'var(--text-sub)', padding:'0 4px',
        }}>
          <span>
            New school?{' '}
            <span style={{color:'#1e40af', cursor:'pointer', fontWeight:700}}
              onClick={() => setShowCreate(true)}>
              Register here
            </span>
          </span>
        </div>
      </div>

      {/* Create School Modal */}
      {showCreate && (
        <div style={{
          position:'fixed', inset:0, background:'#00000070', zIndex:9999,
          display:'flex', alignItems:'center', justifyContent:'center', padding:20,
        }}>
          <div style={{
            background:'var(--surface)', borderRadius:20, padding:32,
            width:'100%', maxWidth:460,
            boxShadow:'0 24px 80px #00000020',
            maxHeight:'90vh', overflowY:'auto',
          }}>
            <div style={{fontSize:18, fontWeight:800, color:'var(--text)', marginBottom:4}}>
              🏫 Register Your School
            </div>
            <div style={{fontSize:13, color:'var(--text-muted)', marginBottom:22}}>
              Set up your school on EduManage Pro
            </div>
            <form onSubmit={handleCreateSchool}>
              {[
                { label:'School Name *',     key:'schoolName', ph:'e.g. Kyaimu Comprehensive',  type:'text'     },
                { label:'Your Name',         key:'yourName',   ph:'e.g. Felix Mutisya',          type:'text'     },
                { label:'Email Address *',   key:'email',      ph:'you@school.ac.ke',            type:'email'    },
                { label:'Password *',        key:'password',   ph:'Min 6 characters',            type:'password' },
                { label:'Confirm Password *',key:'confirm',    ph:'Re-enter password',           type:'password' },
              ].map(f => (
                <div key={f.key} style={{marginBottom:14}}>
                  <label style={{fontSize:12, fontWeight:600, color:'var(--text-muted)', display:'block', marginBottom:5}}>
                    {f.label}
                  </label>
                  <input
                    type={f.type}
                    value={cForm[f.key]}
                    onChange={e => setCForm(p => ({...p, [f.key]: e.target.value}))}
                    placeholder={f.ph}
                    style={IS.base}
                  />
                </div>
              ))}
              {cError && (
                <div style={{
                  background:'#fef2f2', border:'1px solid #fecaca', color:'#dc2626',
                  borderRadius:10, padding:'11px 14px', fontSize:13, marginBottom:14,
                }}>
                  ⚠ {cError}
                </div>
              )}
              <div style={{display:'flex', gap:10, marginTop:8}}>
                <button type="button" onClick={() => setShowCreate(false)} style={{
                  flex:1, padding:12, borderRadius:10,
                  border:'1.5px solid var(--border)', background:'transparent',
                  color:'var(--text-muted)', fontSize:14, cursor:'pointer', fontWeight:600,
                }}>
                  Cancel
                </button>
                <button type="submit" disabled={cLoading} style={{
                  flex:2, padding:12, borderRadius:10, border:'none',
                  background:'linear-gradient(135deg,#1e40af,#7c3aed)',
                  color:'#fff', fontSize:14, fontWeight:700,
                  cursor: cLoading ? 'not-allowed' : 'pointer',
                }}>
                  {cLoading ? 'Creating...' : 'Create School Account →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`input::placeholder { color: var(--text-muted); }`}</style>
    </div>
  );
}
