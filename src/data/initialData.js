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
    classes: ['PP1', 'PP2'],
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
      'Literacy Activities',
      'Kiswahili Language Activities',
      'English Language Activities',
      'Mathematical Activities',
      'Environmental Activities',
      'Creative Arts',
      'Religious Education',
      'Physical & Health Education',
    ],
  },
  UPPER_PRIMARY: {
    label: 'Upper Primary (Grades 4–6)',
    classes: ['Grade 4', 'Grade 5', 'Grade 6'],
    subjects: [
      'English',
      'Kiswahili',
      'Mathematics',
      'Science & Technology',
      'Social Studies',
      'CRE',
      'IRE',
      'HRE',
      'Creative Arts & Sports',
      'Agriculture',
      'Home Science',
      'Business Studies',
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
      'Pre-Technical Studies',
      'Social Studies',
      'Creative Arts',
      'CRE',
      'Agriculture',
      'Business Studies',
      'Home Science',
      'Computer Science',
      'Physical Education',
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
  for (const [key, level] of Object.entries(CURRICULUM_LEVELS)) {
    if (level.classes.some(c => name.startsWith(c.toLowerCase()))) {
      return { key, ...level };
    }
  }
  return null;
}

export function getSubjectsForClass(className, data) {
  // 1. Check if school has custom subjects per class (set via "Setup Subjects" in Exams)
  const custom = (data.subjectsByClass || {})[className];
  if (custom && custom.length > 0) return custom;

  // 2. Use school overrides if set, else fall back to CBC defaults. Then add extras.
  const level = getCurriculumLevel(className);
  if (level) {
    const coreSubs = (data.subjectOverridesByLevel || {})[level.key] || level.subjects;
    const extras   = (data.extraSubjectsByLevel    || {})[level.key] || [];
    return [...coreSubs, ...extras];
  }

  // 3. Fall back to school-wide subjects (legacy)
  const schoolSubs = (data.subjects || []).map(s => typeof s === 'string' ? s : (s.name || s.code || ''));
  return schoolSubs.filter(Boolean);
}

export function getAllSubjectsForSchool(data) {
  const classes = getAllClasses(data);
  const all = new Set();
  classes.forEach(cls => getSubjectsForClass(cls, data).forEach(s => all.add(s)));
  (data.subjects || []).forEach(s => {
    const name = typeof s === 'string' ? s : (s.name || s.code || '');
    if (name) all.add(name);
  });
  return [...all].sort();
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

  classGroups: [],
  classes:     [],

  subjects:       [],
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

  students:        [],
  parents:         [],
  exams:           [],
  editRequests:    [],
  notifications:   [],
  messages:        [],
  inventory:       [],
  feeTypes:        [],
  feeSchedule:     [],
  feePayments:     [],
  rollCalls:       [],
  permissions:     [],
  statusAlerts:    [],
  promotionHistory:[],
  terms:           [],
  currentTerm:     null,
  currentYear:     null,
  parentMessages:  [],
  smsConfig: { provider: 'manual', apiKey: '', senderId: '', username: '' },
  gradesConfig:    GRADES_CBC,
  licenseData:     {},

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
      for (const s of g.streams) {
        if (className === `${g.name} ${s}`) return s;
      }
    }
  }
  return null;
}

export function getBaseClass(className, data) {
  if (!className) return className;
  for (const g of (data.classGroups || [])) {
    if (g.streams && g.streams.length > 0) {
      for (const s of g.streams) {
        if (className === `${g.name} ${s}`) return g.name;
      }
    }
  }
  return className;
}

export function getSiblingStreams(className, data) {
  if (!className) return [className];
  for (const g of (data.classGroups || [])) {
    if (!g.streams || g.streams.length === 0) {
      if (g.name === className) return [className];
    } else {
      for (const s of g.streams) {
        if (className === `${g.name} ${s}`) {
          return g.streams.map(st => `${g.name} ${st}`);
        }
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
