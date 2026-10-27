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
    // One Code Club per school (D5-11): Kisumu AI Explorers meets here, not at Nyalenda Hope.
    school(
      11,
      'Manyatta Primary School',
      'primary_school',
      'western_nyanza',
      'Kisumu',
      'Kisumu East',
      'Manyatta B',
      -0.0917,
      34.768,
      'Paul Ochieng',
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
  const [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11] = schools;

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
    club(6, 'WNY-003', 'Kisumu AI Explorers', s11, 'friday', '15:00', '16:30', 'ai_basics'),
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
  // One club per champion (D5-9). Peter Kariuki is waiting for a club; Lanet, Bahari Coders,
  // Kapsoya and Naivasha are waiting for a champion.
  const assignments = [
    assign(1, 11, 'lead'),
    assign(2, 15, 'lead'),
    assign(3, 12, 'lead'),
    assign(4, 13, 'lead'),
    assign(5, 17, 'lead'),
    assign(6, 14, 'lead'),
    assign(7, 16, 'lead'),
  ];

  const learnerData = createLearnerData(clubs);
  return {
    users,
    schools,
    clubs,
    assignments,
    ...learnerData,
    ...createEventData(clubs, learnerData.learners),
    ...createProgrammeData(clubs),
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

/**
 * Sprint 4: terms, events and announcements. Dates are counted from today like sessions, so the
 * demo always has a current term, an upcoming event with a consent gap and a past event.
 */
function createEventData(clubs, learners, today = new Date()) {
  const byCode = Object.fromEntries(clubs.map((c) => [c.code, c]));
  const day = (n) => new Date(today.getTime() + n * 86_400_000).toISOString().slice(0, 10);
  const year = today.getFullYear();

  // The current term started eight weeks ago; the two before it are a holiday apart.
  const terms = [
    { number: 1, startDate: day(-56 - 21 - 91 - 21 - 91), endDate: day(-56 - 21 - 91 - 21) },
    { number: 2, startDate: day(-56 - 21 - 91), endDate: day(-56 - 21) },
    { number: 3, startDate: day(-56), endDate: day(35) },
  ].map((t) => ({ id: uid(2400 + t.number), year, ...t, ...stamp }));

  const event = (n, name, type, start, length, venue, region, status, codes, extra = {}) => ({
    id: uid(1800 + n),
    name,
    type,
    startDate: day(start),
    endDate: day(start + length),
    venue,
    region,
    description: '',
    capacity: 40,
    registrationCloses: day(start - 2),
    status,
    clubIds: codes.map((code) => byCode[code].id),
    photoIds: [],
    ...stamp,
    ...extra,
  });
  const events = [
    event(
      1,
      'Nairobi Scratch Showcase',
      'showcase',
      5,
      0,
      'Kenyatta International Convention Centre',
      'nairobi_central',
      'open',
      ['NAC-001', 'NAC-002'],
      { description: 'Learners show the games and stories they made this term.' },
    ),
    event(
      2,
      'National Code Clubs Hackathon',
      'hackathon',
      30,
      1,
      'STEAMLabs Hub, Nairobi',
      null,
      'planned',
      ['NAC-001', 'WNY-001', 'CST-001', 'RVL-001'],
      { capacity: 60 },
    ),
    event(
      3,
      'Kisumu Game Jam',
      'competition',
      -20,
      0,
      'Kisumu Social Hall',
      'western_nyanza',
      'held',
      ['WNY-001'],
    ),
  ];

  const byNumber = (n) => learners.find((l) => l.id === uid(1000 + n));
  const participant = (n, eventN, learnerN, status) => {
    const l = byNumber(learnerN);
    return {
      id: uid(1900 + n),
      eventId: uid(1800 + eventN),
      learnerId: l.id,
      clubId: l.clubId,
      region: l.region,
      status,
      ...stamp,
    };
  };
  const eventParticipants = [
    participant(1, 1, 1, 'registered'),
    participant(2, 1, 2, 'registered'),
    participant(3, 1, 3, 'registered'),
    participant(4, 3, 10, 'attended'),
    participant(5, 3, 11, 'attended'),
  ];
  // Imani (learner 3) has no event consent yet, so the showcase shows the alert.
  const eventConsents = [
    [1, 1, 1],
    [2, 1, 2],
    [3, 3, 10],
    [4, 3, 11],
  ].map(([n, eventN, learnerN]) => {
    const l = byNumber(learnerN);
    return {
      id: uid(2000 + n),
      eventId: uid(1800 + eventN),
      learnerId: l.id,
      clubId: l.clubId,
      region: l.region,
      status: 'given',
      signedOn: day(-10),
      fileId: null,
      ...stamp,
    };
  });
  const eventProjects = [
    {
      id: uid(2101),
      eventId: uid(1803),
      title: 'Lake Victoria Clean-up Game',
      description: 'A Scratch game where a boat collects plastic from the lake.',
      link: null,
      learnerIds: [uid(1010), uid(1011)],
      clubId: byCode['WNY-001'].id,
      region: 'western_nyanza',
      award: 'Best game design',
      rank: 1,
      ...stamp,
    },
  ];

  const announcement = (n, title, body, audience, senderN, senderName, recipientIds, days) => ({
    id: uid(2200 + n),
    title,
    body,
    audience: { roles: [], regions: [], clubIds: [], ...audience },
    channels: [],
    recipientIds,
    senderId: uid(senderN),
    senderName,
    ...stamp,
    createdAt: `${day(days)}T07:00:00.000Z`,
    updatedAt: `${day(days)}T07:00:00.000Z`,
  });
  const champions = [11, 12, 13, 14, 15, 16, 17, 18].map(uid);
  const announcements = [
    announcement(
      1,
      'Term reports due Friday',
      'Please report every session held this term by Friday so the termly report is complete.',
      { roles: ['champion'] },
      2,
      'Otieno Ouma',
      champions,
      -3,
    ),
    announcement(
      2,
      'Nairobi Scratch Showcase',
      'Register your learners for the showcase and collect the event consent forms this week.',
      { regions: ['nairobi_central'], roles: ['champion'] },
      3,
      'Mwende Mutua',
      [uid(11), uid(12), uid(15)],
      -1,
    ),
  ];
  const announcementReads = [
    {
      id: uid(2301),
      announcementId: uid(2201),
      userId: uid(11),
      readAt: `${day(-2)}T09:00:00.000Z`,
      createdAt: `${day(-2)}T09:00:00.000Z`,
      updatedAt: `${day(-2)}T09:00:00.000Z`,
    },
  ];

  return {
    terms,
    events,
    eventParticipants,
    eventConsents,
    eventProjects,
    announcements,
    announcementReads,
  };
}

/**
 * Sprint 5: equipment, resources, learner projects and assessments. Dates are counted from today
 * so the current term always has results and one loan is always overdue.
 */
function createProgrammeData(clubs, today = new Date()) {
  const byCode = Object.fromEntries(clubs.map((c) => [c.code, c]));
  const day = (n) => new Date(today.getTime() + n * 86_400_000).toISOString().slice(0, 10);
  const at = (n) => `${day(n)}T08:00:00.000Z`;
  const dated = (n) => ({ ...stamp, createdAt: at(n), updatedAt: at(n) });

  const item = (n, name, type, serialNumber, region, code, extra = {}) => ({
    id: uid(2600 + n),
    assetTag: `EQ-${String(n).padStart(4, '0')}`,
    name,
    type,
    serialNumber,
    condition: 'working',
    region,
    clubId: code ? byCode[code].id : null,
    contents: null,
    notes: null,
    ...dated(-60),
    ...extra,
  });
  const equipmentItems = [
    item(1, 'Laptop 1', 'laptop', 'HP-5CG2041A1', 'nairobi_central', 'NAC-001'),
    item(2, 'Laptop 2', 'laptop', 'HP-5CG2041A2', 'nairobi_central', 'NAC-001'),
    item(3, 'Laptop 3', 'laptop', 'HP-5CG2041A3', 'nairobi_central', 'NAC-001', {
      condition: 'damaged',
      notes: 'Screen cracked',
      ...dated(-2),
    }),
    item(4, 'Robotics kit 1', 'robotics_kit', 'RK-2025-001', 'nairobi_central', 'NAC-003', {
      contents: '10 micro:bits, 10 battery packs, 1 box of crocodile clips',
    }),
    item(5, 'Tablet 1', 'tablet', 'SM-T220-0091', 'nairobi_central', null),
    item(6, 'Laptop 4', 'laptop', 'HP-5CG2041A4', 'nairobi_central', null, {
      condition: 'needs_repair',
      notes: 'Keyboard missing two keys',
    }),
    item(7, 'micro:bit class set', 'microbit', 'MB-SET-07', 'coast', 'CST-001', {
      contents: '15 micro:bits with USB cables',
    }),
    item(8, 'Raspberry Pi 400 kit', 'raspberry_pi', 'RPI400-118', 'western_nyanza', 'WNY-001'),
    item(9, 'Laptop 5', 'laptop', 'LEN-PF3K21', 'rift_valley', null),
    item(10, 'Old tablet', 'tablet', 'SM-T110-0007', 'coast', null, { condition: 'retired' }),
  ];
  const loan = (n, itemNumber, code, out, due, extra = {}) => ({
    id: uid(2700 + n),
    itemId: uid(2600 + itemNumber),
    clubId: byCode[code].id,
    region: byCode[code].region,
    outDate: day(out),
    dueDate: due === null ? null : day(due),
    returnedDate: null,
    conditionOut: 'working',
    conditionReturned: null,
    note: null,
    outBy: uid(2),
    returnedBy: null,
    open: true,
    ...dated(out),
    ...extra,
  });
  const equipmentLoans = [
    loan(1, 1, 'NAC-001', -50, 35),
    loan(2, 2, 'NAC-001', -50, 35),
    loan(3, 3, 'NAC-001', -50, 35),
    // Due back last week: shows as an alert.
    loan(4, 4, 'NAC-003', -40, -5),
    loan(5, 7, 'CST-001', -30, 60),
    loan(6, 8, 'WNY-001', -20, null),
    loan(7, 5, 'NAC-002', -120, -80, {
      returnedDate: day(-82),
      conditionReturned: 'working',
      returnedBy: uid(2),
      open: false,
    }),
  ];
  const equipmentRepairs = [
    {
      id: uid(2751),
      itemId: uid(2606),
      region: 'nairobi_central',
      date: day(-10),
      problem: 'Two keys came off the keyboard',
      action: 'Waiting for a replacement keyboard',
      cost: null,
      conditionAfter: 'needs_repair',
      ...dated(-10),
    },
  ];
  const equipmentReports = [
    {
      id: uid(2761),
      itemId: uid(2603),
      clubId: byCode['NAC-001'].id,
      region: 'nairobi_central',
      condition: 'damaged',
      note: 'Screen cracked when the laptop fell off a desk',
      date: day(-2),
      reportedBy: uid(11),
      ...dated(-2),
    },
  ];

  const resource = (n, title, type, tracks, extra = {}) => ({
    id: uid(2800 + n),
    title,
    description: '',
    type,
    tracks,
    ageBands: [],
    language: 'en',
    link: null,
    fileId: null,
    fileName: null,
    fileType: null,
    size: null,
    status: 'published',
    ...dated(-30),
    ...extra,
  });
  const resources = [
    resource(1, 'Scratch: Make a chatbot', 'lesson_plan', ['scratch'], {
      description: 'A Raspberry Pi Foundation project: learners make a character that talks back.',
      link: 'https://projects.raspberrypi.org/en/projects/chatbot',
      ageBands: ['9-10', '11-12'],
    }),
    resource(2, 'micro:bit: Step counter', 'lesson_plan', ['robotics'], {
      link: 'https://projects.raspberrypi.org/en/projects/step-counter',
      ageBands: ['11-12', '13-14'],
    }),
    resource(3, 'What is an algorithm? (video)', 'video', ['unplugged', 'scratch'], {
      link: 'https://www.youtube.com/watch?v=6hfOvs8pY1k',
    }),
    resource(4, 'Algorithms with paper and pencil', 'worksheet', ['unplugged'], {
      language: 'sw',
      description: 'Karatasi ya kazi: andika hatua za kupika chai.',
      ...demoFileFields(DEMO_RESOURCE_FILES[uid(2804)]),
    }),
    resource(5, 'Term 1 game design slides', 'slides', ['game_design'], { status: 'draft' }),
  ];

  const project = (n, code, learnerNumbers, title, track, days, extra = {}) => ({
    id: uid(2900 + n),
    clubId: byCode[code].id,
    region: byCode[code].region,
    learnerIds: learnerNumbers.map((ln) => uid(1000 + ln)),
    sessionId: null,
    title,
    track,
    link: null,
    fileId: null,
    fileType: null,
    date: day(days),
    note: null,
    ...dated(days),
    ...extra,
  });
  const learnerProjects = [
    project(1, 'NAC-001', [1, 2], 'Maze game', 'scratch', -20, {
      link: 'https://scratch.mit.edu/projects/100000001',
    }),
    project(2, 'NAC-001', [3], 'Animated birthday card', 'scratch', -12),
    project(3, 'NAC-001', [4, 5], 'Quiz about Kenya', 'scratch', -5),
    project(4, 'NAC-002', [7], 'Algorithm for making tea', 'unplugged', -9),
  ];

  const assessment = (n, code, title, track, days, maxScore) => ({
    id: uid(3000 + n),
    clubId: byCode[code].id,
    region: byCode[code].region,
    title,
    track,
    date: day(days),
    maxScore,
    ...dated(days),
  });
  const assessments = [
    assessment(1, 'NAC-001', 'Scratch loops quiz', 'scratch', -21, 10),
    assessment(2, 'NAC-001', 'Events and broadcasts quiz', 'scratch', -7, 20),
  ];
  const scores = [
    [1, 1, 8],
    [1, 2, 6],
    [1, 3, 9],
    [1, 4, 7],
    [1, 5, 5],
    [2, 1, 17],
    [2, 2, 12],
    [2, 3, 18],
    [2, 4, 15],
  ];
  const assessmentScores = scores.map(([a, ln, score], i) => ({
    id: uid(3100 + i + 1),
    assessmentId: uid(3000 + a),
    learnerId: uid(1000 + ln),
    clubId: byCode['NAC-001'].id,
    region: 'nairobi_central',
    score,
    ...dated(a === 1 ? -21 : -7),
  }));

  return {
    equipmentItems,
    equipmentLoans,
    equipmentRepairs,
    equipmentReports,
    resources,
    learnerProjects,
    assessments,
    assessmentScores,
  };
}

/**
 * A one-page PDF with these lines of text, so demo resources have a real file to open and save
 * on a device. Plain ASCII only.
 */
export function demoPdf(lines) {
  const text = lines
    .map(
      (line, i) =>
        `BT /F1 ${i ? 12 : 18} Tf 56 ${770 - i * 24} Td (${line.replace(/[()\\]/g, '')}) Tj ET`,
    )
    .join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((body, i) => {
    const at = pdf.length;
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return at;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return pdf;
}

/** Files of demo resources, by resource id: made by the seed (server) and the demo API. */
export const DEMO_RESOURCE_FILES = {
  [uid(2804)]: {
    fileId: uid(2854),
    fileName: 'algorithms-worksheet.pdf',
    lines: [
      'Algorithms with paper and pencil',
      'Hatua kwa hatua: andika hatua za kupika chai.',
      '1. Chemsha maji.',
      '2. Weka majani ya chai.',
      '3. Ongeza maziwa na sukari.',
      'Fictional demo worksheet for STEAMLabs Code Clubs.',
    ],
  },
};

function demoFileFields({ fileId, fileName, lines }) {
  return {
    fileId,
    fileName,
    fileType: 'application/pdf',
    size: new TextEncoder().encode(demoPdf(lines)).length,
  };
}

/** One account per role for the "Sign in as" buttons on the login page (mock mode only). */
export const DEMO_ACCOUNTS = [
  { role: 'system_admin', userNumber: 1 },
  { role: 'programme_manager', userNumber: 2 },
  { role: 'coordinator', userNumber: 3 },
  { role: 'champion', userNumber: 11 },
];
