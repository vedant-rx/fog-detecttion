import { Outlet, NavLink } from 'react-router-dom';
import { Home, Radio, Camera, Loader, Image, Info, CloudFog, Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';

const navItems = [
  { path: '/dashboard', label: 'Home', icon: Home, exact: true },
  { path: '/dashboard/live-feed', label: 'Live Feed', icon: Radio },
  { path: '/dashboard/upload', label: 'Captured Image', icon: Camera },
  { path: '/dashboard/processing', label: 'Processing', icon: Loader },
  { path: '/dashboard/results', label: 'Results', icon: Image },
  { path: '/dashboard/about', label: 'About Project', icon: Info },
];

export default function DashboardLayout() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex h-screen bg-slate-950">
      {/* Sidebar */}
      <aside className="w-72 bg-slate-900/50 backdrop-blur-xl border-r border-cyan-500/20 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="relative">
              <CloudFog className="w-10 h-10 text-cyan-400" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full animate-pulse" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-cyan-100">Fog Enhancement</h1>
              <p className="text-xs text-slate-400">AI Vision System</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/50 text-cyan-100 shadow-lg shadow-cyan-500/20'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Theme Toggle & System Status */}
        <div className="p-4 space-y-3 border-t border-slate-800">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors text-slate-300"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            <span className="font-medium">Toggle Theme</span>
          </button>

          <div className="p-4 bg-slate-800/30 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs text-slate-400">System Status</span>
            </div>
            <p className="text-sm text-green-400 font-medium">All Systems Operational</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
