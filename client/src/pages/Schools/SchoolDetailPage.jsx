import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BackLink,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TextLink,
  useToast,
} from 'steamlabsui';
import { useAuth } from '../../context/AuthContext.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { DataState } from '../../components/DataState.jsx';
import { Detail } from '../../components/Detail.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { useApi } from '../../utils/useApi.js';
import { getSchool, updateSchool } from '../../services/schoolsService.js';
import { listClubs } from '../../services/clubsService.js';

export function SchoolDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const school = useApi(getSchool, id);

  return (
    <>
      <PageHeader
        eyebrow={t('nav.schools')}
        back={
          <BackLink asChild>
            <Link to="/schools">{t('common.back')}</Link>
          </BackLink>
        }
        title={school.data?.data.name ?? t('schools.title')}
        meta={school.data && <StatusBadge status={school.data.data.status} />}
      />
      <DataState loading={school.loading} error={school.error} onRetry={school.reload}>
        {school.data && <SchoolDetail school={school.data.data} onChanged={school.reload} />}
      </DataState>
    </>
  );
}

function SchoolDetail({ school, onChanged }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const { toast } = useToast();
  const clubs = useApi(listClubs, { schoolId: school.id, pageSize: 100 });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const active = school.status === 'active';

  async function toggleStatus() {
    setBusy(true);
    try {
      await updateSchool(school.id, { status: active ? 'inactive' : 'active' });
      toast({ title: t('schools.saved'), tone: 'success' });
      setConfirming(false);
      onChanged();
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, tone: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  const gps = school.gps ? `${school.gps.lat}, ${school.gps.lng}` : t('common.none');

  return (
    <div className="page-grid">
      <Card>
        <CardHeader>
          <div className="row-between">
            <CardTitle>{t('common.details')}</CardTitle>
            {can('school:write') && (
              <div className="row-between">
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/schools/${school.id}/edit`}>{t('common.edit')}</Link>
                </Button>
                <Button
                  variant={active ? 'ghost' : 'secondary'}
                  size="sm"
                  onClick={() => (active ? setConfirming(true) : toggleStatus())}
                >
                  {active ? t('schools.deactivate') : t('schools.activate')}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <dl className="detail-list">
            <Detail label={t('schools.type')} value={t(`schoolTypes.${school.type}`)} />
            <Detail label={t('schools.region')} value={t(`regions.${school.region}`)} />
            <Detail label={t('schools.county')} value={school.county} />
            <Detail label={t('schools.subCounty')} value={school.subCounty} />
            <Detail label={t('schools.ward')} value={school.ward} />
            <Detail label={t('schools.gps')} value={gps} />
            <Detail label={t('schools.contactName')} value={school.contactName} />
            <Detail label={t('schools.contactPhone')} value={school.contactPhone} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('schools.clubsHere')}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataState
            loading={clubs.loading}
            error={clubs.error}
            isEmpty={clubs.data?.data.length === 0}
            emptyTitle={t('schools.noClubs')}
            onRetry={clubs.reload}
          >
            <Table compact>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('clubs.code')}</TableHead>
                  <TableHead>{t('clubs.name')}</TableHead>
                  <TableHead>{t('clubs.track')}</TableHead>
                  <TableHead>{t('clubs.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clubs.data?.data.map((club) => (
                  <TableRow key={club.id}>
                    <TableCell>{club.code}</TableCell>
                    <TableCell>
                      <TextLink asChild arrow={false}>
                        <Link to={`/clubs/${club.id}`}>{club.name}</Link>
                      </TextLink>
                    </TableCell>
                    <TableCell>{t(`tracks.${club.mainTrack}`)}</TableCell>
                    <TableCell>
                      <StatusBadge status={club.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataState>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirming}
        title={t('schools.deactivate')}
        confirmLabel={t('schools.deactivate')}
        busy={busy}
        onConfirm={toggleStatus}
        onClose={() => setConfirming(false)}
      >
        {t('schools.deactivateConfirm')}
      </ConfirmDialog>
    </div>
  );
}
