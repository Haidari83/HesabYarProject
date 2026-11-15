
import { useEffect, useMemo, useState } from 'react';
import './user-management.css';

// وضعیت اولیه فرم ایجاد کاربر
const INITIAL_FORM = {
  displayName: '',
  username: '',
  password: '',
  confirmPassword: '',
  role: 'user',
  permissions: [],
};

// تبدیل تاریخ میلادی به تاریخ فارسی
function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('fa-AF', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

// نمایش نقش کاربر
function getRoleLabel(role) {
  return role === 'admin' ? 'مدیر سیستم' : 'کاربر عادی';
}

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // وضعیت فرم ایجاد کاربر
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // وضعیت پنجره ویرایش کاربر
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // کاربری که در حال ویرایش آن هستیم
  const [editingUser, setEditingUser] = useState(null);

  // شناسه کاربری که تغییر وضعیت آن در حال انجام است
  const [processingUserId, setProcessingUserId] = useState('');

  // خطای عملیات جدول کاربران
  const [tableActionError, setTableActionError] = useState('');

  const [form, setForm] = useState(INITIAL_FORM);
  const [permissionGroups, setPermissionGroups] = useState([]);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // دریافت فهرست کاربران
  useEffect(() => {
    let isActive = true;

    async function loadUsers() {
      try {
        setIsLoading(true);
        setError('');

        const getUsers = window.hesabyar?.users?.list;

        if (typeof getUsers !== 'function') {
          throw new Error(
            'سرویس دریافت فهرست کاربران در دسترس نیست.'
          );
        }

        const result = await getUsers();

        if (!Array.isArray(result)) {
          throw new Error(
            'اطلاعات دریافتی کاربران معتبر نیست.'
          );
        }

        if (isActive) {
          setUsers(result);
        }

      } catch (err) {
        if (isActive) {
          setError(
            err.message || 'دریافت فهرست کاربران ناموفق بود.'
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadUsers();

    return () => {
      isActive = false;
    };
  }, []);

  // دریافت فهرست دسترسی‌ها هنگام بازشدن فرم
  useEffect(() => {
    if (
      (!isCreateModalOpen && !isEditModalOpen) ||
      form.role !== 'user'
    ) {
      return;
    }

    let isActive = true;

    async function loadPermissions() {
      try {
        setIsLoadingPermissions(true);
        setCreateError('');

        const getCatalog =
          window.hesabyar?.users?.getPermissionCatalog;

        if (typeof getCatalog !== 'function') {
          throw new Error(
            'سرویس دریافت فهرست دسترسی‌ها در دسترس نیست.'
          );
        }

        const result = await getCatalog();

        if (!Array.isArray(result)) {
          throw new Error(
            'فهرست دسترسی‌ها معتبر نیست.'
          );
        }

        if (isActive) {
          setPermissionGroups(result);
        }

      } catch (err) {
        if (isActive) {
          setCreateError(
            err.message || 'دریافت دسترسی‌ها ناموفق بود.'
          );
        }
      } finally {
        if (isActive) {
          setIsLoadingPermissions(false);
        }
      }
    }

    loadPermissions();

    return () => {
      isActive = false;
    };
  }, [isCreateModalOpen, isEditModalOpen, form.role]);

  // محاسبه آمار کاربران
  const statistics = useMemo(() => ({
    total: users.length,
    active: users.filter((user) => user.isActive).length,
    inactive: users.filter((user) => !user.isActive).length,
    admins: users.filter((user) => user.role === 'admin').length,
  }), [users]);

  // جست‌وجو و فیلتر کاربران
  const filteredUsers = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !searchValue ||
        user.displayName.toLowerCase().includes(searchValue) ||
        user.username.toLowerCase().includes(searchValue);

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && user.isActive) ||
        (statusFilter === 'inactive' && !user.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [users, search, statusFilter]);

  // بازکردن فرم ایجاد کاربر
  function openCreateModal() {
    setForm(INITIAL_FORM);
    setEditingUser(null);

    setCreateError('');
    setSuccessMessage('');
    setTableActionError('');

    setIsEditModalOpen(false);
    setIsCreateModalOpen(true);
  }


  // بستن فرم ایجاد یا ویرایش
  function closeCreateModal() {
    if (isSubmitting) return;

    setIsCreateModalOpen(false);
    setIsEditModalOpen(false);

    setEditingUser(null);
    setForm(INITIAL_FORM);

    setCreateError('');
  }

  // بازکردن فرم ویرایش کاربر
  function openEditModal(user) {

    // نگهداری اطلاعات کاربر انتخاب‌شده
    setEditingUser(user);

    // انتقال اطلاعات فعلی کاربر به فرم
    setForm({
      displayName: user.displayName,
      username: user.username,
      password: '',
      confirmPassword: '',
      role: user.role,
      permissions:
        user.role === 'admin'
          ? []
          : [...user.permissions],
    });

    setCreateError('');
    setSuccessMessage('');
    setTableActionError('');

    setIsCreateModalOpen(false);
    setIsEditModalOpen(true);

  }

  // تغییر اطلاعات فرم
  function handleFormChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));

    setCreateError('');
  }

  // انتخاب یا لغو انتخاب یک دسترسی
  function togglePermission(permissionKey) {
    setForm((currentForm) => {
      const exists = currentForm.permissions.includes(permissionKey);

      return {
        ...currentForm,
        permissions: exists
          ? currentForm.permissions.filter(
            (key) => key !== permissionKey
          )
          : [...currentForm.permissions, permissionKey],
      };
    });

    setCreateError('');
  }

  // انتخاب تمام دسترسی‌های یک گروه
  function togglePermissionGroup(group) {
    const groupKeys = group.permissions.map(
      (permission) => permission.key
    );

    const allSelected = groupKeys.every((key) =>
      form.permissions.includes(key)
    );

    setForm((currentForm) => ({
      ...currentForm,
      permissions: allSelected
        ? currentForm.permissions.filter(
          (key) => !groupKeys.includes(key)
        )
        : [
          ...new Set([
            ...currentForm.permissions,
            ...groupKeys,
          ]),
        ],
    }));

    setCreateError('');
  }

  // تغییر نقش کاربر
  function handleRoleChange(event) {
    const role = event.target.value;

    setForm((currentForm) => ({
      ...currentForm,
      role,
      permissions: [],
    }));

    setCreateError('');
  }

  // ثبت کاربر جدید
  async function handleCreateUser(event) {
    event.preventDefault();

    setCreateError('');
    setSuccessMessage('');

    if (form.password !== form.confirmPassword) {
      setCreateError('گذرواژه و تکرار آن یکسان نیستند.');
      return;
    }

    if (form.password.length < 12) {
      setCreateError('گذرواژه باید حداقل ۱۲ نویسه داشته باشد.');
      return;
    }

    if (
      form.role === 'user' &&
      form.permissions.length === 0
    ) {
      setCreateError(
        'حداقل یک دسترسی برای کاربر عادی انتخاب کن.'
      );
      return;
    }

    try {
      setIsSubmitting(true);

      const createUser = window.hesabyar?.users?.create;

      if (typeof createUser !== 'function') {
        throw new Error(
          'سرویس ایجاد کاربر در دسترس نیست.'
        );
      }

      const newUser = await createUser({
        ...form,
        permissions:
          form.role === 'admin' ? [] : form.permissions,
      });

      if (!newUser?.id) {
        throw new Error(
          'پاسخ سرویس ایجاد کاربر معتبر نیست.'
        );
      }

      // افزودن کاربر جدید به ابتدای فهرست
      setUsers((currentUsers) => [
        newUser,
        ...currentUsers,
      ]);

      setIsCreateModalOpen(false);
      setForm(INITIAL_FORM);

      setSuccessMessage(
        `حساب کاربری «${newUser.displayName}» با موفقیت ایجاد شد.`
      );

    } catch (err) {
      setCreateError(
        err.message || 'ایجاد حساب کاربری ناموفق بود.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // ذخیره تغییرات اطلاعات کاربر
  async function handleUpdateUser(event) {
    event.preventDefault();

    setCreateError('');
    setSuccessMessage('');

    if (!editingUser) {
      setCreateError('کاربر انتخاب‌شده معتبر نیست.');
      return;
    }

    if (
      form.role === 'user' &&
      form.permissions.length === 0
    ) {
      setCreateError(
        'حداقل یک دسترسی برای کاربر عادی انتخاب کن.'
      );
      return;
    }

    try {
      setIsSubmitting(true);

      const updateUser = window.hesabyar?.users?.update;

      if (typeof updateUser !== 'function') {
        throw new Error(
          'سرویس ویرایش کاربر در دسترس نیست.'
        );
      }

      const updatedUser = await updateUser(
        editingUser.id,
        {
          displayName: form.displayName,
          role: form.role,
          permissions:
            form.role === 'admin' ? [] : form.permissions,
        }
      );

      if (!updatedUser?.id) {
        throw new Error(
          'پاسخ سرویس ویرایش کاربر معتبر نیست.'
        );
      }

      // جایگزینی اطلاعات قبلی با اطلاعات به‌روز
      setUsers((currentUsers) =>
        currentUsers.map((user) =>
          user.id === updatedUser.id
            ? updatedUser
            : user
        )
      );

      setIsEditModalOpen(false);
      setEditingUser(null);
      setForm(INITIAL_FORM);

      setSuccessMessage(
        `اطلاعات حساب «${updatedUser.displayName}» با موفقیت ویرایش شد.`
      );

    } catch (err) {
      setCreateError(
        err.message || 'ویرایش اطلاعات کاربر ناموفق بود.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // فعال یا غیرفعال کردن حساب کاربر
  async function handleSetUserActive(user) {

    const nextStatus = !user.isActive;

    const confirmationMessage = nextStatus
      ? `آیا می‌خواهی حساب «${user.displayName}» را فعال کنی؟`
      : `آیا می‌خواهی حساب «${user.displayName}» را غیرفعال کنی؟`;


    // دریافت تأیید از مدیر
    if (!window.confirm(confirmationMessage)) {
      return;
    }


    try {

      setProcessingUserId(user.id);
      setTableActionError('');
      setSuccessMessage('');


      const setActive = window.hesabyar?.users?.setActive;

      if (typeof setActive !== 'function') {
        throw new Error(
          'سرویس تغییر وضعیت حساب در دسترس نیست.'
        );
      }


      // ارسال درخواست به Main Process
      const updatedUser = await setActive(
        user.id,
        nextStatus
      );


      if (!updatedUser?.id) {
        throw new Error(
          'پاسخ سرویس تغییر وضعیت حساب معتبر نیست.'
        );
      }


      // به‌روزرسانی اطلاعات همان ردیف
      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === updatedUser.id
            ? updatedUser
            : currentUser
        )
      );


      setSuccessMessage(
        nextStatus
          ? `حساب «${user.displayName}» با موفقیت فعال شد.`
          : `حساب «${user.displayName}» با موفقیت غیرفعال شد.`
      );


    } catch (err) {

      setTableActionError(
        err.message || 'تغییر وضعیت حساب ناموفق بود.'
      );

    } finally {

      setProcessingUserId('');

    }

  }
  return (
    <div className="user-management">

      {/* آمار کاربران */}
      <section className="user-statistics">

        <article className="user-stat-card">
          <span>تعداد کل کاربران</span>
          <strong>{statistics.total.toLocaleString('fa-IR')}</strong>
        </article>

        <article className="user-stat-card">
          <span>کاربران فعال</span>
          <strong>{statistics.active.toLocaleString('fa-IR')}</strong>
        </article>

        <article className="user-stat-card">
          <span>کاربران غیرفعال</span>
          <strong>{statistics.inactive.toLocaleString('fa-IR')}</strong>
        </article>

        <article className="user-stat-card">
          <span>مدیران سیستم</span>
          <strong>{statistics.admins.toLocaleString('fa-IR')}</strong>
        </article>

      </section>


      {/* پیام موفقیت */}
      {successMessage && (
        <div className="user-success-message">
          {successMessage}
        </div>
      )}

      {/* خطای عملیات کاربران */}
      {tableActionError && (
        <div className="user-action-error">
          {tableActionError}
        </div>
      )}


      {/* ابزار جست‌وجو و فیلتر */}
      <section className="user-toolbar">

        <label className="user-search">
          <span aria-hidden="true">⌕</span>

          <input
            type="search"
            placeholder="جست‌وجو بر اساس نام یا نام کاربری..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="فیلتر وضعیت کاربران"
        >
          <option value="all">تمام کاربران</option>
          <option value="active">کاربران فعال</option>
          <option value="inactive">کاربران غیرفعال</option>
        </select>

        <button
          type="button"
          className="user-create-button"
          onClick={openCreateModal}
        >
          <span aria-hidden="true">+</span>
          ایجاد کاربر
        </button>

      </section>


      {/* جدول کاربران */}
      <section className="user-table-card">

        <header className="user-table-header">
          <div>
            <h2>فهرست کاربران</h2>
            <p>
              {filteredUsers.length.toLocaleString('fa-IR')} کاربر
              {' '}یافت شد
            </p>
          </div>
        </header>


        {isLoading ? (

          <div className="user-message">
            در حال دریافت اطلاعات کاربران...
          </div>

        ) : error ? (

          <div className="user-message user-error">
            <strong>دریافت اطلاعات ناموفق بود</strong>
            <p>{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
            >
              تلاش مجدد
            </button>
          </div>

        ) : filteredUsers.length === 0 ? (

          <div className="user-empty-state">
            <span aria-hidden="true">♙</span>

            <strong>
              {users.length === 0
                ? 'هنوز کاربری ثبت نشده است.'
                : 'کاربری با این مشخصات پیدا نشد.'}
            </strong>

            <p>
              {users.length === 0
                ? 'پس از ایجاد کاربران جدید، اطلاعات آن‌ها در این بخش نمایش داده می‌شود.'
                : 'عبارت جست‌وجو یا فیلتر وضعیت را تغییر بده.'}
            </p>
          </div>

        ) : (

          <div className="user-table-wrapper">

            <table className="user-table">

              <thead>
                <tr>
                  <th>عملیات</th>
                  <th>ردیف</th>
                  <th>نام و نام خانوادگی</th>
                  <th>نام کاربری</th>
                  <th>نقش</th>
                  <th>تعداد دسترسی‌ها</th>
                  <th>وضعیت</th>
                  <th>تاریخ ایجاد</th>
                  <th>آخرین ورود</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user, index) => (

                  <tr key={user.id}>

                    <td>{(index + 1).toLocaleString('fa-IR')}</td>

                    <td className="user-name">
                      {user.displayName}
                    </td>

                    <td className="user-username">
                      {user.username}
                    </td>

                    <td>
                      <span
                        className={`user-role ${user.role === 'admin' ? 'admin' : 'regular'
                          }`}
                      >
                        {getRoleLabel(user.role)}
                      </span>
                    </td>

                    <td>
                      {user.role === 'admin'
                        ? 'همه دسترسی‌ها'
                        : user.permissions.length.toLocaleString('fa-IR')}
                    </td>

                    <td>
                      <span
                        className={`user-status ${user.isActive ? 'active' : 'inactive'
                          }`}
                      >
                        {user.isActive ? 'فعال' : 'غیرفعال'}
                      </span>
                    </td>

                    <td>{formatDate(user.createdAt)}</td>

                    <td>{formatDate(user.lastLoginAt)}</td>

                    <td>

                      <div className="user-row-actions">

                        {/* دکمه ویرایش */}
                        <button
                          type="button"
                          className="user-edit-button"
                          onClick={() => openEditModal(user)}
                          disabled={Boolean(processingUserId) || isSubmitting}
                        >
                          ویرایش
                        </button>


                        {/* دکمه تغییر وضعیت */}
                        <button
                          type="button"
                          className={`user-toggle-button ${user.isActive ? 'deactivate' : 'activate'
                            }`}
                          onClick={() => handleSetUserActive(user)}
                          disabled={Boolean(processingUserId) || isSubmitting}
                        >
                          {processingUserId === user.id
                            ? 'در حال انجام...'
                            : user.isActive
                              ? 'غیرفعال‌سازی'
                              : 'فعال‌سازی'}
                        </button>

                      </div>

                    </td>

                  </tr>

                ))}
              </tbody>

            </table>

          </div>

        )}

      </section>


      {/* پنجره ایجاد یا ویرایش کاربر */}
      {(isCreateModalOpen || isEditModalOpen) && (

        <div className="user-modal-backdrop">

          <section
            className="user-create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-create-title"
          >

            <header className="user-modal-header">

              <div>
                <h2 id="user-create-title">
                  {isEditModalOpen
                    ? 'ویرایش حساب کاربری'
                    : 'ایجاد حساب کاربری'}
                </h2>

                <p>
                  {isEditModalOpen
                    ? 'اطلاعات حساب و سطح دسترسی کاربر را ویرایش کن.'
                    : 'اطلاعات حساب و سطح دسترسی کاربر جدید را تعیین کن.'}
                </p>
              </div>

              <button
                type="button"
                className="user-modal-close"
                onClick={closeCreateModal}
                disabled={isSubmitting}
                aria-label="بستن پنجره"
              >
                ×
              </button>

            </header>


            <form
              className="user-create-form"
              onSubmit={
                isEditModalOpen
                  ? handleUpdateUser
                  : handleCreateUser
              }
            >

              {/* اطلاعات پایه */}
              <div className="user-form-section">

                <h3>اطلاعات حساب</h3>

                <div className="user-form-grid">

                  <label className="user-form-field">
                    <span>نام و نام خانوادگی</span>
                    <input
                      type="text"
                      name="displayName"
                      value={form.displayName}
                      onChange={handleFormChange}
                      placeholder="مثلاً علی احمد حیدری"
                      minLength={2}
                      maxLength={80}
                      required
                    />
                  </label>

                  <label className="user-form-field">
                    <span>نام کاربری</span>
                    <input
                      type="text"
                      name="username"
                      value={form.username}
                      onChange={handleFormChange}
                      placeholder="مثلاً ali.ahmadi"
                      minLength={3}
                      maxLength={32}
                      autoComplete="off"
                      dir="ltr"
                      readOnly={isEditModalOpen}
                      required
                    />
                    <small>
                      فقط حروف انگلیسی کوچک، عدد، نقطه، خط تیره و زیرخط.
                    </small>
                  </label>

                  {!isEditModalOpen && (
                    <>
                      {/* فیلد گذرواژه اولیه */}
                      <label className="user-form-field">
                        <span>گذرواژه اولیه</span>
                        <input
                          type="password"
                          name="password"
                          value={form.password}
                          onChange={handleFormChange}
                          minLength={12}
                          maxLength={128}
                          autoComplete="new-password"
                          required
                        />
                        <small>حداقل ۱۲ نویسه.</small>
                      </label>

                      {/* فیلد تکرار گذرواژه */}
                      <label className="user-form-field">
                        <span>تکرار گذرواژه</span>
                        <input
                          type="password"
                          name="confirmPassword"
                          value={form.confirmPassword}
                          onChange={handleFormChange}
                          minLength={12}
                          maxLength={128}
                          autoComplete="new-password"
                          required
                        />
                      </label>
                    </>
                  )}

                </div>

              </div>


              {/* انتخاب نقش */}
              <div className="user-form-section">

                <h3>نقش کاربر</h3>

                <div className="user-role-options">

                  <label className={`user-role-option ${form.role === 'user' ? 'selected' : ''
                    }`}>
                    <input
                      type="radio"
                      name="role"
                      value="user"
                      checked={form.role === 'user'}
                      onChange={handleRoleChange}
                    />
                    <span>
                      <strong>کاربر عادی</strong>
                      <small>
                        دسترسی‌ها به‌صورت جداگانه تعیین می‌شوند.
                      </small>
                    </span>
                  </label>

                  <label className={`user-role-option ${form.role === 'admin' ? 'selected' : ''
                    }`}>
                    <input
                      type="radio"
                      name="role"
                      value="admin"
                      checked={form.role === 'admin'}
                      onChange={handleRoleChange}
                    />
                    <span>
                      <strong>مدیر سیستم</strong>
                      <small>
                        دسترسی کامل به تمام بخش‌های برنامه.
                      </small>
                    </span>
                  </label>

                </div>

              </div>


              {/* دسترسی‌ها */}
              {form.role === 'user' && (

                <div className="user-form-section">

                  <div className="user-permission-heading">
                    <div>
                      <h3>دسترسی‌های کاربر</h3>
                      <p>
                        دسترسی‌های موردنیاز این حساب را انتخاب کن.
                      </p>
                    </div>

                    <span>
                      {form.permissions.length.toLocaleString('fa-IR')}
                      {' '}دسترسی انتخاب‌شده
                    </span>
                  </div>


                  {isLoadingPermissions ? (

                    <div className="user-permission-loading">
                      در حال دریافت فهرست دسترسی‌ها...
                    </div>

                  ) : (

                    <div className="user-permission-groups">

                      {permissionGroups.map((group) => {

                        const groupKeys = group.permissions.map(
                          (permission) => permission.key
                        );

                        const allSelected = groupKeys.length > 0 &&
                          groupKeys.every((key) =>
                            form.permissions.includes(key)
                          );

                        return (
                          <section
                            className="user-permission-group"
                            key={group.id}
                          >

                            <header>
                              <strong>{group.label}</strong>

                              <button
                                type="button"
                                onClick={() =>
                                  togglePermissionGroup(group)
                                }
                              >
                                {allSelected
                                  ? 'لغو انتخاب همه'
                                  : 'انتخاب همه'}
                              </button>
                            </header>

                            <div className="user-permission-list">

                              {group.permissions.map((permission) => (

                                <label
                                  className="user-permission-item"
                                  key={permission.key}
                                >
                                  <input
                                    type="checkbox"
                                    checked={form.permissions.includes(
                                      permission.key
                                    )}
                                    onChange={() =>
                                      togglePermission(permission.key)
                                    }
                                  />

                                  <span>{permission.label}</span>
                                </label>

                              ))}

                            </div>

                          </section>
                        );
                      })}

                    </div>

                  )}

                </div>

              )}


              {form.role === 'admin' && (
                <div className="user-admin-notice">
                  این حساب به‌عنوان مدیر سیستم ایجاد می‌شود و تمام
                  دسترسی‌های برنامه را خواهد داشت.
                </div>
              )}


              {/* خطای فرم */}
              {createError && (
                <div className="user-form-error">
                  {createError}
                </div>
              )}


              {/* دکمه‌های فرم */}
              <footer className="user-form-footer">

                <button
                  type="button"
                  className="user-cancel-button"
                  onClick={closeCreateModal}
                  disabled={isSubmitting}
                >
                  انصراف
                </button>

                <button
                  type="submit"
                  className="user-submit-button"
                  disabled={
                    isSubmitting ||
                    (isLoadingPermissions && form.role === 'user')
                  }
                >
                  {isSubmitting
                    ? isEditModalOpen
                      ? 'در حال ذخیره تغییرات...'
                      : 'در حال ایجاد حساب...'
                    : isEditModalOpen
                      ? 'ذخیره تغییرات'
                      : 'ایجاد حساب کاربری'}
                </button>

              </footer>

            </form>

          </section>

        </div>

      )}

    </div>
  );
}

export default UserManagement;
