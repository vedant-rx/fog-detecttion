import { motion } from 'motion/react';
import { Activity, Cpu, Wifi, TrendingUp, CloudFog, Zap } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Mock data for processing stats
const processingData = [
  { time: '00:00', clarity: 45, fogDensity: 85 },
  { time: '04:00', clarity: 52, fogDensity: 78 },
  { time: '08:00', clarity: 68, fogDensity: 62 },
  { time: '12:00', clarity: 89, fogDensity: 35 },
  { time: '16:00', clarity: 92, fogDensity: 28 },
  { time: '20:00', clarity: 78, fogDensity: 48 },
  { time: '24:00', clarity: 65, fogDensity: 65 },
];

export default function Home() {
  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-3xl font-bold text-cyan-100 mb-2">Dashboard Overview</h1>
          <p className="text-slate-400">Monitor your AI fog enhancement system in real-time</p>
        </div>
        <div className="px-6 py-3 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/50 rounded-xl">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm text-slate-300">Live: Highway 101</span>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {/* Stat Card 1 */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-2xl blur-xl opacity-50 group-hover:opacity-100 transition-opacity" />
          <div className="relative bg-slate-900/80 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-cyan-500/20 rounded-xl">
                <Activity className="w-6 h-6 text-cyan-400" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <div className="space-y-1">
              <p className="text-slate-400 text-sm">Images Processed</p>
              <p className="text-3xl font-bold text-cyan-100">1,247</p>
              <p className="text-xs text-green-400">+12.5% from yesterday</p>
            </div>
          </div>
        </div>

        {/* Stat Card 2 */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl blur-xl opacity-50 group-hover:opacity-100 transition-opacity" />
          <div className="relative bg-slate-900/80 backdrop-blur-xl border border-blue-500/30 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <Cpu className="w-6 h-6 text-blue-400 animate-pulse" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <div className="space-y-1">
              <p className="text-slate-400 text-sm">Avg Processing Time</p>
              <p className="text-3xl font-bold text-blue-100">1.8s</p>
              <p className="text-xs text-green-400">-0.3s improvement</p>
            </div>
          </div>
        </div>

        {/* Stat Card 3 */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl blur-xl opacity-50 group-hover:opacity-100 transition-opacity" />
          <div className="relative bg-slate-900/80 backdrop-blur-xl border border-purple-500/30 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-purple-500/20 rounded-xl">
                <CloudFog className="w-6 h-6 text-purple-400" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <div className="space-y-1">
              <p className="text-slate-400 text-sm">Clarity Score</p>
              <p className="text-3xl font-bold text-purple-100">94.2%</p>
              <p className="text-xs text-green-400">+8.7% average boost</p>
            </div>
          </div>
        </div>

        {/* Stat Card 4 */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-2xl blur-xl opacity-50 group-hover:opacity-100 transition-opacity" />
          <div className="relative bg-slate-900/80 backdrop-blur-xl border border-green-500/30 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-green-500/20 rounded-xl">
                <Wifi className="w-6 h-6 text-green-400" />
              </div>
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            </div>
            <div className="space-y-1">
              <p className="text-slate-400 text-sm">Rover Connection</p>
              <p className="text-3xl font-bold text-green-100">Strong</p>
              <p className="text-xs text-green-400">Signal: -45 dBm</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Charts Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid lg:grid-cols-2 gap-6"
      >
        {/* Processing Chart */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-cyan-100 mb-1">Image Clarity Trend</h3>
              <p className="text-sm text-slate-400">24-hour performance metrics</p>
            </div>
            <Zap className="w-6 h-6 text-cyan-400" />
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={processingData}>
              <defs>
                <linearGradient id="colorClarity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                }}
              />
              <Area
                type="monotone"
                dataKey="clarity"
                stroke="#06b6d4"
                fillOpacity={1}
                fill="url(#colorClarity)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* DCP Algorithm Status */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-cyan-100 mb-1">DCP Algorithm Status</h3>
              <p className="text-sm text-slate-400">Processing pipeline health</p>
            </div>
            <Cpu className="w-6 h-6 text-cyan-400 animate-pulse" />
          </div>

          <div className="space-y-4">
            {/* Pipeline Steps */}
            {[
              { name: 'Atmospheric Light Estimation', progress: 100, status: 'Complete' },
              { name: 'Dark Channel Extraction', progress: 100, status: 'Complete' },
              { name: 'Transmission Map', progress: 85, status: 'Processing' },
              { name: 'Image Recovery', progress: 45, status: 'In Queue' },
            ].map((step, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-300">{step.name}</span>
                  <span className={`font-medium ${
                    step.status === 'Complete' ? 'text-green-400' :
                    step.status === 'Processing' ? 'text-cyan-400' :
                    'text-slate-500'
                  }`}>
                    {step.status}
                  </span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      step.status === 'Complete' ? 'bg-green-400' :
                      step.status === 'Processing' ? 'bg-cyan-400 animate-pulse' :
                      'bg-slate-600'
                    }`}
                    style={{ width: `${step.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl flex items-center gap-3">
            <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse" />
            <div>
              <p className="text-sm text-cyan-100 font-medium">Active Processing</p>
              <p className="text-xs text-slate-400">Image #1248 - Highway 101 North</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* System Health Monitors */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid md:grid-cols-3 gap-6"
      >
        {/* CPU Usage */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6">
          <h3 className="text-sm text-slate-400 mb-4">CPU Usage</h3>
          <div className="flex items-end gap-2 mb-4">
            <span className="text-4xl font-bold text-cyan-400">42</span>
            <span className="text-slate-400 mb-2">%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full w-[42%] bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full" />
          </div>
        </div>

        {/* Memory Usage */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6">
          <h3 className="text-sm text-slate-400 mb-4">Memory Usage</h3>
          <div className="flex items-end gap-2 mb-4">
            <span className="text-4xl font-bold text-purple-400">6.8</span>
            <span className="text-slate-400 mb-2">GB</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full w-[68%] bg-gradient-to-r from-purple-400 to-pink-500 rounded-full" />
          </div>
        </div>

        {/* Network Latency */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6">
          <h3 className="text-sm text-slate-400 mb-4">Network Latency</h3>
          <div className="flex items-end gap-2 mb-4">
            <span className="text-4xl font-bold text-green-400">28</span>
            <span className="text-slate-400 mb-2">ms</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full w-[15%] bg-gradient-to-r from-green-400 to-emerald-500 rounded-full" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
