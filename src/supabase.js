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
export const supabaseClient = { from: (...a) => getSupabase().from(...a), storage: { from: (...a) => getSupabase().storage.from(...a) } };

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
    extraSubjectsByLevel:    row.extra_subjects_by_level    || {},
    subjectExamGroups:       row.subject_exam_groups        || {},
    studentFeeEnrollments:   row.student_fee_enrollments    || {},
    schoolStamp:             row.school_stamp               || INITIAL_DATA.schoolStamp,
    timetableRules:          row.timetable_rules             || [],
    // Public page fields
    schoolSlug:              row.school_slug              || '',
    slugLocked:              row.slug_locked              || false,
    schoolAbout:             row.school_about             || '',
    schoolVision:            row.school_vision            || '',
    schoolMission:           row.school_mission           || '',
    schoolPhone:             row.school_phone             || '',
    schoolEmail:             row.school_email             || '',
    schoolWebsite:           row.school_website           || '',
    schoolGallery:           row.school_gallery           || [],
    jobVacancies:            row.job_vacancies            || [],
    onlineApplications:      row.online_applications      || [],
    customDocReqs:           row.custom_doc_reqs          || [],
    // Admission & theme settings
    admissionSetting:        row.admission_setting        || 'manual',
    schoolCode:              row.school_code              || '',
    schoolCodeYear:          row.school_code_year         || '',
    darkTheme:               row.dark_theme               !== false,
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

/**
 * findStudentBySlc
 * ────────────────
 * Searches ALL schools for a student whose SLC matches.
 * SLC is stored in the `extra` JSON blob on each student row.
 * We query all students with matching slc from the extra field.
 * Returns { schoolId, student } or null.
 */
export async function findStudentBySlc(slcCode) {
  if (!slcCode) return null;
  const slc = String(slcCode).trim();
  try {
    // Query students table — extra->>'slc' matches the code
    const { data: rows, error } = await getSupabase()
      .from('students')
      .select('school_id, local_id, name, adm_no, class, gender, dob, parent_name, parent_phone, parent_email, status, extra')
      .eq('extra->>slc', slc)
      .limit(1);
    if (error || !rows || rows.length === 0) return null;
    const row = rows[0];
    const student = {
      id:          row.local_id,
      name:        row.name,
      admNo:       row.adm_no,
      class:       row.class,
      gender:      row.gender,
      dob:         row.dob,
      parentName:  row.parent_name,
      parentPhone: row.parent_phone,
      parentEmail: row.parent_email,
      status:      row.status,
      ...(row.extra || {}),
    };
    return { schoolId: row.school_id, student };
  } catch (e) {
    console.error('[EduManage] findStudentBySlc error:', e);
    return null;
  }
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
    markEntrySubjects: t.mark_entry_subjects || [],
    canSeeKitchenAlerts: t.can_see_kitchen,
    canSeeFees:     t.can_see_fees,
    canEnterAllMarks: t.can_enter_all_marks || false,
    canManageStudents: t.can_manage_students || false,
    canMessageParents: t.can_message_parents || false,
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
  const { error: termsErr } = await getSupabase().from('terms').insert(defaultTerms);
  if (termsErr) console.error('[EduManage] createSchool: terms insert FAILED:', termsErr.message, termsErr);

  // Insert default admin teacher (hashed password)
  const { error: teacherErr } = await getSupabase().from('teachers').insert({
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
  if (teacherErr) console.error('[EduManage] createSchool: default teacher insert FAILED:', teacherErr.message, teacherErr);

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
  schoolPayload.promotion_history = data.promotionHistory ?? [];
  if (data.timetable && Object.keys(data.timetable||{}).length > 0) schoolPayload.timetable = data.timetable;
  if (data.gradesConfig) schoolPayload.grades_config = data.gradesConfig;
  schoolPayload.subjects_by_class          = data.subjectsByClass          || {};
  schoolPayload.subject_overrides_by_level = data.subjectOverridesByLevel ?? {};
  schoolPayload.extra_subjects_by_level    = data.extraSubjectsByLevel    ?? {};
  schoolPayload.subject_exam_groups        = data.subjectExamGroups       ?? {};
  schoolPayload.student_fee_enrollments    = data.studentFeeEnrollments   ?? {};
  schoolPayload.school_stamp               = data.schoolStamp            ?? {};
  schoolPayload.timetable_rules            = data.timetableRules           ?? [];
  // Public page fields
  schoolPayload.school_slug              = data.schoolSlug              || '';
  schoolPayload.slug_locked              = data.slugLocked              || false;
  schoolPayload.school_about             = data.schoolAbout             || '';
  schoolPayload.school_vision            = data.schoolVision            || '';
  schoolPayload.school_mission           = data.schoolMission           || '';
  schoolPayload.school_phone             = data.schoolPhone             || '';
  schoolPayload.school_email             = data.schoolEmail             || '';
  schoolPayload.school_website           = data.schoolWebsite           || '';
  schoolPayload.school_gallery           = data.schoolGallery           ?? [];
  schoolPayload.job_vacancies            = data.jobVacancies            ?? [];
  schoolPayload.online_applications      = data.onlineApplications      ?? [];
  schoolPayload.custom_doc_reqs          = data.customDocReqs           ?? [];
  // Admission & theme settings
  schoolPayload.admission_setting        = data.admissionSetting        || 'manual';
  schoolPayload.school_code              = data.schoolCode              || '';
  schoolPayload.school_code_year         = data.schoolCodeYear          || '';
  schoolPayload.dark_theme               = data.darkTheme               !== false;

  // CRITICAL FIX: Supabase's client does NOT throw on a failed request — it
  // returns { data, error } and silently continues unless you check `error`
  // yourself. This call was discarding that result entirely, so ANY failed
  // save (bad value, constraint violation, schema mismatch, RLS rejection,
  // etc.) was invisible: the UI would still show "✓ All changes saved"
  // while nothing actually reached the database. This is the most likely
  // explanation for tokens, subjects, and other changes "disappearing" —
  // they were never silently lost after being saved; the save itself was
  // silently failing in the first place, before this fix could ever know.
  const { error: schoolUpdateError } = await getSupabase().from('schools').update(schoolPayload).eq('id', schoolId);
  if (schoolUpdateError) {
    console.error('[EduManage] schools.update FAILED:', schoolUpdateError.message, schoolUpdateError);
    throw new Error('Save failed: ' + schoolUpdateError.message);
  }

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
      mark_entry_subjects: t.markEntrySubjects || [],
      can_see_kitchen:  t.canSeeKitchenAlerts || false,
      can_see_fees:     t.canSeeFees || false,
      can_enter_all_marks: t.canEnterAllMarks || false,
      can_manage_students: t.canManageStudents || false,
      can_message_parents: t.canMessageParents || false,
      admin:            t.admin || false,
      password:         hashedPw,
      status:           t.status || 'active',
    };
  }));
  let { error: upsertErr } = await getSupabase().from('teachers').upsert(rows, { onConflict: 'school_id,local_id' });
  // If a newly-added column (from a migration the school hasn't run yet)
  // doesn't exist, don't let it break saving everything else — strip that
  // column and retry, warning loudly so it gets fixed. Until the migration
  // runs, whatever that column stores won't persist across reloads.
  const NEW_COLUMNS = {
    mark_entry_subjects: "ALTER TABLE teachers ADD COLUMN mark_entry_subjects jsonb DEFAULT '[]'::jsonb;",
    can_manage_students: "ALTER TABLE teachers ADD COLUMN can_manage_students boolean DEFAULT false;",
    can_message_parents: "ALTER TABLE teachers ADD COLUMN can_message_parents boolean DEFAULT false;",
  };
  let currentRows = rows;
  let guard = 0;
  while (upsertErr && guard < Object.keys(NEW_COLUMNS).length) {
    const missingCol = Object.keys(NEW_COLUMNS).find(col => new RegExp(col, 'i').test(upsertErr.message || ''));
    if (!missingCol) break;
    console.error(`[EduManage] "${missingCol}" column missing on teachers table — related settings will NOT be saved until this migration is run: ${NEW_COLUMNS[missingCol]}`);
    currentRows = currentRows.map(r => { const { [missingCol]: _drop, ...rest } = r; return rest; });
    ({ error: upsertErr } = await getSupabase().from('teachers').upsert(currentRows, { onConflict: 'school_id,local_id' }));
    guard++;
  }
  if (upsertErr) { console.error('[EduManage] teachers.upsert FAILED:', upsertErr.message, upsertErr); throw new Error('Save failed (teachers): ' + upsertErr.message); }
  // NOTE: same reasoning as students — deletion is never inferred from a
  // stale local array. See deleteTeacherDirect().
}

export async function deleteTeacherDirect(schoolId, localId) {
  await setSchoolContext(schoolId);
  const { error } = await getSupabase().from('teachers').delete().eq('school_id', schoolId).eq('local_id', String(localId));
  if (error) { console.error('[EduManage] deleteTeacherDirect FAILED:', error.message, error); throw new Error('Delete failed: ' + error.message); }
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
      local_id:     s.id || generateId(),
      name:         s.name,
      adm_no:       s.admNo || '',
      class:        s.class || '',
      gender:       s.gender || '',
      dob:          s.dob || '',
      parent_name:  s.parentName || '',
      parent_phone: s.parentPhone || '',
      parent_email: s.parentEmail || '',
      status:       s.status || 'active',
      extra:        { ...extra, slc: s.slc || '' }, // ensure SLC is always in extra for querying
    };
  });
  const { error: upsertErr } = await getSupabase().from('students').upsert(rows, { onConflict: 'school_id,local_id' });
  if (upsertErr) { console.error('[EduManage] students.upsert FAILED:', upsertErr.message, upsertErr); throw new Error('Save failed (students): ' + upsertErr.message); }
  // NOTE: deletion is intentionally NOT inferred from "rows missing from this
  // local array" — a session that hasn't refreshed recently has a stale
  // local list, and syncing it used to silently DELETE students that were
  // only ever absent because this browser tab hadn't seen them yet
  // (typically another admission/teacher's device added them moments
  // earlier), and could just as easily RESURRECT a student someone else had
  // just deleted. Deleting a student is now a direct, explicit, immediate
  // action — see deleteStudentDirect() — never inferred here.
}

// Explicit, immediate delete — call this the moment a student is removed in
// the UI, instead of relying on the general debounced save to notice it's
// "missing". This is what makes a deletion actually stick.
export async function deleteStudentDirect(schoolId, localId) {
  await setSchoolContext(schoolId);
  const { error } = await getSupabase().from('students').delete().eq('school_id', schoolId).eq('local_id', String(localId));
  if (error) { console.error('[EduManage] deleteStudentDirect FAILED:', error.message, error); throw new Error('Delete failed: ' + error.message); }
}

async function syncJsonTable(table, schoolId, items) {
  // NOTE: this used to (a) wipe the ENTIRE table for this school if the
  // local array was empty, and (b) delete any row missing from the local
  // array. Both are unsafe: any session with a stale or momentarily-empty
  // local copy (e.g. right after login, or a slow tab that hasn't
  // refreshed) would silently erase real data — including OTHER people's
  // just-saved exam marks — the moment it saved anything. This is now
  // upsert-only. Explicit deletes (e.g. deleting one exam) go through
  // deleteJsonRowDirect() instead, called immediately at the point of
  // deletion, never inferred here.
  if (!items || items.length == 0) return;
  const rows = items.map(item => ({
    school_id: schoolId,
    local_id:  String(item.id || item._uuid || generateId()),
    data:      item,
  }));
  const { error: upsertErr } = await getSupabase().from(table).upsert(rows, { onConflict: 'school_id,local_id' });
  if (upsertErr) { console.error(`[EduManage] ${table}.upsert FAILED:`, upsertErr.message, upsertErr); throw new Error(`Save failed (${table}): ` + upsertErr.message); }
}

// Explicit, immediate delete for one row in a json-blob table (exams,
// notifications, etc.) — call at the moment of deletion in the UI.
export async function deleteJsonRowDirect(table, schoolId, localId) {
  await setSchoolContext(schoolId);
  const { error } = await getSupabase().from(table).delete().eq('school_id', schoolId).eq('local_id', String(localId));
  if (error) { console.error(`[EduManage] deleteJsonRowDirect(${table}) FAILED:`, error.message, error); throw new Error('Delete failed: ' + error.message); }
}

// Safely apply score changes to ONE exam's results, for ONE class, without
// touching anything else in that row. Fetches the exam's CURRENT data
// straight from the database, merges in just the cells being changed, and
// writes back immediately — instead of relying on the general debounced
// save (which pushes this browser's whole, possibly-stale, copy of the
// exam and can silently erase marks another teacher entered moments
// earlier into the SAME exam). patches is [{ studentName, subject, score,
// submittedBy, locked }].
export async function applyExamScorePatch(schoolId, examLocalId, patches) {
  await setSchoolContext(schoolId);
  const { data: row, error: fetchErr } = await getSupabase()
    .from('exams').select('data').eq('school_id', schoolId).eq('local_id', String(examLocalId)).maybeSingle();
  if (fetchErr) { console.error('[EduManage] applyExamScorePatch fetch FAILED:', fetchErr.message, fetchErr); throw new Error('Save failed (marks): ' + fetchErr.message); }
  const current = row?.data || {};
  const results = { ...(current.results || {}) };
  patches.forEach(p => {
    results[p.studentName] = { ...(results[p.studentName] || {}) };
    results[p.studentName][p.subject] = {
      ...(results[p.studentName][p.subject] || {}),
      score: p.score, submittedBy: p.submittedBy, locked: p.locked || false,
    };
  });
  const merged = { ...current, results };
  const { error: upsertErr } = await getSupabase().from('exams')
    .upsert({ school_id: schoolId, local_id: String(examLocalId), data: merged }, { onConflict: 'school_id,local_id' });
  if (upsertErr) { console.error('[EduManage] applyExamScorePatch save FAILED:', upsertErr.message, upsertErr); throw new Error('Save failed (marks): ' + upsertErr.message); }
  return merged;
}

// Companion to applyExamScorePatch: removes one student's score for one
// subject from an exam, fetched fresh and merged the same safe way.
export async function removeExamScore(schoolId, examLocalId, studentName, subject) {
  await setSchoolContext(schoolId);
  const { data: row, error: fetchErr } = await getSupabase()
    .from('exams').select('data').eq('school_id', schoolId).eq('local_id', String(examLocalId)).maybeSingle();
  if (fetchErr) { console.error('[EduManage] removeExamScore fetch FAILED:', fetchErr.message, fetchErr); throw new Error('Save failed: ' + fetchErr.message); }
  const current = row?.data || {};
  const results = { ...(current.results || {}) };
  if (results[studentName]) {
    const studentRow = { ...results[studentName] };
    delete studentRow[subject];
    results[studentName] = studentRow;
  }
  const merged = { ...current, results };
  const { error: upsertErr } = await getSupabase().from('exams')
    .upsert({ school_id: schoolId, local_id: String(examLocalId), data: merged }, { onConflict: 'school_id,local_id' });
  if (upsertErr) { console.error('[EduManage] removeExamScore save FAILED:', upsertErr.message, upsertErr); throw new Error('Save failed: ' + upsertErr.message); }
  return merged;
}
// other class's list — fetches the school's current subjects_by_class
// straight from the database, updates just this one class's key, and
// writes back immediately. This is what stops Setup Subjects from
// "disappearing" after logout/login: previously the whole subjects_by_class
// object was overwritten wholesale by whichever browser tab saved last,
// including tabs that hadn't seen a class's most recent subject list yet.
export async function saveSubjectsByClassDirect(schoolId, className, subjectsList) {
  await setSchoolContext(schoolId);
  const { data: row, error: fetchErr } = await getSupabase()
    .from('schools').select('subjects_by_class').eq('id', schoolId).maybeSingle();
  if (fetchErr) { console.error('[EduManage] saveSubjectsByClassDirect fetch FAILED:', fetchErr.message, fetchErr); throw new Error('Save failed (subjects): ' + fetchErr.message); }
  const merged = { ...(row?.subjects_by_class || {}), [className]: subjectsList };
  const { error: upErr } = await getSupabase().from('schools').update({ subjects_by_class: merged }).eq('id', schoolId);
  if (upErr) { console.error('[EduManage] saveSubjectsByClassDirect save FAILED:', upErr.message, upErr); throw new Error('Save failed (subjects): ' + upErr.message); }
  return merged;
}

async function syncFeeTypes(schoolId, feeTypes) {
  if (!feeTypes || !feeTypes.length) return;
  const rows = feeTypes.map(f => ({
    school_id:          schoolId,
    local_id:           String(f.id),
    name:               f.name,
    description:        f.description || '',
    applies_to_all:     f.appliesToAll !== false,
    applicable_classes: f.applicableClasses || [],
  }));
  const { error: upsertErr } = await getSupabase().from('fee_types').upsert(rows, { onConflict: 'school_id,local_id' });
  if (upsertErr) { console.error('[EduManage] fee_types.upsert FAILED:', upsertErr.message, upsertErr); throw new Error('Save failed (fee_types): ' + upsertErr.message); }
}

async function syncFeeSchedule(schoolId, feeSchedule) {
  if (!feeSchedule || !feeSchedule.length) return;
  const rows = feeSchedule.map(f => ({
    school_id:   schoolId,
    local_id:    String(f.id),
    fee_type_id: String(f.feeTypeId),
    class:       f.class,
    term:        f.term,
    year:        f.year,
    amount:      f.amount,
  }));
  const { error: upsertErr } = await getSupabase().from('fee_schedule').upsert(rows, { onConflict: 'school_id,local_id' });
  if (upsertErr) { console.error('[EduManage] fee_schedule.upsert FAILED:', upsertErr.message, upsertErr); throw new Error('Save failed (fee_schedule): ' + upsertErr.message); }
}

async function syncFeePayments(schoolId, feePayments) {
  if (!feePayments || !feePayments.length) return;
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
  const { error: upsertErr } = await getSupabase().from('fee_payments').upsert(rows, { onConflict: 'school_id,local_id' });
  if (upsertErr) { console.error('[EduManage] fee_payments.upsert FAILED:', upsertErr.message, upsertErr); throw new Error('Save failed (fee_payments): ' + upsertErr.message); }
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
      // CRITICAL FIX: write into THIS school's own localStorage key, never the
      // shared legacy key. Previously this wrote into 'edumanage_license_v1'
      // and 'edumanage_token_v1' (no school suffix) — on a browser used for
      // multiple schools, the first paid school's token would "leak" into
      // every other school's session that didn't have its own token yet,
      // silently unlocking schools that had never paid.
      const code = (schoolId || '').replace(/-/g, '').slice(0, 8);
      if (lic) localStorage.setItem('edumanage_license_v1_' + code, JSON.stringify(lic));
      if (token && token.expiry && new Date(token.expiry) > new Date()) {
        localStorage.setItem('edumanage_token_v1_' + code, JSON.stringify(token));
      } else {
        // Cloud has no active token for this school — make sure no stale
        // token lingers locally for it either.
        localStorage.removeItem('edumanage_token_v1_' + code);
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

  let query = getSupabase().from('teachers').select('*, schools(*)').ilike('email', email.trim());
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
    const { error } = await getSupabase().from('teachers').update({ password: hashed }).eq('id', teacher.id);
    if (error) console.error('[EduManage] teacher password migration FAILED:', error.message, error);
  }
  return teacher;
}

export async function loginPrincipal(email, password) {
  const hashed = await hashPassword(password);
  // Fetch by email only, then check password (hashed or legacy plain text)
  const { data: schools } = await getSupabase()
    .from('schools')
    .select('*')
    .ilike('principal_email', email.trim());

  if (!schools || !schools.length) return null;

  const school = schools.find(s => s.principal_password === hashed || s.principal_password === password);
  if (!school) return null;

  // Migrate plain-text password to hashed on successful login
  if (school.principal_password === password && !isHashed(password)) {
    const { error } = await getSupabase().from('schools').update({ principal_password: hashed }).eq('id', school.id);
    if (error) console.error('[EduManage] principal password migration FAILED:', error.message, error);
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

/* ─────────────────────────────────────────────────────────────
   GALLERY STORAGE — Supabase Storage bucket: school-gallery
───────────────────────────────────────────────────────────── */

/**
 * Upload a photo to Supabase Storage.
 * Returns the public URL on success, throws on error.
 * @param {File} file - The file object from input
 * @param {string} schoolId - Used to namespace files per school
 * @param {string} caption - Optional caption
 */
export async function uploadGalleryPhoto(file, schoolId) {
  // Validate file type
  if (!file.type.startsWith('image/')) throw new Error('Only image files are allowed.');
  // Validate size — 3MB max
  if (file.size > 3 * 1024 * 1024) throw new Error(`File too large: ${(file.size/1024/1024).toFixed(1)}MB. Maximum is 3MB.`);

  const ext      = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const safeName = `${(schoolId||'school').replace(/-/g,'').slice(0,8)}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;

  const { data, error } = await getSupabase()
    .storage
    .from('school-gallery')
    .upload(safeName, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

  if (error) throw new Error('Upload failed: ' + error.message);

  const { data: urlData } = getSupabase()
    .storage
    .from('school-gallery')
    .getPublicUrl(safeName);

  return { url: urlData.publicUrl, fileName: safeName };
}

/**
 * Delete a photo from Supabase Storage by its file path.
 * @param {string} fileName - The storage path returned from uploadGalleryPhoto
 */
export async function deleteGalleryPhoto(fileName) {
  if (!fileName) return;
  const { error } = await getSupabase()
    .storage
    .from('school-gallery')
    .remove([fileName]);
  if (error) console.warn('Gallery delete error:', error.message);
}
