/**
 * Sprint 5 in the demo API: equipment, the resource library, learner projects and assessments.
 * Same rules, shapes and errors as server/src/modules/{equipment,resources,progress} (R1-19).
 */
import {
  LENDABLE_CONDITIONS,
  PHOTO_TYPES,
  RESOURCE_FILE_TYPES,
  RESOURCE_MAX_BYTES,
  UPLOAD_MAX_BYTES,
  UPLOAD_TYPES,
} from '@code-clubs/shared/enums';
import { ERROR_MESSAGES } from '@code-clubs/shared/errors';
import { DEMO_RESOURCE_FILES, demoPdf } from '@code-clubs/shared/demo';
import { can, scopeFor } from '@code-clubs/shared/permissions';
import {
  assessmentScoresSchema,
  createAssessmentSchema,
  createEquipmentSchema,
  createProjectSchema,
  createResourceSchema,
  equipmentRepairSchema,
  idSchema,
  lendEquipmentSchema,
  listAssessmentsQuerySchema,
  listEquipmentQuerySchema,
  listProjectsQuerySchema,
  listResourcesQuerySchema,
  notInFuture,
  projectFileQuerySchema,
  reportEquipmentSchema,
  resourceExtension,
  resourceFileQuerySchema,
  returnEquipmentSchema,
  termForDate,
  updateAssessmentSchema,
  updateEquipmentSchema,
  updateProjectSchema,
  updateResourceSchema,
} from '@code-clubs/shared/schemas';

const percent = (score, max) => (score === null ? null : Math.round((score / max) * 100));
const average = (values) =>
  values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
const isPresent = (status) => status === 'present' || status === 'late';

/** @param {object} ctx helpers from mockApi.js, which owns the store */
export function sprint5Routes(ctx) {
  const {
    getDb,
    authorize,
    scopeFilter,
    clubInFilter,
    clubRecordInFilter,
    currentAssignments,
    validate,
    paginate,
    readBytes,
    files,
    errors: { badRequest, forbidden, notFound, conflict, tooLarge },
    matches,
    today,
    now,
  } = ctx;
  const idParam = (id, name = 'id') => validate(idSchema, id, `params.${name}`);
  const stampNew = (actor) => ({
    createdAt: now(),
    updatedAt: now(),
    createdBy: actor.id,
    updatedBy: actor.id,
  });
  const stampChange = (actor) => ({ updatedAt: now(), updatedBy: actor.id });
  const fullName = (l) => `${l.firstName} ${l.lastName}`;
  const filterFor = (actor, permission) => scopeFilter(actor, scopeFor(actor, permission));
  const db = () => getDb();

  // -------------------------------------------------------------------------
  // Equipment (plan section 4)

  /** Same as server/src/db/scopeQueries.js equipmentScopeQuery. */
  function itemInFilter(item, filter) {
    if (filter.all) return true;
    if (filter.regions) {
      if (filter.regions.includes(item.region)) return true;
      const club = item.clubId && db().clubs.find((c) => c.id === item.clubId);
      return Boolean(club && filter.regions.includes(club.region));
    }
    if (filter.championUserId) {
      return Boolean(
        item.clubId &&
        currentAssignments(item.clubId).some((a) => a.userId === filter.championUserId),
      );
    }
    return false;
  }
  const itemManagedBy = (item, filter) =>
    filter.all || Boolean(filter.regions?.includes(item.region));

  const clubSummary = (id) => {
    const club = id && db().clubs.find((c) => c.id === id);
    return club ? { id: club.id, code: club.code, name: club.name, region: club.region } : null;
  };
  const openLoan = (itemId) => db().equipmentLoans.find((l) => l.itemId === itemId && l.open);
  const presentItem = (item) => {
    const loan = openLoan(item.id);
    return {
      ...item,
      club: clubSummary(item.clubId),
      dueDate: loan?.dueDate ?? null,
      overdue: Boolean(loan?.dueDate && loan.dueDate < today()),
    };
  };

  function findItem(actor, id) {
    const item = db().equipmentItems.find((i) => i.id === id);
    if (!item || !itemInFilter(item, filterFor(actor, 'equipment:read'))) {
      throw notFound(ERROR_MESSAGES.equipmentNotFound);
    }
    return item;
  }

  function findManagedItem(actor, scope, id) {
    const item = findItem(actor, id);
    if (!itemManagedBy(item, scopeFilter(actor, scope))) {
      throw forbidden(ERROR_MESSAGES.equipmentOwnRegion);
    }
    return item;
  }

  function checkRegion(actor, scope, region) {
    const filter = scopeFilter(actor, scope);
    if (filter.regions && !filter.regions.includes(region)) {
      throw forbidden(ERROR_MESSAGES.equipmentOwnRegion);
    }
  }

  function checkSerial(serialNumber, exceptId) {
    if (
      serialNumber &&
      db().equipmentItems.some((i) => i.id !== exceptId && i.serialNumber === serialNumber)
    ) {
      throw conflict(ERROR_MESSAGES.duplicateSerial);
    }
  }

  function equipmentDetail(actor, id) {
    const item = findItem(actor, id);
    const byDate = (key) => (a, b) => String(b[key]).localeCompare(String(a[key]));
    return {
      ...presentItem(item),
      loans: db()
        .equipmentLoans.filter((l) => l.itemId === id)
        .sort(byDate('outDate'))
        .map((l) => ({ ...l, club: clubSummary(l.clubId) })),
      repairs: db()
        .equipmentRepairs.filter((r) => r.itemId === id)
        .sort(byDate('date')),
      reports: db()
        .equipmentReports.filter((r) => r.itemId === id)
        .sort(byDate('date')),
      canManage: itemManagedBy(item, filterFor(actor, 'equipment:manage') ?? {}),
    };
  }

  function nextAssetTag() {
    const top = Math.max(0, ...db().equipmentItems.map((i) => Number(i.assetTag.slice(3))));
    return `EQ-${String(top + 1).padStart(4, '0')}`;
  }

  /** A champion's report of damage or loss; from a device, `recordedAt` is when (US-27). */
  function reportItem(actor, id, body, recordedAt = now()) {
    authorize(actor, 'equipment:report');
    const item = findItem(actor, id);
    const input = validate(reportEquipmentSchema, body, 'body');
    db().equipmentReports.push({
      id: crypto.randomUUID(),
      itemId: id,
      clubId: item.clubId,
      region: item.region,
      condition: input.condition,
      note: input.note,
      date: recordedAt.slice(0, 10),
      reportedBy: actor.id,
      reportedByName: actor.fullName,
      createdAt: now(),
      updatedAt: now(),
    });
    if (item.condition !== 'retired') {
      Object.assign(item, { condition: input.condition }, stampChange(actor));
    }
    return equipmentDetail(actor, id);
  }

  // -------------------------------------------------------------------------
  // Resources (plan section 5)

  const managing = (actor) => can(actor, 'resource:manage');
  const presentResource = ({ createdBy: _c, updatedBy: _u, fileId, ...r }) => ({
    ...r,
    hasFile: Boolean(fileId),
  });

  function findResource(actor, id) {
    const resource = db().resources.find((r) => r.id === id);
    if (!resource || (!managing(actor) && resource.status !== 'published')) {
      throw notFound(ERROR_MESSAGES.resourceNotFound);
    }
    return resource;
  }

  function checkContent(resource) {
    if (resource.type === 'video' && resource.fileId)
      throw badRequest(ERROR_MESSAGES.videoLinkOnly);
    if (resource.status === 'published' && !resource.link && !resource.fileId) {
      throw badRequest(ERROR_MESSAGES.resourceNeedsLinkOrFile);
    }
  }

  /** The real type from the first bytes, like server/src/utils/fileType.js. */
  async function fileFamily(blob) {
    const b = await readBytes(blob, 8);
    if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf';
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
    if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return 'zip';
    return null;
  }

  /** Demo files are made again after a reload; uploads stay in memory only. */
  function resourceBlob(resource) {
    if (files.has(resource.fileId)) return files.get(resource.fileId);
    const demo = DEMO_RESOURCE_FILES[resource.id];
    if (demo && demo.fileId === resource.fileId) {
      return new Blob([demoPdf(demo.lines)], { type: 'application/pdf' });
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Learner progress (plan section 6)

  function findClub(actor, scope, clubId) {
    const club = db().clubs.find((c) => c.id === clubId);
    if (!club || !clubInFilter(club, scopeFilter(actor, scope))) {
      throw notFound(ERROR_MESSAGES.clubNotFound);
    }
    return club;
  }

  function checkDate(date) {
    if (!notInFuture(date)) {
      throw badRequest(ERROR_MESSAGES.invalidFields, [
        { field: 'body.date', message: 'The date cannot be in the future' },
      ]);
    }
  }

  const learnerById = (id) => db().learners.find((l) => l.id === id);

  function checkMembers(clubId, learnerIds, keep = []) {
    const ok = learnerIds.every((id) => {
      const l = learnerById(id);
      return l && l.clubId === clubId && (l.status === 'active' || keep.includes(l.id));
    });
    if (!ok) throw badRequest(ERROR_MESSAGES.projectLearnersOneClub);
  }

  function checkSession(clubId, sessionId) {
    if (sessionId && !db().sessions.some((s) => s.id === sessionId && s.clubId === clubId)) {
      throw badRequest(ERROR_MESSAGES.sessionNotFound);
    }
  }

  const presentProject = ({ fileId, createdBy: _c, updatedBy: _u, ...p }) => ({
    ...p,
    hasFile: Boolean(fileId),
    learners: p.learnerIds.map((id) => {
      const l = learnerById(id);
      return { id, name: l ? fullName(l) : '' };
    }),
  });

  function findProject(actor, id, permission = 'progress:read') {
    const project = db().learnerProjects.find((p) => p.id === id);
    if (!project || !clubRecordInFilter(project, filterFor(actor, permission))) {
      throw notFound(ERROR_MESSAGES.projectNotFound);
    }
    return project;
  }

  function createProject(actor, scope, body) {
    const input = validate(createProjectSchema, body, 'body');
    const club = findClub(actor, scope, input.clubId);
    checkDate(input.date);
    checkMembers(club.id, input.learnerIds);
    checkSession(club.id, input.sessionId);
    const id = input.id ?? crypto.randomUUID();
    if (db().learnerProjects.some((p) => p.id === id)) throw conflict(ERROR_MESSAGES.duplicateId);
    const project = {
      sessionId: null,
      link: null,
      note: null,
      ...input,
      id,
      clubId: club.id,
      region: club.region,
      fileId: null,
      fileType: null,
      ...stampNew(actor),
    };
    db().learnerProjects.push(project);
    return presentProject(project);
  }

  function updateProject(actor, id, body) {
    const project = findProject(actor, id, 'progress:record');
    const changes = validate(updateProjectSchema, body, 'body');
    if (changes.date) checkDate(changes.date);
    if (changes.learnerIds) checkMembers(project.clubId, changes.learnerIds, project.learnerIds);
    if (changes.sessionId) checkSession(project.clubId, changes.sessionId);
    Object.assign(project, changes, stampChange(actor));
    return presentProject(project);
  }

  const scoresOf = (ids) => db().assessmentScores.filter((s) => ids.includes(s.assessmentId));

  const presentAssessment = ({ createdBy: _c, updatedBy: _u, ...a }) => {
    const given = scoresOf([a.id]).filter((s) => s.score !== null);
    return {
      ...a,
      scored: given.length,
      averageScore: average(given.map((s) => percent(s.score, a.maxScore))),
    };
  };

  function findAssessment(actor, id, permission = 'progress:read') {
    const assessment = db().assessments.find((a) => a.id === id);
    if (!assessment || !clubRecordInFilter(assessment, filterFor(actor, permission))) {
      throw notFound(ERROR_MESSAGES.assessmentNotFound);
    }
    return assessment;
  }

  const activeLearners = (clubId) =>
    db()
      .learners.filter((l) => l.clubId === clubId && l.status === 'active')
      .sort(
        (a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName),
      );

  function assessmentDetail(actor, id) {
    const assessment = findAssessment(actor, id);
    const scores = scoresOf([id]);
    const scoreBy = new Map(scores.map((s) => [s.learnerId, s.score]));
    const active = activeLearners(assessment.clubId);
    const others = scores
      .map((s) => s.learnerId)
      .filter((l) => !active.some((a) => a.id === l))
      .map(learnerById)
      .filter(Boolean);
    return {
      ...presentAssessment(assessment),
      scores: [...active, ...others].map((l) => ({
        learnerId: l.id,
        name: fullName(l),
        learnerNumber: l.learnerNumber ?? null,
        status: l.status,
        score: scoreBy.get(l.id) ?? null,
      })),
    };
  }

  function createAssessment(actor, scope, body) {
    const input = validate(createAssessmentSchema, body, 'body');
    const club = findClub(actor, scope, input.clubId);
    checkDate(input.date);
    const id = input.id ?? crypto.randomUUID();
    if (db().assessments.some((a) => a.id === id)) throw conflict(ERROR_MESSAGES.duplicateId);
    db().assessments.push({
      ...input,
      id,
      clubId: club.id,
      region: club.region,
      ...stampNew(actor),
    });
    return assessmentDetail(actor, id);
  }

  function updateAssessment(actor, id, body) {
    const assessment = findAssessment(actor, id, 'progress:record');
    const changes = validate(updateAssessmentSchema, body, 'body');
    if (changes.date) checkDate(changes.date);
    if (changes.maxScore !== undefined) {
      const given = scoresOf([id]).filter((s) => s.score !== null);
      if (given.some((s) => s.score > changes.maxScore)) {
        throw badRequest(ERROR_MESSAGES.scoreAboveMaximum);
      }
    }
    Object.assign(assessment, changes, stampChange(actor));
    return assessmentDetail(actor, id);
  }

  /** Merged learner by learner, like attendance (D5-5). */
  function saveScores(actor, id, body) {
    const assessment = findAssessment(actor, id, 'progress:record');
    const { scores } = validate(assessmentScoresSchema, body, 'body');
    if (scores.some((s) => s.score !== null && s.score > assessment.maxScore)) {
      throw badRequest(ERROR_MESSAGES.scoreAboveMaximum);
    }
    const existing = new Set(scoresOf([id]).map((s) => s.learnerId));
    const ok = scores.every((s) => {
      const l = learnerById(s.learnerId);
      return l && l.clubId === assessment.clubId && (l.status === 'active' || existing.has(l.id));
    });
    if (!ok) throw badRequest(ERROR_MESSAGES.scoresNotInClub);
    for (const { learnerId, score } of scores) {
      const row = db().assessmentScores.find(
        (s) => s.assessmentId === id && s.learnerId === learnerId,
      );
      if (row) Object.assign(row, { score, updatedAt: now(), updatedBy: actor.id });
      else {
        db().assessmentScores.push({
          id: crypto.randomUUID(),
          assessmentId: id,
          learnerId,
          clubId: assessment.clubId,
          region: assessment.region,
          score,
          ...stampNew(actor),
        });
      }
    }
    return assessmentDetail(actor, id);
  }

  function attendanceOf(learnerId, from) {
    const marks = db().attendance.filter(
      (a) => a.learnerId === learnerId && (!from || a.date >= from),
    );
    const present = marks.filter((m) => isPresent(m.status)).length;
    return {
      present,
      total: marks.length,
      rate: marks.length ? Math.round((present / marks.length) * 100) : null,
    };
  }

  function learnerProgress(actor, scope, learnerId) {
    const learner = learnerById(learnerId);
    if (!learner || !clubRecordInFilter(learner, scopeFilter(actor, scope))) {
      throw notFound(ERROR_MESSAGES.learnerNotFound);
    }
    const term = termForDate(db().terms, today());
    const results = db()
      .assessmentScores.filter((s) => s.learnerId === learnerId && s.score !== null)
      .map((s) => ({ s, a: db().assessments.find((a) => a.id === s.assessmentId) }))
      .filter(({ a }) => a)
      .map(({ s, a }) => ({
        assessmentId: a.id,
        title: a.title,
        track: a.track,
        date: a.date,
        score: s.score,
        maxScore: a.maxScore,
        percent: percent(s.score, a.maxScore),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
    const eventProjects = db()
      .eventProjects.filter((p) => p.learnerIds.includes(learnerId))
      .map((p) => {
        const event = db().events.find((e) => e.id === p.eventId);
        return {
          id: p.id,
          eventId: p.eventId,
          eventName: event?.name ?? '',
          date: event?.startDate ?? null,
          title: p.title,
          link: p.link ?? null,
          award: p.award ?? null,
          rank: p.rank ?? null,
        };
      });
    return {
      learner: {
        id: learner.id,
        name: fullName(learner),
        learnerNumber: learner.learnerNumber ?? null,
        clubId: learner.clubId,
        status: learner.status,
      },
      term: term ? { id: term.id, number: term.number, year: term.year } : null,
      attendance: {
        term: term ? attendanceOf(learnerId, term.startDate) : null,
        allTime: attendanceOf(learnerId),
      },
      projects: db()
        .learnerProjects.filter((p) => p.learnerIds.includes(learnerId))
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(presentProject),
      eventProjects,
      results,
      averageScore: average(results.map((r) => r.percent)),
    };
  }

  function clubProgress(actor, scope, clubId) {
    const club = findClub(actor, scope, clubId);
    const projects = db()
      .learnerProjects.filter((p) => p.clubId === clubId)
      .sort((a, b) => b.date.localeCompare(a.date));
    const learners = activeLearners(clubId);
    const byTrack = {};
    for (const p of projects) byTrack[p.track] = (byTrack[p.track] ?? 0) + 1;
    const withProject = new Set(projects.flatMap((p) => p.learnerIds));
    return {
      club: { id: club.id, code: club.code, name: club.name },
      activeLearners: learners.length,
      learnersWithProject: learners.filter((l) => withProject.has(l.id)).length,
      projectsByTrack: byTrack,
      projects: projects.slice(0, 20).map(presentProject),
      assessments: db()
        .assessments.filter((a) => a.clubId === clubId)
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(presentAssessment),
    };
  }

  // -------------------------------------------------------------------------
  // Routes

  const routes = [
    // Equipment
    [
      'GET',
      '/equipment',
      ({ actor, query }) => {
        const filter = scopeFilter(actor, authorize(actor, 'equipment:read'));
        const q = validate(listEquipmentQuerySchema, query, 'query');
        const rows = db()
          .equipmentItems.filter((i) => itemInFilter(i, filter))
          .filter(
            (i) =>
              (!q.type || i.type === q.type) &&
              (!q.condition || i.condition === q.condition) &&
              (!q.region || i.region === q.region) &&
              (!q.clubId || i.clubId === q.clubId) &&
              (q.location !== 'store' || !i.clubId) &&
              (q.location !== 'club' || i.clubId),
          )
          .filter((i) => matches(q.q, i.name, i.assetTag, i.serialNumber))
          .map(presentItem)
          .filter((i) => !q.overdue || i.overdue)
          .sort((a, b) => a.assetTag.localeCompare(b.assetTag));
        return [200, paginate(rows, q)];
      },
    ],
    [
      'POST',
      '/equipment',
      ({ actor, body }) => {
        const scope = authorize(actor, 'equipment:manage');
        const input = validate(createEquipmentSchema, body, 'body');
        checkRegion(actor, scope, input.region);
        checkSerial(input.serialNumber);
        const item = {
          id: crypto.randomUUID(),
          assetTag: nextAssetTag(),
          serialNumber: null,
          contents: null,
          notes: null,
          ...input,
          clubId: null,
          ...stampNew(actor),
        };
        db().equipmentItems.push(item);
        return [201, { data: equipmentDetail(actor, item.id) }];
      },
    ],
    [
      'GET',
      '/equipment/:id',
      ({ actor, params }) => {
        authorize(actor, 'equipment:read');
        return [200, { data: equipmentDetail(actor, idParam(params.id)) }];
      },
    ],
    [
      'PATCH',
      '/equipment/:id',
      ({ actor, params, body }) => {
        const scope = authorize(actor, 'equipment:manage');
        const item = findManagedItem(actor, scope, idParam(params.id));
        const changes = validate(updateEquipmentSchema, body, 'body');
        if (changes.region && changes.region !== item.region) {
          checkRegion(actor, scope, changes.region);
          if (item.clubId) throw conflict(ERROR_MESSAGES.equipmentOnLoan);
        }
        checkSerial(changes.serialNumber, item.id);
        Object.assign(item, changes, stampChange(actor));
        return [200, { data: equipmentDetail(actor, item.id) }];
      },
    ],
    [
      'POST',
      '/equipment/:id/loans',
      ({ actor, params, body }) => {
        const scope = authorize(actor, 'equipment:manage');
        const item = findManagedItem(actor, scope, idParam(params.id));
        const input = validate(lendEquipmentSchema, body, 'body');
        if (item.clubId) throw conflict(ERROR_MESSAGES.equipmentOnLoan);
        if (!LENDABLE_CONDITIONS.includes(item.condition)) {
          throw conflict(ERROR_MESSAGES.equipmentNotLendable);
        }
        const club = findClub(actor, scope, input.clubId);
        if (club.status !== 'active') throw badRequest(ERROR_MESSAGES.clubInactive);
        db().equipmentLoans.push({
          id: crypto.randomUUID(),
          itemId: item.id,
          clubId: club.id,
          region: club.region,
          outDate: input.outDate,
          dueDate: input.dueDate ?? null,
          returnedDate: null,
          conditionOut: item.condition,
          conditionReturned: null,
          note: input.note ?? null,
          outBy: actor.id,
          outByName: actor.fullName,
          returnedBy: null,
          returnedByName: null,
          open: true,
          createdAt: now(),
          updatedAt: now(),
        });
        Object.assign(item, { clubId: club.id }, stampChange(actor));
        return [201, { data: equipmentDetail(actor, item.id) }];
      },
    ],
    [
      'POST',
      '/equipment/:id/return',
      ({ actor, params, body }) => {
        const scope = authorize(actor, 'equipment:manage');
        const item = findManagedItem(actor, scope, idParam(params.id));
        const input = validate(returnEquipmentSchema, body, 'body');
        const loan = openLoan(item.id);
        if (!loan) throw conflict(ERROR_MESSAGES.equipmentNotOnLoan);
        if (input.returnedDate < loan.outDate) {
          throw badRequest(ERROR_MESSAGES.invalidFields, [
            { field: 'body.returnedDate', message: 'The item cannot come back before it went out' },
          ]);
        }
        Object.assign(loan, {
          open: false,
          returnedDate: input.returnedDate,
          conditionReturned: input.condition,
          note: input.note ?? loan.note,
          returnedBy: actor.id,
          returnedByName: actor.fullName,
          updatedAt: now(),
        });
        Object.assign(item, { clubId: null, condition: input.condition }, stampChange(actor));
        return [200, { data: equipmentDetail(actor, item.id) }];
      },
    ],
    [
      'POST',
      '/equipment/:id/repairs',
      ({ actor, params, body }) => {
        const scope = authorize(actor, 'equipment:manage');
        const item = findManagedItem(actor, scope, idParam(params.id));
        const input = validate(equipmentRepairSchema, body, 'body');
        db().equipmentRepairs.push({
          id: crypto.randomUUID(),
          itemId: item.id,
          region: item.region,
          action: null,
          cost: null,
          ...input,
          ...stampNew(actor),
        });
        Object.assign(item, { condition: input.conditionAfter }, stampChange(actor));
        return [201, { data: equipmentDetail(actor, item.id) }];
      },
    ],
    [
      'POST',
      '/equipment/:id/report',
      ({ actor, params, body }) => [201, { data: reportItem(actor, idParam(params.id), body) }],
    ],

    // Resources
    [
      'GET',
      '/resources',
      ({ actor, query }) => {
        authorize(actor, 'resource:read');
        const q = validate(listResourcesQuerySchema, query, 'query');
        const status = managing(actor) ? q.status : 'published';
        const rows = db()
          .resources.filter(
            (r) =>
              (!q.type || r.type === q.type) &&
              (!q.track || r.tracks.includes(q.track)) &&
              (!q.ageBand || r.ageBands.includes(q.ageBand)) &&
              (!q.language || r.language === q.language) &&
              (!status || r.status === status),
          )
          .filter((r) => matches(q.q, r.title, r.description))
          .sort((a, b) => a.title.localeCompare(b.title))
          .map(presentResource);
        return [200, paginate(rows, q)];
      },
    ],
    [
      'POST',
      '/resources',
      ({ actor, body }) => {
        authorize(actor, 'resource:manage');
        const input = validate(createResourceSchema, body, 'body');
        const resource = {
          id: crypto.randomUUID(),
          description: null,
          link: null,
          fileId: null,
          fileName: null,
          fileType: null,
          size: null,
          ...input,
          ...stampNew(actor),
        };
        checkContent(resource);
        db().resources.push(resource);
        return [201, { data: presentResource(resource) }];
      },
    ],
    [
      'GET',
      '/resources/:id',
      ({ actor, params }) => {
        authorize(actor, 'resource:read');
        return [200, { data: presentResource(findResource(actor, idParam(params.id))) }];
      },
    ],
    [
      'PATCH',
      '/resources/:id',
      ({ actor, params, body }) => {
        authorize(actor, 'resource:manage');
        const resource = findResource(actor, idParam(params.id));
        const changes = validate(updateResourceSchema, body, 'body');
        checkContent({ ...resource, ...changes });
        Object.assign(resource, changes, stampChange(actor));
        return [200, { data: presentResource(resource) }];
      },
    ],
    [
      'DELETE',
      '/resources/:id',
      ({ actor, params }) => {
        authorize(actor, 'resource:manage');
        const resource = findResource(actor, idParam(params.id));
        getDb().resources = db().resources.filter((r) => r.id !== resource.id);
        files.delete(resource.fileId);
        return [204, null];
      },
    ],
    [
      'PUT',
      '/resources/:id/file',
      async ({ actor, params, query, body }) => {
        authorize(actor, 'resource:manage');
        const resource = findResource(actor, idParam(params.id));
        const { filename } = validate(resourceFileQuerySchema, query, 'query');
        if (!(body instanceof Blob)) throw badRequest(ERROR_MESSAGES.resourceFileType);
        if (body.size > RESOURCE_MAX_BYTES) throw tooLarge(ERROR_MESSAGES.resourceFileTooLarge);
        const { type, family } = RESOURCE_FILE_TYPES[resourceExtension(filename)];
        if ((await fileFamily(body)) !== family) throw badRequest(ERROR_MESSAGES.resourceFileType);
        if (resource.type === 'video') throw badRequest(ERROR_MESSAGES.videoLinkOnly);
        const fileId = crypto.randomUUID();
        files.set(fileId, new Blob([body], { type }));
        files.delete(resource.fileId);
        Object.assign(
          resource,
          {
            fileId,
            fileName: filename.replace(/[^\w.\- ]+/g, '_'),
            fileType: type,
            size: body.size,
          },
          stampChange(actor),
        );
        return [200, { data: presentResource(resource) }];
      },
    ],
    [
      'DELETE',
      '/resources/:id/file',
      ({ actor, params }) => {
        authorize(actor, 'resource:manage');
        const resource = findResource(actor, idParam(params.id));
        if (!resource.fileId) throw notFound(ERROR_MESSAGES.resourceFileNotFound);
        checkContent({ ...resource, fileId: null });
        files.delete(resource.fileId);
        Object.assign(
          resource,
          { fileId: null, fileName: null, fileType: null, size: null },
          stampChange(actor),
        );
        return [200, { data: presentResource(resource) }];
      },
    ],
    [
      'GET',
      '/resources/:id/file',
      ({ actor, params }) => {
        authorize(actor, 'resource:read');
        const resource = findResource(actor, idParam(params.id));
        const file = resource.fileId && resourceBlob(resource);
        if (!file) throw notFound(ERROR_MESSAGES.resourceFileNotFound);
        return [200, file];
      },
    ],

    // Projects
    [
      'GET',
      '/progress/projects',
      ({ actor, query }) => {
        const filter = scopeFilter(actor, authorize(actor, 'progress:read'));
        const q = validate(listProjectsQuerySchema, query, 'query');
        const rows = db()
          .learnerProjects.filter((p) => clubRecordInFilter(p, filter))
          .filter(
            (p) =>
              (!q.clubId || p.clubId === q.clubId) &&
              (!q.learnerId || p.learnerIds.includes(q.learnerId)) &&
              (!q.track || p.track === q.track),
          )
          .sort((a, b) => b.date.localeCompare(a.date))
          .map(presentProject);
        return [200, paginate(rows, q)];
      },
    ],
    [
      'POST',
      '/progress/projects',
      ({ actor, body }) => [
        201,
        { data: createProject(actor, authorize(actor, 'progress:record'), body) },
      ],
    ],
    [
      'GET',
      '/progress/projects/:id',
      ({ actor, params }) => {
        authorize(actor, 'progress:read');
        return [200, { data: presentProject(findProject(actor, idParam(params.id))) }];
      },
    ],
    [
      'PATCH',
      '/progress/projects/:id',
      ({ actor, params, body }) => {
        authorize(actor, 'progress:record');
        return [200, { data: updateProject(actor, idParam(params.id), body) }];
      },
    ],
    [
      'DELETE',
      '/progress/projects/:id',
      ({ actor, params }) => {
        authorize(actor, 'progress:record');
        const project = findProject(actor, idParam(params.id), 'progress:record');
        getDb().learnerProjects = db().learnerProjects.filter((p) => p.id !== project.id);
        files.delete(project.fileId);
        return [204, null];
      },
    ],
    [
      'PUT',
      '/progress/projects/:id/file',
      async ({ actor, params, query, body }) => {
        authorize(actor, 'progress:record');
        const project = findProject(actor, idParam(params.id), 'progress:record');
        const { confirmConsent, opId } = validate(projectFileQuerySchema, query, 'query');
        if (opId && project.fileOpId === opId) {
          return [200, { data: presentProject(project) }];
        }
        if (!(body instanceof Blob)) throw badRequest(ERROR_MESSAGES.fileTypeNotAllowed);
        if (body.size > UPLOAD_MAX_BYTES) throw tooLarge(ERROR_MESSAGES.fileTooLarge);
        const family = await fileFamily(body);
        const type = { pdf: 'application/pdf', png: 'image/png', jpeg: 'image/jpeg' }[family];
        if (!type || !UPLOAD_TYPES.includes(type)) {
          throw badRequest(ERROR_MESSAGES.fileTypeNotAllowed);
        }
        const missing = PHOTO_TYPES.includes(type)
          ? project.learnerIds.filter(
              (id) =>
                !db().consents.some(
                  (c) => c.learnerId === id && c.type === 'photo' && c.status === 'given',
                ),
            )
          : [];
        if (missing.length && !confirmConsent) {
          throw conflict(
            ERROR_MESSAGES.photoConsentMissing,
            'PHOTO_CONSENT_MISSING',
            missing.map((id) => ({ learnerId: id, name: fullName(learnerById(id)) })),
          );
        }
        const fileId = crypto.randomUUID();
        files.set(fileId, new Blob([body], { type }));
        files.delete(project.fileId);
        Object.assign(
          project,
          { fileId, fileType: type, fileOpId: opId ?? null },
          stampChange(actor),
        );
        return [200, { data: presentProject(project) }];
      },
    ],
    [
      'GET',
      '/progress/projects/:id/file',
      ({ actor, params }) => {
        authorize(actor, 'progress:read');
        const project = findProject(actor, idParam(params.id));
        const file = project.fileId && files.get(project.fileId);
        if (!file) throw notFound(ERROR_MESSAGES.photoNotFound);
        return [200, file];
      },
    ],

    // Assessments
    [
      'GET',
      '/progress/assessments',
      ({ actor, query }) => {
        const filter = scopeFilter(actor, authorize(actor, 'progress:read'));
        const q = validate(listAssessmentsQuerySchema, query, 'query');
        const rows = db()
          .assessments.filter((a) => clubRecordInFilter(a, filter))
          .filter((a) => (!q.clubId || a.clubId === q.clubId) && (!q.track || a.track === q.track))
          .sort((a, b) => b.date.localeCompare(a.date))
          .map(presentAssessment);
        return [200, paginate(rows, q)];
      },
    ],
    [
      'POST',
      '/progress/assessments',
      ({ actor, body }) => [
        201,
        { data: createAssessment(actor, authorize(actor, 'progress:record'), body) },
      ],
    ],
    [
      'GET',
      '/progress/assessments/:id',
      ({ actor, params }) => {
        authorize(actor, 'progress:read');
        return [200, { data: assessmentDetail(actor, idParam(params.id)) }];
      },
    ],
    [
      'PATCH',
      '/progress/assessments/:id',
      ({ actor, params, body }) => {
        authorize(actor, 'progress:record');
        return [200, { data: updateAssessment(actor, idParam(params.id), body) }];
      },
    ],
    [
      'PUT',
      '/progress/assessments/:id/scores',
      ({ actor, params, body }) => {
        authorize(actor, 'progress:record');
        return [200, { data: saveScores(actor, idParam(params.id), body) }];
      },
    ],
    [
      'GET',
      '/progress/learners/:id',
      ({ actor, params }) => [
        200,
        {
          data: learnerProgress(actor, authorize(actor, 'progress:read'), idParam(params.id)),
        },
      ],
    ],
    [
      'GET',
      '/progress/clubs/:id',
      ({ actor, params }) => [
        200,
        { data: clubProgress(actor, authorize(actor, 'progress:read'), idParam(params.id)) },
      ],
    ],
  ];

  // -------------------------------------------------------------------------
  // Offline: the same operations as server sync.service (plan section 7).

  /** Runs one pushed Sprint 5 change; returns false for types it does not know. */
  function applyOperation(actor, op, id) {
    switch (op.type) {
      case 'equipment.report':
        reportItem(actor, id(), op.data, op.recordedAt);
        return true;
      case 'project.save': {
        const scope = authorize(actor, 'progress:record');
        const input = validate(createProjectSchema.required({ id: true }), op.data, 'data');
        if (db().learnerProjects.some((p) => p.id === input.id)) {
          const { id: _id, clubId: _c, ...changes } = input;
          updateProject(actor, input.id, changes);
        } else createProject(actor, scope, input);
        return true;
      }
      case 'assessment.save': {
        const scope = authorize(actor, 'progress:record');
        const input = validate(createAssessmentSchema.required({ id: true }), op.data, 'data');
        if (db().assessments.some((a) => a.id === input.id)) {
          const { id: _id, clubId: _c, ...changes } = input;
          updateAssessment(actor, input.id, changes);
        } else createAssessment(actor, scope, input);
        return true;
      }
      case 'assessment.scores':
        authorize(actor, 'progress:record');
        saveScores(actor, id(), op.data);
        return true;
      default:
        return false;
    }
  }

  /** What the sync pull adds for Sprint 5, and the ids a device may keep. */
  function pullChanges(actor, filter) {
    const strip = ({ createdBy: _c, updatedBy: _u, ...r }) => r;
    const equipmentItems = db()
      .equipmentItems.filter((i) => itemInFilter(i, filter))
      .map(strip);
    const resources = db()
      .resources.filter((r) => r.status === 'published')
      .map(presentResource);
    const learnerProjects = db()
      .learnerProjects.filter((p) => clubRecordInFilter(p, filter))
      .map(({ fileId, fileOpId: _o, ...p }) => ({ ...strip(p), hasFile: Boolean(fileId) }));
    const assessments = db()
      .assessments.filter((a) => clubRecordInFilter(a, filter))
      .map(strip);
    const assessmentScores = db()
      .assessmentScores.filter((s) => clubRecordInFilter(s, filter))
      .map(strip);
    return {
      changes: { equipmentItems, resources, learnerProjects, assessments, assessmentScores },
      inScope: {
        equipmentItems: equipmentItems.map((i) => i.id),
        resources: resources.map((r) => r.id),
        learnerProjects: learnerProjects.map((p) => p.id),
      },
    };
  }

  /** Rows for the dashboard, alerts and termly report, like server insights.repository. */
  const insights = {
    equipmentRows: (filter, { region, clubId } = {}) =>
      db().equipmentItems.filter(
        (i) =>
          itemInFilter(i, filter) &&
          (!region || i.region === region) &&
          (!clubId || i.clubId === clubId),
      ),
    openLoanRows: (clubIds) =>
      db().equipmentLoans.filter((l) => l.open && clubIds.includes(l.clubId)),
    equipmentReportRows: (clubIds, since) =>
      db().equipmentReports.filter((r) => clubIds.includes(r.clubId) && r.date >= since),
    projectRows: (clubIds, { from, to }) =>
      db().learnerProjects.filter(
        (p) => clubIds.includes(p.clubId) && p.date >= from && p.date <= to,
      ),
    assessmentRows: (clubIds, { from, to }) =>
      db().assessments.filter((a) => clubIds.includes(a.clubId) && a.date >= from && a.date <= to),
    assessmentScoreRows: (assessmentIds) => scoresOf(assessmentIds),
  };

  return { routes, applyOperation, pullChanges, insights };
}
