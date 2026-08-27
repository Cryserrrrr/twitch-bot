import { useState } from "react";
import { Outlet } from "react-router-dom";

import { RealtimeProvider } from "../../context/RealtimeContext";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <RealtimeProvider>
      <div className="min-h-screen bg-canvas">
        <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

        <div className="lg:pl-64">
          <Topbar onOpenMenu={() => setMenuOpen(true)} />
          <main className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </RealtimeProvider>
  );
}
