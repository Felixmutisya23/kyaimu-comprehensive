export const GRADES_CBC = [
  { label: 'EE1', points: 8, color: '#10b981', scoreMin: 68, scoreMax: 72 },
  { label: 'EE2', points: 7, color: '#34d399', scoreMin: 60, scoreMax: 67 },
  { label: 'ME1', points: 6, color: '#4f8ef7', scoreMin: 52, scoreMax: 59 },
  { label: 'ME2', points: 5, color: '#7c3aed', scoreMin: 43, scoreMax: 51 },
  { label: 'AE1', points: 4, color: '#f59e0b', scoreMin: 34, scoreMax: 42 },
  { label: 'AE2', points: 3, color: '#f97316', scoreMin: 25, scoreMax: 33 },
  { label: 'BE1', points: 2, color: '#ef4444', scoreMin: 16, scoreMax: 24 },
  { label: 'BE2', points: 1, color: '#dc2626', scoreMin: 9,  scoreMax: 15 },
];

export function getGrade(score) {
  if (score >= 68) return GRADES_CBC[0];
  if (score >= 60) return GRADES_CBC[1];
  if (score >= 52) return GRADES_CBC[2];
  if (score >= 43) return GRADES_CBC[3];
  if (score >= 34) return GRADES_CBC[4];
  if (score >= 25) return GRADES_CBC[5];
  if (score >= 16) return GRADES_CBC[6];
  return GRADES_CBC[7];
}

export const INITIAL_DATA = {
  // ── School identity — ALL BLANK by default, principal fills in Settings ──
  schoolName:        '',   // e.g. "Kiriene Day Primary School"
  schoolMotto:       '',   // e.g. "Strive To Excel"
  schoolPOBox:       '',   // e.g. "P.O. Box 159-60607"
  schoolLocation:    '',   // e.g. "Mikinduri"
  schoolCounty:      '',   // e.g. "Tharaka Nithi"
  schoolType:        'Primary',
  principalName:     '',
  principalEmail:    'principal@school.ac.ke',
  principalPassword: 'admin123',

  // ── Classes & Streams — blank by default, principal adds in Settings ──
  classGroups: [],

  get classes() {
    const list = [];
    this.classGroups.forEach(g => {
      if (!g.streams || g.streams.length === 0) { list.push(g.name); }
      else { g.streams.forEach(s => list.push(`${g.name} ${s}`)); }
    });
    return list;
  },

  subjects: [],
  departments: ['Academics', 'Management', 'Kitchen', 'Sports', 'Library', 'Finance', 'Counselling', 'Security'],

  // Only the admin account — all others added by principal
  teachers: [
    {
      id: 1, name: 'Administrator', email: 'principal@school.ac.ke', phone: '',
      staffId: 'T000', dept: 'Management', staffType: 'non_teaching',
      isClassTeacher: false, classTeacherOf: null,
      subjects: [], canSeeKitchenAlerts: true, canSeeFees: true, admin: true,
      password: 'admin123',
    },
  ],

  students:      [],
  exams:         [],
  editRequests:  [],
  notifications: [],
  messages:      [],

  inventory: [],

  // ── Fee structure — principal defines fee types and amounts per class/term ──
  // feeTypes: [{ id, name, description, appliesToAll, applicableClasses[] }]
  // feeSchedule: [{ id, feeTypeId, class, term, amount, year }]
  feeTypes: [],
  feeSchedule: [],
  feePayments:  [],
  rollCalls:    [],      // [{id, class, term, year, date, takenBy, results:{studentId:true/false}}]
  permissions:  [],      // [{id, studentId, studentName, reason, dateGiven, dateReturn, approvedBy, returned, returnDate}]
  statusAlerts: [],      // [{id, type, studentId, message, date, resolved}]

  // ── Term calendar ──
  terms: [],             // [{id, year, term, startDate, endDate, name, opened, closed}]
  currentTerm: null,     // set when admin opens a term
  currentYear: null,

  // ── Parent messaging ──
  parentMessages: [],    // [{id, date, type, message, class, recipientCount, sentBy, delivered}]
  smsConfig: {
    provider: 'manual',
    apiKey: '',
    senderId: '',
    username: '',
  },

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

  timetable: {},
};

/* ── Helpers ─────────────────────────────────────────── */

/** Get all flat class names from classGroups */
export function getAllClasses(data) {
  const list = [];
  (data.classGroups || []).forEach(g => {
    if (!g.streams || g.streams.length === 0) list.push(g.name);
    else g.streams.forEach(s => list.push(`${g.name} ${s}`));
  });
  return list;
}

/** Extract stream from a full class name e.g. 'Grade 8 East' → 'East' */
export function getStreamFromClass(className, data) {
  for (const g of (data.classGroups || [])) {
    if (g.streams && g.streams.length > 0) {
      for (const s of g.streams) {
        if (className === `${g.name} ${s}`) return s;
      }
    }
  }
  return null;
}

/** Get the base class name without stream, e.g. 'Grade 8 East' → 'Grade 8' */
export function getBaseClass(className, data) {
  for (const g of (data.classGroups || [])) {
    if (g.streams && g.streams.length > 0) {
      for (const s of g.streams) {
        if (className === `${g.name} ${s}`) return g.name;
      }
    }
    if (className === g.name) return g.name;
  }
  return className;
}

/** Get all stream classes for the same base class e.g. all 'Grade 8 *' */
export function getSiblingStreams(className, data) {
  const base = getBaseClass(className, data);
  const g = (data.classGroups || []).find(x => x.name === base);
  if (!g || !g.streams || g.streams.length === 0) return [className];
  return g.streams.map(s => `${g.name} ${s}`);
}

export function canSeeKitchenAlerts(user, data) {
  if (user.role === 'principal') return true;
  const staff = data.teachers.find(t => t.staffId === user.staffId);
  return staff ? !!staff.canSeeKitchenAlerts : false;
}

export function canSeeFees(user, data) {
  if (user.role === 'principal') return true;
  const staff = data.teachers.find(t => t.staffId === user.staffId);
  return staff ? !!staff.canSeeFees : false;
}

export function getClassTeacherOf(user, data) {
  if (user.role === 'principal') return null;
  const staff = data.teachers.find(t => t.staffId === user.staffId);
  return staff?.classTeacherOf || null;
}

export function getTeacherSubjects(user, data) {
  const staff = data.teachers.find(t => t.staffId === user.staffId);
  return staff?.subjects || [];
}

export function canEnterScores(user, subject, className, data) {
  if (user.role === 'principal') return true;
  const subs = getTeacherSubjects(user, data);
  return subs.some(s => s.subject === subject && s.classes.includes(className));
}

export function getClassTeacherStaffId(className, data) {
  const ct = data.teachers.find(t => t.classTeacherOf === className);
  return ct?.staffId || null;
}

export function isTeachingStaff(user, data) {
  if (user.role === 'principal') return true;
  const staff = data.teachers.find(t => t.staffId === user.staffId);
  return staff?.staffType === 'teaching';
}

/** Compute score from result cell (handles {score,submittedBy} or plain number) */
export function getScore(cell) {
  if (cell === null || cell === undefined) return null;
  if (typeof cell === 'object') return cell.score ?? null;
  return cell;
}

/* ═══════════════════════════════════════════════════════
   ADDITIONAL DATA HELPERS
═══════════════════════════════════════════════════════ */

/** Get all students enrolled (not withdrawn/expelled) */
export function getActiveStudents(data) {
  return (data.students || []).filter(s => !s.status || s.status === 'active');
}

/** Get all withdrawn/expelled students */
export function getInactiveStudents(data) {
  return (data.students || []).filter(s => s.status && s.status !== 'active');
}

/** Compute fee summary for a student across all fee types */
export function getStudentFeeSummary(studentId, feeTypeId, data) {
  const payments = (data.feePayments || []).filter(p =>
    p.studentId === studentId &&
    (feeTypeId ? p.feeTypeId === feeTypeId : true)
  );
  return {
    totalPaid: payments.reduce((s, p) => s + p.amount, 0),
    payments,
  };
}

/** Get expected fee for a student for a given feeType / class / term / year */
export function getExpectedFee(studentClass, feeTypeId, term, year, data) {
  const schedule = (data.feeSchedule || []).find(s =>
    s.feeTypeId === feeTypeId &&
    (s.class === studentClass || s.class === 'ALL') &&
    s.term === Number(term) &&
    s.year === Number(year)
  );
  return schedule ? Number(schedule.amount) : 0;
}

/** All fee types defined in the system */
export function getFeeTypes(data) {
  return data.feeTypes || [];
}
