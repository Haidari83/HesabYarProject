
import './app-layout.css';

function AppLayout({ children }) {
  return (
    <div className="app-layout">

      {/* نوار بالایی برنامه */}
      <header className="app-layout__topbar">
        {/* TopBar component will be added here */}
        <span>محل قرارگیری Top Bar</span>
      </header>


      {/* بدنه اصلی برنامه */}
      <div className="app-layout__body">

        {/* منوی کناری */}
        <aside className="app-layout__sidebar">
          {/* Sidebar component will be added here */}
          <span>محل قرارگیری Sidebar</span>
        </aside>


        {/* فضای نمایش صفحات */}
        <main className="app-layout__main">
          {children}
        </main>

      </div>

    </div>
  );
}

export default AppLayout;
