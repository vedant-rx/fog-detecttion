import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Thermometer, Droplet, CloudFog, Clock, ImageOff, Grid3X3 } from 'lucide-react';
import {
  fetchLatest,
  LatestCapture,
  POLL_INTERVAL_MS,
  secondsSince,
} from '../lib/api';

// ===========================================================================
// 3x3 Image Grid component
// Each cell shows exactly 1/9th of the image using CSS background tricks.
// background-size: 300% 300% makes each cell fill 1/3 of the full image.
// background-position then shifts to the correct tile.
// ===========================================================================
interface ImageGridProps {
  src: string;
  label: string;
  borderColor: string;    // e.g. "border-red-500/40"
  badgeBg: string;        // e.g. "bg-red-900/60"
  badgeBorder: string;    // e.g. "border-red-500/40"
  badgeText: string;      // e.g. "ORIGINAL (HAZY)"
  badgeTextColor: string; // e.g. "text-red-100"
  accentColor: string;    // e.g. "#ef4444" for grid lines
  processingMs?: number;
  animationKey: string;   // change this to re-trigger cell animation
}

function ImageGrid({
  src,
  label,
  borderColor,
  badgeBg,
  badgeBorder,
  badgeText,
  badgeTextColor,
  accentColor,
  processingMs,
  animationKey,
}: ImageGridProps) {
  return (
    <div>
      {/* Grid label row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Grid3X3 className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400 font-mono">3×3 TILE VIEW — {label}</span>
        </div>
        {processingMs !== undefined && (
          <span className="text-xs text-slate-500 font-mono">{processingMs}ms</span>
        )}
      </div>

      {/* 3×3 grid */}
      <div
        className={`grid gap-[3px] p-[3px] rounded-2xl border ${borderColor}`}
        style={{
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridTemplateRows: 'repeat(3, 1fr)',
          background: `${accentColor}22`,   // faint tinted background fills the gaps
        }}
      >
        <AnimatePresence mode="wait">
          {Array.from({ length: 9 }).map((_, i) => {
            const row = Math.floor(i / 3);
            const col = i % 3;
            // background-size 300%x300% means image is 3x size of cell
            // background-position shifts to show the correct 1/9th
            const bgPosX = `${col * 50}%`;
            const bgPosY = `${row * 50}%`;

            return (
              <motion.div
                key={`${animationKey}-${i}`}
                className="relative overflow-hidden"
                style={{
                  aspectRatio: '16/9',
                  backgroundImage: `url(${src})`,
                  backgroundSize: '300% 300%',
                  backgroundPosition: `${bgPosX} ${bgPosY}`,
                  backgroundRepeat: 'no-repeat',
                  // Round only the corner cells
                  borderRadius:
                    i === 0 ? '10px 0 0 0' :
                    i === 2 ? '0 10px 0 0' :
                    i === 6 ? '0 0 0 10px' :
                    i === 8 ? '0 0 10px 0' : '0',
                }}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  delay: i * 0.07,        // stagger — cells appear one by one
                  duration: 0.25,
                  ease: 'easeOut',
                }}
              >
                {/* Tile number badge — subtle bottom-right */}
                <div className="absolute bottom-1 right-1 text-[9px] font-mono text-white/40 leading-none">
                  T{i + 1}
                </div>

                {/* Processing flash overlay — sweeps across each cell after it appears */}
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: `${accentColor}30` }}
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ delay: i * 0.07 + 0.2, duration: 0.4 }}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Badge below the grid */}
      <div className={`mt-2 inline-flex items-center gap-2 px-3 py-1.5 ${badgeBg} backdrop-blur-sm border ${badgeBorder} rounded-lg`}>
        <span className={`text-xs font-medium ${badgeTextColor}`}>{badgeText}</span>
      </div>
    </div>
  );
}

// ===========================================================================
// Main UploadImage component
// ===========================================================================
export default function UploadImage() {
  const [latest, setLatest] = useState<LatestCapture | null>(null);
  const [tick, setTick] = useState(0);
  const [backendOnline, setBackendOnline] = useState(true);
  // animationKey changes whenever a new image arrives — re-triggers grid animation
  const [animationKey, setAnimationKey] = useState('init');
  const prevTimestamp = useRef<string | null>(null);

  // Poll backend every POLL_INTERVAL_MS
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
        // Re-trigger grid animation whenever a new image arrives
        if (data.timestamp && data.timestamp !== prevTimestamp.current) {
          prevTimestamp.current = data.timestamp;
          setAnimationKey(data.timestamp ?? String(Date.now()));
        }
      }
    };
    poll();
    const iv = setInterval(poll, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  // Tick every second so "X seconds ago" stays fresh
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const hasData = latest?.available ?? false;
  const temp = latest?.temperature_c ?? 0;
  const humidity = latest?.humidity_percent ?? 0;
  const fogDetected = latest?.fog_detected ?? false;
  const processingMs = latest?.processing_time_ms ?? 0;
  const secondsAgo = secondsSince(latest?.timestamp);
  const nextCaptureIn = Math.max(0, 10 - (secondsAgo % 10));
  const hazyUrl = latest?.original_url;
  const clearUrl = latest?.dehazed_url;
  const captureTime = latest?.timestamp ?? '';

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-cyan-100 mb-2">Captured Image</h1>
          <p className="text-slate-400">
            Rover images divided into 3×3 tiles — demonstrating CLAHE's localized adaptive processing
          </p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${
          backendOnline
            ? 'bg-green-500/20 border-green-500/50'
            : 'bg-red-500/20 border-red-500/50'
        }`}>
          <div className={`w-3 h-3 rounded-full animate-pulse ${backendOnline ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className={`font-medium ${backendOnline ? 'text-green-100' : 'text-red-100'}`}>
            {backendOnline ? 'CONNECTED' : 'OFFLINE'}
          </span>
        </div>
      </motion.div>

      {/* Timestamp bar */}
      {hasData && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 px-4 py-2 bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-xl w-fit"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-red-100 font-medium">LIVE</span>
          </div>
          <span className="text-xs text-slate-400 font-mono">{captureTime}</span>
          <span className="text-xs text-slate-500">{secondsAgo}s ago</span>
        </motion.div>
      )}

      {/* ================================================================ */}
      {/* TWO GRIDS SIDE BY SIDE                                           */}
      {/* ================================================================ */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* LEFT — Original (Hazy) grid */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-red-500/30 p-5"
        >
          <div className="flex items-center gap-3 mb-4">
            <Camera className="w-5 h-5 text-red-400" />
            <h2 className="text-lg font-bold text-red-100">Original (Hazy)</h2>
          </div>

          {hasData && hazyUrl ? (
            <ImageGrid
              src={hazyUrl}
              label="ORIGINAL"
              borderColor="border-red-500/30"
              badgeBg="bg-red-900/60"
              badgeBorder="border-red-500/40"
              badgeText="ORIGINAL (HAZY) — FROM ROVER"
              badgeTextColor="text-red-100"
              accentColor="#ef4444"
              animationKey={`hazy-${animationKey}`}
            />
          ) : (
            <div className="aspect-video rounded-2xl bg-slate-950 border border-red-500/10 flex flex-col items-center justify-center gap-3 text-slate-500">
              <ImageOff className="w-12 h-12" />
              <p className="text-sm">{backendOnline ? 'Waiting for first capture...' : 'Backend offline'}</p>
            </div>
          )}
        </motion.div>

        {/* RIGHT — Dehazed (Clear) grid */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-green-500/30 p-5"
        >
          <div className="flex items-center gap-3 mb-4">
            <Camera className="w-5 h-5 text-green-400" />
            <h2 className="text-lg font-bold text-green-100">Enhanced (Clear)</h2>
          </div>

          {hasData && clearUrl ? (
            <ImageGrid
              src={clearUrl}
              label="ENHANCED"
              borderColor="border-green-500/30"
              badgeBg="bg-green-900/60"
              badgeBorder="border-green-500/40"
              badgeText={`ENHANCED (CLAHE) — ${processingMs}ms`}
              badgeTextColor="text-green-100"
              accentColor="#22c55e"
              processingMs={processingMs}
              animationKey={`clear-${animationKey}`}
            />
          ) : (
            <div className="aspect-video rounded-2xl bg-slate-950 border border-green-500/10 flex flex-col items-center justify-center gap-3 text-slate-500">
              <ImageOff className="w-12 h-12" />
              <p className="text-sm">{backendOnline ? 'Waiting for first capture...' : 'Backend offline'}</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* ================================================================ */}
      {/* CLAHE TILE EXPLANATION CARD                                       */}
      {/* ================================================================ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-slate-900/50 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-5"
      >
        <div className="flex items-center gap-3 mb-3">
          <Grid3X3 className="w-5 h-5 text-cyan-400" />
          <h3 className="text-sm font-semibold text-cyan-100">Why 3×3 Tiles?</h3>
        </div>
        <p className="text-sm text-slate-400 leading-relaxed">
          CLAHE (Contrast Limited Adaptive Histogram Equalization) divides the image into
          localized tiles and applies independent histogram equalization to each region.
          This adaptive approach enhances visibility in foggy areas without over-amplifying
          noise in already-clear regions. The 3×3 visualization demonstrates this
          tile-based processing principle — each cell is enhanced based on its own
          local contrast distribution, not the global image histogram.
        </p>
      </motion.div>

      {/* ================================================================ */}
      {/* SENSOR DATA CARDS                                                 */}
      {/* ================================================================ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {/* Temperature */}
        <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-orange-500/30 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-500/20 rounded-xl">
              <Thermometer className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-orange-100">
                {hasData ? `${temp.toFixed(1)}°C` : '—'}
              </p>
              <p className="text-sm text-slate-400">Temperature</p>
              <p className="text-xs text-slate-500 mt-1">from DHT22 sensor</p>
            </div>
          </div>
        </div>

        {/* Humidity */}
        <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-blue-500/30 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <Droplet className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-blue-100">
                {hasData ? `${humidity.toFixed(1)}%` : '—'}
              </p>
              <p className="text-sm text-slate-400">Humidity</p>
            </div>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, Math.max(0, humidity))}%`,
                background: 'linear-gradient(90deg,#60a5fa,#06b6d4)',
              }}
            />
          </div>
        </div>

        {/* Fog Status */}
        <div className={`bg-slate-900/50 backdrop-blur-xl rounded-2xl p-4 border ${
          fogDetected ? 'border-green-500/30 bg-green-500/10' : 'border-slate-700'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${fogDetected ? 'bg-green-500/20' : 'bg-slate-800/20'}`}>
              <CloudFog className={`w-6 h-6 ${fogDetected ? 'text-green-400' : 'text-slate-400'}`} />
            </div>
            <div>
              <p className={`text-lg font-bold ${fogDetected ? 'text-green-100' : 'text-slate-300'}`}>
                {hasData ? (fogDetected ? 'Fog Detected ✓' : 'Clear Conditions') : '—'}
              </p>
              <p className="text-xs text-slate-400 mt-1">Humidity ≥ 90% threshold</p>
            </div>
          </div>
        </div>

        {/* Capture Countdown */}
        <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-800/30 rounded-xl">
              <Clock className="w-5 h-5 text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-400">
                Last: <span className="font-mono text-cyan-100">{hasData ? `${secondsAgo}s ago` : '—'}</span>
              </p>
              <p className="text-sm text-slate-400">
                Next: <span className="font-mono text-cyan-100">{hasData ? `${nextCaptureIn}s` : '—'}</span>
              </p>
              <div className="mt-2 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all"
                  style={{ width: hasData ? `${((10 - nextCaptureIn) / 10) * 100}%` : '0%' }}
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
