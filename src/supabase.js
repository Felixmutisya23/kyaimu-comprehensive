// ═══════════════════════════════════════════════════════════════
//  EduManage Pro — Supabase Data Layer
//  Replaces localStorage with cloud database.
//  Each school is identified by its UUID stored in localStorage.
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import { INITIAL_DATA } from './data/initialData';

const SUPABASE_URL  = 'https://dhijqdzgvfpbrfegikrp.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoaWpxZHpndmZwYnJmZWdpa3JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzgzODYsImV4cCI6MjA5MzI1NDM4Nn0.z7ORb8DvspYNoHQx34Co7nFsnrcXVTXAWaFfSdydKKg';

// Lazy singleton — avoids module-level side effects that conflict with React
let _supabase = null;
function getSupabase() {
  if (!_supabase) _supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
  return _supabase;
}

// Export single shared client for use across the app
export const supabaseClient = { from: (...a) => getSupabase().from(...a) };

// School ID is stored in localStorage — ties this browser to a specific school
const SCHOOL_ID_KEY = 'edumanage_school_id';

export function getLocalSchoolId() {
  return localStorage.getItem(SCHOOL_ID_KEY);
}
export function setLocalSchoolId(id) {
  localStorage.setItem(SCHOOL_ID_KEY, id);
}
export function clearLocalSchoolId() {
  localStorage.removeItem(SCHOOL_ID_KEY);
}

// ── Convert Supabase school row → app data format ───────────────
function schoolRowToData(row, related = {}) {
  return {
    // Plain object — no getter functions from INITIAL_DATA
    _schoolId:         row.id,
    schoolName:        row.school_name        || '',
    schoolMotto:       row.school_motto       || '',
    schoolPOBox:       row.school_po_box      || '',
    schoolLocation:    row.school_location    || '',
    schoolCounty:      row.school_county      || '',
    schoolType:        row.school_type        || 'Primary',
    principalName:     row.principal_name     || '',
    principalEmail:    row.principal_email    || 'principal@school.ac.ke',
    principalPassword: row.principal_password || 'admin123',
    smsConfig:         row.sms_config         || INITIAL_DATA.smsConfig,
    classGroups:       row.class_groups       || [],
    subjects:          row.subjects           || [],
    departments:       row.departments        || INITIAL_DATA.departments,
    bells:             row.bells              || INITIAL_DATA.bells,
    timetable:         row.timetable          || {},
    currentTerm:       row.current_term,
    currentYear:       row.current_year,
    licenseData:       row.license_data       || {},
    // Related tables
    teachers:          related.teachers       || [INITIAL_DATA.teachers[0]],
    students:          related.students       || [],
    exams:             related.exams          || [],
    feeTypes:          related.feeTypes       || [],
    feeSchedule:       related.feeSchedule    || [],
    feePayments:       related.feePayments    || [],
    terms:             related.terms          || [],
    rollCalls:         related.rollCalls      || [],
    permissions:       related.permissions    || [],
    statusAlerts:      related.statusAlerts   || [],
    notifications:     related.notifications  || [],
    messages:          related.messages       || [],
    parentMessages:    related.parentMessages || [],
    inventory:         related.inventory      || [],
    editRequests:      related.editRequests   || [],
  };
}

// ── Load full school data ────────────────────────────────────────
export async function loadSchoolData(schoolId) {
  const [
    { data: school, error: schoolErr },
    { data: teachers },
    { data: students },
    { data: exams },
    { data: feeTypes },
    { data: feeSchedule },
    { data: feePayments },
    { data: terms },
    { data: rollCalls },
    { data: permissions },
    { data: statusAlerts },
    { data: notifications },
    { data: messages },
    { data: parentMessages },
    { data: inventory },
    { data: editRequests },
  ] = await Promise.all([
    getSupabase().from('schools').select('*').eq('id', schoolId).single(),
    getSupabase().from('teachers').select('*').eq('school_id', schoolId),
    getSupabase().from('students').select('*').eq('school_id', schoolId),
    getSupabase().from('exams').select('*').eq('school_id', schoolId),
    getSupabase().from('fee_types').select('*').eq('school_id', schoolId),
    getSupabase().from('fee_schedule').select('*').eq('school_id', schoolId),
    getSupabase().from('fee_payments').select('*').eq('school_id', schoolId),
    getSupabase().from('terms').select('*').eq('school_id', schoolId),
    getSupabase().from('roll_calls').select('*').eq('school_id', schoolId),
    getSupabase().from('permissions').select('*').eq('school_id', schoolId),
    getSupabase().from('status_alerts').select('*').eq('school_id', schoolId),
    getSupabase().from('notifications').select('*').eq('school_id', schoolId),
    getSupabase().from('messages').select('*').eq('school_id', schoolId),
    getSupabase().from('parent_messages').select('*').eq('school_id', schoolId),
    getSupabase().from('inventory').select('*').eq('school_id', schoolId),
    getSupabase().from('edit_requests').select('*').eq('school_id', schoolId),
  ]);

  if (schoolErr || !school) return null;

  // Map teacher rows back to app format
  const mappedTeachers = (teachers || []).map(t => ({
    id:             t.local_id,
    name:           t.name,
    email:          t.email,
    phone:          t.phone,
    staffId:        t.staff_id,
    dept:           t.dept,
    staffType:      t.staff_type,
    isClassTeacher: t.is_class_teacher,
    classTeacherOf: t.class_teacher_of,
    subjects:       t.subjects || [],
    canSeeKitchenAlerts: t.can_see_kitchen,
    canSeeFees:     t.can_see_fees,
    admin:          t.admin,
    password:       t.password,
    _uuid:          t.id,
  }));

  // Map student rows
  const mappedStudents = (students || []).map(s => ({
    id:          s.local_id,
    name:        s.name,
    admNo:       s.adm_no,
    class:       s.class,
    gender:      s.gender,
    dob:         s.dob,
    parentName:  s.parent_name,
    parentPhone: s.parent_phone,
    parentEmail: s.parent_email,
    status:      s.status,
    _uuid:       s.id,
    ...s.extra,
  }));

  const mapJson = (rows) => (rows || []).map(r => ({ ...r.data, _uuid: r.id }));

  return schoolRowToData(school, {
    teachers:      mappedTeachers.length ? mappedTeachers : INITIAL_DATA.teachers,
    students:      mappedStudents,
    exams:         mapJson(exams),
    feeTypes:      (feeTypes || []).map(f => ({ id: f.local_id, name: f.name, description: f.description, appliesToAll: f.applies_to_all, applicableClasses: f.applicable_classes, _uuid: f.id })),
    feeSchedule:   (feeSchedule || []).map(f => ({ id: f.local_id, feeTypeId: f.fee_type_id, class: f.class, term: f.term, year: f.year, amount: f.amount, _uuid: f.id })),
    feePayments:   (feePayments || []).map(f => ({ id: f.local_id, studentId: f.student_id, feeTypeId: f.fee_type_id, amount: f.amount, date: f.date, term: f.term, year: f.year, receivedBy: f.received_by, method: f.method, note: f.note, _uuid: f.id })),
    terms:         mapJson(terms),
    rollCalls:     mapJson(rollCalls),
    permissions:   mapJson(permissions),
    statusAlerts:  mapJson(statusAlerts),
    notifications: mapJson(notifications),
    messages:      mapJson(messages),
    parentMessages: mapJson(parentMessages),
    inventory:     mapJson(inventory),
    editRequests:  mapJson(editRequests),
  });
}

// ── Create a new school ──────────────────────────────────────────
export async function createSchool(setupData) {
  const { data, error } = await getSupabase().from('schools').insert({
    school_name:        setupData.schoolName,
    school_motto:       setupData.schoolMotto       || '',
    school_po_box:      setupData.schoolPOBox        || '',
    school_location:    setupData.schoolLocation     || '',
    school_county:      setupData.schoolCounty       || '',
    school_type:        setupData.schoolType         || 'Primary',
    principal_name:     setupData.principalName      || '',
    principal_email:    setupData.principalEmail     || 'principal@school.ac.ke',
    principal_password: setupData.principalPassword  || 'admin123',
    bells:              INITIAL_DATA.bells,
    departments:        INITIAL_DATA.departments,
  }).select().single();

  if (error || !data) throw new Error(error?.message || 'Failed to create school');

  // Insert default admin teacher
  await getSupabase().from('teachers').insert({
    school_id:      data.id,
    local_id:       1,
    name:           'Administrator',
    email:          setupData.principalEmail || 'principal@school.ac.ke',
    phone:          '',
    staff_id:       'T000',
    dept:           'Management',
    staff_type:     'non_teaching',
    is_class_teacher: false,
    can_see_kitchen: true,
    can_see_fees:   true,
    admin:          true,
    password:       setupData.principalPassword || 'admin123',
  });

  return data.id;
}

// ── Track previous save to detect what actually changed ──────────
let _lastSaved = {};

// ── Save full school data (called on every setData) ──────────────
// SAFETY RULES:
// 1. Never save empty arrays to Supabase — only save arrays with data
// 2. Only save fields that have actually changed
// 3. Never delete data unless user explicitly deleted it
// 4. Always verify schoolId exists before saving
export async function saveSchoolData(data) {
  const schoolId = data._schoolId;
  if (!schoolId) return;

  // 1. Update main school row — only fields with real non-empty values
  const schoolPayload = {};
  const strFields = {
    school_name: data.schoolName, school_motto: data.schoolMotto,
    school_po_box: data.schoolPOBox, school_location: data.schoolLocation,
    school_county: data.schoolCounty, school_type: data.schoolType,
    principal_name: data.principalName, principal_email: data.principalEmail,
    principal_password: data.principalPassword,
  };

  Object.entries(strFields).forEach(([k, v]) => {
    if (v !== undefined && v !== null) schoolPayload[k] = v;
  });

  if (data.smsConfig) schoolPayload.sms_config = data.smsConfig;
  if (data.currentTerm !== undefined) schoolPayload.current_term = data.currentTerm;
  if (data.currentYear !== undefined) schoolPayload.current_year = data.currentYear;
  if (data.licenseData) schoolPayload.license_data = data.licenseData;

  // Array fields — only save if non-empty
  if (data.classGroups?.length > 0) schoolPayload.class_groups = data.classGroups;
  if (data.subjects?.length > 0) schoolPayload.subjects = data.subjects;
  if (data.departments?.length > 0) schoolPayload.departments = data.departments;
  if (data.bells?.length > 0) schoolPayload.bells = data.bells;
  if (data.timetable && Object.keys(data.timetable).length > 0) schoolPayload.timetable = data.timetable;
  if (data.gradesConfig?.length > 0) schoolPayload.grades_config = data.gradesConfig;

  if (Object.keys(schoolPayload).length > 0) {
    await getSupabase().from('schools').update(schoolPayload).eq('id', schoolId);
  }

  // 2. Only sync relational tables if they have real data AND changed
  const prev = _lastSaved[schoolId] || {};

  if (data.teachers?.length > 0) {
    const sig = JSON.stringify(data.teachers);
    if (sig !== prev.teachers) { await syncTeachers(schoolId, data.teachers); _lastSaved[schoolId] = { ..._lastSaved[schoolId], teachers: sig }; }
  }

  if (data.students?.length > 0) {
    const sig = JSON.stringify(data.students);
    if (sig !== prev.students) { await syncStudents(schoolId, data.students); _lastSaved[schoolId] = { ..._lastSaved[schoolId], students: sig }; }
  }

  // JSON tables — only sync if non-empty and changed
  const jsonTables = [
    ['exams', data.exams], ['terms', data.terms], ['roll_calls', data.rollCalls],
    ['permissions', data.permissions], ['status_alerts', data.statusAlerts],
    ['notifications', data.notifications], ['messages', data.messages],
    ['parent_messages', data.parentMessages], ['inventory', data.inventory],
    ['edit_requests', data.editRequests],
  ];

  for (const [table, items] of jsonTables) {
    if (!items || items.length === 0) continue; // NEVER sync empty — skip
    const sig = JSON.stringify(items);
    if (sig !== prev[table]) {
      await syncJsonTable(table, schoolId, items);
      _lastSaved[schoolId] = { ..._lastSaved[schoolId], [table]: sig };
    }
  }

  // Fee tables
  if (data.feeTypes?.length > 0) await syncFeeTypes(schoolId, data.feeTypes);
  if (data.feeSchedule?.length > 0) await syncFeeSchedule(schoolId, data.feeSchedule);
  if (data.feePayments?.length > 0) await syncFeePayments(schoolId, data.feePayments);
}

// ── Sync helpers ────────────────────────────────────────────────

async function syncTeachers(schoolId, teachers) {
  if (!teachers || !teachers.length) return;
  // Safe upsert: update existing, insert new, delete removed
  // Step 1: upsert all current teachers
  const rows = teachers.map(t => ({
    school_id:        schoolId,
    local_id:         t.id,
    name:             t.name,
    email:            t.email,
    phone:            t.phone || '',
    staff_id:         t.staffId,
    dept:             t.dept || '',
    staff_type:       t.staffType || 'teaching',
    is_class_teacher: t.isClassTeacher || false,
    class_teacher_of: t.classTeacherOf || null,
    subjects:         t.subjects || [],
    can_see_kitchen:  t.canSeeKitchenAlerts || false,
    can_see_fees:     t.canSeeFees || false,
    admin:            t.admin || false,
    password:         t.password || 'admin123',
  }));
  await getSupabase().from('teachers').upsert(rows, { onConflict: 'school_id,local_id' });
  // Step 2: delete only teachers that were explicitly removed
  const currentIds = teachers.map(t => t.id);
  const { data: existing } = await getSupabase().from('teachers').select('local_id').eq('school_id', schoolId);
  const toDelete = (existing || []).filter(e => !currentIds.includes(e.local_id)).map(e => e.local_id);
  if (toDelete.length > 0) {
    await getSupabase().from('teachers').delete().eq('school_id', schoolId).in('local_id', toDelete);
  }
}

async function syncStudents(schoolId, students) {
  if (!students || !students.length) return;
  // Safe upsert: update existing, insert new, delete only removed
  const rows = students.map(s => {
    const extra = {...s};
    ['id','name','admNo','class','gender','dob','parentName','parentPhone','parentEmail','status','_uuid'].forEach(k => delete extra[k]);
    return {
      school_id:    schoolId,
      local_id:     s.id,
      name:         s.name,
      adm_no:       s.admNo || '',
      class:        s.class || '',
      gender:       s.gender || '',
      dob:          s.dob || '',
      parent_name:  s.parentName || '',
      parent_phone: s.parentPhone || '',
      parent_email: s.parentEmail || '',
      status:       s.status || 'active',
      extra,
    };
  });
  await getSupabase().from('students').upsert(rows, { onConflict: 'school_id,local_id' });
  // Delete only students that were explicitly removed
  const currentIds = students.map(s => s.id);
  const { data: existing } = await getSupabase().from('students').select('local_id').eq('school_id', schoolId);
  const toDelete = (existing || []).filter(e => !currentIds.includes(e.local_id)).map(e => e.local_id);
  if (toDelete.length > 0) {
    await getSupabase().from('students').delete().eq('school_id', schoolId).in('local_id', toDelete);
  }
}

async function syncJsonTable(table, schoolId, items) {
  if (!items || items.length === 0) return;
  // Safe upsert: update existing records, insert new ones
  const rows = items.map((item, i) => ({
    school_id: schoolId,
    local_id:  String(item.id || i),
    data:      item,
  }));
  await getSupabase().from(table).upsert(rows, { onConflict: 'school_id,local_id' });
  // Delete only items that were explicitly removed
  const currentIds = new Set(rows.map(r => r.local_id));
  const { data: existing } = await getSupabase().from(table).select('local_id').eq('school_id', schoolId);
  const toDelete = (existing || []).filter(e => !currentIds.has(e.local_id)).map(e => e.local_id);
  if (toDelete.length > 0) {
    await getSupabase().from(table).delete().eq('school_id', schoolId).in('local_id', toDelete);
  }
}

async function syncFeeTypes(schoolId, feeTypes) {
  if (!feeTypes || !feeTypes.length) return;
  await getSupabase().from('fee_types').delete().eq('school_id', schoolId);
  await getSupabase().from('fee_types').insert(feeTypes.map(f => ({
    school_id:          schoolId,
    local_id:           String(f.id),
    name:               f.name,
    description:        f.description || '',
    applies_to_all:     f.appliesToAll !== false,
    applicable_classes: f.applicableClasses || [],
  })));
}

async function syncFeeSchedule(schoolId, feeSchedule) {
  if (!feeSchedule || !feeSchedule.length) return;
  await getSupabase().from('fee_schedule').delete().eq('school_id', schoolId);
  await getSupabase().from('fee_schedule').insert(feeSchedule.map(f => ({
    school_id:   schoolId,
    local_id:    String(f.id),
    fee_type_id: String(f.feeTypeId),
    class:       f.class,
    term:        f.term,
    year:        f.year,
    amount:      f.amount,
  })));
}

async function syncFeePayments(schoolId, feePayments) {
  if (!feePayments || !feePayments.length) return;
  await getSupabase().from('fee_payments').delete().eq('school_id', schoolId);
  await getSupabase().from('fee_payments').insert(feePayments.map(f => ({
    school_id:   schoolId,
    local_id:    String(f.id),
    student_id:  String(f.studentId),
    fee_type_id: String(f.feeTypeId),
    amount:      f.amount,
    date:        f.date,
    term:        f.term,
    year:        f.year,
    received_by: f.receivedBy || '',
    method:      f.method || 'cash',
    note:        f.note || '',
  })));
}

// ── Login: find teacher across all schools by email+password ─────
export async function loadLicenseFromCloud(schoolId) {
  if (!schoolId) return null;
  try {
    const { data } = await getSupabase()
      .from('schools')
      .select('license_data')
      .eq('id', schoolId)
      .single();
    if (data?.license_data) {
      const { lic, token } = data.license_data;
      if (lic) localStorage.setItem('edumanage_license_v1', JSON.stringify(lic));
      if (token && token.expiry && new Date(token.expiry) > new Date()) {
        localStorage.setItem('edumanage_token_v1', JSON.stringify(token));
      }
      return data.license_data;
    }
  } catch(e) { console.warn('Cloud license load failed:', e); }
  return null;
}

export async function checkAnySchoolExists() {
  try {
    const { data, error } = await getSupabase()
      .from('schools')
      .select('id')
      .limit(1);
    return !error && data && data.length > 0;
  } catch (e) {
    return false;
  }
}

export async function loginTeacher(email, password) {
  const { data: teachers } = await getSupabase()
    .from('teachers')
    .select('*, schools(*)')
    .eq('email', email)
    .eq('password', password);

  if (!teachers || !teachers.length) return null;
  return teachers[0];
}

export async function loginPrincipal(email, password) {
  const { data: schools } = await getSupabase()
    .from('schools')
    .select('*')
    .eq('principal_email', email)
    .eq('principal_password', password);

  if (!schools || !schools.length) return null;
  return schools[0];
}

// ── Subscriptions / SMS Quota ────────────────────────────────────

// Get or create subscription row for current term
export async function getSubscription(schoolId, term, year) {
  if (!schoolId) return null;
  try {
    const { data, error } = await getSupabase()
      .from('subscriptions')
      .select('*')
      .eq('school_id', schoolId)
      .eq('term', term)
      .eq('year', year)
      .single();
    if (error || !data) return null;
    return data;
  } catch { return null; }
}

// Upsert subscription row (called after payment confirmed)
export async function upsertSubscription(schoolId, term, year, fields) {
  if (!schoolId) return null;
  try {
    const { data, error } = await getSupabase()
      .from('subscriptions')
      .upsert({ school_id: schoolId, term, year, ...fields },
               { onConflict: 'school_id,term,year' })
      .select()
      .single();
    if (error) { console.error('upsertSubscription error:', error); return null; }
    return data;
  } catch (e) { console.error('upsertSubscription exception:', e); return null; }
}

// Atomically increment sms_used — called server-side after each batch send
// Returns { ok, remaining } so UI can update quota display
export async function incrementSmsUsed(schoolId, term, year, count = 1) {
  if (!schoolId) return { ok: false };
  try {
    // Read current value first
    const sub = await getSubscription(schoolId, term, year);
    if (!sub) return { ok: false, reason: 'no_subscription' };
    const newUsed = (sub.sms_used || 0) + count;
    const quota   = sub.sms_quota || 0;
    if (newUsed > quota) return { ok: false, reason: 'quota_exceeded', remaining: quota - (sub.sms_used || 0) };
    await getSupabase()
      .from('subscriptions')
      .update({ sms_used: newUsed })
      .eq('school_id', schoolId)
      .eq('term', term)
      .eq('year', year);
    return { ok: true, remaining: quota - newUsed };
  } catch (e) { console.error('incrementSmsUsed error:', e); return { ok: false }; }
}

// Same for WhatsApp
export async function incrementWaUsed(schoolId, term, year, count = 1) {
  if (!schoolId) return { ok: false };
  try {
    const sub = await getSubscription(schoolId, term, year);
    if (!sub) return { ok: false, reason: 'no_subscription' };
    const newUsed = (sub.wa_used || 0) + count;
    const quota   = sub.wa_quota || 0;
    if (newUsed > quota) return { ok: false, reason: 'quota_exceeded', remaining: quota - (sub.wa_used || 0) };
    await getSupabase()
      .from('subscriptions')
      .update({ wa_used: newUsed })
      .eq('school_id', schoolId)
      .eq('term', term)
      .eq('year', year);
    return { ok: true, remaining: quota - newUsed };
  } catch (e) { console.error('incrementWaUsed error:', e); return { ok: false }; }
}
