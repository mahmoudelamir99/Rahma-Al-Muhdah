import { motion } from 'framer-motion';
import { LoaderCircle, Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import {
  AdminBadge,
  AdminButton,
  AdminDrawer,
  AdminEmptyState,
  AdminField,
  AdminInput,
  AdminPageHeader,
  AdminPanel,
  AdminSelect,
  AdminTable,
} from '../components/ui/admin-kit';
import { cleanAdminText, formatDateTime } from '../lib/admin-dashboard';
import type { ApplicationRecord } from '../lib/admin-store';
import { useAdmin } from '../lib/admin-store';

type CandidateRow = {
  key: string;
  name: string;
  email: string;
  phone: string;
  applications: ApplicationRecord[];
  lastSubmittedAt: string;
};

function buildCandidateRows(applications: ApplicationRecord[]): CandidateRow[] {
  const map = new Map<string, CandidateRow>();

  applications.forEach((application) => {
    const email = String(application.applicantEmail || '').trim().toLowerCase();
    const phoneDigits = String(application.applicantPhone || '').replace(/\D+/g, '');
    const key = email ? `e:${email}` : phoneDigits ? `p:${phoneDigits}` : `id:${application.id}`;
    const submitted = application.submittedAt || '';
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        name: application.applicantName,
        email: application.applicantEmail,
        phone: application.applicantPhone,
        applications: [application],
        lastSubmittedAt: submitted,
      });
    } else {
      existing.applications.push(application);
      if (!existing.name && application.applicantName) existing.name = application.applicantName;
      if (!existing.email && application.applicantEmail) existing.email = application.applicantEmail;
      if (!existing.phone && application.applicantPhone) existing.phone = application.applicantPhone;
      if (submitted > existing.lastSubmittedAt) existing.lastSubmittedAt = submitted;
    }
  });

  return Array.from(map.values()).sort((a, b) => b.lastSubmittedAt.localeCompare(a.lastSubmittedAt));
}

export default function Candidates() {
  const {
    state,
    hasPermission,
    permanentDeleteCandidate,
    updateCandidateIdentity,
    createManualCandidateApplication,
  } = useAdmin();

  const canEdit = hasPermission('applications:update');
  const [keyword, setKeyword] = useState('');
  const deferredKeyword = useDeferredValue(keyword);
  const [selected, setSelected] = useState<CandidateRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [keywordConfirm, setKeywordConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const [editForm, setEditForm] = useState({
    applicantName: '',
    applicantEmail: '',
    applicantPhone: '',
    city: '',
    governorate: '',
  });

  const [addForm, setAddForm] = useState({
    jobId: '',
    applicantName: '',
    applicantEmail: '',
    applicantPhone: '',
    city: '',
    governorate: '',
  });

  const rows = useMemo(() => buildCandidateRows(state.applications), [state.applications]);

  const filtered = useMemo(() => {
    const q = cleanAdminText(deferredKeyword).trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      `${row.name} ${row.email} ${row.phone} ${row.applications.map((a) => `${a.jobTitle} ${a.companyName}`).join(' ')}`
        .toLowerCase()
        .includes(q),
    );
  }, [deferredKeyword, rows]);

  const openEdit = (row: CandidateRow) => {
    setSelected(row);
    setEditForm({
      applicantName: row.name,
      applicantEmail: row.email,
      applicantPhone: row.phone,
      city: row.applications[0]?.city || '',
      governorate: row.applications[0]?.governorate || '',
    });
    setEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selected || !canEdit) return;
    setBusy(true);
    updateCandidateIdentity(
      { email: selected.email, phone: selected.phone },
      {
        applicantName: editForm.applicantName.trim(),
        applicantEmail: editForm.applicantEmail.trim(),
        applicantPhone: editForm.applicantPhone.trim(),
        city: editForm.city.trim(),
        governorate: editForm.governorate.trim(),
      },
    );
    setToast({ tone: 'success', text: 'تم حفظ التعديلات على كل طلبات هذا المرشح.' });
    setBusy(false);
    setEditOpen(false);
    setSelected(null);
  };

  const handleDelete = async () => {
    if (!selected || !canEdit) return;
    setBusy(true);
    const result = await permanentDeleteCandidate({ email: selected.email, phone: selected.phone });
    setToast({ tone: result.ok ? 'success' : 'danger', text: result.message });
    setBusy(false);
    setDeleteOpen(false);
    setKeywordConfirm('');
    setSelected(null);
  };

  const handleAdd = () => {
    if (!canEdit) return;
    setBusy(true);
    const result = createManualCandidateApplication({
      jobId: addForm.jobId,
      applicantName: addForm.applicantName,
      applicantEmail: addForm.applicantEmail,
      applicantPhone: addForm.applicantPhone,
      city: addForm.city,
      governorate: addForm.governorate,
    });
    setToast({ tone: result.ok ? 'success' : 'danger', text: result.message });
    setBusy(false);
    if (result.ok) {
      setAddOpen(false);
      setAddForm({
        jobId: '',
        applicantName: '',
        applicantEmail: '',
        applicantPhone: '',
        city: '',
        governorate: '',
      });
    }
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="إدارة المرشحين"
        title="ملفات المتقدمين"
        description="تجميع الطلبات حسب هوية المرشح، مع تعديل البيانات المشتركة أو حذف كل طلباته نهائيًا من Firebase، وطلب حذف حساب Supabase عند ضبط دالة الخادم."
        actions={
          canEdit ? (
            <AdminButton type="button" variant="secondary" onClick={() => setAddOpen(true)}>
              <Plus size={16} />
              إضافة طلب يدوي
            </AdminButton>
          ) : null
        }
      />

      {toast ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-[1.35rem] border px-4 py-3 text-sm font-bold ${
            toast.tone === 'danger'
              ? 'border-red-200 bg-red-50 text-red-900'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900'
          }`}
        >
          {toast.text}
        </motion.div>
      ) : null}

      <AdminPanel title="بحث سريع" description="ابحث بالاسم، البريد، الهاتف، الوظيفة أو الشركة.">
        <AdminField label="كلمات البحث">
          <AdminInput
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="مثال: محاسب، القاهرة، اسم الشركة…"
          />
        </AdminField>
      </AdminPanel>

      <AdminTable>
        <div className="overflow-x-auto">
          <table className="admin-table min-w-[960px]">
            <thead>
              <tr>
                <th>المرشح</th>
                <th>التواصل</th>
                <th>عدد الطلبات</th>
                <th>آخر تقديم</th>
                <th>نبذة</th>
                {canEdit ? <th>إجراءات</th> : null}
              </tr>
            </thead>
            <tbody>
              {filtered.length ? (
                filtered.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef3ff] text-[#1a3359]">
                          <UserRound size={18} />
                        </span>
                        <div>
                          <div className="font-black text-[#10213d]">{cleanAdminText(row.name) || 'بدون اسم'}</div>
                          <div className="text-xs text-[#73849a]">
                            {row.applications[0]?.jobTitle ? cleanAdminText(row.applications[0].jobTitle) : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="text-sm font-semibold text-[#1f2f45]" dir="ltr">
                        {cleanAdminText(row.email) || '—'}
                      </div>
                      <div className="text-xs text-[#73849a]" dir="ltr">
                        {cleanAdminText(row.phone) || '—'}
                      </div>
                    </td>
                    <td>
                      <AdminBadge tone="info">{row.applications.length}</AdminBadge>
                    </td>
                    <td className="text-sm text-[#4d5f6d]">{formatDateTime(row.lastSubmittedAt)}</td>
                    <td className="max-w-[220px] text-xs leading-6 text-[#64748b]">
                      {cleanAdminText(
                        Array.from(new Set(row.applications.map((a) => `${a.jobTitle} @ ${a.companyName}`))).slice(0, 2).join(' • '),
                      )}
                    </td>
                    {canEdit ? (
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <AdminButton type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => openEdit(row)}>
                            <Pencil size={14} />
                            تعديل
                          </AdminButton>
                          <AdminButton
                            type="button"
                            variant="danger"
                            className="h-8 px-2 text-xs"
                            onClick={() => {
                              setSelected(row);
                              setDeleteOpen(true);
                            }}
                          >
                            <Trash2 size={14} />
                            حذف نهائي
                          </AdminButton>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={canEdit ? 6 : 5}>
                    <AdminEmptyState title="لا يوجد مرشحون مطابقون" description="جرّب كلمات أخرى أو راجع صفحة الطلبات." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminTable>

      <AdminDrawer
        open={editOpen}
        title="تعديل بيانات المرشح"
        description="التعديل ينطبق على كل طلبات التقديم المرتبطة بنفس البريد أو الهاتف."
        onClose={() => setEditOpen(false)}
      >
        <div className="grid gap-4">
          <AdminField label="الاسم الكامل">
            <AdminInput value={editForm.applicantName} onChange={(e) => setEditForm((c) => ({ ...c, applicantName: e.target.value }))} />
          </AdminField>
          <AdminField label="البريد">
            <AdminInput dir="ltr" value={editForm.applicantEmail} onChange={(e) => setEditForm((c) => ({ ...c, applicantEmail: e.target.value }))} />
          </AdminField>
          <AdminField label="الهاتف">
            <AdminInput dir="ltr" value={editForm.applicantPhone} onChange={(e) => setEditForm((c) => ({ ...c, applicantPhone: e.target.value }))} />
          </AdminField>
          <AdminField label="المحافظة">
            <AdminInput value={editForm.governorate} onChange={(e) => setEditForm((c) => ({ ...c, governorate: e.target.value }))} />
          </AdminField>
          <AdminField label="المدينة">
            <AdminInput value={editForm.city} onChange={(e) => setEditForm((c) => ({ ...c, city: e.target.value }))} />
          </AdminField>
          <AdminButton type="button" disabled={busy} onClick={handleSaveEdit}>
            {busy ? <LoaderCircle className="animate-spin" size={16} /> : null}
            حفظ التعديلات
          </AdminButton>
        </div>
      </AdminDrawer>

      <AdminDrawer
        open={addOpen}
        title="طلب تقديم يدوي"
        description="يُنشئ سجلًا جديدًا مرتبطًا بوظيفة منشورة. استخدمه للحالات الإدارية فقط."
        onClose={() => setAddOpen(false)}
      >
        <div className="grid gap-4">
          <AdminField label="الوظيفة" hint="من الوظائف المعتمدة حاليًا في النظام.">
            <AdminSelect value={addForm.jobId} onChange={(e) => setAddForm((c) => ({ ...c, jobId: e.target.value }))}>
              <option value="">— اختر —</option>
              {state.jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {cleanAdminText(job.title)} — {cleanAdminText(job.companyName)}
                </option>
              ))}
            </AdminSelect>
          </AdminField>
          <AdminField label="اسم المرشح">
            <AdminInput value={addForm.applicantName} onChange={(e) => setAddForm((c) => ({ ...c, applicantName: e.target.value }))} />
          </AdminField>
          <AdminField label="البريد">
            <AdminInput dir="ltr" value={addForm.applicantEmail} onChange={(e) => setAddForm((c) => ({ ...c, applicantEmail: e.target.value }))} />
          </AdminField>
          <AdminField label="الهاتف">
            <AdminInput dir="ltr" value={addForm.applicantPhone} onChange={(e) => setAddForm((c) => ({ ...c, applicantPhone: e.target.value }))} />
          </AdminField>
          <AdminField label="المحافظة">
            <AdminInput value={addForm.governorate} onChange={(e) => setAddForm((c) => ({ ...c, governorate: e.target.value }))} />
          </AdminField>
          <AdminField label="المدينة">
            <AdminInput value={addForm.city} onChange={(e) => setAddForm((c) => ({ ...c, city: e.target.value }))} />
          </AdminField>
          <AdminButton type="button" disabled={busy} onClick={handleAdd}>
            {busy ? <LoaderCircle className="animate-spin" size={16} /> : null}
            حفظ الطلب
          </AdminButton>
        </div>
      </AdminDrawer>

      <ConfirmDialog
        open={deleteOpen}
        title="حذف المرشح نهائيًا"
        description={`سيتم حذف ${selected?.applications.length || 0} طلب(ات) تقديم من Firebase. إن وُجد حساب Supabase بنفس البريد، ستُستدعى دالة الخادم عند ضبط VITE_SUPABASE_DELETE_CANDIDATE_URL.`}
        confirmLabel="تأكيد الحذف النهائي"
        keyword="حذف نهائي"
        keywordValue={keywordConfirm}
        onKeywordChange={setKeywordConfirm}
        onClose={() => {
          setDeleteOpen(false);
          setKeywordConfirm('');
        }}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
