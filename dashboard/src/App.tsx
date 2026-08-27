import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/layout/AppShell";
import { Spinner } from "./components/ui/Feedback";
import { useAuth } from "./context/AuthContext";
import { AuthCallback } from "./pages/AuthCallback";
import { ChatPage } from "./pages/ChatPage";
import { CommandsPage } from "./pages/CommandsPage";
import { IntegrationsPage } from "./pages/IntegrationsPage";
import { LoginPage } from "./pages/LoginPage";
import { LogsPage } from "./pages/LogsPage";
import { ModerationPage } from "./pages/ModerationPage";
import { OverlaysPage } from "./pages/OverlaysPage";
import { OverviewPage } from "./pages/OverviewPage";
import { RecurringPage } from "./pages/RecurringPage";
import { SettingsPage } from "./pages/SettingsPage";
import { StreamPage } from "./pages/StreamPage";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas">
        <Spinner />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={<AuthCallback />} />

      {!user ? (
        <>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </>
      ) : (
        <Route element={<AppShell />}>
          <Route index element={<OverviewPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="stream" element={<StreamPage />} />
          <Route path="commands" element={<CommandsPage />} />
          <Route path="moderation" element={<ModerationPage />} />
          <Route path="recurring" element={<RecurringPage />} />
          <Route path="integrations" element={<IntegrationsPage />} />
          <Route path="overlays" element={<OverlaysPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      )}
    </Routes>
  );
}
