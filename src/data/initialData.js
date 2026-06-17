export const GRADES_CBC = [
  { label: 'EE1', points: 8, color: '#10b981', scoreMin: 75, scoreMax: 100 },
  { label: 'EE2', points: 7, color: '#34d399', scoreMin: 65, scoreMax: 74  },
  { label: 'ME1', points: 6, color: '#4f8ef7', scoreMin: 55, scoreMax: 64  },
  { label: 'ME2', points: 5, color: '#7c3aed', scoreMin: 45, scoreMax: 54  },
  { label: 'AE1', points: 4, color: '#f59e0b', scoreMin: 35, scoreMax: 44  },
  { label: 'AE2', points: 3, color: '#f97316', scoreMin: 25, scoreMax: 34  },
  { label: 'BE1', points: 2, color: '#ef4444', scoreMin: 10, scoreMax: 24  },
  { label: 'BE2', points: 1, color: '#dc2626', scoreMin: 0,  scoreMax: 9   },
];

export function getGrade(score, data) {
  const grades = data?.gradesConfig || GRADES_CBC;
  for (const g of grades) {
    if (score >= g.scoreMin && score <= g.scoreMax) return g;
  }
  return grades[grades.length - 1];
}

export const CURRICULUM_LEVELS = {
  PRE_PRIMARY: {
    label: 'Pre-Primary',
    classes: ['PP1', 'PP2', 'Pre-Primary 1', 'Pre-Primary 2', 'Nursery', 'Baby Class', 'Playgroup', 'KG1', 'KG2', 'ECD1', 'ECD2'],
    subjects: [
      'Language Activities',
      'Mathematical Activities',
      'Environmental Activities',
      'Psychomotor & Creative Activities',
      'Religious Education Activities',
    ],
  },
  LOWER_PRIMARY: {
    label: 'Lower Primary (Grades 1–3)',
    classes: ['Grade 1', 'Grade 2', 'Grade 3'],
    subjects: [
      'English',
      'Kiswahili',
      'Mathematics',
      'Literacy',
      'Hygiene and Nutrition',
      'Creative Arts',
      'Environmental Activities',
      'Religious Education',
    ],
  },
  UPPER_PRIMARY: {
    label: 'Upper Primary (Grades 4–6)',
    classes: ['Grade 4', 'Grade 5', 'Grade 6'],
    subjects: [
      'English',
      'Kiswahili',
      'Mathematics',
      'Science & Agriculture',
      'Social Studies',
      'CRE',
    ],
  },
  JUNIOR_SECONDARY: {
    label: 'Junior Secondary (Grades 7–9)',
    classes: ['Grade 7', 'Grade 8', 'Grade 9'],
    subjects: [
      'English',
      'Kiswahili',
      'Mathematics',
      'Integrated Science',
      'Agriculture',
      'Pre-Technical Studies',
      'Social Studies',
      'CRE',
    ],
  },
  SENIOR_SECONDARY: {
    label: 'Senior Secondary (Form 1–4)',
    classes: ['Form 1', 'Form 2', 'Form 3', 'Form 4'],
    subjects: [
      'English',
      'Kiswahili',
      'Mathematics',
      'Biology',
      'Chemistry',
      'Physics',
      'History',
      'Geography',
      'CRE',
      'IRE',
      'Business Studies',
      'Computer Studies',
      'Agriculture',
      'Home Science',
      'Art & Design',
      'Music',
      'French',
      'German',
      'Arabic',
    ],
  },
};

export function getCurriculumLevel(className) {
  if (!className) return null;
  const name = className.trim().toLowerCase();
  // Extra aliases for Pre-Primary
  if (name.startsWith('pp') || name.startsWith('pre-primary') || name.startsWith('pre primary') || name.startsWith('preprimary') || name.startsWith('nursery') || name.startsWith('baby') || name.startsWith('playgroup') || name.startsWith('ecd') || name.startsWith('kg')) {
    return { key: 'PRE_PRIMARY', ...CURRICULUM_LEVELS.PRE_PRIMARY };
  }
  for (const [key, level] of Object.entries(CURRICULUM_LEVELS)) {
    if (level.classes.some(c => name.startsWith(c.toLowerCase()))) return { key, ...level };
  }
  return null;
}

export function getSubjectsForClass(className, data) {
  const custom = (data.subjectsByClass || {})[className];
  if (custom && custom.length > 0) return custom;
  const level = getCurriculumLevel(className);
  if (level) {
    const coreSubs = (data.subjectOverridesByLevel || {})[level.key] || level.subjects;
    const extras   = (data.extraSubjectsByLevel    || {})[level.key] || [];
    return [...coreSubs, ...extras];
  }
  const schoolSubs = (data.subjects || []).map(s => typeof s === 'string' ? s : (s.name || s.code || ''));
  return schoolSubs.filter(Boolean);
}

export function getAllSubjectsForSchool(data) {
  const classes = getAllClasses(data);
  const all = new Set();
  classes.forEach(cls => getSubjectsForClass(cls, data).forEach(s => all.add(s)));
  (data.subjects || []).forEach(s => { const n = typeof s === 'string' ? s : (s.name||s.code||''); if(n) all.add(n); });
  return [...all].sort();
}

/* ── SLC Generator ─────────────────────────────────────────────
   Student Login Code: YYYY-XXXX (year + 4 random digits)
   Unique per school. Used for student & parent login.
──────────────────────────────────────────────────────────────── */
export function generateSLC(students = []) {
  const year = new Date().getFullYear();
  const existing = new Set((students || []).map(s => s.slc).filter(Boolean));
  let code;
  do {
    const rand = Math.floor(1000 + Math.random() * 9000);
    code = `${year}-${rand}`;
  } while (existing.has(code));
  return code;
}

/* ── Admission number auto-generator ──────────────────────────
   Format: KPS/001/2019 — schoolCode/sequence/year
──────────────────────────────────────────────────────────────── */
export function generateAdmNo(data, students = []) {
  const code = (data.schoolCode || 'SCH').toUpperCase();
  const year  = data.schoolCodeYear || new Date().getFullYear();
  const existing = (students || [])
    .map(s => s.admNo || '')
    .filter(a => a.startsWith(`${code}/`))
    .map(a => parseInt(a.split('/')[1]) || 0);
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return `${code}/${String(next).padStart(3, '0')}/${year}`;
}

/* ── School slug generator ─────────────────────────────────── */
export function generateSlug(schoolName) {
  return (schoolName || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 60);
}

/* ── Generate a one-time, permanent stamp seed code for a school ──
   Format: 3 letters from the school name + 5 random base36 chars,
   e.g. "KAM-7Q2F9". Called once when the school is first set up;
   stored in schoolStamp.seedCode and never regenerated, so the
   resulting seal pattern is permanently tied to this one school. ── */
export function generateStampSeedCode(schoolName) {
  const letters = (schoolName || 'SCH').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3).padEnd(3, 'X');
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${letters}-${rand}`;
}

/* ── Deterministic hash from a seed code — used to derive the seal's
   inner pattern (ring count, notch positions, micro-pattern) so the
   same seed always draws the exact same unique pattern. ── */
export function stampHash(seedCode) {
  let h = 0;
  const str = seedCode || 'DEFAULT';
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}


export function buildStudentName(firstName, lastName, otherName) {
  return [firstName, otherName, lastName].filter(Boolean).join(' ').trim();
}

export const INITIAL_DATA = {
  schoolName:        '',
  schoolMotto:       '',
  schoolPOBox:       '',
  schoolLocation:    '',
  schoolCounty:      '',
  schoolType:        'Primary',
  principalName:     '',
  principalEmail:    'principal@school.ac.ke',
  principalPassword: 'admin123',

  // Official digital stamp/seal — appears on report forms, fee receipts, certificates.
  // Always reads live from this same config; the date shown inside it is computed
  // fresh every time it's rendered (today's real date), it is never stored.
  schoolStamp: {
    enabled:     true,
    primaryColor:'#0d3fa8',
    accentColor: '#cc0000',
    text:        '',          // defaults to schoolName if blank
    subtext:     '',          // defaults to P.O. Box + location if blank
  },

  // Public page
  schoolSlug:        '',   // e.g. 'kiriene-day-primary' — set on setup, editable once
  slugLocked:        false, // once school is live, slug should not change
  schoolAbout:       '',
  schoolVision:      '',
  schoolMission:     '',
  schoolPhone:       '',
  schoolEmail:       '',
  schoolWebsite:     '',
  schoolGallery:     [],   // max 20 items: { url, caption }
  jobVacancies:      [],   // { id, title, description, deadline, active }
  onlineApplications:[], // student applications from public page
  customDocReqs:     [],   // admin-defined extra required documents for enrollment

  // Admission settings
  admissionSetting:  'manual', // 'manual' | 'auto' | 'mixed'
  schoolCode:        '',       // e.g. 'KPS' — used for auto admission format
  schoolCodeYear:    '',       // e.g. '2019'

  // Theme
  darkTheme:         true,     // default dark, can switch to light

  classGroups: [],
  classes:     [],

  subjects:        [],
  subjectsByClass: {},

  departments: ['Academics','Management','Kitchen','Sports','Library','Finance','Counselling','Security'],

  teachers: [
    {
      id: 1, name: 'Administrator', email: 'principal@school.ac.ke', phone: '',
      staffId: 'T000', dept: 'Management', staffType: 'non_teaching',
      isClassTeacher: false, classTeacherOf: null,
      subjects: [], canSeeKitchenAlerts: true, canSeeFees: true, admin: true,
      password: 'admin123', status: 'active',
    },
  ],

  students:          [],
  parents:           [],
  exams:             [],
  editRequests:      [],
  notifications:     [],
  messages:          [],
  inventory:         [],
  feeTypes:          [],
  feeSchedule:       [],
  feePayments:       [],
  rollCalls:         [],
  permissions:       [],
  statusAlerts:      [],
  promotionHistory:  [],
  terms:             [],
  currentTerm:       null,
  currentYear:       null,
  parentMessages:    [],
  smsConfig: { provider: 'manual', apiKey: '', senderId: '', username: '' },
  gradesConfig:      GRADES_CBC,
  licenseData:       {},

  bells: [
    { id: 1,  time: '07:30', label: 'Morning Assembly', type: 'assembly', duration: 30 },
    { id: 2,  time: '08:00', label: 'Lesson 1',         type: 'lesson',   duration: 40 },
    { id: 3,  time: '08:40', label: 'Lesson 2',         type: 'lesson',   duration: 40 },
    { id: 4,  time: '09:20', label: 'Lesson 3',         type: 'lesson',   duration: 40 },
    { id: 5,  time: '10:00', label: 'Break Time',       type: 'break',    duration: 20 },
    { id: 6,  time: '10:20', label: 'Lesson 4',         type: 'lesson',   duration: 40 },
    { id: 7,  time: '11:00', label: 'Lesson 5',         type: 'lesson',   duration: 40 },
    { id: 8,  time: '11:40', label: 'Lesson 6',         type: 'lesson',   duration: 40 },
    { id: 9,  time: '12:20', label: 'Lunch Break',      type: 'lunch',    duration: 40 },
    { id: 10, time: '13:00', label: 'Lesson 7',         type: 'lesson',   duration: 40 },
    { id: 11, time: '13:40', label: 'Lesson 8',         type: 'lesson',   duration: 40 },
    { id: 12, time: '14:20', label: 'End of Day',       type: 'end',      duration: 0  },
  ],

  timetable:               {},
  timetableRules:          [],
  extraSubjectsByLevel:    {},
  subjectOverridesByLevel: {},
};

export function getAllClasses(data) {
  const list = [];
  (data.classGroups || []).forEach(g => {
    if (!g.streams || g.streams.length === 0) list.push(g.name);
    else g.streams.forEach(s => list.push(`${g.name} ${s}`));
  });
  return list;
}

export function getStreamFromClass(className, data) {
  if (!className) return null;
  for (const g of (data.classGroups || [])) {
    if (g.streams && g.streams.length > 0) {
      for (const s of g.streams) { if (className === `${g.name} ${s}`) return s; }
    }
  }
  return null;
}

export function getBaseClass(className, data) {
  if (!className) return className;
  for (const g of (data.classGroups || [])) {
    if (g.streams && g.streams.length > 0) {
      for (const s of g.streams) { if (className === `${g.name} ${s}`) return g.name; }
    }
  }
  return className;
}

export function getSiblingStreams(className, data) {
  if (!className) return [className];
  for (const g of (data.classGroups || [])) {
    if (!g.streams || g.streams.length === 0) { if (g.name === className) return [className]; }
    else {
      for (const s of g.streams) {
        if (className === `${g.name} ${s}`) return g.streams.map(st => `${g.name} ${st}`);
      }
    }
  }
  return [className];
}

export function getScore(cell) {
  if (cell === null || cell === undefined || cell === '') return null;
  if (typeof cell === 'object' && cell !== null) {
    const v = cell.score ?? cell.value;
    return v !== undefined ? Number(v) : null;
  }
  const n = Number(cell);
  return isNaN(n) ? null : n;
}

export function canEnterScores(user, subject, className, data) {
  if (!user) return false;
  if (user.role === 'principal' || user.admin) return true;
  const teacher = (data.teachers || []).find(t => t.staffId === user.staffId);
  if (!teacher) return false;
  if (teacher.isClassTeacher && teacher.classTeacherOf === className) return true;
  return (teacher.subjects || []).some(s => s.subject === subject && (s.classes || []).includes(className));
}

export function getTeacherSubjects(staffId, data) {
  const teacher = (data.teachers || []).find(t => t.staffId === staffId);
  return teacher?.subjects || [];
}

export function getClassTeacherStaffId(className, data) {
  const t = (data.teachers || []).find(t => t.isClassTeacher && t.classTeacherOf === className);
  return t?.staffId || null;
}

export function isTeachingStaff(teacher) {
  return teacher?.staffType === 'teaching' || (!teacher?.staffType && teacher?.subjects?.length > 0);
}

export function canSeeKitchenAlerts(teacher) {
  return teacher?.canSeeKitchenAlerts || teacher?.admin || false;
}

export function canSeeFees(teacher) {
  return teacher?.canSeeFees || teacher?.admin || false;
}
