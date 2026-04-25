import { useEffect, useState, useCallback } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import axios from "axios";
import { createContext, useContext } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";

// Toast & Realtime
import { ToastProvider } from "@/components/Toast";
import { ExecutorRealtimeBridge, TesterRealtimeBridge, ClientRealtimeBridge, AdminRealtimeBridge } from "@/components/RealtimeBridge";
import { ThemeProvider } from "@/contexts/ThemeContext";

// Pages
import LandingPage from "@/pages/LandingPage";
import ClientAuthPage from "@/pages/ClientAuthPage";
import BuilderAuthPage from "@/pages/BuilderAuthPage";
import AdminLoginPage from "@/pages/AdminLoginPage";
import ClientDashboard from "@/pages/ClientDashboard";
import DeveloperDashboard from "@/pages/DeveloperDashboard";
import TesterDashboard from "@/pages/TesterDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminCockpit from "@/pages/AdminCockpit";
import NewRequest from "@/pages/NewRequest";
import ProjectDetails from "@/pages/ProjectDetails";
import ScopeBuilder from "@/pages/ScopeBuilder";
import WorkUnitDetail from "@/pages/WorkUnitDetail";
import DeliverableBuilder from "@/pages/DeliverableBuilder";
import DeveloperWorkUnit from "@/pages/DeveloperWorkUnit";
import TesterValidation from "@/pages/TesterValidation";
import ClientDeliverable from "@/pages/ClientDeliverable";
import AdminDeliverableBuilder from "@/pages/AdminDeliverableBuilder";
import AdminIntegrationsPage from "@/pages/AdminIntegrationsPage";
import ClientDeliverablePage from "@/pages/ClientDeliverablePage";
import ClientVersionsPage from "@/pages/ClientVersionsPage";

// New Developer Workspace
import DeveloperLayout from "@/layouts/DeveloperLayout";
import DeveloperHub from "@/pages/DeveloperHub";
import DeveloperAssignments from "@/pages/DeveloperAssignments";
import DeveloperWorkPage from "@/pages/DeveloperWorkPage";
import DeveloperPerformance from "@/pages/DeveloperPerformance";
import ExecutorBoard from "@/pages/ExecutorBoard";

// New Tester Workspace
import TesterLayout from "@/layouts/TesterLayout";
import TesterHub from "@/pages/TesterHub";
import TesterValidationList from "@/pages/TesterValidationList";
import TesterValidationPage from "@/pages/TesterValidationPage";
import TesterIssues from "@/pages/TesterIssues";
import TesterPerformance from "@/pages/TesterPerformance";

// Admin Control Center
import AdminControlCenter from "@/pages/AdminControlCenter";
import AdminControlCenter2 from "@/pages/AdminControlCenter2";
import AdminProjectWarRoom from "@/pages/AdminProjectWarRoom";
import AdminDeveloperProfile from "@/pages/AdminDeveloperProfile";
import DeveloperMarketplace from "@/pages/DeveloperMarketplace";
import DeveloperLeaderboard from "@/pages/DeveloperLeaderboard";
import DeveloperProfileEnhanced from "@/pages/DeveloperProfileEnhanced";
import MasterAdminDashboard from "@/pages/MasterAdminDashboard";
import AdminLayout from "@/layouts/AdminLayout";
import AdminEarningsControl from "@/pages/AdminEarningsControl";
// ScopeBuilder already imported above

// Client Layout and Pages
import ClientLayout from "@/layouts/ClientLayout";
import ClientHub from "@/pages/ClientHub";
import ClientProjects from "@/pages/ClientProjects";
import ClientSupport from "@/pages/ClientSupport";
import ClientProjectPage from "@/pages/ClientProjectPage";
import ClientEstimatePage from "@/pages/ClientEstimatePage";

// Client OS (Operating Workspace)
import ClientDashboardOS from "@/pages/ClientDashboardOS";
import CreateModuleDominance from "@/pages/CreateModuleDominance";
import ModuleCreatedSuccess from "@/pages/ModuleCreatedSuccess";
import ClientProjectWorkspaceOS from "@/pages/ClientProjectWorkspaceOS";
import ClientBillingOS from "@/pages/ClientBillingOS";
import ClientContractPage from "@/pages/ClientContractPage";

// Growth / Referral
import ClientReferralPage from "@/pages/ClientReferralPage";
import DeveloperGrowthPage from "@/pages/DeveloperGrowthPage";
import ClientLeaderboardPage from "@/pages/ClientLeaderboardPage";
import ClientTransparency from "@/pages/ClientTransparency";

// Admin Financials
import AdminFinancialsPage from "@/pages/AdminFinancialsPage";

// Admin QA & Margin
import AdminQAPage from "@/pages/AdminQAPage";
import AdminMarginPage from "@/pages/AdminMarginPage";

// Developer Workspace & Client Cabinet (Production Operations)
import DeveloperWorkspace from "@/pages/DeveloperWorkspace";
import ClientCabinet from "@/pages/ClientCabinet";

// GPT Scope Builder
import GPTScopeBuilder from "@/pages/GPTScopeBuilder";

// Admin Templates (AI Matcher)
import AdminTemplatesPage from "@/pages/AdminTemplatesPage";

// Provider Marketplace
import ProviderInbox from "@/pages/ProviderInbox";
import ProviderAuth from "@/pages/ProviderAuth";

// Assignment Engine 2.0 + Team Panel
import AdminTeamPanel from "@/pages/AdminTeamPanel";
import DeveloperWorkspaceV2 from "@/pages/DeveloperWorkspaceV2";

// Acceptance Layer
import AcceptanceQueue from "@/pages/AcceptanceQueue";

// Time Control Panel (Step 2C)
import DeveloperTimeControl from "@/pages/DeveloperTimeControl";
import AdminTimeControl from "@/pages/AdminTimeControl";

// Earnings UI (Step 3D)
import DeveloperEarnings from "@/pages/DeveloperEarnings";

// Profit Intelligence (Step 4)
import AdminProfitControl from "@/pages/AdminProfitControl";
import AdminUnderpricedControl from "@/pages/AdminUnderpricedControl";

// ATLAS DevOS — Client layer pages (restored + new)
import ClientCosts from "@/pages/ClientCosts";
import ClientOperator from "@/pages/ClientOperator";
import ClientWorkspace from "@/pages/ClientWorkspace";
import DevWork from "@/pages/DevWork";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        withCredentials: true
      });
      setUser(response.data);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, 
      { email, password },
      { withCredentials: true }
    );
    setUser(response.data);
    return response.data;
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    } catch (error) {
      console.error("Logout error:", error);
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

// Protected Route
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/10 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    // Redirect to appropriate auth page based on path
    if (location.pathname.startsWith('/admin')) {
      return <Navigate to="/admin/login" state={{ from: location }} replace />;
    } else if (location.pathname.startsWith('/developer') || location.pathname.startsWith('/tester')) {
      return <Navigate to="/builder/auth" state={{ from: location }} replace />;
    } else {
      return <Navigate to="/client/auth" state={{ from: location }} replace />;
    }
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const dashboardRoutes = {
      client: '/client/dashboard',
      developer: '/developer/dashboard',
      tester: '/tester/dashboard',
      admin: '/admin/dashboard'
    };
    return <Navigate to={dashboardRoutes[user.role] || '/client/dashboard'} replace />;
  }

  return children;
};

function AppRouter() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      
      {/* Auth Routes - New Structure */}
      <Route path="/client/auth" element={<ClientAuthPage />} />
      <Route path="/builder/auth" element={<BuilderAuthPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      
      {/* Client Routes - New Layout */}
      <Route 
        path="/client" 
        element={
          <ProtectedRoute allowedRoles={['client', 'admin']}>
            <ClientLayout />
          </ProtectedRoute>
        }
      >
        {/* CLIENT OS - New Operating Workspace */}
        <Route path="dashboard-os" element={<ClientDashboardOS />} />
        <Route path="create-module-dominance" element={<CreateModuleDominance />} />
        <Route path="project-workspace/:projectId" element={<ClientProjectWorkspaceOS />} />
        <Route path="billing-os" element={<ClientBillingOS />} />
        <Route path="contract/:projectId" element={<ClientContractPage />} />
        
        {/* LEGACY Client Routes */}
        <Route path="dashboard" element={<ClientHub />} />
        <Route path="projects" element={<ClientProjects />} />
        <Route path="projects/:projectId" element={<ProjectDetails />} />
        <Route path="project/:projectId" element={<ClientProjectPage />} />
        <Route path="cabinet/:projectId" element={<ClientCabinet />} />
        <Route path="deliverables" element={<ClientHub />} />
        <Route path="deliverable/:deliverableId" element={<ClientDeliverablePage />} />
        <Route path="support" element={<ClientSupport />} />
        <Route path="request/new" element={<NewRequest />} />
        <Route path="project/:projectId/versions" element={<ClientVersionsPage />} />
        <Route path="estimate" element={<ClientEstimatePage />} />
        <Route path="referrals" element={<ClientReferralPage />} />
        <Route path="leaderboard" element={<ClientLeaderboardPage />} />
        <Route path="transparency" element={<ClientTransparency />} />
        {/* ATLAS DevOS — Client layer */}
        <Route path="costs" element={<ClientCosts />} />
        <Route path="operator" element={<ClientOperator />} />
        <Route path="project/:projectId/workspace" element={<ClientWorkspace />} />
        <Route index element={<Navigate to="/client/dashboard" replace />} />
      </Route>
      
      {/* Developer Routes - New Economy System */}
      <Route 
        path="/developer" 
        element={
          <ProtectedRoute allowedRoles={['developer', 'admin']}>
            <DeveloperLayout />
          </ProtectedRoute>
        }
      >
        {/* NEW SYSTEM (Economy-first) */}
        <Route path="dashboard" element={<DeveloperDashboard />} />
        <Route path="marketplace" element={<DeveloperMarketplace />} />
        <Route path="workspace" element={<DeveloperWorkspace />} />
        <Route path="earnings" element={<DeveloperEarnings />} />
        <Route path="profile" element={<DeveloperProfileEnhanced />} />
        <Route path="leaderboard" element={<DeveloperLeaderboard />} />
        
        {/* LEGACY (fallback only) */}
        <Route path="workspace-v2" element={<DeveloperWorkspaceV2 />} />
        <Route path="acceptance-queue" element={<AcceptanceQueue />} />
        <Route path="time-control" element={<DeveloperTimeControl />} />
        <Route path="board" element={<ExecutorBoard />} />
        <Route path="assignments" element={<DeveloperAssignments />} />
        <Route path="work/:unitId" element={<DeveloperWorkPage />} />
        <Route path="performance" element={<DeveloperPerformance />} />
        <Route path="network" element={<DeveloperGrowthPage />} />
        
        {/* Redirect */}
        <Route index element={<Navigate to="/developer/dashboard" replace />} />
      </Route>
      
      {/* Tester Routes - New Layout */}
      <Route 
        path="/tester" 
        element={
          <ProtectedRoute allowedRoles={['tester', 'admin']}>
            <TesterLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<TesterHub />} />
        <Route path="validation" element={<TesterValidationList />} />
        <Route path="validation/:validationId" element={<TesterValidationPage />} />
        <Route path="issues" element={<TesterIssues />} />
        <Route path="performance" element={<TesterPerformance />} />
        <Route index element={<Navigate to="/tester/dashboard" replace />} />
      </Route>
      
      {/* Admin Routes - Unified Layout */}
      <Route 
        path="/admin" 
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="control-center" element={<AdminControlCenter2 />} />
        <Route path="cockpit" element={<AdminCockpit />} />
        <Route path="project/:projectId/war-room" element={<AdminProjectWarRoom />} />
        <Route path="dev/:developerId" element={<AdminDeveloperProfile />} />


        <Route path="control-center-legacy" element={<AdminControlCenter />} />
        <Route path="master" element={<MasterAdminDashboard />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="requests" element={<AdminDashboard />} />
        <Route path="projects" element={<AdminDashboard />} />
        <Route path="review" element={<AdminDashboard />} />
        <Route path="validation" element={<AdminDashboard />} />
        <Route path="users" element={<AdminDashboard />} />
        <Route path="templates" element={<AdminTemplatesPage />} />
        <Route path="integrations" element={<AdminIntegrationsPage />} />
        <Route path="settings" element={<AdminIntegrationsPage />} />
        <Route path="project/:projectId/scope" element={<ScopeBuilder />} />
        <Route path="scope-builder/:requestId" element={<ScopeBuilder />} />
        <Route path="work-unit/:unitId" element={<WorkUnitDetail />} />
        <Route path="deliverable/:projectId" element={<DeliverableBuilder />} />
        <Route path="deliverable-builder/:projectId" element={<AdminDeliverableBuilder />} />
        <Route path="project/:projectId/financials" element={<AdminFinancialsPage />} />
        <Route path="qa" element={<AdminQAPage />} />
        <Route path="margin" element={<AdminMarginPage />} />
        <Route path="team" element={<AdminTeamPanel />} />
        <Route path="time-control" element={<AdminTimeControl />} />
        <Route path="earnings-control" element={<AdminEarningsControl />} />
        <Route path="profit-control" element={<AdminProfitControl />} />
        <Route path="ai-scope/:requestId" element={<GPTScopeBuilder />} />
        <Route path="ai-scope" element={<GPTScopeBuilder />} />
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
      </Route>
      
      {/* Provider Marketplace Routes */}
      <Route 
        path="/provider/auth" 
        element={<ProviderAuth />} 
      />

      {/* ATLAS DevOS — Developer Work Hub (standalone) */}
      <Route
        path="/dev/work"
        element={
          <ProtectedRoute allowedRoles={['developer', 'admin']}>
            <DevWork />
          </ProtectedRoute>
        }
      />
      <Route
        path="/developer/work-hub"
        element={
          <ProtectedRoute allowedRoles={['developer', 'admin']}>
            <DevWork />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/provider/inbox" 
        element={<ProviderInbox />} 
      />
      <Route 
        path="/provider/job/:bookingId" 
        element={<ProviderInbox />} 
      />
      
      {/* Legacy redirects */}
      <Route path="/dashboard" element={<Navigate to="/client/dashboard" replace />} />
      <Route path="/developer/hub" element={<Navigate to="/developer/dashboard" replace />} />
      <Route path="/tester/hub" element={<Navigate to="/tester/dashboard" replace />} />
        <Route path="marketplace" element={<DeveloperMarketplace />} />

      <Route path="/admin/work-board" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/request/new" element={<Navigate to="/client/request/new" replace />} />
      <Route path="/auth/client" element={<Navigate to="/client/auth" replace />} />
      <Route path="/auth/builder" element={<Navigate to="/builder/auth" replace />} />
      <Route path="/projects/:projectId" element={<Navigate to="/client/projects/:projectId" replace />} />
      
      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  // Real Google OAuth Client ID from env. `GoogleOAuthProvider` tolerates
  // an empty string at build time (the GoogleLogin button just won't render),
  // so this is safe when the env var is missing in dev.
  const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID
    || "539552820560-pso3qndegrntp46oneml9nr33t7rpi9j.apps.googleusercontent.com";
  return (
    <div className="App">
      <GoogleOAuthProvider clientId={googleClientId}>
        <BrowserRouter basename={process.env.PUBLIC_URL || ""}>
          <ThemeProvider>
            <AuthProvider>
              <ToastProvider>
                <AppRouter />
              </ToastProvider>
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </GoogleOAuthProvider>
    </div>
  );
}

export default App;
