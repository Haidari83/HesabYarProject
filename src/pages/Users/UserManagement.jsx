
import { useEffect, useMemo, useState } from 'react';
import './user-management.css';

// تبدیل تاریخ میلادی به تاریخ فارسی
function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('fa-Af', {
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

  // دریافت فهرست کاربران از Main Process
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

                  </tr>

                ))}
              </tbody>

            </table>

          </div>

        )}

      </section>

    </div>
  );
}

export default UserManagement;
