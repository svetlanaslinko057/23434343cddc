import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/App';
import { ConnectionStatusBadge } from '@/components/ConnectionStatus';
import NotificationBell from '@/components/NotificationBell';
import ThemeToggle from '@/components/ThemeToggle';
import { 
  LayoutDashboard,
  Activity,
  Shield,
  FolderKanban,
  Users,
  FileText,
  LogOut,
  Settings,
  ShieldAlert,
  DollarSign,
  Clock,
  TrendingUp,
  Briefcase,
  Key
} from 'lucide-react';

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex" data-testid="admin-layout">
      {/* Sidebar */}
      <aside className="w-[240px] border-r border-border flex flex-col sticky top-0 h-screen bg-card">
        {/* Logo Section */}
        <div className="px-4 pt-6 pb-4">
          <div className="h-11 overflow-hidden flex items-center">
            <img src="/devos_logo.png" alt="DevOS" className="h-[140px] w-auto max-w-none" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">Command Center</p>
          <div className="mt-2 flex items-center gap-2">
            <ConnectionStatusBadge />
            <NotificationBell />
            <ThemeToggle />
          </div>
        </div>

        {/* Navigation - Clean Dev Workforce + Profit OS Structure */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {/* Command */}
          <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Command
          </div>
          <NavItem to="/admin/cockpit" icon={<Activity className="w-[18px] h-[18px]" />} label="Cockpit" />
          <NavItem to="/admin/control-center" icon={<Activity className="w-[18px] h-[18px]" />} label="Control Center" />
          
          {/* Projects & Work */}
          <div className="px-3 py-2 mt-4 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Projects & Work
          </div>
          <NavItem to="/admin/projects" icon={<FolderKanban className="w-[18px] h-[18px]" />} label="Projects" />
          <NavItem to="/admin/dashboard" icon={<LayoutDashboard className="w-[18px] h-[18px]" />} label="Workboard" />
          
          {/* Quality & Operations */}
          <div className="px-3 py-2 mt-4 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Quality & Operations
          </div>
          <NavItem to="/admin/qa" icon={<ShieldAlert className="w-[18px] h-[18px]" />} label="Quality Control" />
          <NavItem to="/admin/time-control" icon={<Clock className="w-[18px] h-[18px]" />} label="Time Control" />
          
          {/* Finance & Profit */}
          <div className="px-3 py-2 mt-4 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Finance & Profit
          </div>
          <NavItem to="/admin/earnings-control" icon={<DollarSign className="w-[18px] h-[18px]" />} label="Earnings Control" />
          <NavItem to="/admin/profit-control" icon={<TrendingUp className="w-[18px] h-[18px]" />} label="Profit Control" />
          
          {/* Team & System */}
          <div className="px-3 py-2 mt-4 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Team & System
          </div>
          <NavItem to="/admin/team" icon={<Users className="w-[18px] h-[18px]" />} label="Team" />
          <NavItem to="/admin/templates" icon={<FileText className="w-[18px] h-[18px]" />} label="Templates" />
          <NavItem to="/admin/integrations" icon={<Key className="w-[18px] h-[18px]" />} label="Integrations" />
          <NavItem to="/admin/settings" icon={<Settings className="w-[18px] h-[18px]" />} label="Settings" />
        </nav>

        {/* User */}
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500/30 to-orange-500/30 flex items-center justify-center font-semibold text-sm border border-white/10">
              {user?.name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || 'Admin'}</p>
              <p className="text-[11px] text-white/40 capitalize">Administrator</p>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white"
              data-testid="admin-logout-btn"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-screen overflow-auto bg-[#0B0F14]">
        <Outlet />
      </main>
    </div>
  );
};

const NavItem = ({ to, icon, label, badge }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
        isActive 
          ? 'bg-gradient-to-r from-red-500/20 to-orange-500/10 text-foreground border border-red-500/20' 
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      }`
    }
  >
    {icon}
    <span className="flex-1">{label}</span>
    {badge && (
      <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full">{badge}</span>
    )}
  </NavLink>
);

export default AdminLayout;
