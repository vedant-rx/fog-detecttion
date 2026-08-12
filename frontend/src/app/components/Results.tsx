import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Download,
  CheckCircle,
  TrendingUp,
  Eye,
  ImageOff,
  Activity,
  Target,
  Car,
  ArrowRight,
  Scan,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchLatest,
  LatestCapture,
  POLL_INTERVAL_MS,
} from '../lib/api';

export default function Results() {
  const [latest, setLatest] = useState<LatestCapture | null>(null);
  const [backendOnline, setBackendOnline] = useState(true);

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

  const hasData = latest?.available ?? false;
  const temp = latest?.temperature_c ?? 0;
  const humidity = latest?.humidity_percent ?? 0;
  const processingMs = latest?.processing_time_ms ?? 0;
  const captureTime = latest?.timestamp ?? '';
  const beforeSrc           = latest?.original_url;
  const afterSrc            = latest?.dehazed_url;
  const annHazySrc          = latest?.annotated_hazy_url;
  const annDehazedSrc       = latest?.annotated_dehazed_url;

  const entropyHazy = latest?.entropy_hazy ?? 0;
  const entropyDehazed = latest?.entropy_dehazed ?? 0;
  const entropyGain = latest?.entropy_gain ?? 0;
  const ssim = latest?.ssim ?? 0;
  const mapScore = latest?.map ?? 0;
  const detectedHazy = latest?.detected_hazy ?? {};
  const detectedDehazed = latest?.detected_dehazed ?? {};

  // All classes seen across both images
  const allClasses = Array.from(
    new Set([...Object.keys(detectedHazy), ...Object.keys(detectedDehazed)])
  ).sort();

  // Colour scheme per object class
  const classColors: Record<string, { bg: string; text: string; border: string }> = {
    person:     { bg: 'bg-green-500/20',  text: 'text-green-300',  border: 'border-green-500/40' },
    car:        { bg: 'bg-blue-500/20',   text: 'text-blue-300',   border: 'border-blue-500/40' },
    truck:      { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/40' },
    bus:        { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/40' },
    motorcycle: { bg: 'bg-pink-500/20',   text: 'text-pink-300',   border: 'border-pink-500/40' },
    bicycle:    { bg: 'bg-cyan-500/20',   text: 'text-cyan-300',   border: 'border-cyan-500/40' },
  };
  const defaultColor = { bg: 'bg-slate-500/20', text: 'text-slate-300', border: 'border-slate-500/40' };

  const confidencePct = hasData ? Math.max(0, Math.min(100, ssim * 100)) : 0;
  const entropyGainPct = hasData ? Math.max(0, Math.min(100, (entropyGain / 2.0) * 100)) : 0;

  const downloadImage = () => {
    if (afterSrc) {
      window.open(afterSrc, '_blank');
      toast.success('Opening enhanced image...');
    } else {
      toast.error('No enhanced image available yet');
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-3xl font-bold text-cyan-100 mb-2">Enhancement Results</h1>
          <p className="text-slate-400">Compare original and enhanced rover images with quality metrics</p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 border rounded-xl ${
          backendOnline && hasData
            ? 'bg-green-500/20 border-green-500/50'
            : 'bg-slate-700/30 border-slate-600/50'
        }`}>
          <CheckCircle className={`w-5 h-5 ${backendOnline && hasData ? 'text-green-400' : 'text-slate-400'}`} />
          <span className={`font-medium ${backendOnline && hasData ? 'text-green-100' : 'text-slate-300'}`}>
            {backendOnline && hasData ? 'Live' : (backendOnline ? 'Waiting' : 'Offline')}
          </span>
        </div>
      </motion.div>

      {/* Stats Cards — 5 cards now (added mAP) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4"
      >
        <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-400" />
            <div>
              <p className="text-sm text-slate-400">SSIM</p>
              <p className="text-2xl font-bold text-green-100">
                {hasData ? ssim.toFixed(3) : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* NEW: mAP card */}
        <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Target className="w-8 h-8 text-yellow-400" />
            <div>
              <p className="text-sm text-slate-400">Detection mAP</p>
              <p className="text-2xl font-bold text-yellow-100">
                {hasData ? mapScore.toFixed(3) : '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Eye className="w-8 h-8 text-cyan-400" />
            <div>
              <p className="text-sm text-slate-400">Dehazed Entropy</p>
              <p className="text-2xl font-bold text-cyan-100">
                {hasData ? entropyDehazed.toFixed(3) : '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-purple-400" />
            <div>
              <p className="text-sm text-slate-400">Hazy Entropy</p>
              <p className="text-2xl font-bold text-purple-100">
                {hasData ? entropyHazy.toFixed(2) : '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Scan className="w-8 h-8 text-blue-400" />
            <div>
              <p className="text-sm text-slate-400">Process Time</p>
              <p className="text-2xl font-bold text-blue-100">
                {hasData ? `${processingMs}ms` : '—'}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Detection Side-by-Side View */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <Scan className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-semibold text-cyan-100">Detection View</h2>
            <span className="text-xs px-2 py-0.5 bg-cyan-500/20 border border-cyan-500/40 rounded-full text-cyan-300 font-medium">YOLOv8n</span>
          </div>
          <button
            onClick={downloadImage}
            disabled={!hasData}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Save Enhanced
          </button>
        </div>

        {/* Capture metadata bar */}
        {hasData && (
          <div className="mb-5 flex items-center gap-4 flex-wrap px-3 py-2.5 bg-slate-800/60 rounded-xl border border-slate-700/50 text-sm">
            <span className="font-mono text-cyan-100">{captureTime}</span>
            <span className="text-slate-400">Temp: <span className="text-cyan-100 font-mono">{temp.toFixed(1)}°C</span></span>
            <span className="text-slate-400">Humidity: <span className="text-cyan-100 font-mono">{humidity.toFixed(0)}%</span></span>
            <span className="text-slate-400">Processed in: <span className="text-cyan-100 font-mono">{processingMs}ms</span></span>
          </div>
        )}

        {/* Two-panel detection images */}
        <div className="grid md:grid-cols-2 gap-4">

          {/* --- Left: Original Foggy + detections --- */}
          <div className="relative rounded-xl overflow-hidden bg-slate-800 aspect-video group">
            {hasData && annHazySrc ? (
              <>
                <img
                  src={annHazySrc}
                  alt="Original foggy with detections"
                  className="w-full h-full object-cover"
                />
                {/* Label */}
                <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 bg-black/75 backdrop-blur-sm border border-red-500/50 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-xs text-red-100 font-semibold tracking-wide">ORIGINAL (FOGGY)</span>
                </div>
                {/* Detection count badge */}
                {Object.keys(detectedHazy).length > 0 && (
                  <div className="absolute bottom-3 left-3 flex gap-1.5 flex-wrap">
                    {Object.entries(detectedHazy).map(([cls, count]) => (
                      <span
                        key={cls}
                        className={`px-2 py-0.5 rounded-md text-xs font-bold border capitalize ${
                          (classColors[cls] ?? defaultColor).bg
                        } ${
                          (classColors[cls] ?? defaultColor).text
                        } ${
                          (classColors[cls] ?? defaultColor).border
                        }`}
                      >
                        {count}× {cls}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500">
                <ImageOff className="w-12 h-12" />
                <p className="text-sm">{backendOnline ? 'Waiting for capture...' : 'Backend offline'}</p>
              </div>
            )}
          </div>

          {/* --- Right: Dehazed + detections --- */}
          <div className="relative rounded-xl overflow-hidden bg-slate-800 aspect-video group">
            {hasData && annDehazedSrc ? (
              <>
                <img
                  src={annDehazedSrc}
                  alt="Dehazed with detections"
                  className="w-full h-full object-cover"
                />
                {/* Label */}
                <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 bg-black/75 backdrop-blur-sm border border-green-500/50 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-green-100 font-semibold tracking-wide">ENHANCED (CLEAR)</span>
                </div>
                {/* Detection count badge */}
                {Object.keys(detectedDehazed).length > 0 && (
                  <div className="absolute bottom-3 left-3 flex gap-1.5 flex-wrap">
                    {Object.entries(detectedDehazed).map(([cls, count]) => (
                      <span
                        key={cls}
                        className={`px-2 py-0.5 rounded-md text-xs font-bold border capitalize ${
                          (classColors[cls] ?? defaultColor).bg
                        } ${
                          (classColors[cls] ?? defaultColor).text
                        } ${
                          (classColors[cls] ?? defaultColor).border
                        }`}
                      >
                        {count}× {cls}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500">
                <ImageOff className="w-12 h-12" />
                <p className="text-sm">{backendOnline ? 'Processing...' : 'Backend offline'}</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Quality Metrics Panel — now FULL WIDTH (histogram removed). 5 bars including mAP. */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="w-6 h-6 text-cyan-400" />
          <h3 className="text-xl font-semibold text-cyan-100">Quality Metrics</h3>
        </div>

        <div className="grid md:grid-cols-2 gap-x-8 gap-y-5">
          {/* Image Entropy (Hazy) */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-slate-300">Image Entropy (Hazy)</span>
              <span className="text-sm font-bold text-orange-400">
                {hasData ? `${entropyHazy.toFixed(3)} / 8.0` : '—'}
              </span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-400 to-amber-500 rounded-full transition-all"
                style={{ width: hasData ? `${(entropyHazy / 8.0) * 100}%` : '0%' }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">Information content of the foggy input</p>
          </div>

          {/* Image Entropy (Dehazed) */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-slate-300">Image Entropy (Dehazed)</span>
              <span className="text-sm font-bold text-green-400">
                {hasData ? `${entropyDehazed.toFixed(3)} / 8.0` : '—'}
              </span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all"
                style={{ width: hasData ? `${(entropyDehazed / 8.0) * 100}%` : '0%' }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">Information content after CLAHE enhancement</p>
          </div>

          {/* Entropy Gain */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-slate-300">Entropy Gain</span>
              <span className={`text-sm font-bold ${entropyGain >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                {hasData ? `${entropyGain >= 0 ? '+' : ''}${entropyGain.toFixed(3)} bits` : '—'}
              </span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all"
                style={{ width: hasData ? `${entropyGainPct}%` : '0%' }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">Positive value = more visible detail recovered</p>
          </div>

          {/* SSIM */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-slate-300">Structural Similarity (SSIM)</span>
              <span className="text-sm font-bold text-purple-400">
                {hasData ? ssim.toFixed(3) : '—'}
              </span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-400 to-pink-500 rounded-full transition-all"
                style={{ width: hasData ? `${ssim * 100}%` : '0%' }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">How well image structure was preserved (1.0 = identical)</p>
          </div>

          {/* YOLOv8 mAP — spans full width */}
          <div className="md:col-span-2">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-slate-300">Object Detection mAP</span>
              <span className="text-sm font-bold text-yellow-400">
                {hasData ? mapScore.toFixed(3) : '—'}
              </span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full transition-all"
                style={{ width: hasData ? `${mapScore * 100}%` : '0%' }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              YOLOv8n multi-class mAP@0.5 — detects people, cars, trucks, buses, motorbikes.
              Dehazed detections used as proxy ground truth. Higher = fog degraded detection less.
            </p>
          </div>
        </div>

        {/* Confidence Score */}
        <div className="mt-6 p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400 mb-1">Pipeline Confidence Score</p>
              <p className="text-3xl font-bold text-green-400">
                {hasData ? `${confidencePct.toFixed(1)}%` : '—'}
              </p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-400" />
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Derived from SSIM &times; 100 — high values indicate structure preservation
          </p>
        </div>
        {/* Detected Objects Panel */}
        {hasData && allClasses.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-6 border-t border-slate-800 pt-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Car className="w-5 h-5 text-cyan-400" />
              <h4 className="text-sm font-semibold text-cyan-100">Detected Objects (YOLOv8n)</h4>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-3 gap-3 mb-2 text-xs text-slate-500 font-medium uppercase tracking-wider">
              <span>Class</span>
              <span className="text-center">Foggy Image</span>
              <span className="text-center">Dehazed Image</span>
            </div>

            <div className="space-y-2">
              {allClasses.map((cls) => {
                const hazyCount    = detectedHazy[cls] ?? 0;
                const dehazedCount = detectedDehazed[cls] ?? 0;
                const delta        = dehazedCount - hazyCount;
                const color        = classColors[cls] ?? defaultColor;

                return (
                  <div key={cls} className="grid grid-cols-3 gap-3 items-center">
                    {/* Class badge */}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${color.bg} ${color.text} ${color.border} capitalize w-fit`}>
                      {cls}
                    </span>

                    {/* Foggy count */}
                    <div className="text-center">
                      <span className={`text-lg font-bold ${
                        hazyCount === 0 ? 'text-slate-600' : 'text-slate-200'
                      }`}>{hazyCount}</span>
                    </div>

                    {/* Dehazed count + delta */}
                    <div className="flex items-center justify-center gap-2">
                      <span className={`text-lg font-bold ${
                        dehazedCount === 0 ? 'text-slate-600' : 'text-slate-200'
                      }`}>{dehazedCount}</span>
                      {delta !== 0 && (
                        <span className={`flex items-center gap-0.5 text-xs font-semibold ${
                          delta > 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          <ArrowRight className={`w-3 h-3 ${
                            delta > 0 ? 'rotate-[-45deg]' : 'rotate-[45deg]'
                          }`} />
                          {delta > 0 ? `+${delta}` : delta}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {allClasses.length === 0 && (
              <p className="text-sm text-slate-500 italic">
                No highway objects detected in either image.
              </p>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Download Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-2xl p-6"
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-cyan-500/20 rounded-2xl">
              <Download className="w-8 h-8 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-cyan-100 mb-1">Latest Enhanced Image</h3>
              <p className="text-sm text-slate-400">
                {hasData
                  ? `Processed in ${processingMs}ms • SSIM ${ssim.toFixed(3)} • mAP ${mapScore.toFixed(3)} • Dehazed entropy ${entropyDehazed.toFixed(3)}`
                  : 'Waiting for first capture...'}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={downloadImage}
              disabled={!hasData}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl font-medium hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              View Enhanced Image
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}