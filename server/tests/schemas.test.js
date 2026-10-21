import {
  createClubSchema,
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
