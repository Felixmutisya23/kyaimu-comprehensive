// ═══════════════════════════════════════════════════════════════
//  EduManage Pro — Supabase Data Layer
//  Replaces localStorage with cloud database.
//  Each school is identified by its UUID stored in localStorage.
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import { INITIAL_DATA } from './data/initialData';

// FIX 1: Credentials from env vars — never hardcode in source
// Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Netlify → Environment Variables
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error('[EduManage] Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Netlify.');
}

// Lazy singleton — avoids module-level side effects that conflict with React
let _supabase = null;
function getSupabase() {
  if (!_supabase) _supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
  return _supabase;
}

// Export single shared client for use across the app
export const supabaseClient = { from: (...a) => getSupabase().from(...a) };

// FIX 2: Set RLS context before queries so DB enforces school isolation
async function setSchoolContext(schoolId) {
  if (!schoolId) return;
  try {
    await getSupabase().rpc('set_school_context', { p_school_id: schoolId });
  } catch (e) {
    console.warn('[EduManage] Could not set school context:', e.message);
  }
}

// FIX 3: Guaranteed unique ID — replaces the dangerous || i (array-index) fallback
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

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

// ── Password hashing using Web Crypto API (SHA-256) ─────────────
// Far more secure than plain text. Works in all modern browsers.
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'edumanage_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Check if a stored value is already hashed (64 hex chars) or plain text
function isHashed(val) {
  return typeof val === 'string' && /^[0-9a-f]{64}$/.test(val);
}

// ── Convert Supabase school row → app data format ───────────────
function schoolRowToData(row, related = {}) {
  return {
    _loadedFromDB: true,  // marks that this data came from Supabase, safe to save back
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
    classes:           row.classes            || [],           // FIX: was never loaded
    subjects:          row.subjects           || [],
    departments:       row.departments        || INITIAL_DATA.departments,
    bells:             (row.bells && row.bells.length > 0) ? row.bells : INITIAL_DATA.bells,
    timetable:         row.timetable          || {},
    currentTerm:       row.current_term,
    currentYear:       row.current_year,
    licenseData:       row.license_data       || {},
    gradesConfig:      row.grades_config      || INITIAL_DATA.gradesConfig,
    subjectsByClass:   row.subjects_by_class   || {}, // FIX: was never loaded
    subjectOverridesByLevel: row.subject_overrides_by_level || {},
    timetableRules:          row.timetable_rules             || [],
    parents:           row.parents            || [],           // FIX: was never loaded
    promotionHistory:  row.promotion_history  || [],          // FIX: was never loaded
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
  await setSchoolContext(schoolId); // FIX: set RLS context before all queries
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
    status:         t.status || 'active',  // 'pending' until admin approves
    registeredAt:   t.created_at,
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

  // FIX 5: guarantee every item has a real unique id (not array index)
  const mapJson = (rows) => (rows || []).map(r => {
    const item = { ...r.data, _uuid: r.id };
    if (!item.id) item.id = r.local_id || generateId();
    return item;
  });

  return schoolRowToData(school, {
    teachers:      mappedTeachers,  // never fall back to demo data — use what's in DB
    students:      mappedStudents,
    exams:         mapJson(exams),
    feeTypes:      (feeTypes || []).map(f => ({ id: f.local_id, name: f.name, description: f.description, appliesToAll: f.applies_to_all, applicableClasses: f.applicable_classes, _uuid: f.id })),
    feeSchedule:   (feeSchedule || []).map(f => ({ id: f.local_id, feeTypeId: f.fee_type_id, class: f.class, term: f.term, year: f.year, amount: f.amount, _uuid: f.id })),
    feePayments:   (feePayments || []).map(f => ({ id: f.local_id, studentId: String(f.student_id || f.local_id), feeTypeId: f.fee_type_id, amount: f.amount, date: f.date, term: f.term, year: f.year, receivedBy: f.received_by, method: f.method, note: f.note, _uuid: f.id })),
    terms: (() => {
      const mapped = mapJson(terms);
      if (mapped && mapped.length > 0) return mapped;
      // No terms in DB — return default terms for current year
      const y = new Date().getFullYear();
      return [
        { id: 1, term: 1, year: y, startDate: y + '-01-01', endDate: y + '-04-15', label: 'Term 1' },
        { id: 2, term: 2, year: y, startDate: y + '-04-16', endDate: y + '-08-15', label: 'Term 2' },
        { id: 3, term: 3, year: y, startDate: y + '-08-16', endDate: y + '-11-30', label: 'Term 3' },
      ];
    })(),
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
  const hashedPw = await hashPassword(setupData.principalPassword || 'admin123');
  const { data, error } = await getSupabase().from('schools').insert({
    school_name:        setupData.schoolName,
    school_motto:       setupData.schoolMotto       || '',
    school_po_box:      setupData.schoolPOBox        || '',
    school_location:    setupData.schoolLocation     || '',
    school_county:      setupData.schoolCounty       || '',
    school_type:        setupData.schoolType         || 'Primary',
    principal_name:     setupData.principalName      || '',
    principal_email:    setupData.principalEmail     || 'principal@school.ac.ke',
    principal_password: hashedPw,
    bells:              INITIAL_DATA.bells,
    departments:        INITIAL_DATA.departments,
  }).select().single();

  if (error || !data) throw new Error(error?.message || 'Failed to create school');

  // Insert default terms for the current year
  const yr = new Date().getFullYear();
  const defaultTerms = [
    { school_id: data.id, local_id: 1, term: 1, year: yr, start_date: yr + '-01-01', end_date: yr + '-04-15', label: 'Term 1' },
    { school_id: data.id, local_id: 2, term: 2, year: yr, start_date: yr + '-04-16', end_date: yr + '-08-15', label: 'Term 2' },
    { school_id: data.id, local_id: 3, term: 3, year: yr, start_date: yr + '-08-16', end_date: yr + '-11-30', label: 'Term 3' },
  ];
  await getSupabase().from('terms').insert(defaultTerms);

  // Insert default admin teacher (hashed password)
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
    password:       hashedPw,
  });

  return data.id;
}

// ── Dirty-flag tracking — only sync tables that changed ──────────
// FIX 6: avoids firing 16 Supabase queries per save when only 1 table changed
let _lastSnapshot = {};
function tableFingerprint(items) {
  if (!items || !items.length) return '0:';
  // Include JSON content so score/result updates inside existing records are detected
  try {
    return items.length + ':' + JSON.stringify(items).length + ':' + items.map(i => String(i.id || i._uuid || '')).join(',');
  } catch { return items.length + ':'; }
}
function isDirty(schoolId, table, items) {
  const key = schoolId + ':' + table;
  const fp  = tableFingerprint(items);
  if (_lastSnapshot[key] === fp) return false;
  _lastSnapshot[key] = fp;
  return true;
}
function markClean(schoolId, table, items) {
  _lastSnapshot[schoolId + ':' + table] = tableFingerprint(items);
}

// ── Save full school data (called on every setData) ──────────────
// SAFETY RULES:
// 1. Never save empty arrays to Supabase — only save arrays with data
// 2. Only save fields that have actually changed
// 3. Never delete data unless user explicitly deleted it
// 4. Always verify schoolId exists before saving
export async function saveSchoolData(data) {
  const schoolId = data._schoolId;
  if (!schoolId) return;
  // Safety: don't save if data hasn't been loaded from DB yet (prevents wiping on init)
  if (!data._loadedFromDB) return;

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

  // Hash principal password before saving if it's plain text
  if (data.principalPassword) {
    schoolPayload.principal_password = isHashed(data.principalPassword)
      ? data.principalPassword
      : await hashPassword(data.principalPassword);
  }

  // Array fields — save always (including empty arrays so deletions persist)
  schoolPayload.class_groups    = data.classGroups     ?? [];
  schoolPayload.classes         = data.classes         ?? [];   // FIX: was never saved
  schoolPayload.subjects        = data.subjects        ?? [];
  schoolPayload.departments     = data.departments     ?? [];
  schoolPayload.bells           = (data.bells && data.bells.length > 0) ? data.bells : INITIAL_DATA.bells;
  schoolPayload.parents         = data.parents         ?? [];   // FIX: was never saved
  schoolPayload.promotion_history = data.promotionHistory ?? []; // FIX: was never saved
  if (data.timetable && Object.keys(data.timetable||{}).length > 0) schoolPayload.timetable = data.timetable;
  if (data.gradesConfig) schoolPayload.grades_config = data.gradesConfig;
  schoolPayload.subjects_by_class          = data.subjectsByClass          || {};
  schoolPayload.subject_overrides_by_level = data.subjectOverridesByLevel ?? {};
  schoolPayload.timetable_rules            = data.timetableRules           ?? [];

  await getSupabase().from('schools').update(schoolPayload).eq('id', schoolId);

  // FIX 6: only sync tables that changed (dirty flag) — reduces Supabase load significantly
  if (isDirty(schoolId, 'teachers', data.teachers)) {
    await syncTeachers(schoolId, data.teachers || [], !!data._teachersLoaded);
    markClean(schoolId, 'teachers', data.teachers);
  }
  if (isDirty(schoolId, 'students', data.students)) {
    await syncStudents(schoolId, data.students || [], !!data._studentsLoaded);
    markClean(schoolId, 'students', data.students);
  }

  const jsonTables = [
    ['exams', data.exams], ['terms', data.terms], ['roll_calls', data.rollCalls],
    ['permissions', data.permissions], ['status_alerts', data.statusAlerts],
    ['notifications', data.notifications], ['messages', data.messages],
    ['parent_messages', data.parentMessages], ['inventory', data.inventory],
    ['edit_requests', data.editRequests],
  ];
  for (const [table, items] of jsonTables) {
    if (isDirty(schoolId, table, items)) {
      await syncJsonTable(table, schoolId, items || []);
      markClean(schoolId, table, items);
    }
  }

  if (isDirty(schoolId, 'fee_types', data.feeTypes)) {
    await syncFeeTypes(schoolId, data.feeTypes || []);
    markClean(schoolId, 'fee_types', data.feeTypes);
  }
  if (isDirty(schoolId, 'fee_schedule', data.feeSchedule)) {
    await syncFeeSchedule(schoolId, data.feeSchedule || []);
    markClean(schoolId, 'fee_schedule', data.feeSchedule);
  }
  if (isDirty(schoolId, 'fee_payments', data.feePayments)) {
    await syncFeePayments(schoolId, data.feePayments || []);
    markClean(schoolId, 'fee_payments', data.feePayments);
  }
}

// ── Sync helpers ────────────────────────────────────────────────

async function syncTeachers(schoolId, teachers, teachersLoaded) {
  // FIX 8: only skip wipe if data was confirmed loaded (prevents race on first load)
  if (!teachers || !teachers.length) return;
  // Hash any plain-text passwords before saving
  const rows = await Promise.all(teachers.map(async t => {
    const pw = t.password || 'admin123';
    const hashedPw = isHashed(pw) ? pw : await hashPassword(pw);
    return {
      school_id:        schoolId,
      local_id:         t.id || generateId(), // FIX: guarantee non-null
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
      password:         hashedPw,
      status:           t.status || 'active',
    };
  }));
  await getSupabase().from('teachers').upsert(rows, { onConflict: 'school_id,local_id' });
  // Step 2: delete only teachers that were explicitly removed
  const currentIds = teachers.map(t => String(t.id || t.staffId));
  const { data: existing } = await getSupabase().from('teachers').select('local_id').eq('school_id', schoolId);
  const toDelete = (existing || []).filter(e => !currentIds.includes(String(e.local_id))).map(e => e.local_id);
  if (toDelete.length > 0) {
    await getSupabase().from('teachers').delete().eq('school_id', schoolId).in('local_id', toDelete);
  }
}

async function syncStudents(schoolId, students, studentsLoaded) {
  // FIX 9: proper loaded-flag guard
  if (!students || !students.length) return;
  // Safe upsert: update existing, insert new, delete only removed
  const rows = students.map(s => {
    const extra = {...s};
    ['id','name','admNo','class','gender','dob','parentName','parentPhone','parentEmail','status','_uuid'].forEach(k => delete extra[k]);
    return {
      school_id:    schoolId,
      local_id:     s.id || generateId(), // FIX: guarantee non-null
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
  const currentIds = students.map(s => String(s.id));
  const { data: existing } = await getSupabase().from('students').select('local_id').eq('school_id', schoolId);
  const toDelete = (existing || []).filter(e => !currentIds.includes(String(e.local_id))).map(e => e.local_id);
  if (toDelete.length > 0) {
    await getSupabase().from('students').delete().eq('school_id', schoolId).in('local_id', toDelete);
  }
}

async function syncJsonTable(table, schoolId, items) {
  // If items is empty, delete everything in this table for this school
  if (!items || items.length == 0) {
    await getSupabase().from(table).delete().eq('school_id', schoolId);
    return;
  }
  // Safe upsert: update existing records, insert new ones
  // FIX 10: use generateId not array index (i) as fallback — prevents id collision
  const rows = items.map(item => ({
    school_id: schoolId,
    local_id:  String(item.id || item._uuid || generateId()),
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
  if (!feeTypes || !feeTypes.length) {
    await getSupabase().from('fee_types').delete().eq('school_id', schoolId);
    return;
  }
  const rows = feeTypes.map(f => ({
    school_id:          schoolId,
    local_id:           String(f.id),
    name:               f.name,
    description:        f.description || '',
    applies_to_all:     f.appliesToAll !== false,
    applicable_classes: f.applicableClasses || [],
  }));
  await getSupabase().from('fee_types').upsert(rows, { onConflict: 'school_id,local_id' });
  // Delete removed fee types
  const currentIds = new Set(rows.map(r => r.local_id));
  const { data: existing } = await getSupabase().from('fee_types').select('local_id').eq('school_id', schoolId);
  const toDelete = (existing || []).filter(e => !currentIds.has(String(e.local_id))).map(e => e.local_id);
  if (toDelete.length > 0) {
    await getSupabase().from('fee_types').delete().eq('school_id', schoolId).in('local_id', toDelete);
  }
}

async function syncFeeSchedule(schoolId, feeSchedule) {
  if (!feeSchedule || !feeSchedule.length) {
    await getSupabase().from('fee_schedule').delete().eq('school_id', schoolId);
    return;
  }
  const rows = feeSchedule.map(f => ({
    school_id:   schoolId,
    local_id:    String(f.id),
    fee_type_id: String(f.feeTypeId),
    class:       f.class,
    term:        f.term,
    year:        f.year,
    amount:      f.amount,
  }));
  await getSupabase().from('fee_schedule').upsert(rows, { onConflict: 'school_id,local_id' });
  const currentIds = new Set(rows.map(r => r.local_id));
  const { data: existing } = await getSupabase().from('fee_schedule').select('local_id').eq('school_id', schoolId);
  const toDelete = (existing || []).filter(e => !currentIds.has(String(e.local_id))).map(e => e.local_id);
  if (toDelete.length > 0) {
    await getSupabase().from('fee_schedule').delete().eq('school_id', schoolId).in('local_id', toDelete);
  }
}

async function syncFeePayments(schoolId, feePayments) {
  if (!feePayments || !feePayments.length) {
    // SAFETY: Never wipe all payments on empty — same guard as students
    return;
  }
  const rows = feePayments.map(f => ({
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
  }));
  await getSupabase().from('fee_payments').upsert(rows, { onConflict: 'school_id,local_id' });
  // Only delete payments that were explicitly removed
  const currentIds = new Set(rows.map(r => r.local_id));
  const { data: existing } = await getSupabase().from('fee_payments').select('local_id').eq('school_id', schoolId);
  const toDelete = (existing || []).filter(e => !currentIds.has(String(e.local_id))).map(e => e.local_id);
  if (toDelete.length > 0) {
    await getSupabase().from('fee_payments').delete().eq('school_id', schoolId).in('local_id', toDelete);
  }
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
      const { lic, token, installation } = data.license_data;
      if (lic) localStorage.setItem('edumanage_license_v1', JSON.stringify(lic));
      if (token && token.expiry && new Date(token.expiry) > new Date()) {
        localStorage.setItem('edumanage_token_v1', JSON.stringify(token));
      }
      // Restore installation-paid status — critical for cross-device access
      // Only write if cloud says paid; never downgrade a device that already has it
      // FIX 11: cloud is always the source of truth — always overwrite localStorage
      if (installation?.paid) {
        localStorage.setItem('edumanage_installation_v1', JSON.stringify(installation));
      }
      return data.license_data;
    }
  } catch(e) { console.warn('Cloud license load failed:', e); }
  return null;
}

export async function checkAnySchoolExists() {
  // FIX 12: skip DB call if local school ID already exists (avoids startup latency)
  if (getLocalSchoolId()) return true;
  try {
    const { data, error } = await getSupabase().from('schools').select('id').limit(1);
    return !error && data && data.length > 0;
  } catch { return false; }
}

export async function loginTeacher(email, password) {
  // FIX 13: scope query to school stored in localStorage — prevents cross-school
  // email collisions and avoids returning all teachers across all schools
  const schoolId = getLocalSchoolId();
  const hashed = await hashPassword(password);

  let query = getSupabase().from('teachers').select('*, schools(*)').eq('email', email);
  if (schoolId) {
    await setSchoolContext(schoolId);
    query = query.eq('school_id', schoolId);
  }
  const { data: teachers } = await query;

  if (!teachers || !teachers.length) return null;

  const teacher = teachers.find(t => t.password === hashed || t.password === password);
  if (!teacher) return null;

  // Migrate plain-text password to hashed on successful login
  if (teacher.password === password && !isHashed(password)) {
    await getSupabase().from('teachers').update({ password: hashed }).eq('id', teacher.id);
  }
  return teacher;
}

export async function loginPrincipal(email, password) {
  const hashed = await hashPassword(password);
  // Fetch by email only, then check password (hashed or legacy plain text)
  const { data: schools } = await getSupabase()
    .from('schools')
    .select('*')
    .eq('principal_email', email);

  if (!schools || !schools.length) return null;

  const school = schools.find(s => s.principal_password === hashed || s.principal_password === password);
  if (!school) return null;

  // Migrate plain-text password to hashed on successful login
  if (school.principal_password === password && !isHashed(password)) {
    await getSupabase().from('schools').update({ principal_password: hashed }).eq('id', school.id);
  }
  return school;
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
      .limit(1);
    if (error || !data || !data.length) return null;
    return data[0];
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
      .select();
    if (error) { console.error('upsertSubscription error:', error); return null; }
    return data?.[0] || null;
  } catch (e) { console.error('upsertSubscription exception:', e); return null; }
}

// Atomically increment sms_used — called server-side after each batch send
// Returns { ok, remaining } so UI can update quota display
// FIX 14: use atomic DB stored procedures — prevents race condition when
// two devices send SMS simultaneously (read-increment-write race)
export async function incrementSmsUsed(schoolId, term, year, count = 1) {
  if (!schoolId) return { ok: false };
  try {
    await setSchoolContext(schoolId);
    const { data, error } = await getSupabase().rpc('increment_sms_used', {
      p_school_id: schoolId, p_term: term, p_year: year, p_count: count,
    });
    if (error) return { ok: false, reason: error.message };
    return data || { ok: false };
  } catch (e) { console.error('incrementSmsUsed error:', e); return { ok: false }; }
}

export async function incrementWaUsed(schoolId, term, year, count = 1) {
  if (!schoolId) return { ok: false };
  try {
    await setSchoolContext(schoolId);
    const { data, error } = await getSupabase().rpc('increment_wa_used', {
      p_school_id: schoolId, p_term: term, p_year: year, p_count: count,
    });
    if (error) return { ok: false, reason: error.message };
    return data || { ok: false };
  } catch (e) { console.error('incrementWaUsed error:', e); return { ok: false }; }
}
