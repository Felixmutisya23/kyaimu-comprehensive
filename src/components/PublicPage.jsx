import React, { useState } from 'react';

/* ═══════════════════════════════════════════════════════════════
   PUBLIC SCHOOL PAGE
   Route: /school/:slug
   Anyone can view — no login needed.
   Shows school info, gallery, jobs, student application form.
═══════════════════════════════════════════════════════════════ */

const C = {
  primary:   '#1e40af',
  accent:    '#10b981',
  text:      '#1e293b',
  sub:       '#64748b',
  light:     '#f8fafc',
  border:    '#e2e8f0',
  white:     '#ffffff',
  gradient:  'linear-gradient(135deg,#1e40af 0%,#7c3aed 100%)',
};

function Section({ children, bg = C.white, style = {} }) {
  return (
    <section style={{ background: bg, padding: '72px 24px', ...style }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>{children}</div>
    </section>
  );
}

function SectionHead({ label, title, sub }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 48 }}>
      {label && <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>{label}</div>}
      <div style={{ fontSize: 32, fontWeight: 900, color: C.text, marginBottom: 12, lineHeight: 1.2 }}>{title}</div>
      {sub && <div style={{ fontSize: 16, color: C.sub, maxWidth: 580, margin: '0 auto' }}>{sub}</div>}
    </div>
  );
}

export default function PublicPage({ data, onLoginClick }) {
  const [applyTab,   setApplyTab]   = useState('student'); // 'student' | 'job'
  const [studentApp, setStudentApp] = useState({ firstName:'', lastName:'', class:'', parentName:'', parentPhone:'', parentEmail:'' });
  const [jobApp,     setJobApp]     = useState({ name:'', email:'', phone:'', position:'', message:'' });
  const [submitted,  setSubmitted]  = useState(null); // 'student' | 'job'
  const [selJob,     setSelJob]     = useState(null);

  const gallery   = (data.schoolGallery   || []).slice(0, 20);
  const jobs      = (data.jobVacancies    || []).filter(j => j.active);
  const allClasses = [];
  (data.classGroups || []).forEach(g => {
    if (!g.streams || g.streams.length === 0) allClasses.push(g.name);
    else g.streams.forEach(s => allClasses.push(`${g.name} ${s}`));
  });

  function submitStudentApp(e) {
    e.preventDefault();
    if (!studentApp.firstName || !studentApp.class || !studentApp.parentPhone) return;
    // In real app this would call supabase — for now add to onlineApplications
    setSubmitted('student');
  }

  function submitJobApp(e) {
    e.preventDefault();
    if (!jobApp.name || !jobApp.email || !jobApp.position) return;
    setSubmitted('job');
  }

  const inp = (val, onChange, ph, type='text', required=false) => (
    <input type={type} value={val} onChange={e=>onChange(e.target.value)} placeholder={ph} required={required}
      style={{width:'100%',padding:'11px 14px',border:`1.5px solid ${C.border}`,borderRadius:10,fontSize:14,color:C.text,background:C.white,outline:'none',boxSizing:'border-box'}}
      onFocus={e=>e.target.style.borderColor=C.primary}
      onBlur={e=>e.target.style.borderColor=C.border}
    />
  );

  return (
    <div style={{ fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', color: C.text }}>

      {/* ── NAV ─────────────────────────────────────────── */}
      <nav style={{ position:'sticky',top:0,zIndex:100,background:'#ffffffee',backdropFilter:'blur(12px)',borderBottom:`1px solid ${C.border}`,padding:'0 24px' }}>
        <div style={{ maxWidth:1100,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',height:64 }}>
          <div style={{ display:'flex',alignItems:'center',gap:12 }}>
            <div style={{ width:40,height:40,borderRadius:10,background:C.gradient,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:18,color:'#fff' }}>E</div>
            <div>
              <div style={{ fontSize:15,fontWeight:800,color:C.text }}>{data.schoolName}</div>
              {data.schoolMotto && <div style={{ fontSize:11,color:C.sub }}>{data.schoolMotto}</div>}
            </div>
          </div>
          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
            {['About','Academics','Gallery','Jobs','Apply','Contact'].map(l => (
              <a key={l} href={`#${l.toLowerCase()}`} style={{ fontSize:13,color:C.sub,textDecoration:'none',padding:'6px 12px',borderRadius:8,fontWeight:500 }}
                onMouseEnter={e=>e.target.style.color=C.primary} onMouseLeave={e=>e.target.style.color=C.sub}>
                {l}
              </a>
            ))}
            <button onClick={onLoginClick} style={{ padding:'9px 20px',borderRadius:10,border:'none',background:C.gradient,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',marginLeft:8 }}>
              Login →
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────── */}
      <section style={{ background:C.gradient,padding:'100px 24px',textAlign:'center',position:'relative',overflow:'hidden' }}>
        <div style={{ position:'absolute',inset:0,background:'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.05\'%3E%3Ccircle cx=\'30\' cy=\'30\' r=\'4\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',opacity:0.5 }} />
        <div style={{ position:'relative',maxWidth:800,margin:'0 auto' }}>
          <div style={{ display:'inline-block',background:'#ffffff20',borderRadius:100,padding:'6px 18px',fontSize:12,color:'#e0e7ff',fontWeight:600,letterSpacing:1,textTransform:'uppercase',marginBottom:20 }}>
            {data.schoolType || 'School'} · {data.schoolCounty}
          </div>
          <h1 style={{ fontSize:52,fontWeight:900,color:'#fff',margin:'0 0 20px',lineHeight:1.1 }}>{data.schoolName}</h1>
          {data.schoolMotto && <div style={{ fontSize:22,color:'#e0e7ff',marginBottom:32,fontStyle:'italic' }}>"{data.schoolMotto}"</div>}
          <div style={{ display:'flex',gap:14,justifyContent:'center',flexWrap:'wrap' }}>
            <button onClick={()=>document.getElementById('apply')?.scrollIntoView({behavior:'smooth'})}
              style={{ padding:'14px 32px',borderRadius:12,border:'none',background:'#fff',color:C.primary,fontSize:15,fontWeight:800,cursor:'pointer' }}>
              Apply for Admission
            </button>
            <button onClick={()=>document.getElementById('about')?.scrollIntoView({behavior:'smooth'})}
              style={{ padding:'14px 32px',borderRadius:12,border:'2px solid #ffffff60',background:'transparent',color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer' }}>
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* ── QUICK STATS ─────────────────────────────────── */}
      <Section bg={C.light}>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:20 }}>
          {[
            { icon:'🎓', label:'Students', value: (data.students||[]).length || '500+' },
            { icon:'👨‍🏫', label:'Teachers', value: (data.teachers||[]).filter(t=>t.staffType==='teaching').length || '30+' },
            { icon:'🏫', label:'Classes',  value: allClasses.length || '12+' },
            { icon:'📍', label:'Location', value: data.schoolLocation || data.schoolCounty || 'Kenya' },
          ].map(s => (
            <div key={s.label} style={{ background:C.white,border:`1.5px solid ${C.border}`,borderRadius:16,padding:'28px 24px',textAlign:'center',boxShadow:'0 4px 16px #0000000a' }}>
              <div style={{ fontSize:36,marginBottom:10 }}>{s.icon}</div>
              <div style={{ fontSize:28,fontWeight:900,color:C.primary,marginBottom:4 }}>{s.value}</div>
              <div style={{ fontSize:13,color:C.sub,fontWeight:600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── ABOUT ───────────────────────────────────────── */}
      <Section id="about">
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:60,alignItems:'center' }}>
          <div>
            <div style={{ fontSize:12,fontWeight:700,color:C.primary,textTransform:'uppercase',letterSpacing:2,marginBottom:12 }}>About Us</div>
            <h2 style={{ fontSize:36,fontWeight:900,color:C.text,marginBottom:20,lineHeight:1.2 }}>Welcome to {data.schoolName}</h2>
            <p style={{ fontSize:16,color:C.sub,lineHeight:1.8,marginBottom:20 }}>
              {data.schoolAbout || `${data.schoolName} is a leading educational institution in ${data.schoolLocation || data.schoolCounty || 'Kenya'}, committed to providing quality education and nurturing well-rounded students.`}
            </p>
            {data.schoolVision && (
              <div style={{ background:'#eff6ff',border:`1px solid #bfdbfe`,borderRadius:12,padding:'16px 20px',marginBottom:14 }}>
                <div style={{ fontSize:12,fontWeight:700,color:C.primary,marginBottom:6 }}>OUR VISION</div>
                <div style={{ fontSize:14,color:C.text }}>{data.schoolVision}</div>
              </div>
            )}
            {data.schoolMission && (
              <div style={{ background:'#f0fdf4',border:`1px solid #bbf7d0`,borderRadius:12,padding:'16px 20px' }}>
                <div style={{ fontSize:12,fontWeight:700,color:C.accent,marginBottom:6 }}>OUR MISSION</div>
                <div style={{ fontSize:14,color:C.text }}>{data.schoolMission}</div>
              </div>
            )}
          </div>
          <div style={{ background:C.gradient,borderRadius:24,padding:48,textAlign:'center',color:'#fff' }}>
            <div style={{ fontSize:64,marginBottom:16 }}>🏫</div>
            <div style={{ fontSize:20,fontWeight:800,marginBottom:8 }}>{data.schoolName}</div>
            <div style={{ fontSize:14,opacity:0.85,marginBottom:20 }}>
              {[data.schoolPOBox,data.schoolLocation,data.schoolCounty].filter(Boolean).join(' · ')}
            </div>
            {data.schoolPhone && <div style={{ fontSize:14,opacity:0.85 }}>📞 {data.schoolPhone}</div>}
            {data.schoolEmail && <div style={{ fontSize:14,opacity:0.85 }}>✉ {data.schoolEmail}</div>}
          </div>
        </div>
      </Section>

      {/* ── ACADEMICS ───────────────────────────────────── */}
      <Section bg={C.light} id="academics">
        <SectionHead label="Academics" title="Curriculum & Classes" sub="We follow the Kenya CBC curriculum, offering quality education from early childhood to senior secondary." />
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:16 }}>
          {allClasses.slice(0,12).map(cls => (
            <div key={cls} style={{ background:C.white,border:`1.5px solid ${C.border}`,borderRadius:12,padding:'18px 20px',display:'flex',alignItems:'center',gap:12 }}>
              <div style={{ width:40,height:40,borderRadius:10,background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18 }}>📚</div>
              <div style={{ fontWeight:700,fontSize:14,color:C.text }}>{cls}</div>
            </div>
          ))}
          {allClasses.length === 0 && ['Grade 1–3','Grade 4–6','Grade 7–9','Form 1–4'].map(c => (
            <div key={c} style={{ background:C.white,border:`1.5px solid ${C.border}`,borderRadius:12,padding:'18px 20px',display:'flex',alignItems:'center',gap:12 }}>
              <div style={{ width:40,height:40,borderRadius:10,background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18 }}>📚</div>
              <div style={{ fontWeight:700,fontSize:14,color:C.text }}>{c}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── GALLERY ─────────────────────────────────────── */}
      {gallery.length > 0 && (
        <Section id="gallery">
          <SectionHead label="Gallery" title="Life at Our School" />
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:16 }}>
            {gallery.map((photo, i) => (
              <div key={i} style={{ borderRadius:14,overflow:'hidden',aspectRatio:'4/3',position:'relative',cursor:'pointer',boxShadow:'0 4px 16px #0000001a' }}>
                <img src={photo.url} alt={photo.caption||'School photo'} style={{ width:'100%',height:'100%',objectFit:'cover' }} />
                {photo.caption && (
                  <div style={{ position:'absolute',bottom:0,left:0,right:0,background:'linear-gradient(transparent,#00000099)',color:'#fff',padding:'20px 14px 12px',fontSize:12 }}>
                    {photo.caption}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── JOBS ────────────────────────────────────────── */}
      <Section bg={C.light} id="jobs">
        <SectionHead label="Careers" title="Join Our Team" sub={jobs.length > 0 ? "We're looking for passionate educators and staff to join our school." : "No vacancies at the moment. Check back soon."} />
        {jobs.length > 0 && (
          <div style={{ display:'grid',gap:16 }}>
            {jobs.map(job => (
              <div key={job.id} style={{ background:C.white,border:`1.5px solid ${C.border}`,borderRadius:16,padding:'24px 28px',boxShadow:'0 4px 16px #0000000a' }}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12 }}>
                  <div>
                    <div style={{ fontSize:18,fontWeight:800,color:C.text,marginBottom:6 }}>{job.title}</div>
                    <div style={{ fontSize:14,color:C.sub,lineHeight:1.7 }}>{job.description}</div>
                  </div>
                  <div style={{ textAlign:'right',flexShrink:0 }}>
                    {job.deadline && <div style={{ fontSize:12,color:'#ef4444',fontWeight:600,marginBottom:10 }}>Deadline: {job.deadline}</div>}
                    <button onClick={()=>{ setSelJob(job); setApplyTab('job'); document.getElementById('apply')?.scrollIntoView({behavior:'smooth'}); }}
                      style={{ padding:'10px 24px',borderRadius:10,border:'none',background:C.gradient,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer' }}>
                      Apply Now
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── APPLY ───────────────────────────────────────── */}
      <Section id="apply">
        <SectionHead label="Applications" title="Apply Now" />
        {/* Tab switcher */}
        <div style={{ display:'flex',gap:4,background:C.light,borderRadius:14,padding:5,marginBottom:28,width:'fit-content',margin:'0 auto 28px' }}>
          {[{id:'student',label:'🎒 Student Admission'},{id:'job',label:'💼 Job Application'}].map(t => (
            <button key={t.id} onClick={()=>setApplyTab(t.id)} style={{
              padding:'10px 24px',borderRadius:10,border:'none',cursor:'pointer',fontSize:14,fontWeight:700,
              background: applyTab===t.id ? C.gradient : 'transparent',
              color:      applyTab===t.id ? '#fff' : C.sub,
            }}>{t.label}</button>
          ))}
        </div>

        <div style={{ maxWidth:560,margin:'0 auto' }}>
          {submitted === 'student' && applyTab === 'student' && (
            <div style={{ background:'#f0fdf4',border:`1.5px solid #86efac`,borderRadius:16,padding:40,textAlign:'center' }}>
              <div style={{ fontSize:48,marginBottom:16 }}>✅</div>
              <div style={{ fontSize:22,fontWeight:800,color:C.accent,marginBottom:8 }}>Application Submitted!</div>
              <div style={{ fontSize:14,color:C.sub }}>The school office will contact you shortly to confirm enrollment and the required documents.</div>
            </div>
          )}
          {submitted === 'job' && applyTab === 'job' && (
            <div style={{ background:'#f0fdf4',border:`1.5px solid #86efac`,borderRadius:16,padding:40,textAlign:'center' }}>
              <div style={{ fontSize:48,marginBottom:16 }}>✅</div>
              <div style={{ fontSize:22,fontWeight:800,color:C.accent,marginBottom:8 }}>Application Received!</div>
              <div style={{ fontSize:14,color:C.sub }}>Thank you for your interest. We will review your application and get back to you.</div>
            </div>
          )}

          {submitted !== 'student' && applyTab === 'student' && (
            <form onSubmit={submitStudentApp} style={{ background:C.white,border:`1.5px solid ${C.border}`,borderRadius:20,padding:32,boxShadow:'0 8px 32px #0000000a' }}>
              <div style={{ fontSize:16,fontWeight:800,color:C.text,marginBottom:20 }}>Student Admission Application</div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14 }}>
                <div>
                  <label style={{ fontSize:12,fontWeight:600,color:C.sub,display:'block',marginBottom:5 }}>First Name *</label>
                  {inp(studentApp.firstName, v=>setStudentApp(p=>({...p,firstName:v})), 'e.g. Kamau', 'text', true)}
                </div>
                <div>
                  <label style={{ fontSize:12,fontWeight:600,color:C.sub,display:'block',marginBottom:5 }}>Last Name *</label>
                  {inp(studentApp.lastName, v=>setStudentApp(p=>({...p,lastName:v})), 'e.g. Njoroge', 'text', true)}
                </div>
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:12,fontWeight:600,color:C.sub,display:'block',marginBottom:5 }}>Class Applying For *</label>
                <select value={studentApp.class} onChange={e=>setStudentApp(p=>({...p,class:e.target.value}))} required
                  style={{ width:'100%',padding:'11px 14px',border:`1.5px solid ${C.border}`,borderRadius:10,fontSize:14,color:C.text,background:C.white,outline:'none' }}>
                  <option value="">Select class...</option>
                  {allClasses.map(c=><option key={c} value={c}>{c}</option>)}
                  {allClasses.length===0 && ['Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Form 1','Form 2','Form 3','Form 4'].map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:12,fontWeight:600,color:C.sub,display:'block',marginBottom:5 }}>Parent/Guardian Name *</label>
                {inp(studentApp.parentName, v=>setStudentApp(p=>({...p,parentName:v})), 'Full name', 'text', true)}
              </div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14 }}>
                <div>
                  <label style={{ fontSize:12,fontWeight:600,color:C.sub,display:'block',marginBottom:5 }}>Phone Number *</label>
                  {inp(studentApp.parentPhone, v=>setStudentApp(p=>({...p,parentPhone:v})), '0712345678', 'tel', true)}
                </div>
                <div>
                  <label style={{ fontSize:12,fontWeight:600,color:C.sub,display:'block',marginBottom:5 }}>Email (optional)</label>
                  {inp(studentApp.parentEmail, v=>setStudentApp(p=>({...p,parentEmail:v})), 'email@example.com', 'email')}
                </div>
              </div>
              <div style={{ background:'#fffbeb',border:`1px solid #fde68a`,borderRadius:10,padding:'12px 16px',fontSize:12,color:'#92400e',marginBottom:20 }}>
                📋 <strong>Required Documents on Reporting:</strong> Birth certificate photocopy, Parent/Guardian ID photocopy
                {(data.customDocReqs||[]).length > 0 && `, ${data.customDocReqs.join(', ')}`}
                . If transferring from another school, bring your Transfer Letter.
              </div>
              <button type="submit" style={{ width:'100%',padding:14,borderRadius:12,border:'none',background:C.gradient,color:'#fff',fontSize:15,fontWeight:800,cursor:'pointer' }}>
                Submit Application →
              </button>
            </form>
          )}

          {submitted !== 'job' && applyTab === 'job' && (
            <form onSubmit={submitJobApp} style={{ background:C.white,border:`1.5px solid ${C.border}`,borderRadius:20,padding:32,boxShadow:'0 8px 32px #0000000a' }}>
              <div style={{ fontSize:16,fontWeight:800,color:C.text,marginBottom:20 }}>
                Job Application {selJob ? `— ${selJob.title}` : ''}
              </div>
              {jobs.length > 0 && (
                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:12,fontWeight:600,color:C.sub,display:'block',marginBottom:5 }}>Position *</label>
                  <select value={jobApp.position} onChange={e=>setJobApp(p=>({...p,position:e.target.value}))} required
                    style={{ width:'100%',padding:'11px 14px',border:`1.5px solid ${C.border}`,borderRadius:10,fontSize:14,color:C.text,background:C.white,outline:'none' }}>
                    <option value="">Select position...</option>
                    {jobs.map(j=><option key={j.id} value={j.title}>{j.title}</option>)}
                  </select>
                </div>
              )}
              {[{l:'Full Name *',k:'name',ph:'Your full name',t:'text',req:true},{l:'Email Address *',k:'email',ph:'your@email.com',t:'email',req:true},{l:'Phone Number',k:'phone',ph:'0712345678',t:'tel',req:false}].map(f=>(
                <div key={f.k} style={{marginBottom:14}}>
                  <label style={{fontSize:12,fontWeight:600,color:C.sub,display:'block',marginBottom:5}}>{f.l}</label>
                  {inp(jobApp[f.k],v=>setJobApp(p=>({...p,[f.k]:v})),f.ph,f.t,f.req)}
                </div>
              ))}
              <div style={{ marginBottom:20 }}>
                <label style={{ fontSize:12,fontWeight:600,color:C.sub,display:'block',marginBottom:5 }}>Cover Message</label>
                <textarea value={jobApp.message} onChange={e=>setJobApp(p=>({...p,message:e.target.value}))} rows={4}
                  placeholder="Tell us about yourself and why you'd like to join our school..."
                  style={{ width:'100%',padding:'11px 14px',border:`1.5px solid ${C.border}`,borderRadius:10,fontSize:14,color:C.text,background:C.white,outline:'none',resize:'vertical',boxSizing:'border-box' }} />
              </div>
              <button type="submit" style={{ width:'100%',padding:14,borderRadius:12,border:'none',background:C.gradient,color:'#fff',fontSize:15,fontWeight:800,cursor:'pointer' }}>
                Submit Application →
              </button>
            </form>
          )}
        </div>
      </Section>

      {/* ── CONTACT ─────────────────────────────────────── */}
      <Section bg={C.light} id="contact">
        <SectionHead label="Contact" title="Get In Touch" />
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:20,maxWidth:800,margin:'0 auto' }}>
          {[
            { icon:'📍', label:'Location',  value:[data.schoolLocation,data.schoolCounty].filter(Boolean).join(', ')||'Kenya' },
            { icon:'📮', label:'P.O. Box',  value:data.schoolPOBox||'—' },
            { icon:'📞', label:'Phone',     value:data.schoolPhone||'Contact the school' },
            { icon:'✉️', label:'Email',     value:data.schoolEmail||'info@school.ac.ke' },
          ].map(c => (
            <div key={c.label} style={{ background:C.white,border:`1.5px solid ${C.border}`,borderRadius:16,padding:'24px',textAlign:'center',boxShadow:'0 4px 16px #0000000a' }}>
              <div style={{ fontSize:32,marginBottom:10 }}>{c.icon}</div>
              <div style={{ fontSize:12,fontWeight:700,color:C.sub,textTransform:'uppercase',letterSpacing:1,marginBottom:6 }}>{c.label}</div>
              <div style={{ fontSize:15,fontWeight:600,color:C.text }}>{c.value}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── FOOTER ──────────────────────────────────────── */}
      <footer style={{ background:'#0f172a',color:'#94a3b8',padding:'40px 24px',textAlign:'center' }}>
        <div style={{ maxWidth:1100,margin:'0 auto' }}>
          <div style={{ fontSize:18,fontWeight:800,color:'#fff',marginBottom:6 }}>{data.schoolName}</div>
          {data.schoolMotto && <div style={{ fontSize:13,marginBottom:16,fontStyle:'italic' }}>"{data.schoolMotto}"</div>}
          <div style={{ fontSize:12,marginBottom:16 }}>
            {[data.schoolPOBox,data.schoolLocation,data.schoolCounty].filter(Boolean).join(' · ')}
          </div>
          <div style={{ borderTop:'1px solid #1e293b',paddingTop:16,fontSize:11,color:'#475569' }}>
            Powered by EduManage Pro · {new Date().getFullYear()}
          </div>
        </div>
      </footer>
    </div>
  );
}
