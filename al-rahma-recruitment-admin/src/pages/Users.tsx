import { CheckCircle2, ShieldAlert, Trash2, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  AdminButton,
  AdminEmptyState,
  AdminField,
  AdminInput,
  AdminKeyValue,
  AdminPageIntro,
  AdminPanel,
  AdminSelect,
  AdminStatusBadge,
  AdminTable,
  AdminTextarea,
} from '../components/ui/admin-kit';
import { getRoleLabel, getUserSummary, useAdmin, type PlatformUser } from '../lib/admin-store';

const ROLE_FILTERS: Array<{ value: PlatformUser['role'] | 'all'; label: string }> = [
  { value: 'all', label: 'كل الأنواع' },
  { value: 'company', label: 'شركة' },
  { value: 'admin', label: 'إدارة' },
];

const STATUS_FILTERS: Array<{ value: PlatformUser['status'] | 'all'; label: string }> = [
  { value: 'all', label: 'كل الحالات' },
  { value: 'active', label: 'نشط' },
  { value: 'suspended', label: 'موقوف' },
  { value: 'banned', label: 'محظور' },
  { value: 'archived', label: 'مؤرشف' },
];

export default function Users() {
  const { state, updateUserStatus, updateUserRole, toggleUserVerified, softDeleteUser, restoreUser, addNote } = useAdmin();
  const [keyword, setKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | PlatformUser['role']>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | PlatformUser['status']>('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState('');

  const visibleUsers = useMemo(
    () =>
      state.users
        .filter((user) => ['company', 'admin'].includes(user.role))
        .filter((user) => !user.deletedAt || user.status === 'archived')
        .filter((user) => (roleFilter === 'all' ? true : user.role === roleFilter))
        .filter((user) => (statusFilter === 'all' ? true : user.status === statusFilter))
        .filter((user) =>
          `${user.displayName} ${user.email} ${user.phone} ${user.city} ${user.companyName}`
            .toLowerCase()
            .includes(keyword.trim().toLowerCase()),
        )
        .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()),
    [keyword, roleFilter, state.users, statusFilter],
  );

  useEffect(() => {
    if (!visibleUsers.length) {
      setSelectedUserId(null);
      return;
    }
    if (!selectedUserId || !visibleUsers.some((user) => user.id === selectedUserId)) {
      setSelectedUserId(visibleUsers[0].id);
    }
  }, [selectedUserId, visibleUsers]);

  const selectedUser = visibleUsers.find((user) => user.id === selectedUserId) || null;
  const metrics = useMemo(
    () => ({
      active: state.users.filter((user) => !user.deletedAt && ['company', 'admin'].includes(user.role) && user.status === 'active').length,
      companies: state.users.filter((user) => !user.deletedAt && user.role === 'company').length,
      admins: state.users.filter((user) => !user.deletedAt && user.role === 'admin').length,
      suspended: state.users.filter((user) => !user.deletedAt && ['company', 'admin'].includes(user.role) && user.status === 'suspended').length,
    }),
    [state.users],
  );

  return (
    <>
      <AdminPageIntro
        eyebrow="إدارة المستخدمين"
        title="حسابات المنصة"
        description="مراجعة حسابات الشركات والإدارة، مع التحكم في الحالة والتوثيق والأرشفة من شاشة واحدة."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminPanel className="p-0"><div className="p-5"><p className="text-sm font-semibold text-[#667784]">نشط</p><p className="mt-3 text-3xl font-black text-[#12293b]">{metrics.active}</p></div></AdminPanel>
        <AdminPanel className="p-0"><div className="p-5"><p className="text-sm font-semibold text-[#667784]">حسابات الشركات</p><p className="mt-3 text-3xl font-black text-[#12293b]">{metrics.companies}</p></div></AdminPanel>
        <AdminPanel className="p-0"><div className="p-5"><p className="text-sm font-semibold text-[#667784]">أدمن</p><p className="mt-3 text-3xl font-black text-[#12293b]">{metrics.admins}</p></div></AdminPanel>
        <AdminPanel className="p-0"><div className="p-5"><p className="text-sm font-semibold text-[#667784]">موقوف</p><p className="mt-3 text-3xl font-black text-[#12293b]">{metrics.suspended}</p></div></AdminPanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <AdminPanel title="ملخص سريع" description="أهم مؤشرات الحسابات داخل النظام.">
          <div className="grid gap-3">
            <AdminKeyValue label="الحسابات النشطة" value={metrics.active} />
            <AdminKeyValue label="حسابات الشركات" value={metrics.companies} />
            <AdminKeyValue label="حسابات الإدارة" value={metrics.admins} />
            <AdminKeyValue label="الحسابات الموقوفة" value={metrics.suspended} />
          </div>
        </AdminPanel>

        <div className="space-y-6">
          <AdminPanel>
            <div className="grid gap-3 md:grid-cols-3">
              <AdminField label="بحث">
                <AdminInput value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="ابحث بالاسم أو البريد..." />
              </AdminField>
              <AdminField label="النوع">
                <AdminSelect value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}>
                  {ROLE_FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </AdminSelect>
              </AdminField>
              <AdminField label="الحالة">
                <AdminSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                  {STATUS_FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </AdminSelect>
              </AdminField>
            </div>
          </AdminPanel>

          <AdminTable>
            <div className="overflow-x-auto">
              <table className="admin-table min-w-[980px]">
                <thead>
                  <tr>
                    <th>الاسم</th>
                    <th>النوع</th>
                    <th>البريد</th>
                    <th>المدينة</th>
                    <th>الحالة</th>
                    <th>التوثيق</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.length ? (
                    visibleUsers.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <button type="button" onClick={() => setSelectedUserId(user.id)} className="text-right">
                            <div className="font-bold text-[#173349]">{user.displayName}</div>
                            <div className="mt-1 text-xs text-[#7b8791]">{getUserSummary(user)}</div>
                          </button>
                        </td>
                        <td>{getRoleLabel(user.role)}</td>
                        <td>{user.email || 'بدون بريد'}</td>
                        <td>{user.city || 'غير محدد'}</td>
                        <td><AdminStatusBadge status={user.status} /></td>
                        <td>
                          <button type="button" onClick={() => toggleUserVerified(user.id)} className="inline-flex items-center gap-2 rounded-md bg-[#eef2f5] px-2.5 py-1 text-xs font-bold text-[#26445d]">
                            {user.verified ? <CheckCircle2 size={14} /> : <ShieldAlert size={14} />}
                            {user.verified ? 'موثق' : 'غير موثق'}
                          </button>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-2">
                            <AdminButton type="button" variant="secondary" className="h-8 px-3 text-xs" onClick={() => setSelectedUserId(user.id)}>التفاصيل</AdminButton>
                            <AdminButton type="button" variant="ghost" className="h-8 px-3 text-xs" onClick={() => updateUserStatus(user.id, 'active')}>تفعيل</AdminButton>
                            <AdminButton type="button" variant="ghost" className="h-8 px-3 text-xs" onClick={() => updateUserStatus(user.id, 'suspended')}>إيقاف</AdminButton>
                            <AdminButton type="button" variant={user.deletedAt ? 'secondary' : 'danger'} className="h-8 px-3 text-xs" onClick={() => (user.deletedAt ? restoreUser(user.id) : softDeleteUser(user.id))}>
                              <Trash2 size={14} />
                              {user.deletedAt ? 'استعادة' : 'أرشفة'}
                            </AdminButton>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={7}><AdminEmptyState title="لا توجد حسابات مطابقة" description="بدّل الفلاتر أو ابحث باسم مختلف." /></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </AdminTable>

          <AdminPanel title="تفاصيل الحساب" description="بيانات الحساب المختار مع الملاحظات والإجراءات السريعة.">
            {selectedUser ? (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-2xl font-black text-[#12293b]">{selectedUser.displayName}</h3>
                        <AdminStatusBadge status={selectedUser.status} />
                      </div>
                      <p className="mt-2 text-sm text-[#667784]">{getRoleLabel(selectedUser.role)} - {getUserSummary(selectedUser)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <AdminButton type="button" variant="secondary" onClick={() => toggleUserVerified(selectedUser.id)}>{selectedUser.verified ? 'إلغاء التوثيق' : 'توثيق'}</AdminButton>
                      <AdminButton type="button" variant="ghost" onClick={() => updateUserStatus(selectedUser.id, 'active')}>تفعيل</AdminButton>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <AdminKeyValue label="البريد" value={selectedUser.email || 'غير متاح'} />
                    <AdminKeyValue label="الهاتف" value={selectedUser.phone || 'غير متاح'} />
                    <AdminKeyValue label="آخر نشاط" value={new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(selectedUser.lastActivityAt))} />
                  </div>
                  <div className="rounded-2xl bg-[#f8fafb] px-4 py-4 text-sm leading-8 text-[#4d5f6d]">
                    {selectedUser.role === 'company'
                      ? selectedUser.companyName || 'لا يوجد اسم شركة مرتبط بهذا الحساب بعد.'
                      : selectedUser.city || 'هذا الحساب تابع لفريق الإدارة ولا يحتوي على ملف شركة.'}
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <AdminButton type="button" variant="secondary" onClick={() => updateUserRole(selectedUser.id, 'company')}>حساب شركة</AdminButton>
                    <AdminButton type="button" variant="ghost" onClick={() => updateUserRole(selectedUser.id, 'admin')}>حساب إدارة</AdminButton>
                    <AdminButton type="button" variant={selectedUser.deletedAt ? 'secondary' : 'danger'} onClick={() => (selectedUser.deletedAt ? restoreUser(selectedUser.id) : softDeleteUser(selectedUser.id))}>
                      {selectedUser.deletedAt ? 'استعادة' : 'أرشفة'}
                    </AdminButton>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="rounded-2xl bg-[#26445d] px-4 py-4 text-white">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/12"><UsersRound size={18} /></div>
                      <div>
                        <div className="text-sm font-black">{selectedUser.companyName || selectedUser.city || 'حساب إدارة'}</div>
                        <div className="text-xs text-white/75">بطاقة الحساب</div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-[#f8fafb] px-4 py-4">
                    <div className="mb-3 text-sm font-black text-[#173349]">ملاحظات داخلية</div>
                    <div className="space-y-3">
                      {selectedUser.notes.length ? selectedUser.notes.slice(0, 4).map((note) => (
                        <div key={note.id} className="rounded-xl bg-white px-3 py-3 text-sm text-[#4d5f6d] ring-1 ring-[#e2e7eb]">
                          <div className="font-semibold text-[#173349]">{note.authorName}</div>
                          <div className="mt-1 leading-7">{note.body}</div>
                        </div>
                      )) : <p className="text-sm text-[#7b8791]">لا توجد ملاحظات داخلية مضافة بعد.</p>}
                    </div>
                    <div className="mt-3 space-y-2">
                      <AdminTextarea value={noteBody} onChange={(event) => setNoteBody(event.target.value)} placeholder="أضف ملاحظة داخلية..." className="min-h-[96px]" />
                      <AdminButton type="button" variant="primary" className="w-full" onClick={() => {
                        if (!selectedUser || !noteBody.trim()) return;
                        addNote('users', selectedUser.id, noteBody);
                        setNoteBody('');
                      }}>حفظ الملاحظة</AdminButton>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <AdminEmptyState title="اختر حسابًا من الجدول" description="بعد تحديد الحساب ستظهر بياناته هنا مع كل الإجراءات المتاحة." />
            )}
          </AdminPanel>
        </div>
      </section>
    </>
  );
}
