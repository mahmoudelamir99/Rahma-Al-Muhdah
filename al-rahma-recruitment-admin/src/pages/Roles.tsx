import { Plus, ToggleLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  AdminButton,
  AdminEmptyState,
  AdminField,
  AdminInput,
  AdminKeyValue,
  AdminModal,
  AdminPageIntro,
  AdminPanel,
  AdminTextarea,
  AdminTable,
} from '../components/ui/admin-kit';
import { PERMISSION_CATALOG } from '../lib/admin-data';
import { getStatusLabel, humanDate, useAdmin } from '../lib/admin-store';

export default function Roles() {
  const { state, currentAdmin, createRole, hasPermission, toggleRolePermission, updateAdminRole, updateAdminStatus } = useAdmin();
  const [selectedRoleId, setSelectedRoleId] = useState(state.roles[0]?.id || 'super-admin');
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    if (state.roles.length && !state.roles.some((role) => role.id === selectedRoleId)) {
      setSelectedRoleId(state.roles[0].id);
    }
  }, [selectedRoleId, state.roles]);

  const selectedRole = useMemo(
    () => state.roles.find((role) => role.id === selectedRoleId) || state.roles[0],
    [selectedRoleId, state.roles],
  );

  const roleNameById = useMemo(() => new Map(state.roles.map((role) => [role.id, role.name])), [state.roles]);
  const roleMembers = useMemo(() => state.admins.filter((admin) => admin.roleId === selectedRole?.id), [selectedRole?.id, state.admins]);
  const canManageRoles = hasPermission('roles:manage') || hasPermission('access:manage');
  const canManageAdmins = hasPermission('admins:manage') || hasPermission('admins:cancel');
  const canInspectAdmins = hasPermission('admins:view_sensitive') || hasPermission('admins:view') || canManageAdmins;

  const roleMetrics = useMemo(
    () => ({
      roles: state.roles.length,
      admins: state.admins.filter((admin) => admin.status === 'active').length,
      locked: state.roles.filter((role) => role.locked).length,
      permissions: new Set(state.roles.flatMap((role) => role.permissions)).size,
    }),
    [state.admins, state.roles],
  );

  const handleCreateRole = () => {
    if (!canManageRoles || !roleName.trim()) return;
    createRole(roleName, roleDescription);
    setRoleName('');
    setRoleDescription('');
  };

  return (
    <>
      <AdminPageIntro
        eyebrow="الصلاحيات"
        title="الأدوار وصلاحيات الوصول"
        description="هنا نحدد من يملك عرض البيانات، من يملك التعديل، ومن يقدر يلغي أو يراجع حسابات الأدمن والمشرفين."
        actions={
          <AdminButton type="button" variant="primary" onClick={() => setIsCreateOpen(true)}>
            <Plus size={16} />
            إضافة دور
          </AdminButton>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminPanel className="p-0">
          <div className="p-5">
            <p className="text-sm font-semibold text-[#667784]">الأدوار</p>
            <p className="mt-3 text-3xl font-black text-[#12293b]">{roleMetrics.roles}</p>
          </div>
        </AdminPanel>
        <AdminPanel className="p-0">
          <div className="p-5">
            <p className="text-sm font-semibold text-[#667784]">الأدمن النشط</p>
            <p className="mt-3 text-3xl font-black text-[#12293b]">{roleMetrics.admins}</p>
          </div>
        </AdminPanel>
        <AdminPanel className="p-0">
          <div className="p-5">
            <p className="text-sm font-semibold text-[#667784]">الأدوار المقفلة</p>
            <p className="mt-3 text-3xl font-black text-[#12293b]">{roleMetrics.locked}</p>
          </div>
        </AdminPanel>
        <AdminPanel className="p-0">
          <div className="p-5">
            <p className="text-sm font-semibold text-[#667784]">الصلاحيات الفعالة</p>
            <p className="mt-3 text-3xl font-black text-[#12293b]">{roleMetrics.permissions}</p>
          </div>
        </AdminPanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <AdminPanel title="الأدوار الحالية" description="اختَر دورًا لعرض صلاحياته وأعضائه.">
          <div className="space-y-3">
            {state.roles.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => setSelectedRoleId(role.id)}
                className={`flex w-full items-start justify-between gap-3 rounded-xl px-4 py-4 text-right transition ${
                  selectedRoleId === role.id ? 'bg-[#eaf0f6]' : 'bg-[#f8fafb] hover:bg-[#eef2f5]'
                }`}
              >
                <div>
                  <div className="font-bold text-[#173349]">{role.name}</div>
                  <div className="mt-1 text-xs text-[#7b8791]">{role.description}</div>
                </div>
                <span className="rounded-md bg-white px-2 py-1 text-[11px] font-bold text-[#607280]">{role.permissions.length}</span>
              </button>
            ))}
          </div>
        </AdminPanel>

        <div className="space-y-6">
          <AdminPanel>
            <div className="grid gap-3 md:grid-cols-3">
              <AdminKeyValue label="الدور الحالي" value={selectedRole?.name || 'غير محدد'} />
              <AdminKeyValue label="عدد الصلاحيات" value={selectedRole?.permissions.length || 0} />
              <AdminKeyValue label="الأعضاء المرتبطون" value={roleMembers.length} />
            </div>
          </AdminPanel>

          <AdminTable>
            <div className="border-b border-[#edf2f5] px-5 py-4">
              <h3 className="text-lg font-bold text-[#12293b]">خريطة الصلاحيات</h3>
              <p className="text-sm text-[#667784]">اعمل تفعيل أو إلغاء لأي صلاحية من هنا، مع حماية الأدوار المقفلة.</p>
            </div>
            <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
              {PERMISSION_CATALOG.map((permission) => {
                const active = Boolean(selectedRole?.permissions.includes(permission.key));
                const disabled = !selectedRole || selectedRole.locked || !canManageRoles;

                return (
                  <button
                    key={permission.key}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (!selectedRole || selectedRole.locked || !canManageRoles) return;
                      toggleRolePermission(selectedRole.id, permission.key);
                    }}
                    className={`flex items-start gap-3 rounded-2xl border px-4 py-4 text-right transition ${
                      active ? 'border-[#26445d] bg-[#edf3f8]' : 'border-[#dfe4e8] bg-[#f8fafb] hover:bg-white'
                    } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    <span className={`mt-1 flex h-8 w-8 items-center justify-center rounded-full ${active ? 'bg-[#26445d] text-white' : 'bg-white text-[#26445d]'}`}>
                      <ToggleLeft size={14} />
                    </span>
                    <div>
                      <div className="text-sm font-bold text-[#173349]">{permission.label}</div>
                      <div className="mt-1 text-xs text-[#7b8791]">{permission.key}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </AdminTable>

          <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <AdminPanel
              title="حسابات الأدمن والمشرفين"
              description="تحديث الحالة أو تغيير الدور من نفس المكان، مع إظهار التفاصيل الكاملة للمخولين فقط."
            >
              {state.admins.length ? (
                <div className="space-y-3">
                  {state.admins.map((admin) => (
                    <div key={admin.id} className="rounded-2xl bg-[#f8fafb] px-4 py-4">
                      {admin.id === currentAdmin?.id ? (
                        <div className="mb-3 rounded-xl border border-[#dfe5ea] bg-white px-3 py-2 text-xs font-bold text-[#667784]">
                          الحساب الحالي محمي. يمكن تعديل الاسم والبريد وكلمة المرور فقط من صفحة حسابي.
                        </div>
                      ) : null}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-bold text-[#173349]">{admin.displayName}</div>
                          <div className="mt-1 text-xs text-[#7b8791]">
                            {getStatusLabel(admin.status)} - {roleNameById.get(admin.roleId) || admin.roleId}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <AdminButton
                            type="button"
                            variant="secondary"
                            className="h-8 px-3 text-xs"
                            disabled={!canManageAdmins || admin.id === currentAdmin?.id}
                            onClick={() => updateAdminStatus(admin.id, admin.status === 'active' ? 'suspended' : 'active')}
                          >
                            {admin.status === 'active' ? 'إلغاء' : 'تفعيل'}
                          </AdminButton>
                          <AdminButton
                            type="button"
                            variant="ghost"
                            className="h-8 px-3 text-xs"
                            disabled={!canManageAdmins || !selectedRole || admin.id === currentAdmin?.id}
                            onClick={() => selectedRole && updateAdminRole(admin.id, selectedRole.id)}
                          >
                            تعيين للدور الحالي
                          </AdminButton>
                        </div>
                      </div>

                      {canInspectAdmins ? (
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          <div className="rounded-xl bg-white px-3 py-2 text-xs text-[#52606d]">
                            <div className="font-bold text-[#173349]">آخر دخول</div>
                            <div className="mt-1">{admin.lastLoginAt ? humanDate(admin.lastLoginAt) : 'لم يسجل بعد'}</div>
                          </div>
                          <div className="rounded-xl bg-white px-3 py-2 text-xs text-[#52606d]">
                            <div className="font-bold text-[#173349]">تاريخ الإنشاء</div>
                            <div className="mt-1">{humanDate(admin.createdAt)}</div>
                          </div>
                          <div className="rounded-xl bg-white px-3 py-2 text-xs text-[#52606d] sm:col-span-2">
                            <div className="font-bold text-[#173349]">المعرف الداخلي</div>
                            <div className="mt-1 break-all">{admin.id}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-xl bg-[#fff7ed] px-3 py-2 text-xs text-[#92400e]">
                          التفاصيل الكاملة للحساب مخفية. فعّل صلاحية <span className="font-bold">admins:view_sensitive</span> لعرض بيانات الأدمن بالكامل.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <AdminEmptyState title="لا توجد حسابات أدمن" description="سيظهر هنا أول حساب إداري يتم إنشاؤه." />
              )}
            </AdminPanel>

            <AdminPanel title="دور جديد" description="أنشئ دورًا مخصصًا ثم عيّن له الصلاحيات التي يحتاجها.">
              <div className="space-y-4">
                <AdminField label="اسم الدور">
                  <AdminInput
                    value={roleName}
                    onChange={(event) => setRoleName(event.target.value)}
                    placeholder="مثال: مشرف التوظيف"
                  />
                </AdminField>
                <AdminField label="الوصف">
                  <AdminTextarea value={roleDescription} onChange={(event) => setRoleDescription(event.target.value)} rows={4} />
                </AdminField>
                <AdminButton type="button" variant="primary" className="w-full" onClick={handleCreateRole} disabled={!canManageRoles}>
                  حفظ الدور
                </AdminButton>
              </div>
            </AdminPanel>
          </section>
        </div>
      </section>

      <AdminModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="إضافة دور جديد"
        description="أنشئ دورًا جديدًا ثم اضبط صلاحياته من لوحة الأدوار."
        footer={
          <>
            <AdminButton type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>
              إلغاء
            </AdminButton>
            <AdminButton type="button" variant="primary" onClick={handleCreateRole} disabled={!canManageRoles}>
              حفظ
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          <AdminField label="اسم الدور">
            <AdminInput value={roleName} onChange={(event) => setRoleName(event.target.value)} placeholder="مثال: مشرف المحتوى" />
          </AdminField>
          <AdminField label="الوصف">
            <AdminTextarea value={roleDescription} onChange={(event) => setRoleDescription(event.target.value)} />
          </AdminField>
          {!canManageRoles ? (
            <div className="rounded-2xl bg-[#fff7ed] px-4 py-3 text-sm text-[#92400e]">
              أنت تحتاج صلاحية <span className="font-bold">roles:manage</span> أو <span className="font-bold">access:manage</span> لإضافة الأدوار.
            </div>
          ) : null}
        </div>
      </AdminModal>
    </>
  );
}
