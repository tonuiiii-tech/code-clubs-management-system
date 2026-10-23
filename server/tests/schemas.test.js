import {
  attendanceSchema,
  birthYearFromAge,
  createClubSchema,
  createLearnerSchema,
  createSessionSchema,
  createSchoolSchema,
  createUserSchema,
  updateOwnProfileSchema,
} from '@code-clubs/shared/schemas';

const validClub = {
  name: 'Kibera Coders',
  schoolId: '0f8fad5b-d9cb-469f-a165-70867728950e',
  venueType: 'community_centre',
  meetingDay: 'saturday',
  startTime: '10:00',
  endTime: '12:00',
  mainTrack: 'scratch',
};

describe('Club schema', () => {
  it('accepts a valid club and defaults capacity to 30', () => {
    const club = createClubSchema.parse(validClub);
    expect(club.capacity).toBe(30);
    expect(club.frequency).toBe('weekly');
  });

  it('rejects capacity above 30', () => {
    expect(createClubSchema.safeParse({ ...validClub, capacity: 31 }).success).toBe(false);
  });

  it('requires a school unless the club meets online', () => {
    const { schoolId: _s, ...noSchool } = validClub;
    expect(createClubSchema.safeParse(noSchool).success).toBe(false);
    expect(createClubSchema.safeParse({ ...noSchool, venueType: 'online' }).success).toBe(true);
  });

  it('rejects an end time before the start time', () => {
    expect(createClubSchema.safeParse({ ...validClub, endTime: '09:00' }).success).toBe(false);
  });

  it('rejects unknown fields such as a client-supplied region', () => {
    expect(createClubSchema.safeParse({ ...validClub, region: 'coast' }).success).toBe(false);
  });
});

describe('School schema', () => {
  const school = {
    name: 'Mwangaza Primary School',
    type: 'primary_school',
    region: 'nairobi_central',
    county: 'Nairobi',
    subCounty: 'Kibra',
    contactPhone: '+254700000101',
  };

  it('accepts a valid school', () => {
    expect(createSchoolSchema.safeParse(school).success).toBe(true);
  });

  it('rejects counties that do not exist and badly formatted phones', () => {
    expect(createSchoolSchema.safeParse({ ...school, county: 'Atlantis' }).success).toBe(false);
    expect(createSchoolSchema.safeParse({ ...school, contactPhone: '0712345678' }).success).toBe(
      false,
    );
  });
});

describe('User schemas', () => {
  it('normalises email addresses', () => {
    const u = createUserSchema.parse({
      fullName: 'Achieng Otieno',
      email: '  Achieng@Example.ORG ',
      role: 'champion',
    });
    expect(u.email).toBe('achieng@example.org');
  });

  it('does not let users change their own role or status', () => {
    expect(updateOwnProfileSchema.safeParse({ role: 'system_admin' }).success).toBe(false);
    expect(updateOwnProfileSchema.safeParse({ status: 'active' }).success).toBe(false);
  });
});

const validLearner = {
  clubId: '0f8fad5b-d9cb-469f-a165-70867728950e',
  firstName: 'Zawadi',
  lastName: 'Mwangi',
  age: 11,
  gender: 'girl',
  grade: 'grade_6',
};

describe('Learner schema (D2-2, D2-9)', () => {
  it('accepts only the agreed fields', () => {
    expect(createLearnerSchema.safeParse(validLearner).success).toBe(true);
    expect(
      createLearnerSchema.safeParse({ ...validLearner, dateOfBirth: '2015-01-01' }).success,
    ).toBe(false);
    expect(createLearnerSchema.safeParse({ ...validLearner, phone: '+254700000001' }).success).toBe(
      false,
    );
  });

  it('keeps ages between 9 and 14 and uses Kenyan numbers for guardians', () => {
    expect(createLearnerSchema.safeParse({ ...validLearner, age: 8 }).success).toBe(false);
    expect(createLearnerSchema.safeParse({ ...validLearner, age: 15 }).success).toBe(false);
    const contact = { guardianName: 'Rehema Mwangi', relationship: 'mother', phone: '0712345678' };
    expect(createLearnerSchema.safeParse({ ...validLearner, contact }).success).toBe(false);
    expect(
      createLearnerSchema.safeParse({
        ...validLearner,
        contact: { ...contact, phone: '+254712345678' },
      }).success,
    ).toBe(true);
  });

  it('works out the year of birth from the age', () => {
    expect(birthYearFromAge(11, new Date('2026-10-23'))).toBe(2015);
  });
});

describe('Session and attendance schemas', () => {
  const session = { clubId: validLearner.clubId, date: '2026-10-20' };

  it('needs a topic when the session was held', () => {
    expect(createSessionSchema.safeParse(session).success).toBe(false);
    expect(createSessionSchema.parse({ ...session, topic: 'Loops' }).status).toBe('held');
    expect(createSessionSchema.safeParse({ ...session, status: 'planned' }).success).toBe(true);
  });

  it('lists each learner once', () => {
    const record = { learnerId: validLearner.clubId, status: 'present' };
    expect(attendanceSchema.safeParse({ records: [record] }).success).toBe(true);
    expect(attendanceSchema.safeParse({ records: [record, record] }).success).toBe(false);
  });
});
