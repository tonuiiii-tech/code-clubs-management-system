/**
 * Fictional demo data, used by demo mode (client mock API) and `npm run seed` (D1-22, R1-12).
 * People, schools and organisations are invented. Counties, sub-counties and wards are real places;
 * GPS points are approximate. Phone numbers use the fake +254700000xxx range and emails the
 * reserved .test domain, so nothing here can reach a real person.
 */

/** Deterministic UUIDs so tests and links stay stable. */
export const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const DEMO_PASSWORD = 'demo-password-2026';

const created = '2026-10-01T08:00:00.000Z';
const stamp = { createdAt: created, updatedAt: created, createdBy: uid(1), updatedBy: uid(1) };
const phone = (n) => `+254700000${String(n).padStart(3, '0')}`;

const person = (n, fullName, role, extra = {}) => ({
  id: uid(n),
  fullName,
  email: `${fullName.toLowerCase().replace(/[^a-z]+/g, '.')}@demo.steamlabs.test`,
  phone: phone(n),
  role,
  status: 'active',
  regions: [],
  permissionGrants: [],
  preferredLanguage: 'en',
  ...stamp,
  ...extra,
});

const champion = (n, fullName, type, safeguarding, skills) =>
  person(n, fullName, 'champion', {
    championProfile: { type, skills, safeguarding },
  });

export function createSeedData() {
  const users = [
    person(1, 'Wanjiru Kamau', 'system_admin'),
    person(2, 'Otieno Ouma', 'programme_manager'),
    person(3, 'Mwende Mutua', 'coordinator', { regions: ['nairobi_central'] }),
    person(4, 'Achieng Odhiambo', 'coordinator', { regions: ['western_nyanza'] }),
    person(5, 'Hassan Mwinyi', 'coordinator', { regions: ['coast'] }),
    person(6, 'Kiprop Chebet', 'coordinator', { regions: ['rift_valley'] }),
    champion(11, 'Faith Njeri', 'teacher', { status: 'cleared', date: '2026-02-14' }, [
      'scratch',
      'unplugged',
    ]),
    champion(12, 'Brian Kiptoo', 'volunteer', { status: 'pending' }, ['robotics', 'micro:bit']),
    champion(13, 'Amina Salim', 'teacher', { status: 'cleared', date: '2025-11-03' }, ['scratch']),
    champion(14, 'Kevin Omondi', 'staff', { status: 'cleared', date: '2026-01-20' }, [
      'game_design',
      'ai_basics',
    ]),
    champion(15, 'Grace Wambui', 'volunteer', { status: 'expired', date: '2024-09-30' }, [
      'unplugged',
    ]),
    champion(16, 'Joseph Mutiso', 'teacher', { status: 'cleared', date: '2026-03-08' }, [
      'robotics',
      'Arduino',
    ]),
    champion(17, 'Lilian Akinyi', 'volunteer', { status: 'cleared', date: '2026-05-12' }, [
      'scratch',
      'game_design',
    ]),
    champion(18, 'Peter Kariuki', 'teacher', { status: 'pending' }, ['ai_basics']),
  ];

  const school = (n, name, type, region, county, subCounty, ward, lat, lng, contactName) => ({
    id: uid(100 + n),
    name,
    type,
    region,
    county,
    subCounty,
    ward,
    gps: { lat, lng },
    contactName,
    contactPhone: phone(100 + n),
    status: 'active',
    ...stamp,
  });

  const schools = [
    school(
      1,
      'Mwangaza Primary School',
      'primary_school',
      'nairobi_central',
      'Nairobi',
      'Kibra',
      'Laini Saba',
      -1.3133,
      36.7876,
      'Mary Atieno',
    ),
    school(
      2,
      'Kawangware Community Learning Centre',
      'community_centre',
      'nairobi_central',
      'Nairobi',
      'Dagoretti North',
      'Kawangware',
      -1.285,
      36.748,
      'John Mwangi',
    ),
    school(
      3,
      'Thika Reading Library',
      'library',
      'nairobi_central',
      'Kiambu',
      'Thika Town',
      'Township',
      -1.0388,
      37.0834,
      'Esther Wairimu',
    ),
    school(
      4,
      'Nyalenda Hope Primary School',
      'primary_school',
      'western_nyanza',
      'Kisumu',
      'Kisumu Central',
      'Nyalenda B',
      -0.1145,
      34.77,
      'Tom Okoth',
    ),
    school(
      5,
      'Lurambi Youth Library',
      'library',
      'western_nyanza',
      'Kakamega',
      'Lurambi',
      'Shirere',
      -0.2827,
      34.7519,
      'Beatrice Anyango',
    ),
    school(
      6,
      'Majengo Bright Primary School',
      'primary_school',
      'coast',
      'Mombasa',
      'Mvita',
      'Majengo',
      -4.047,
      39.666,
      'Fatuma Ali',
    ),
    school(
      7,
      'Kilifi Bahari Community Centre',
      'community_centre',
      'coast',
      'Kilifi',
      'Kilifi North',
      'Sokoni',
      -3.6305,
      39.8499,
      'Juma Kahindi',
    ),
    school(
      8,
      'Lanet Valley Primary School',
      'primary_school',
      'rift_valley',
      'Nakuru',
      'Nakuru East',
      'Biashara',
      -0.278,
      36.095,
      'Rose Chepkoech',
    ),
    school(
      9,
      'Kapsoya Community Library',
      'library',
      'rift_valley',
      'Uasin Gishu',
      'Ainabkoi',
      'Kapsoya',
      0.5143,
      35.298,
      'Daniel Kibet',
    ),
    school(
      10,
      'Lakeview Youth Centre',
      'community_centre',
      'rift_valley',
      'Nakuru',
      'Naivasha',
      'Lakeview',
      -0.7167,
      36.4333,
      'Susan Nyokabi',
    ),
  ];

  const venueFor = (s) => (s.type === 'other' ? 'community_centre' : s.type);
  const club = (n, code, name, s, meetingDay, startTime, endTime, mainTrack, extra = {}) => ({
    id: uid(200 + n),
    code,
    name,
    schoolId: s.id,
    venueType: venueFor(s),
    region: s.region,
    meetingDay,
    startTime,
    endTime,
    frequency: 'weekly',
    mainTrack,
    capacity: 30,
    status: 'active',
    ...stamp,
    ...extra,
  });
  const [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10] = schools;

  const clubs = [
    club(1, 'NAC-001', 'Mwangaza Scratch Stars', s1, 'tuesday', '15:30', '17:00', 'scratch'),
    club(2, 'NAC-002', 'Kawangware Code Explorers', s2, 'saturday', '10:00', '12:00', 'unplugged'),
    club(3, 'NAC-003', 'Thika Robotics Club', s3, 'saturday', '14:00', '16:00', 'robotics', {
      capacity: 20,
    }),
    club(4, 'WNY-001', 'Nyalenda Young Coders', s4, 'wednesday', '15:30', '17:00', 'scratch'),
    club(5, 'WNY-002', 'Lurambi Game Makers', s5, 'saturday', '09:00', '11:00', 'game_design', {
      status: 'paused',
    }),
    club(6, 'WNY-003', 'Kisumu AI Explorers', s4, 'friday', '15:00', '16:30', 'ai_basics'),
    club(7, 'CST-001', 'Majengo Micro:bit Makers', s6, 'thursday', '15:30', '17:00', 'robotics'),
    club(8, 'CST-002', 'Bahari Coders', s7, 'saturday', '10:00', '12:00', 'scratch', {
      frequency: 'fortnightly',
    }),
    club(9, 'CST-003', 'Kilifi Unplugged', s7, 'monday', '16:00', '17:00', 'unplugged', {
      status: 'closed',
    }),
    club(10, 'RVL-001', 'Lanet Scratch Club', s8, 'tuesday', '15:30', '17:00', 'scratch'),
    club(11, 'RVL-002', 'Kapsoya Game Designers', s9, 'saturday', '11:00', '13:00', 'game_design'),
    club(12, 'RVL-003', 'Naivasha Robotics Lab', s10, 'saturday', '14:00', '16:30', 'robotics', {
      capacity: 25,
    }),
  ];

  const assign = (clubN, userN, role) => ({
    clubId: uid(200 + clubN),
    userId: uid(userN),
    role,
    startDate: '2026-01-12',
    endDate: null,
  });
  const assignments = [
    assign(1, 11, 'lead'),
    assign(2, 11, 'lead'),
    assign(2, 15, 'assistant'),
    assign(3, 12, 'lead'),
    assign(4, 13, 'lead'),
    assign(5, 17, 'lead'),
    assign(6, 14, 'lead'),
    assign(7, 16, 'lead'),
    assign(8, 13, 'assistant'),
    assign(10, 18, 'lead'),
    assign(11, 17, 'assistant'),
    assign(12, 14, 'assistant'),
  ];

  return {
    users,
    schools,
    clubs,
    assignments,
    ...createLearnerData(clubs),
  };
}

/**
 * Sprint 2: fictional learners, guardian contacts, consent, sessions and attendance (R2-1).
 * Session dates are counted back from today, so the 7-day edit window (D2-5) always has one
 * open and one locked session to show.
 */
function createLearnerData(clubs, today = new Date()) {
  const byCode = Object.fromEntries(clubs.map((c) => [c.code, c]));
  const year = today.getFullYear();
  const learner = (n, code, firstName, lastName, age, gender, grade, extra = {}) => {
    const club = byCode[code];
    return {
      id: uid(1000 + n),
      learnerNumber: `${code}-${String(n % 100).padStart(3, '0')}`,
      firstName,
      lastName,
      birthYear: year - age,
      gender,
      grade,
      ...(club.venueType === 'primary_school' && { admissionNumber: `ADM-${4100 + n}` }),
      clubId: club.id,
      schoolId: club.schoolId,
      region: club.region,
      status: 'active',
      joinedAt: '2026-01-20',
      leftAt: null,
      ...stamp,
      ...extra,
    };
  };
  const learners = [
    learner(1, 'NAC-001', 'Zawadi', 'Mwangi', 11, 'girl', 'grade_6'),
    learner(2, 'NAC-001', 'Baraka', 'Otieno', 12, 'boy', 'grade_6'),
    learner(3, 'NAC-001', 'Imani', 'Wekesa', 10, 'girl', 'grade_5'),
    learner(4, 'NAC-001', 'Tumaini', 'Kiplagat', 13, 'boy', 'grade_7'),
    learner(5, 'NAC-001', 'Neema', 'Achieng', 9, 'girl', 'grade_4', {
      accessibilityNeeds: 'Sits near the front to see the screen',
    }),
    learner(6, 'NAC-001', 'Jabari', 'Mutua', 11, 'prefer_not_to_say', 'grade_6', {
      status: 'left',
      leftAt: '2026-09-30',
    }),
    learner(7, 'NAC-002', 'Amani', 'Njoroge', 12, 'girl', 'grade_7'),
    learner(8, 'NAC-002', 'Kamau', 'Gitau', 14, 'boy', 'grade_8'),
    learner(9, 'NAC-002', 'Wairimu', 'Karanja', 10, 'girl', 'grade_5'),
    learner(10, 'WNY-001', 'Akinyi', 'Ouma', 11, 'girl', 'grade_6'),
    learner(11, 'WNY-001', 'Odhiambo', 'Ochieng', 12, 'boy', 'grade_7'),
    learner(12, 'CST-001', 'Mwanaisha', 'Bakari', 13, 'girl', 'grade_8'),
  ];

  const guardians = [
    ['Rehema Mwangi', 'mother'],
    ['Samuel Otieno', 'father'],
    ['Esther Wekesa', 'mother'],
    ['Daniel Kiplagat', 'guardian'],
  ];
  const learnerContacts = guardians.map(([guardianName, relationship], i) => ({
    id: uid(1301 + i),
    learnerId: uid(1001 + i),
    guardianName,
    relationship,
    phone: phone(500 + i),
  }));

  const consent = (n, type, status) => {
    const l = learners[n - 1];
    return {
      id: uid(1400 + n * 2 + (type === 'photo' ? 1 : 0)),
      learnerId: l.id,
      clubId: l.clubId,
      region: l.region,
      type,
      status,
      signedOn: '2026-01-20',
      fileId: null,
      ...stamp,
    };
  };
  // Learner 3 has no photo consent and learner 5 none at all, so the warnings can be seen.
  const consents = [
    consent(1, 'participation', 'given'),
    consent(1, 'photo', 'given'),
    consent(2, 'participation', 'given'),
    consent(2, 'photo', 'given'),
    consent(3, 'participation', 'given'),
    consent(3, 'photo', 'refused'),
    consent(4, 'participation', 'given'),
    consent(4, 'photo', 'given'),
    consent(7, 'participation', 'given'),
    consent(8, 'participation', 'given'),
    consent(10, 'participation', 'given'),
    consent(10, 'photo', 'given'),
  ];

  const daysAgo = (n) => new Date(today.getTime() - n * 86_400_000).toISOString().slice(0, 10);
  const session = (n, code, days, topic, notes) => {
    const club = byCode[code];
    return {
      id: uid(1600 + n),
      clubId: club.id,
      region: club.region,
      date: daysAgo(days),
      status: 'held',
      topic,
      notes,
      startTime: club.startTime,
      endTime: club.endTime,
      photoIds: [],
      reportedBy: uid(11),
      reportedAt: created,
      ...stamp,
    };
  };
  const sessions = [
    session(1, 'NAC-001', 15, 'Scratch: moving sprites', 'Two laptops would not start.'),
    session(2, 'NAC-001', 8, 'Scratch: loops and repeat blocks', 'Everyone finished the maze.'),
    session(3, 'NAC-001', 1, 'Scratch: variables and scores', 'Learners asked for a quiz game.'),
    session(4, 'WNY-001', 6, 'Scratch: drawing with the pen', 'Power cut for 20 minutes.'),
  ];
  const marks = {
    1: { 1: 'present', 2: 'present', 3: 'absent', 4: 'present', 5: 'late' },
    2: { 1: 'present', 2: 'excused', 3: 'present', 4: 'present', 5: 'present' },
    3: { 1: 'present', 2: 'present', 3: 'present', 4: 'absent', 5: 'present' },
    4: { 10: 'present', 11: 'present' },
  };
  const attendance = sessions.flatMap((s, i) =>
    Object.entries(marks[i + 1]).map(([n, status]) => ({
      id: uid(1700 + (i + 1) * 20 + Number(n)),
      sessionId: s.id,
      learnerId: uid(1000 + Number(n)),
      clubId: s.clubId,
      region: s.region,
      date: s.date,
      status,
      ...stamp,
    })),
  );

  return { learners, learnerContacts, consents, sessions, attendance };
}

/** One account per role for the "Sign in as" buttons on the login page (mock mode only). */
export const DEMO_ACCOUNTS = [
  { role: 'system_admin', userNumber: 1 },
  { role: 'programme_manager', userNumber: 2 },
  { role: 'coordinator', userNumber: 3 },
  { role: 'champion', userNumber: 11 },
];
