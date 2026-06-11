import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Download,
  ZoomIn,
  CheckCircle,
  TrendingUp,
  Eye,
  Layers,
  ImageOff,
  Activity,
  Target,
} from 'lucide-react';
import * as Slider from '@radix-ui/react-slider';
import { toast } from 'sonner';
import {
  fetchLatest,
  LatestCapture,
  POLL_INTERVAL_MS,
} from '../lib/api';

export default function Results() {
  const [sliderValue, setSliderValue] = useState([50]);
  const [zoomLevel] = useState(100);
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
  const beforeSrc = latest?.original_url;
  const afterSrc = latest?.dehazed_url;

  const entropyHazy = latest?.entropy_hazy ?? 0;
  const entropyDehazed = latest?.entropy_dehazed ?? 0;
  const entropyGain = latest?.entropy_gain ?? 0;
  const ssim = latest?.ssim ?? 0;
  const mapScore = latest?.map ?? 0;

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
            <Layers className="w-8 h-8 text-blue-400" />
            <div>
              <p className="text-sm text-slate-400">Process Time</p>
              <p className="text-2xl font-bold text-blue-100">
                {hasData ? `${processingMs}ms` : '—'}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Image Comparison Slider (with corrected layer order) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Layers className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-semibold text-cyan-100">Image Comparison</h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-xl">
              <ZoomIn className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-300">{zoomLevel}%</span>
            </div>

            <button
              onClick={downloadImage}
              disabled={!hasData}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              View Enhanced
            </button>
          </div>
        </div>

        <div className="mb-4">
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-3 inline-flex items-center gap-4 flex-wrap">
            <div className="font-mono text-cyan-100 text-sm">
              {hasData ? `Captured at: ${captureTime}` : 'Waiting for capture...'}
            </div>
            <div className="text-sm text-slate-400">
              Temp: <span className="font-mono text-cyan-100">{hasData ? `${temp.toFixed(1)}°C` : '—'}</span>
            </div>
            <div className="text-sm text-slate-400">
              Humidity: <span className="font-mono text-cyan-100">{hasData ? `${humidity.toFixed(0)}%` : '—'}</span>
            </div>
          </div>
        </div>

        <div className="relative bg-slate-800 rounded-xl overflow-hidden aspect-video">
          {hasData && beforeSrc && afterSrc ? (
            <>
              {/* Bottom layer: ENHANCED (clear) */}
              <div className="absolute inset-0">
                <img src={afterSrc} alt="Enhanced clear" className="w-full h-full object-cover" />
              </div>

              {/* Top layer: ORIGINAL (foggy) clipped by slider */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${sliderValue[0]}%` }}
              >
                <img src={beforeSrc} alt="Original foggy" className="w-full h-full object-cover" />
              </div>

              <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/70 backdrop-blur-sm border border-red-500/50 rounded-lg">
                <span className="text-xs text-red-100 font-medium">ORIGINAL (FOGGY)</span>
              </div>
              <div className="absolute top-4 right-4 px-3 py-1.5 bg-black/70 backdrop-blur-sm border border-green-500/50 rounded-lg">
                <span className="text-xs text-green-100 font-medium">ENHANCED (CLEAR)</span>
              </div>

              <div
                className="absolute top-0 bottom-0 w-1 bg-white shadow-lg z-10"
                style={{ left: `${sliderValue[0]}%` }}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-xl flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-cyan-500 rounded-full" />
                </div>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500">
              <ImageOff className="w-16 h-16" />
              <p className="text-sm">{backendOnline ? 'Waiting for first capture from rover...' : 'Backend server is offline'}</p>
            </div>
          )}
        </div>

        <div className="mt-6 px-4">
          <Slider.Root
            className="relative flex items-center select-none touch-none w-full h-5"
            value={sliderValue}
            onValueChange={setSliderValue}
            max={100}
            step={1}
            disabled={!hasData}
          >
            <Slider.Track className="bg-slate-700 relative grow rounded-full h-2">
              <Slider.Range className="absolute bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full h-full" />
            </Slider.Track>
            <Slider.Thumb
              className="block w-6 h-6 bg-white shadow-lg rounded-full hover:bg-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              aria-label="Comparison slider"
            />
          </Slider.Root>
          <div className="flex justify-between mt-2 text-xs text-slate-400">
            <span>Original</span>
            <span>Enhanced</span>
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

          {/* NEW: Object Detection mAP — spans full width on desktop */}
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
              HOG-based person detection mAP, IoU ≥ 0.5. Dehazed detections used as proxy ground truth.
              0.0 may indicate no detectable people in either image.
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