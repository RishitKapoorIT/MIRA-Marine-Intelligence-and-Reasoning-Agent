import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import WelcomePage from './components/welcome/WelcomePage.jsx';
import MapsPage from './components/maps/MapsPage.jsx';
import ChatPage from './components/chat/ChatPage.jsx';
import PfzExplorationPage from './components/pfz/PfzExplorationPage.jsx';
import HazardsPage from './components/hazards/HazardsPage.jsx';
import RoutePlanningPage from './components/route/RoutePlanningPage.jsx';
import OceanAnalyticsPage from './components/analytics/OceanAnalyticsPage.jsx';
import AuthorityDashboardPage from './components/dashboard/AuthorityDashboardPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Frame 01 — Welcome Screen */}
        <Route path="/" element={<WelcomePage />} />

        {/* Frame 02 — Marine Maps Shell */}
        <Route path="/maps" element={<MapsPage />} />

        {/* Frames 03, 04, 05 — Conversational Workspace, Agent Pipeline & Evidence */}
        <Route path="/chat" element={<ChatPage />} />

        {/* Frame 06 — PFZ Exploration */}
        <Route path="/pfz" element={<PfzExplorationPage />} />

        {/* Frame 07 — Safety & Hazards View */}
        <Route path="/hazards" element={<HazardsPage />} />

        {/* Frame 08 — Safe Route Planning */}
        <Route path="/route" element={<RoutePlanningPage />} />

        {/* Frame 09 — Ocean Analytics */}
        <Route path="/analytics" element={<OceanAnalyticsPage />} />

        {/* Frame 10 — Regional Authority Dashboard */}
        <Route path="/dashboard" element={<AuthorityDashboardPage />} />

        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
