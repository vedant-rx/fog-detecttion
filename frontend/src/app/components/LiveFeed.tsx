import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Radio, Wifi, MapPin, Gauge, Signal, Camera, Clock, ImageOff } from 'lucide-react';
import {
  fetchLatest,
  LatestCapture,
  POLL_INTERVAL_MS,
  secondsSince,
} from '../lib/api';

export default function LiveFeed() {
  const [signalStrength, setSignalStrength] = useState(85);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [latest, setLatest] = useState<LatestCapture | null>(null);
  const [backendOnline, setBackendOnline] = useState(true);

  // Poll backend for latest capture
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      const data = await fetchLatest();
      if (cancelled) return;
      if (data === null) {
        setBackendOnline(false);
      } else {
        setBackendOnline(true);
        setLatest(data);
      }
    };

    poll();
    const iv = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, []);

  // Clock + simulated signal strength
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      setSignalStrength(80 + Math.random() * 20);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const hasData = latest?.available ?? false;
  const temp = latest?.temperature_c ?? 0;
  const humidity = latest?.humidity_percent ?? 0;
  const fogDetected = latest?.fog_detected ?? false;
  const hazyUrl = latest?.original_url;
  const captureSecondsAgo = secondsSince(latest?.timestamp);

  // Fog density label/color logic
  const fogLabel = humidity > 95 ? 'High' : humidity >= 85 ? 'Medium' : 'Low';
  const fogGradient =
    fogLabel === 'High'
      ? 'linear-gradient(90deg,#fb923c,#ef4444)'
      : fogLabel === 'Medium'
      ? 'linear-gradient(90deg,#fb923c,#ef4444)'
      : 'linear-gradient(90deg,#facc15,#f59e0b)';
  const fogTextColor =
    fogLabel === 'High' ? 'text-orange-400' : fogLabel === 'Medium' ? 'text-orange-400' : 'text-yellow-400';

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-3xl font-bold text-cyan-100 mb-2">Live Rover Feed</h1>
          <p className="text-slate-400">Real-time camera streaming from Raspberry Pi</p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 border rounded-xl ${
          backendOnline ? 'bg-red-500/20 border-red-500/50' : 'bg-slate-700/30 border-slate-600/50'
        }`}>
          <div className={`w-3 h-3 rounded-full animate-pulse ${backendOnline ? 'bg-red-500' : 'bg-slate-500'}`} />
          <span className={`font-medium ${backendOnline ? 'text-red-100' : 'text-slate-300'}`}>
            {backendOnline ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Video Feed */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 space-y-4"
        >
          {/* Video Container */}
          <div className="relative bg-slate-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-2xl overflow-hidden group">
            <div className="aspect-video bg-slate-800 rounded-xl flex items-center justify-center relative overflow-hidden">
              {hasData && hazyUrl ? (
                <img src={hazyUrl} alt="Live rover feed" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-3 text-slate-500">
                  <ImageOff className="w-16 h-16" />
                  <p className="text-sm">{backendOnline ? 'Waiting for first capture from rover...' : 'Backend server is offline'}</p>
                </div>
              )}

              {/* Live overlay badges */}
              <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                <div className="px-3 py-1.5 bg-black/70 backdrop-blur-sm border border-red-500/50 rounded-lg flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-xs text-red-100 font-medium">REC</span>
                </div>
                <div className="px-3 py-1.5 bg-black/70 backdrop-blur-sm border border-cyan-500/30 rounded-lg">
                  <span className="text-xs text-cyan-100 font-mono">{currentTime.toLocaleTimeString()}</span>
                </div>
              </div>

              {/* Bottom overlay info */}
              <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                <div className="px-3 py-2 bg-black/70 backdrop-blur-sm border border-slate-700 rounded-lg">
                  <p className="text-xs text-slate-400">Resolution</p>
                  <p className="text-sm text-slate-200 font-medium">1920x1080</p>
                </div>
                <div className="px-3 py-2 bg-black/70 backdrop-blur-sm border border-slate-700 rounded-lg">
                  <p className="text-xs text-slate-400">Last Update</p>
                  <p className="text-sm text-slate-200 font-medium">
                    {hasData ? `${captureSecondsAgo}s ago` : '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Hover controls */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center justify-center gap-4">
                <button className="p-3 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 rounded-xl transition-colors">
                  <Camera className="w-5 h-5 text-cyan-400" />
                </button>
              </div>
            </div>
          </div>

          {/* Feed Controls */}
          <div className="grid grid-cols-3 gap-4">
            <button className="p-4 bg-slate-900/50 backdrop-blur-xl border border-slate-800 hover:border-cyan-500/50 rounded-xl transition-all group">
              <Camera className="w-6 h-6 text-slate-400 group-hover:text-cyan-400 mx-auto mb-2 transition-colors" />
              <p className="text-sm text-slate-400 group-hover:text-cyan-100 transition-colors">Capture Frame</p>
            </button>
            <button className="p-4 bg-slate-900/50 backdrop-blur-xl border border-slate-800 hover:border-cyan-500/50 rounded-xl transition-all group">
              <Radio className="w-6 h-6 text-slate-400 group-hover:text-cyan-400 mx-auto mb-2 transition-colors" />
              <p className="text-sm text-slate-400 group-hover:text-cyan-100 transition-colors">Start Recording</p>
            </button>
            <button className="p-4 bg-slate-900/50 backdrop-blur-xl border border-slate-800 hover:border-cyan-500/50 rounded-xl transition-all group">
              <Gauge className="w-6 h-6 text-slate-400 group-hover:text-cyan-400 mx-auto mb-2 transition-colors" />
              <p className="text-sm text-slate-400 group-hover:text-cyan-100 transition-colors">Quality Settings</p>
            </button>
          </div>
        </motion.div>

        {/* Sidebar Info */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          {/* Connection Status */}
          <div className={`bg-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border ${
            backendOnline ? 'border-green-500/30' : 'border-red-500/30'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 rounded-xl ${backendOnline ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                <Wifi className={`w-6 h-6 ${backendOnline ? 'text-green-400' : 'text-red-400'}`} />
              </div>
              <div>
                <h3 className={`font-semibold ${backendOnline ? 'text-green-100' : 'text-red-100'}`}>
                  {backendOnline ? 'Connected' : 'Backend Offline'}
                </h3>
                <p className="text-xs text-slate-400">Rover #RP4-001</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Signal Strength</span>
                <span className="text-sm text-green-400 font-medium">{signalStrength.toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${signalStrength}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>

              <div className="pt-3 border-t border-slate-800 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Latency</span>
                  <span className="text-cyan-100 font-medium">~30ms</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Last Capture</span>
                  <span className="text-cyan-100 font-medium">
                    {hasData ? `${captureSecondsAgo}s ago` : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* GPS Location (placeholder data — add real GPS later if needed) */}
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-cyan-500/20 rounded-xl">
                <MapPin className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h3 className="font-semibold text-cyan-100">Rover Location</h3>
                <p className="text-xs text-slate-400">Test deployment</p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Status</span>
                <span className="text-slate-200 font-mono">Stationary</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Mode</span>
                <span className="text-slate-200 font-mono">Auto-capture</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Interval</span>
                <span className="text-slate-200 font-mono">10 seconds</span>
              </div>
            </div>
          </div>

          {/* Environmental Conditions — REAL DHT22 data */}
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-purple-500/20 rounded-xl">
                <Signal className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-purple-100">Conditions</h3>
                <p className="text-xs text-slate-400">Live DHT22 sensor</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400">Fog Density</span>
                  <span className={`${fogTextColor} font-medium`}>
                    {hasData ? `${fogLabel} (${humidity.toFixed(0)}%)` : '—'}
                  </span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, Math.max(0, humidity))}%`,
                      background: fogGradient,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400">Fog Detected</span>
                  <span className={`font-medium ${fogDetected ? 'text-green-400' : 'text-slate-400'}`}>
                    {hasData ? (fogDetected ? 'Yes ✓' : 'No') : '—'}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-slate-400 mb-1">Temperature</p>
                  <p className="text-slate-200 font-medium">
                    {hasData ? `${temp.toFixed(1)}°C` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 mb-1">Humidity</p>
                  <p className="text-slate-200 font-medium">
                    {hasData ? `${humidity.toFixed(1)}%` : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Timestamp Info */}
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-slate-400" />
              <div className="flex-1">
                <p className="text-xs text-slate-400">Last Update</p>
                <p className="text-sm text-slate-200 font-mono">{currentTime.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}