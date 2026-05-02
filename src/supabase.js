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

// ── Save full school data (called on every setData) ──────────────
export async function saveSchoolData(data) {
  const schoolId = data._schoolId;
  if (!schoolId) return;

  // 1. Update main school row
  await getSupabase().from('schools').update({
    school_name:        data.schoolName,
    school_motto:       data.schoolMotto,
    school_po_box:      data.schoolPOBox,
    school_location:    data.schoolLocation,
    school_county:      data.schoolCounty,
    school_type:        data.schoolType,
    principal_name:     data.principalName,
    principal_email:    data.principalEmail,
    principal_password: data.principalPassword,
    sms_config:         data.smsConfig,
    class_groups:       data.classGroups,
    subjects:           data.subjects,
    departments:        data.departments,
    bells:              data.bells,
    timetable:          data.timetable,
    current_term:       data.currentTerm,
    current_year:       data.currentYear,
    license_data:       data.licenseData || {},
  }).eq('id', schoolId);

  // 2. Sync teachers
  await syncTeachers(schoolId, data.teachers || []);

  // 3. Sync students
  await syncStudents(schoolId, data.students || []);

  // 4. Sync simple jsonb tables
  await syncJsonTable('exams',          schoolId, data.exams          || []);
  await syncJsonTable('terms',          schoolId, data.terms          || []);
  await syncJsonTable('roll_calls',     schoolId, data.rollCalls      || []);
  await syncJsonTable('permissions',    schoolId, data.permissions    || []);
  await syncJsonTable('status_alerts',  schoolId, data.statusAlerts   || []);
  await syncJsonTable('notifications',  schoolId, data.notifications  || []);
  await syncJsonTable('messages',       schoolId, data.messages       || []);
  await syncJsonTable('parent_messages',schoolId, data.parentMessages || []);
  await syncJsonTable('inventory',      schoolId, data.inventory      || []);
  await syncJsonTable('edit_requests',  schoolId, data.editRequests   || []);

  // 5. Sync fee tables
  await syncFeeTypes(schoolId, data.feeTypes || []);
  await syncFeeSchedule(schoolId, data.feeSchedule || []);
  await syncFeePayments(schoolId, data.feePayments || []);
}

// ── Sync helpers ────────────────────────────────────────────────

async function syncTeachers(schoolId, teachers) {
  // Delete all and re-insert (simple approach for small datasets)
  await getSupabase().from('teachers').delete().eq('school_id', schoolId);
  if (!teachers.length) return;
  await getSupabase().from('teachers').insert(teachers.map(t => ({
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
  })));
}

async function syncStudents(schoolId, students) {
  await getSupabase().from('students').delete().eq('school_id', schoolId);
  if (!students.length) return;
  await getSupabase().from('students').insert(students.map(s => ({
    school_id:   schoolId,
    local_id:    s.id,
    name:        s.name,
    adm_no:      s.admNo || '',
    class:       s.class || '',
    gender:      s.gender || '',
    dob:         s.dob || '',
    parent_name: s.parentName || '',
    parent_phone: s.parentPhone || '',
    parent_email: s.parentEmail || '',
    status:      s.status || 'active',
    extra:       (() => { const e = {...s}; delete e.id; delete e.name; delete e.admNo; delete e.class; delete e.gender; delete e.dob; delete e.parentName; delete e.parentPhone; delete e.parentEmail; delete e.status; delete e._uuid; return e; })(),
  })));
}

async function syncJsonTable(table, schoolId, items) {
  await getSupabase().from(table).delete().eq('school_id', schoolId);
  if (!items.length) return;
  await getSupabase().from(table).insert(items.map((item, i) => ({
    school_id: schoolId,
    local_id:  String(item.id || i),
    data:      item,
  })));
}

async function syncFeeTypes(schoolId, feeTypes) {
  await getSupabase().from('fee_types').delete().eq('school_id', schoolId);
  if (!feeTypes.length) return;
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
  await getSupabase().from('fee_schedule').delete().eq('school_id', schoolId);
  if (!feeSchedule.length) return;
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
  await getSupabase().from('fee_payments').delete().eq('school_id', schoolId);
  if (!feePayments.length) return;
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
export async function loginTeacher(email, password) {
  const { data: teachers } = await supabase
    .from('teachers')
    .select('*, schools(*)')
    .eq('email', email)
    .eq('password', password);

  if (!teachers || !teachers.length) return null;
  return teachers[0]; // returns teacher row with embedded school
}

// ── Login: find school by principal email+password ───────────────
export async function loginPrincipal(email, password) {
  const { data: schools } = await supabase
    .from('schools')
    .select('*')
    .eq('principal_email', email)
    .eq('principal_password', password);

  if (!schools || !schools.length) return null;
  return schools[0];
}
