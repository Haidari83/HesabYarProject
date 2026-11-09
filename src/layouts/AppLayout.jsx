import { useState } from 'react';
import TopBar from '../components/navigation/TopBar';
import './app-layout.css';

function AppLayout({ children }) {

  // وضعیت باز یا بسته بودن منوی کناری
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // تغییر وضعیت منوی کناری
  function toggleSidebar() {
    setSidebarCollapsed((previousState) => !previousState);
  }

  return (
    <div className="app-layout">

      {/* نوار بالایی برنامه */}
      <TopBar
        onToggleSidebar={toggleSidebar}
        sidebarCollapsed={sidebarCollapsed}
      />


      {/* بدنه اصلی برنامه */}
      <div className="app-layout__body">

        {/* محل قرارگیری منوی کناری */}
        <aside
          className={`app-layout__sidebar ${sidebarCollapsed ? 'is-collapsed' : ''
            }`}
        >
          <span>
            {sidebarCollapsed ? 'منو' : 'محل قرارگیری Sidebar'}
          </span>
        </aside>


        {/* محل نمایش صفحات برنامه */}
        <main className="app-layout__main">
          {children}
        </main>

      </div>

    </div>
  );
}

export default AppLayout;
