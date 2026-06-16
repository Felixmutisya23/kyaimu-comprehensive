import React, { useState, useEffect } from 'react';
import { INITIAL_DATA, canSeeKitchenAlerts, canSeeFees, isTeachingStaff } from './data/initialData';
import { Icon } from './components/UI';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Students from './components/Students';
import Teachers from './components/Teachers';
import Exams from './components/Exams';
import Timetable from './components/Timetable';
import Messages from './components/Messages';
import { Kitchen, Departments, Settings } from './components/Modules';
import FeesModule from './components/FeesModule';
import StudentStatus from './components/StudentStatus';
import TermManagement, { getCurrentTermInfo, TermBadge, PromotionPanel } from './components/TermManagement';
import ParentMessaging from './components/ParentMessaging';
import { useLicense, LicenseGate, TokenGenerator } from './components/LicenseSystem';
import TeacherPortal from './components/TeacherPortal';
import { TeacherRegisterPage } from './components/TeacherRegistration';
import { StudentPortal, ParentPortal } from './components/StudentHistory';
import PublicPage from './components/PublicPage';
import AuditLog from './components/AuditLog';
import { logAction } from './components/AuditLog';
import {
  loadSchoolData, saveSchoolData, createSchool,
  loginPrincipal, loginTeacher,
  getLocalSchoolId, setLocalSchoolId,
  checkAnySchoolExists,
  loadLicenseFromCloud,
  getSubscription, upsertSubscription,
  supabaseClient,
} from './supabase';

/*
  NAV VISIBILITY RULES
  ─────────────────────
  principal      → everything
  teaching staff → dashboard, students (own class only), exams, timetable, messages, notifications
  non_teaching   → dashboard, messages, + kitchen (if kitchen dept), + fees (if finance dept)

  Settings only visible to principal.
  Fees only visible to principal + Finance dept.
  Kitchen only visible to principal + Kitchen dept.
  Staff management only visible to principal.
  Departments only visible to principal.
*/

function buildNav(user, data) {
  if (!user) return [];
  const teaching    = isTeachingStaff(user, data);
  const isPrincipal = user.role == 'principal';
  const staff       = (data.teachers||[]).find(t => t.staffId == user.staffId);
  const dept        = staff?.dept || user.dept || '';
  const seeKitchen  = isPrincipal || dept == 'Kitchen';
  const seeFees     = isPrincipal || dept == 'Finance';

  return [
    { id: 'dashboard',     label: 'Dashboard',        icon: 'dashboard', section: 'Main'          },
    { id: 'notifications', label: 'Notifications',     icon: 'bell',      section: 'Main'          },
    (teaching || isPrincipal)
      ? { id: 'students',  label: 'Students',          icon: 'students',  section: 'Main'          } : null,
    isPrincipal
      ? { id: 'teachers',  label: 'Staff',             icon: 'teachers',  section: 'Main'          } : null,
    seeFees
      ? { id: 'fees',      label: 'Fees',              icon: 'fees',      section: 'Finance'       } : null,
    (teaching || isPrincipal)
      ? { id: 'exams',     label: 'Exams & Reports',   icon: 'exams',     section: 'Academics'     } : null,
    (teaching || isPrincipal)
      ? { id: 'timetable', label: 'Timetable',         icon: 'timetable', section: 'Academics'     } : null,
    (teaching || isPrincipal)
      ? { id: 'status',    label: 'Student Status',    icon: 'alert',     section: 'Students'      } : null,
    { id: 'messages',      label: 'Messages',          icon: 'messages',  section: 'Communication' },
    isPrincipal
      ? { id: 'departments',label: 'Departments',      icon: 'dept',      section: 'Admin'         } : null,
    seeKitchen
      ? { id: 'kitchen',   label: 'Kitchen',           icon: 'kitchen',   section: 'Admin'         } : null,
    isPrincipal
      ? { id: 'terms',     label: 'Term Calendar',     icon: 'timetable', section: 'System'        } : null,
    (isPrincipal || (teaching && !!(data.teachers||[]).find(t => t.staffId == user.staffId)?.classTeacherOf))
      ? { id: 'parentmsg', label: 'Parent SMS',         icon: 'messages',  section: 'Communication' } : null,
    isPrincipal
      ? { id: 'settings',  label: 'Settings',          icon: 'settings',  section: 'System'        } : null,
  ].filter(Boolean);
}

const PAGE_TITLES = {
  dashboard:'Dashboard', notifications:'Notifications', students:'Student Management',
  teachers:'Staff Management', fees:'Fee Management', exams:'Exams & CBC Reports',
  timetable:'Timetable', status:'Student Status & Roll Call', messages:'Messages',
  departments:'Departments', kitchen:'Kitchen & Inventory', settings:'Settings',
  terms:'Term Calendar', parentmsg:'Parent SMS Broadcasting',
};

const ROLE_COLORS = { principal:'#7c3aed', class_teacher:'#4f8ef7', subject_teacher:'#4f8ef7', non_teaching:'#10b981' };

function getUserRole(staffRecord) {
  if (!staffRecord) return 'non_teaching';
  if (staffRecord.admin) return 'principal';
  if (staffRecord.staffType == 'teaching') {
    return staffRecord.isClassTeacher ? 'class_teacher' : 'subject_teacher';
  }
  return 'non_teaching';
}

function Notifications({ data, setData, user }) {
  const myNotifs = (data.notifications || []).filter(n => n.to == user.staffId || n.to == 'ALL');
  // Also show pending edit requests that need this user's approval
  const pendingApprovals = (data.editRequests || []).filter(r => {
    if (r.status !== 'pending') return false;
    if (user.role == 'principal' && r.approvals?.principal == null) return true;
    // class teacher of that exam class
    const staff = (data.teachers||[]).find(t => t.staffId == user.staffId);
    if (staff?.classTeacherOf) {
      const exam = (data.exams||[]).find(e => e.id == r.examId);
      if (exam?.class == staff.classTeacherOf && r.approvals?.classTeacher == null) return true;
    }
    return false;
  });

  function markRead(id) {
    setData(d => ({ ...d, notifications: d.notifications.map(n => n.id == id ? { ...n, read: true } : n) }));
  }

  function handleApproval(reqId, decision) {
    const isPrincipal = user.role == 'principal';
    const staff = (data.teachers||[]).find(t => t.staffId == user.staffId);
    setData(d => {
      const reqs = d.editRequests.map(r => {
        if (r.id !== reqId) return r;
        const updated = { ...r, approvals: { ...r.approvals } };
        if (isPrincipal) updated.approvals.principal = decision;
        else if (staff?.classTeacherOf) updated.approvals.classTeacher = decision;

        // Check if fully approved or rejected
        const { classTeacher, principal } = updated.approvals;
        if (classTeacher == 'approved' && principal == 'approved') {
          updated.status = 'approved';
          // Apply the score change
          d = applyEditRequest(d, updated);
          // Notify all parties
          d.notifications = [...(d.notifications||[]),
            { id: Date.now()+1, to: r.requestedBy, from: 'System', message: `✅ Your edit request for ${r.studentName} — ${r.subject} (${r.oldScore}→${r.newScore}) has been APPROVED.`, date: new Date().toISOString().split('T')[0], read: false },
            { id: Date.now()+2, to: 'ALL_TEACHING', from: 'System', message: `Score updated: ${r.studentName} — ${r.subject} changed from ${r.oldScore} to ${r.newScore} by ${r.requestedByName}.`, date: new Date().toISOString().split('T')[0], read: false },
          ];
        } else if (classTeacher == 'rejected' || principal == 'rejected') {
          updated.status = 'rejected';
          d.notifications = [...(d.notifications||[]),
            { id: Date.now()+1, to: r.requestedBy, from: 'System', message: `❌ Your edit request for ${r.studentName} — ${r.subject} (${r.oldScore}→${r.newScore}) was REJECTED.`, date: new Date().toISOString().split('T')[0], read: false },
          ];
        }
        return updated;
      });
      return { ...d, editRequests: reqs };
    });
  }

  function applyEditRequest(d, req) {
    return {
      ...d,
      exams: d.exams.map(ex => {
        if (ex.id !== req.examId) return ex;
        const newResults = { ...ex.results };
        if (newResults[req.studentName] && newResults[req.studentName][req.subject]) {
          newResults[req.studentName] = {
            ...newResults[req.studentName],
            [req.subject]: { ...newResults[req.studentName][req.subject], score: req.newScore },
          };
        }
        return { ...ex, results: newResults };
      }),
    };
  }

  const unread = myNotifs.filter(n => !n.read).length;

  return (
    <div>
      {pendingApprovals.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#f59e0b' }}>
            ⏳ Pending Approval Requests ({pendingApprovals.length})
          </div>
          {pendingApprovals.map(r => (
            <div key={r.id} style={{ background: '#f59e0b10', border: '1px solid #f59e0b40', borderRadius: 10, padding: 16, marginBottom: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Edit Request — {r.studentName}</div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 2 }}>Subject: <strong>{r.subject}</strong></div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 2 }}>
                Score change: <span style={{ color: '#ef4444' }}>{r.oldScore}</span> → <span style={{ color: '#10b981' }}>{r.newScore}</span>
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 10 }}>Requested by: {r.requestedByName} · {r.date}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
                Class Teacher: <span style={{ color: r.approvals?.classTeacher ? (r.approvals?.classTeacher == 'approved' ? '#10b981' : '#ef4444') : '#f59e0b' }}>
                  {r.approvals?.classTeacher || 'Pending'}
                </span>
                &nbsp;&nbsp;·&nbsp;&nbsp;
                Principal: <span style={{ color: r.approvals?.principal ? (r.approvals?.principal == 'approved' ? '#10b981' : '#ef4444') : '#f59e0b' }}>
                  {r.approvals?.principal || 'Pending'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleApproval(r.id, 'approved')} style={{ padding: '6px 16px', borderRadius: 7, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  ✓ Approve
                </button>
                <button onClick={() => handleApproval(r.id, 'rejected')} style={{ padding: '6px 16px', borderRadius: 7, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  ✕ Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
        Notifications {unread > 0 && <span style={{ background: '#ef4444', color: '#fff', fontSize: 11, padding: '2px 7px', borderRadius: 10, marginLeft: 8 }}>{unread}</span>}
      </div>
      {myNotifs.length == 0 ? (
        <div style={{ background: '#171b26', border: '1px solid #2a3350', borderRadius: 10, padding: 32, textAlign: 'center', color: '#64748b' }}>
          No notifications yet.
        </div>
      ) : [...myNotifs].reverse().map(n => (
        <div key={n.id} onClick={() => markRead(n.id)} style={{
          background: '#171b26', border: `1px solid ${n.read ? '#2a3350' : '#4f8ef740'}`,
          borderLeft: `4px solid ${n.read ? '#2a3350' : '#4f8ef7'}`,
          borderRadius: 10, padding: '14px 16px', marginBottom: 8, cursor: 'pointer',
        }}>
          <div style={{ fontSize: 13, color: n.read ? '#94a3b8' : '#e2e8f0', marginBottom: 4 }}>{n.message}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>{n.date} {!n.read && <span style={{ color: '#4f8ef7', fontWeight: 600 }}>· New</span>}</div>
        </div>
      ))}
    </div>
  );
}


/* ── First-time Setup Wizard ──────────────────────────── */
function SetupWizard({ data, setData, onDone }) {
  const [form, setForm] = React.useState({
    schoolName: '', schoolMotto: '', schoolPOBox: '', schoolLocation: '',
    schoolCounty: '', schoolType: 'Primary', principalName: '', newPass: '',
  });

  async function save() {
    const setupData = {
      schoolName:        form.schoolName.trim(),
      schoolMotto:       form.schoolMotto.trim(),
      schoolPOBox:       form.schoolPOBox.trim(),
      schoolLocation:    form.schoolLocation.trim(),
      schoolCounty:      form.schoolCounty.trim(),
      schoolType:        form.schoolType,
      principalName:     form.principalName.trim(),
      principalEmail:    'principal@school.ac.ke',
      principalPassword: form.newPass.trim() || 'admin123',
    };
    await onDone(setupData);
  }

  const inp = (val, onChange, ph) => ({
    value: val, onChange: e => onChange(e.target.value), placeholder: ph,
    style: { width: '100%', padding: '10px 13px', background: '#1e2435', border: '1px solid #2a3350', borderRadius: 8, color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' },
    onFocus: e => { e.target.style.borderColor = '#4f8ef7'; },
    onBlur:  e => { e.target.style.borderColor = '#2a3350'; },
  });

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 60, height: 60, borderRadius: 14, background: 'linear-gradient(135deg,#4f8ef7,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 26, fontWeight: 800, color: '#fff' }}>E</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0' }}>EduManage Pro</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Welcome! Set up your school — takes 2 minutes.</div>
        </div>
        <div style={{ background: '#171b26', border: '1px solid #2a3350', borderRadius: 16, padding: 28 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#4f8ef7', marginBottom: 16 }}>🏫 School Information</div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5, fontWeight: 500 }}>School Name *</label>
              <input {...inp(form.schoolName, v => setForm({...form, schoolName: v}), 'e.g. Kiriene Day Primary School')} autoFocus />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5, fontWeight: 500 }}>School Motto</label>
                <input {...inp(form.schoolMotto, v => setForm({...form, schoolMotto: v}), 'e.g. Strive To Excel')} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5, fontWeight: 500 }}>School Type</label>
                <select value={form.schoolType} onChange={e => setForm({...form, schoolType: e.target.value})} style={{ width: '100%', padding: '10px 13px', background: '#1e2435', border: '1px solid #2a3350', borderRadius: 8, color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}>
                  {['Primary','Junior Secondary','Secondary','Combined'].map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5, fontWeight: 500 }}>P.O. Box</label>
                <input {...inp(form.schoolPOBox, v => setForm({...form, schoolPOBox: v}), 'e.g. P.O. Box 159-60607')} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5, fontWeight: 500 }}>Town / Location</label>
                <input {...inp(form.schoolLocation, v => setForm({...form, schoolLocation: v}), 'e.g. Mikinduri')} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5, fontWeight: 500 }}>County</label>
                <input {...inp(form.schoolCounty, v => setForm({...form, schoolCounty: v}), 'e.g. Tharaka Nithi')} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5, fontWeight: 500 }}>Principal Name</label>
                <input {...inp(form.principalName, v => setForm({...form, principalName: v}), 'e.g. Agnes Njoroge')} />
              </div>
            </div>
            {form.schoolName && (
              <div style={{ background: '#1e2435', borderRadius: 8, padding: '10px 14px', textAlign: 'center', fontSize: 12 }}>
                <div style={{ fontWeight: 700, color: '#4f8ef7', fontSize: 14, textTransform: 'uppercase' }}>{form.schoolName}</div>
                {form.schoolMotto && <div style={{ color: '#94a3b8' }}>{form.schoolMotto}</div>}
                {(form.schoolPOBox || form.schoolLocation) && <div style={{ color: '#64748b' }}>{[form.schoolPOBox, form.schoolLocation].filter(Boolean).join(', ')}</div>}
                <div style={{ fontSize: 10, color: '#4f8ef7', marginTop: 4 }}>This is how it will appear on all printed reports</div>
              </div>
            )}
            <div>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5, fontWeight: 500 }}>Admin Password (leave blank to keep default: admin123)</label>
              <input type="password" {...inp(form.newPass, v => setForm({...form, newPass: v}), 'New password or leave blank')} />
            </div>
          </div>
          <button onClick={save} disabled={!form.schoolName.trim()}
            style={{ width: '100%', marginTop: 20, padding: 12, borderRadius: 8, border: 'none', background: form.schoolName.trim() ? '#4f8ef7' : '#2a3350', color: '#fff', fontSize: 14, fontWeight: 600, cursor: form.schoolName.trim() ? 'pointer' : 'not-allowed' }}>
            Save &amp; Open Dashboard →
          </button>
          <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: '#64748b' }}>You can update all details anytime from Settings</div>
        </div>
      </div>
    </div>
  );
}


export default function App() {
  const [data, setDataRaw]        = React.useState({ ...INITIAL_DATA });
  const [user, setUser]           = React.useState(null);
  const [page, setPage]           = React.useState('dashboard');
  const [showTeacherRegister]     = React.useState(() => new URLSearchParams(window.location.search).get('action') == 'register');
  const [studentUser, setStudentUser] = React.useState(null);
  const [parentUser,  setParentUser]  = React.useState(null);
  const [collapsed, setCollapsed] = React.useState(() => window.innerWidth < 768);
  const [setupDone, setSetupDone] = React.useState(false);
  const [loading, setLoading]     = React.useState(true);
  const [dbError, setDbError]     = React.useState(null);
  const [anySchoolExists, setAnySchoolExists] = React.useState(false);
  const [licenseRefreshKey, setLicenseRefreshKey] = React.useState(0);
  const [subscription, setSubscription] = React.useState(null);
  const [saveError, setSaveError] = React.useState(null);
  const [loginError, setLoginError] = React.useState('');

  /* ── THEME: inject CSS variables whenever darkTheme changes ── */
  const isDark = data.darkTheme !== false;
  React.useEffect(() => {
    const dark = {
      '--bg':          '#0f1117',
      '--surface':     '#171b26',
      '--surface2':    '#1e2435',
      '--border':      '#2a3350',
      '--text':        '#e2e8f0',
      '--text-sub':    '#94a3b8',
      '--text-muted':  '#64748b',
      '--input-bg':    '#1e2435',
      '--input-color': '#e2e8f0',
      '--accent':      '#4f8ef7',
      '--card-shadow': 'none',
    };
    const light = {
      '--bg':          '#f0f4f8',
      '--surface':     '#ffffff',
      '--surface2':    '#f8fafc',
      '--border':      '#d1dbe8',
      '--text':        '#0f172a',
      '--text-sub':    '#334155',
      '--text-muted':  '#64748b',
      '--input-bg':    '#ffffff',
      '--input-color': '#0f172a',
      '--accent':      '#2563eb',
      '--card-shadow': '0 1px 4px rgba(0,0,0,0.08)',
    };
    const vars = isDark ? dark : light;
    const root = document.documentElement;
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');
    document.body.style.background = vars['--bg'];
    document.body.style.color      = vars['--text'];
  }, [isDark]);




  // ── Load school data from Supabase on mount ──────────────────
  React.useEffect(() => {
    async function init() {
      try {
        const schoolId = getLocalSchoolId();
        if (schoolId) {
          const schoolData = await loadSchoolData(schoolId);
          if (schoolData) {
            setDataRaw(schoolData);
            setAnySchoolExists(true);
          } else {
            localStorage.removeItem('edumanage_school_id');
          }
          // ── Always sync license/token from cloud on boot ──────────
          // This ensures payment status & tokens work on ANY device
          // (phone, tablet, another browser) even before the school
          // has ever logged in on that specific device.
          try {
            await loadLicenseFromCloud(schoolId);
            setLicenseRefreshKey(k => k + 1); // tell useLicense to re-read localStorage
          } catch (licErr) {
            console.warn('Boot license sync failed (non-fatal):', licErr);
          }
        }
        // Check if ANY school exists in DB (so new devices show Login not Setup)
        const exists = await checkAnySchoolExists();
        setAnySchoolExists(exists);
      } catch (e) {
        console.error('Failed to load school data:', e);
        setDbError('Could not connect to database. Check your internet connection.');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // ── Save to Supabase on every data change ────────────────────
  const saveTimer = React.useRef(null);
  function setData(updater) {
    setDataRaw(prev => {
      const next = typeof updater == 'function' ? updater(prev) : updater;
      // Only save if data was loaded from DB (_loadedFromDB flag set by loadSchoolData)
      // This prevents wiping DB when state is still at INITIAL_DATA
      if (next._schoolId && next._loadedFromDB) {
        clearTimeout(saveTimer.current);
        // FIX: 2000ms debounce (was 800ms) — reduces Supabase query load at scale
        saveTimer.current = setTimeout(() => {
          setSaveError(null);
          saveSchoolData(next).catch(e => {
            console.error('Save error:', e);
            setSaveError('⚠ Changes could not be saved — check your connection.');
          });
        }, 2000);
      }
      return next;
    });
  }

  const isConfigured = !!(data.schoolName && data.schoolName.trim()) || setupDone;

  // ── License / Subscription system — must be called before any early returns ──
  const license = useLicense(data, licenseRefreshKey, setData);

  // ── Dev panel hook — must be before early returns ──
  const [showDevPanel, setShowDevPanel] = React.useState(false);

  // ── Secret dev panel: type "felix" anywhere (outside inputs) to toggle ──
  const keyBuffer = React.useRef('');
  React.useEffect(() => {
    function handleKey(e) {
      // Only block if user is actively typing (has a value in the input)
      // But still allow the secret sequence via Ctrl+Shift+F shortcut
      if (e.ctrlKey && e.shiftKey && e.key == 'F') {
        e.preventDefault();
        setShowDevPanel(v => !v);
        keyBuffer.current = '';
        return;
      }
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag == 'input' || tag == 'textarea' || tag == 'select') return;
      keyBuffer.current = (keyBuffer.current + e.key).slice(-5);
      if (keyBuffer.current == 'felix') {
        setShowDevPanel(v => !v);
        keyBuffer.current = '';
      }
    }
    function handleDevOpen() { setShowDevPanel(v => !v); }
    window.addEventListener('keydown', handleKey);
    window.addEventListener('felix-dev-open', handleDevOpen);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('felix-dev-open', handleDevOpen);
    };
  }, []);

  // Early returns AFTER all hooks — loading must be here too so hooks run every render


  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0d14', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 48 }}>🏫</div>
      <div style={{ color: '#4f8ef7', fontWeight: 700, fontSize: 18 }}>EduManage Pro</div>
      <div style={{ color: '#64748b', fontSize: 13 }}>Loading school data...</div>
      {dbError && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8, maxWidth: 300, textAlign: 'center' }}>{dbError}</div>}
    </div>
  );

  // Only show setup wizard if NO school exists in DB at all
  if (!isConfigured && !setupDone && !user && !anySchoolExists) {
    return (
      <SetupWizard
        data={data}
        setData={setData}
        onDone={async (setupData) => {
          try {
            const schoolId = await createSchool(setupData);
            setLocalSchoolId(schoolId);
            const schoolData = await loadSchoolData(schoolId);
            if (schoolData) setDataRaw(schoolData);
            setSetupDone(true);
          } catch (e) {
            console.error('Setup error:', e);
            alert('Failed to create school: ' + e.message);
          }
        }}
      />
    );
  }


  if (!user) {
    if (showTeacherRegister) {
      return <TeacherRegisterPage data={data} setData={setData} onBack={() => window.history.back()} />;
    }
    if (studentUser) return <StudentPortal student={studentUser} data={data} onLogout={() => setStudentUser(null)} />;
    if (parentUser)  return <ParentPortal  parent={parentUser}  data={data} onLogout={() => setParentUser(null)} />;
    return (
    <Login
      data={data}
      externalError={loginError}
      onStudentLogin={async (slcCode) => {
        const slcTrim = String(slcCode || '').trim();
        if (!slcTrim) return false;
        // First check already-loaded data
        let student = (data.students || []).find(s =>
          String(s.slc || '').trim() === slcTrim
        );
        // If not found and we have a schoolId, reload from DB
        if (!student) {
          const schoolId = getLocalSchoolId();
          if (schoolId) {
            try {
              const freshData = await loadSchoolData(schoolId);
              if (freshData) {
                setDataRaw(freshData);
                student = (freshData.students || []).find(s =>
                  String(s.slc || '').trim() === slcTrim
                );
              }
            } catch(e) { console.error('SLC load error:', e); }
          }
        }
        if (student) { setStudentUser(student); return true; }
        return false;
      }}
      onParentLogin={async (slcCode) => {
        const slcTrim = String(slcCode || '').trim();
        if (!slcTrim) return false;
        // First check already-loaded data
        let student = (data.students || []).find(s =>
          String(s.slc || '').trim() === slcTrim
        );
        // If not found, reload from DB
        if (!student) {
          const schoolId = getLocalSchoolId();
          if (schoolId) {
            try {
              const freshData = await loadSchoolData(schoolId);
              if (freshData) {
                setDataRaw(freshData);
                student = (freshData.students || []).find(s =>
                  String(s.slc || '').trim() === slcTrim
                );
              }
            } catch(e) { console.error('SLC parent load error:', e); }
          }
        }
        if (student) {
          setParentUser({ email: student.parentEmail, name: student.parentName, phone: student.parentPhone, childId: student.id });
          return true;
        }
        return false;
      }}
      onTeacherRegister={() => {
        const url = new URL(window.location.href);
        url.searchParams.set('action', 'register');
        window.location.href = url.toString();
      }}
      onCreateSchool={async (setupData) => {
        try {
          const schoolId = await createSchool(setupData);
          setLocalSchoolId(schoolId);
          const schoolData = await loadSchoolData(schoolId);
          if (schoolData) setDataRaw(schoolData);
          // Auto-login as principal
          setUser({ role: 'principal', name: setupData.principalName || 'Principal', email: setupData.principalEmail });
          setPage('dashboard');
        } catch (e) {
          throw new Error(e.message || 'Failed to create school');
        }
      }}
      onLogin={async (email, password) => {
        // Try principal login first
        const school = await loginPrincipal(email, password);
        if (school) {
          setLocalSchoolId(school.id);
          const schoolData = await loadSchoolData(school.id);
          if (schoolData) setDataRaw(schoolData);
          // Sync license/token from cloud so payment persists across devices
          await loadLicenseFromCloud(school.id);
          setLicenseRefreshKey(k => k + 1); // force useLicense to re-read localStorage
          setUser({ role: 'principal', name: school.principal_name || 'Principal', email });
          setPage('dashboard');
          // Load subscription for current term
          const now = new Date();
          const t = schoolData?.currentTerm || (now.getMonth() < 4 ? 1 : now.getMonth() < 8 ? 2 : 3);
          const y = schoolData?.currentYear || now.getFullYear();
          const sub = await getSubscription(school.id, t, y);
          setSubscription(sub);
          return true;
        }
        // Try staff login
        const teacher = await loginTeacher(email, password);
        if (teacher) {
          setLocalSchoolId(teacher.school_id);
          const teacherSchoolData = await loadSchoolData(teacher.school_id);
          if (teacherSchoolData) setDataRaw(teacherSchoolData);
          // Block pending (unapproved) teachers
          const pendingCheck = (teacherSchoolData?.teachers || []).find(t => t.email == email);
          if (pendingCheck && pendingCheck.status == 'pending') {
            setLoginError('Your account is pending approval. Please wait for the administrator to approve you.');
            return false;
          }
          setLoginError('');
          await loadLicenseFromCloud(teacher.school_id);
          setLicenseRefreshKey(k => k + 1);
          // Build full teacher user object — needed by TeacherPortal
          const teacherRecord = (teacherSchoolData?.teachers || []).find(t => t.email == email || t.staffId == teacher.staff_id);
          setUser({
            role:               teacher.admin ? 'principal' : 'staff',
            staffType:          teacherRecord?.staffType       || teacher.staff_type        || 'teaching',
            name:               teacher.name,
            email,
            staffId:            teacher.staff_id               || teacherRecord?.staffId,
            isClassTeacher:     teacherRecord?.isClassTeacher  || teacher.is_class_teacher  || false,
            classTeacherOf:     teacherRecord?.classTeacherOf  || teacher.class_teacher_of  || null,
            teacherSubjects:    teacherRecord?.subjects        || [],
            admin:              teacher.admin                  || false,
            dept:               teacherRecord?.dept            || '',
            canSeeFees:         teacherRecord?.canSeeFees      || false,
            canSeeKitchenAlerts:teacherRecord?.canSeeKitchenAlerts || false,
            canEnterAllMarks:   teacherRecord?.canEnterAllMarks || false,
          });
          setPage('dashboard');
          // Load subscription for current term
          const now2 = new Date();
          const t2 = teacherSchoolData?.currentTerm || (now2.getMonth() < 4 ? 1 : now2.getMonth() < 8 ? 2 : 3);
          const y2 = teacherSchoolData?.currentYear || now2.getFullYear();
          const sub = await getSubscription(teacher.school_id, t2, y2);
          setSubscription(sub);
          return true;
        }
        return false;
      }}
    />
  );
  }
  // Redirect teachers to their dedicated portal
  if (user && user.role !== 'principal') {
    return <TeacherPortal data={data} setData={setData} user={user} onLogout={() => { setUser(null); setDataRaw({...INITIAL_DATA}); clearLocalSchoolId(); }} />;
  }

  if (user.role == 'principal' && !isConfigured && !setupDone) {
    return (
      <SetupWizard
        data={data}
        setData={setData}
        onDone={async (setupData) => {
          try {
            const schoolId = await createSchool(setupData);
            setLocalSchoolId(schoolId);
            const schoolData = await loadSchoolData(schoolId);
            if (schoolData) setDataRaw(schoolData);
            setSetupDone(true);
          } catch (e) {
            console.error('Setup error:', e);
            alert('Failed to create school. Check your internet connection.');
          }
        }}
      />
    );
  }


  const nav      = buildNav(user, data);
  const sections = [...new Set(nav.map(n => n.section))];

  const myMsgUnread = (data.messages||[]).filter(m => !m.read && (user.role == 'principal' || m.dept == user.dept)).length;
  const myNotifUnread = (data.notifications || []).filter(n => !n.read && (n.to == user.staffId || n.to == 'ALL')).length;
  const pendingApprovalCount = (data.editRequests || []).filter(r => {
    if (r.status !== 'pending') return false;
    if (user.role == 'principal' && r.approvals?.principal == null) return true;
    const staff = (data.teachers||[]).find(t => t.staffId == user.staffId);
    if (staff?.classTeacherOf) {
      const exam = (data.exams||[]).find(e => e.id == r.examId);
      if (exam?.class == staff.classTeacherOf && r.approvals?.classTeacher == null) return true;
    }
    return false;
  }).length;

  const lowInv         = (data.inventory||[]).filter(i => i.current <= i.min).length;
  const showKitchenAlert = canSeeKitchenAlerts(user, data) && lowInv > 0;
  const statusAlertCount = user.role == 'principal'
    ? (data.statusAlerts || []).filter(a => !a.resolved).length
    : 0;
  // Overdue permissions — relevant to class teachers too
  const overduePermCount = (data.permissions || []).filter(p =>
    !p.returned && p.dateReturn < new Date().toISOString().split('T')[0] &&
    (user.role == 'principal' || (user.isClassTeacher && (data.students||[]).find(s=>s.id == p.studentId)?.class == user.classTeacherOf))
  ).length;

  const badges = {
    messages:      myMsgUnread,
    notifications: myNotifUnread + pendingApprovalCount,
    kitchen:       showKitchenAlert ? lowInv : 0,
    status:        statusAlertCount + overduePermCount,
  };

  const roleColor = ROLE_COLORS[user.role] || '#4f8ef7';
  const initials  = (user.name||"").split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  // Show license gate — but NEVER on Settings so Felix can always reach it
  const showLicenseGate = !license.isUnlocked && user?.role == 'principal' && page !== 'settings';



  function renderPage() {
    if (!nav.find(n => n.id == page)) return <Dashboard data={data} setData={setData} user={user} />;
    const props = { data, setData, user, isUnlocked: license.isUnlocked };
    switch (page) {
      case 'dashboard':     return <Dashboard     {...props} />;
      case 'notifications': return <Notifications {...props} />;
      case 'students':      return <Students      {...props} />;
      case 'teachers':      return <Teachers      {...props} />;
      case 'fees':          return <FeesModule    {...props} />;
      case 'exams':         return <Exams         {...props} />;
      case 'timetable':     return <Timetable     {...props} />;
      case 'auditlog':      return <AuditLog data={data} />;
      case 'status':        return <StudentStatus {...props} />;
      case 'messages':      return <Messages      {...props} />;
      case 'departments':   return <Departments   {...props} />;
      case 'kitchen':       return <Kitchen       {...props} />;
      case 'settings':      return <Settings      {...props} />;
      case 'terms':         return <><TermManagement {...props} /><PromotionPanel data={data} setData={setData} /></>;
      case 'parentmsg':     return <ParentMessaging {...props} subscription={subscription} onSubscriptionChange={setSubscription} />;
      default:              return <Dashboard     {...props} />;
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* LICENSE GATE — shows over read-only mode */}
      {showLicenseGate && <LicenseGate license={license} data={data} />}

      {/* ── SECRET DEV PANEL (triggered by typing "felix") ── */}
      {showDevPanel && (
        <div style={{ position: 'fixed', inset: 0, background: '#0008', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target == e.currentTarget) setShowDevPanel(false); }}>
          <div style={{ background: '#0f1117', border: '2px solid #7c3aed', borderRadius: 20, padding: 28, maxWidth: 520, width: '94%', boxShadow: '0 32px 100px #7c3aed30', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 2 }}>🛠 Developer Panel</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Only you can see this, Felix</div>
              </div>
              <button onClick={() => setShowDevPanel(false)}
                style={{ background: '#1e2435', border: '1px solid #2a3350', color: '#94a3b8', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <TokenGenerator data={data} />
            <div style={{ marginTop: 16, padding: '10px 14px', background: '#1e2435', borderRadius: 10, fontSize: 11, color: '#475569', textAlign: 'center' }}>
              Press <kbd style={{ background: '#0f1117', border: '1px solid #2a3350', borderRadius: 4, padding: '1px 6px', color: '#7c3aed', fontFamily: 'monospace' }}>felix</kbd> again anywhere to close
            </div>
          </div>
        </div>
      )}
      {/* SAVE ERROR BANNER */}
      {saveError && (
        <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 9999, background: '#ef4444', color: '#fff', padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 20px #0006', display: 'flex', alignItems: 'center', gap: 10 }}>
          {saveError}
          <span style={{ cursor: 'pointer', fontWeight: 900 }} onClick={() => setSaveError(null)}>✕</span>
        </div>
      )}
      {/* READ-ONLY BANNER */}
      {!license.isUnlocked && user?.role == 'principal' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 998, background: '#ef4444', color: '#fff', textAlign: 'center', padding: '6px 0', fontSize: 12, fontWeight: 700 }}>
          🔒 READ-ONLY MODE — Subscribe to unlock full access &nbsp;·&nbsp;
          <span style={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={() => setPage('settings')}>Pay Now</span>
        </div>
      )}

      {/* MOBILE HAMBURGER */}
      <style>{`
        @media (max-width: 768px) {
          .edu-sidebar { position: fixed !important; left: 0; top: 0; height: 100vh; z-index: 1000; transform: translateX(-100%); transition: transform 0.25s !important; width: 260px !important; }
          .edu-sidebar.open { transform: translateX(0) !important; }
          .edu-overlay { display: block !important; }
          .edu-top-bar { display: flex !important; }
          .edu-main { margin-left: 0 !important; padding-top: 56px !important; }
          .edu-hamburger-btn { display: flex !important; }
        }
        .edu-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 999; cursor: pointer; }
        .edu-top-bar { display: none; position: fixed; top: 0; left: 0; right: 0; z-index: 997; background: #171b26; border-bottom: 1px solid #2a3350; padding: 0 14px; height: 52px; align-items: center; gap: 12px; }
        .edu-hamburger-btn { display: none; background: none; border: none; color: #e2e8f0; font-size: 22px; cursor: pointer; padding: 6px; line-height: 1; }
        /* Make tables scroll on mobile */
        @media (max-width: 768px) {
          table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .edu-page-content { padding: 14px !important; }
          /* Modals full-screen on phone */
          .edu-modal-inner { width: 96vw !important; max-height: 92vh !important; margin: 4vh auto !important; }
          /* Form rows stack on phone */
          .edu-form-row { flex-direction: column !important; }
        }
      `}</style>
      <div className="edu-overlay" style={{ pointerEvents: collapsed ? 'none' : 'auto' }} onClick={() => setCollapsed(true)} />

      {/* Mobile top bar */}
      <div className="edu-top-bar">
        <button className="edu-hamburger-btn" onClick={() => setCollapsed(v => !v)}>☰</button>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'linear-gradient(135deg,#4f8ef7,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: '#fff' }}>E</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{PAGE_TITLES[page] || page}</div>
        {myNotifUnread > 0 && <div style={{ background: '#ef4444', color: '#fff', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{myNotifUnread}</div>}
      </div>
      {/* SIDEBAR */}
      <aside className={"edu-sidebar" + (!collapsed ? " open" : "")} style={{ width: collapsed ? 64 : 240, background: '#171b26', borderRight: '1px solid #2a3350', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden', transition: 'width 0.2s' }}>
        <div style={{ padding: '14px 12px', borderBottom: '1px solid #2a3350', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg,#4f8ef7,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color: '#fff', flexShrink: 0 }}>E</div>
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#4f8ef7' }}>EduManage Pro</div>
              <div style={{ fontSize: 10, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.schoolName}</div>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4, flexShrink: 0, fontSize: 14 }}>
            {collapsed ? '→' : '←'}
          </button>
        </div>

        {!collapsed && (
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #2a3350' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: roleColor }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: roleColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {user.role == 'principal' ? 'Principal' : user.role == 'class_teacher' ? 'Class Teacher' : user.role == 'subject_teacher' ? 'Subject Teacher' : 'Non-Teaching Staff'}
              </span>
            </div>
            {user.classTeacherOf && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, paddingLeft: 16 }}>Class Teacher: {user.classTeacherOf}</div>}
            {user.dept && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, paddingLeft: 16 }}>{user.dept} Department</div>}
          </div>
        )}

        <nav style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
          {sections.map(sec => (
            <div key={sec}>
              {!collapsed && <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', padding: '8px 14px 4px', textTransform: 'uppercase', letterSpacing: 1 }}>{sec}</div>}
              {nav.filter(n => n.section == sec).map(n => {
                const active = page == n.id;
                return (
                  <div key={n.id} onClick={() => { setPage(n.id); if (window.innerWidth < 768) setCollapsed(true); }} title={collapsed ? n.label : undefined}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '11px 0' : '9px 14px', justifyContent: collapsed ? 'center' : 'flex-start', cursor: 'pointer', fontSize: 13, color: active ? '#4f8ef7' : '#94a3b8', background: active ? '#1e2435' : 'transparent', borderLeft: active ? '3px solid #4f8ef7' : '3px solid transparent', fontWeight: active ? 600 : 400, transition: 'all 0.12s' }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#1e243570'; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Icon name={n.icon} size={16} />
                    {!collapsed && <span style={{ flex: 1 }}>{n.label}</span>}
                    {badges[n.id] > 0 && <span style={{ background: '#ef4444', color: '#fff', fontSize: 10, padding: '1px 6px', borderRadius: 10, fontWeight: 700, flexShrink: 0 }}>{badges[n.id]}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        <div style={{ borderTop: '1px solid #2a3350' }}>
          {!collapsed ? (
            <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: roleColor + '30', color: roleColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                <div style={{ fontSize: 10, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
              </div>
              <button onClick={() => { setUser(null); setDataRaw({...INITIAL_DATA}); clearLocalSchoolId(); }} title="Sign out"
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '6px 8px', borderRadius: 6, fontSize: 13, fontWeight: 700, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#ef444420'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>⏻ {!collapsed && 'Logout'}</button>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
              <button onClick={() => { setUser(null); setDataRaw({...INITIAL_DATA}); }} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18 }}>⏻</button>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN */}
      <main className="edu-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', marginTop: (!license.isUnlocked && user?.role == 'principal') ? 30 : 0 }}>
        <header style={{ background: '#171b26', borderBottom: '1px solid #2a3350', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setCollapsed(c => !c)}
              style={{ background: 'none', border: 'none', color: '#e2e8f0', cursor: 'pointer', fontSize: 20, padding: 4, borderRadius: 6 }}>☰</button>
            <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0' }}>{PAGE_TITLES[page] || page}</div>
            <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ display: 'none' }} className="edu-desktop-label">{data.schoolName} · </span>
              {new Date().toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric' })}
              <TermBadge data={data} />
            </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* License status badge */}
            {user?.role == 'principal' && (
              license.isUnlocked
                ? (license.tokenActive
                    ? <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#7c3aed20', color: '#7c3aed', border: '1px solid #7c3aed30' }}>🔑 TOKEN · {license.daysLeft}d</span>
                    : <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#10b98120', color: '#10b981', border: '1px solid #10b98130' }}>✓ LICENSED</span>)
                : <span onClick={() => setPage('settings')} style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#ef444420', color: '#ef4444', border: '1px solid #ef444430', cursor: 'pointer' }}>🔒 SUBSCRIBE</span>
            )}
            {myMsgUnread > 0 && (
              <button onClick={() => setPage('messages')} style={{ background: '#ef444415', border: '1px solid #ef444430', color: '#ef4444', padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                {myMsgUnread} unread
              </button>
            )}
            {showKitchenAlert && (
              <button onClick={() => setPage('kitchen')} style={{ background: '#f59e0b15', border: '1px solid #f59e0b30', color: '#f59e0b', padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                ⚠ {lowInv} low stock
              </button>
            )}
            {(pendingApprovalCount > 0 || myNotifUnread > 0) && (
              <button onClick={() => setPage('notifications')} style={{ background: '#4f8ef715', border: '1px solid #4f8ef730', color: '#4f8ef7', padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                🔔 {pendingApprovalCount + myNotifUnread}
              </button>
            )}
            {(statusAlertCount + overduePermCount) > 0 && (
              <button onClick={() => setPage('status')} style={{ background: '#ef444415', border: '1px solid #ef444430', color: '#ef4444', padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                🚨 {statusAlertCount + overduePermCount}
              </button>
            )}
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: roleColor + '30', color: roleColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, border: `2px solid ${roleColor}40`, flexShrink: 0 }}>{initials}</div>
          </div>
        </header>
        <div className="edu-page-content" style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#0f1117' }}>
          {renderPage()}
        </div>
      </main>
    </div>
  );
}
