import { useState } from 'react';
import './sidebar.css';

/* =========================
   آیکون‌های منوی کناری
========================= */

// آیکون داشبورد
function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="5" rx="2" />
      <rect x="13" y="10" width="8" height="11" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
    </svg>
  );
}

// آیکون محصولات و انبار
function PackageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="M3 8v9l9 5 9-5V8" />
      <path d="M12 13v9M7.5 5.5l9 5" />
    </svg>
  );
}

// آیکون فروش
function ShoppingCartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <circle cx="9" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2 3h2l3 13h12l3-10H5" />
    </svg>
  );
}

// آیکون خرید
function ShoppingBagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M5 8h14l1 13H4L5 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

// آیکون مشتریان و تأمین‌کنندگان
function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21v-2a7 7 0 0 1 14 0v2" />
      <path d="M17 5a4 4 0 0 1 0 7M19 15a6 6 0 0 1 3 5" />
    </svg>
  );
}

// آیکون بدهکاری و طلبکاری
function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <rect x="2" y="5" width="20" height="16" rx="3" />
      <path d="M2 9h20M16 15h2" />
      <path d="M5 5V3h14v2" />
    </svg>
  );
}

// آیکون گزارش‌ها
function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M3 3v18h18" />
      <rect x="7" y="11" width="3" height="6" rx="1" />
      <rect x="13" y="7" width="3" height="10" rx="1" />
      <rect x="19" y="4" width="3" height="13" rx="1" />
    </svg>
  );
}

// آیکون تنظیمات
function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.7-1.4-2.4 1.4-1.1a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.7 1.4 2.4-1.4 1.1a8 8 0 0 1 0 2Z" />
    </svg>
  );
}

// آیکون فلش زیرمنو
function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="m7 10 5 5 5-5" />
    </svg>
  );
}


/* =========================
   ارتباط شناسه آیکون‌ها با کامپوننت آن‌ها
========================= */

const iconComponents = {
  dashboard: DashboardIcon,
  package: PackageIcon,
  sales: ShoppingCartIcon,
  purchases: ShoppingBagIcon,
  contacts: UsersIcon,
  accounts: WalletIcon,
  reports: ChartIcon,
  settings: SettingsIcon
};

/* =========================
   کامپوننت منوی کناری
========================= */

function Sidebar({
  items = [],
  collapsed = false,
  mobileOpen = false,
  activeItem = 'dashboard',
  onSelect = () => { },
  onCloseMobile = () => { },
  onExpand = () => { }
}) {

  // نگهداری شناسه زیرمنوی باز
  const [expandedGroup, setExpandedGroup] = useState(null);


  // مدیریت کلیک روی بخش اصلی منو
  function handleItemClick(item) {

    // بررسی وجود زیرمنو
    if (item.children?.length) {

      // اگر منو جمع شده باشد، ابتدا آن را باز می‌کنیم
      if (collapsed) {
        onExpand();
        setExpandedGroup(item.id);
        return;
      }

      // باز یا بسته کردن زیرمنوی انتخاب‌شده
      setExpandedGroup((previousGroup) =>
        previousGroup === item.id ? null : item.id
      );

      return;
    }

    // انتخاب بخشی که زیرمنو ندارد
    onSelect({
      id: item.id,
      label: item.label
    });

    onCloseMobile();
  }


  // مدیریت انتخاب یکی از گزینه‌های زیرمنو
  function handleSubItemClick(item) {

    onSelect({
      id: item.id,
      label: item.label
    });

    onCloseMobile();
  }


  return (
    <aside
      className={[
        'sidebar',
        collapsed ? 'is-collapsed' : '',
        mobileOpen ? 'is-mobile-open' : ''
      ].filter(Boolean).join(' ')}

      aria-label="منوی اصلی برنامه"
    >

      {/* عنوان منوی کناری */}
      <div className="sidebar__header">

        <span className="sidebar__section-label">
          منوی اصلی
        </span>

      </div>


      {/* فهرست بخش‌های برنامه */}
      <nav className="sidebar__nav" aria-label="بخش‌های حساب‌یار">

        <ul className="sidebar__list">

          {items.map((item) => {

            const Icon = iconComponents[item.icon] || DashboardIcon;

            const hasChildren = Boolean(item.children?.length);

            const isExpanded = expandedGroup === item.id;

            const isActive =
              activeItem === item.id ||
              item.children?.some(
                (child) => child.id === activeItem
              );

            return (
              <li className="sidebar__list-item" key={item.id}>

                {/* دکمه بخش اصلی */}
                <button
                  type="button"
                  className={[
                    'sidebar__item',
                    isActive ? 'is-active' : ''
                  ].filter(Boolean).join(' ')}

                  onClick={() => handleItemClick(item)}

                  title={collapsed ? item.label : undefined}

                  aria-expanded={
                    hasChildren ? isExpanded : undefined
                  }

                  aria-controls={
                    hasChildren
                      ? `sidebar-submenu-${item.id}`
                      : undefined
                  }

                  aria-current={
                    activeItem === item.id ? 'page' : undefined
                  }
                >

                  {/* آیکون بخش */}
                  <span className="sidebar__item-icon">
                    <Icon />
                  </span>

                  {/* عنوان بخش */}
                  <span className="sidebar__item-label">
                    {item.label}
                  </span>

                  {/* فلش باز و بسته شدن زیرمنو */}
                  {hasChildren && (
                    <span
                      className={[
                        'sidebar__chevron',
                        isExpanded ? 'is-expanded' : ''
                      ].filter(Boolean).join(' ')}
                    >
                      <ChevronIcon />
                    </span>
                  )}

                </button>


                {/* گزینه‌های زیرمنو */}
                {hasChildren && isExpanded && !collapsed && (

                  <ul
                    className="sidebar__submenu"
                    id={`sidebar-submenu-${item.id}`}
                  >

                    {item.children.map((child) => (

                      <li key={child.id}>

                        <button
                          type="button"
                          className={[
                            'sidebar__subitem',
                            activeItem === child.id ? 'is-active' : ''
                          ].filter(Boolean).join(' ')}

                          onClick={() => handleSubItemClick(child)}

                          aria-current={
                            activeItem === child.id ? 'page' : undefined
                          }
                        >
                          {child.label}
                        </button>

                      </li>

                    ))}

                  </ul>

                )}

              </li>

            );
          })}

        </ul>

      </nav>

    </aside>
  );
}

export default Sidebar;
