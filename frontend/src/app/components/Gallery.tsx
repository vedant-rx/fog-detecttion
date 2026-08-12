import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FolderOpen, Play, CheckCircle, Loader2, AlertCircle,
  RefreshCw, ImageOff, Zap, ChevronRight, X, Wind,
  Layers, Sun,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../lib/api';

interface GalleryImage { filename: string; url: string; }
type ImageState = 'idle' | 'processing' | 'done' | 'error';
type DehazingMode = 'natural' | 'strong' | 'clahe';

interface ModeConfig {
  id: DehazingMode;
  label: string;
  description: string;
  tag: string;
  accent: string;          // Tailwind bg class for selection ring
  tagBg: string;           // badge background
  icon: React.ElementType;
}

const MODES: ModeConfig[] = [
  {
    id: 'natural',
    label: 'Natural',
    description: 'Mild DCP + colour fixes. Best for light-to-medium fog — preserves natural colours.',
    tag: 'Default',
    accent: 'ring-cyan-400',
    tagBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    icon: Wind,
  },
  {
    id: 'strong',
    label: 'Strong',
    description: 'Aggressive DCP. Push through dense fog but may over-sharpen bright areas.',
    tag: 'Dense fog',
    accent: 'ring-violet-400',
    tagBg: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
    icon: Layers,
  },
  {
    id: 'clahe',
    label: 'CLAHE',
    description: 'No DCP — pure contrast enhancement. Great for daytime thin haze without colour shifts.',
    tag: 'Daytime haze',
    accent: 'ring-amber-400',
    tagBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    icon: Sun,
  },
];

export default function Gallery() {
  const navigate = useNavigate();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageStates, setImageStates] = useState<Record<string, ImageState>>({});
  const [activeImage, setActiveImage] = useState<string | null>(null);

  // Modal state
  const [previewImg, setPreviewImg] = useState<GalleryImage | null>(null);
  const [selectedMode, setSelectedMode] = useState<DehazingMode>('natural');
  const [previews, setPreviews] = useState<Record<string, string>>({});   // { natural: url, strong: url, clahe: url }
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // ── Fetch gallery list ──────────────────────────────────────────────────────
  const fetchGallery = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/gallery`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setImages(data.images ?? []);
    } catch {
      setError('Could not connect to the backend. Make sure app.py is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGallery(); }, [fetchGallery]);

  // ── Fetch all-mode previews when modal opens ────────────────────────────────
  const openPreview = async (img: GalleryImage) => {
    setPreviewImg(img);
    setSelectedMode('natural');
    setPreviews({});
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/gallery/preview-all/${img.filename}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPreviews(data);
    } catch {
      setPreviewError('Could not generate mode previews. Check the backend console.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const closeModal = () => {
    setPreviewImg(null);
    setPreviews({});
    setPreviewError(null);
  };

  // ── Trigger processing ──────────────────────────────────────────────────────
  const processImage = async (img: GalleryImage, mode: DehazingMode) => {
    if (imageStates[img.filename] === 'processing') return;
    setImageStates(prev => ({ ...prev, [img.filename]: 'processing' }));
    setActiveImage(img.filename);
    closeModal();
    toast.info(`Queuing "${img.filename}" with mode "${mode}"…`);

    try {
      const res = await fetch(`${API_BASE_URL}/api/gallery/process/${img.filename}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temperature: 25.0, humidity: 95.0, mode }),
      });

      if (res.status === 202) {
        toast.warning('Backend busy — try again in a moment.');
        setImageStates(prev => ({ ...prev, [img.filename]: 'idle' }));
        setActiveImage(null);
        return;
      }
      if (!res.ok) throw new Error(`Server ${res.status}`);

      setImageStates(prev => ({ ...prev, [img.filename]: 'done' }));
      toast.success(`Processed! Redirecting to Results…`, { duration: 2500 });
      setTimeout(() => navigate('/dashboard/results'), 2200);
    } catch {
      setImageStates(prev => ({ ...prev, [img.filename]: 'error' }));
      setActiveImage(null);
      toast.error(`Failed to process "${img.filename}"`);
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const stateIcon = (state: ImageState) => {
    if (state === 'processing') return <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />;
    if (state === 'done')       return <CheckCircle className="w-4 h-4 text-green-400" />;
    if (state === 'error')      return <AlertCircle className="w-4 h-4 text-red-400" />;
    return null;
  };

  const stateBorder = (state: ImageState, isActive: boolean) => {
    if (isActive || state === 'processing') return 'border-cyan-400 shadow-lg shadow-cyan-500/40';
    if (state === 'done')  return 'border-green-500/60';
    if (state === 'error') return 'border-red-500/60';
    return 'border-slate-700/50 hover:border-cyan-500/50';
  };

  const activeModeConfig = MODES.find(m => m.id === selectedMode)!;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 space-y-6 min-h-screen">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-cyan-100 mb-1 flex items-center gap-3">
            <FolderOpen className="w-8 h-8 text-cyan-400" />
            Image Gallery
          </h1>
          <p className="text-slate-400">
            Click any image → preview all three dehazing modes → pick one → process.
          </p>
        </div>
        <button
          onClick={fetchGallery}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800/60 border border-slate-700 rounded-xl text-slate-300 hover:text-cyan-200 hover:border-cyan-500/50 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </motion.div>

      {/* ── Status bar ──────────────────────────────────────────────────────── */}
      {!loading && !error && images.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex items-center gap-3 px-4 py-2.5 bg-slate-900/50 border border-slate-800 rounded-xl text-sm text-slate-400"
        >
          <Zap className="w-4 h-4 text-cyan-400" />
          <span><span className="text-cyan-100 font-mono">{images.length}</span> images available</span>
          <span className="ml-auto text-xs hidden sm:block">
            3 modes — Natural · Strong · CLAHE — previewed before processing
          </span>
        </motion.div>
      )}

      {/* ── Loading skeleton ─────────────────────────────────────────────────── */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-video rounded-xl bg-slate-800/60 animate-pulse" />
          ))}
        </div>
      )}

      {/* ── Error state ──────────────────────────────────────────────────────── */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4 py-20 text-center"
        >
          <AlertCircle className="w-16 h-16 text-red-400" />
          <p className="text-red-300 font-medium">{error}</p>
          <button onClick={fetchGallery}
            className="px-6 py-2 bg-red-500/20 border border-red-500/40 rounded-xl text-red-200 hover:bg-red-500/30 transition">
            Retry
          </button>
        </motion.div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────────── */}
      {!loading && !error && images.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-20 text-center text-slate-500">
          <ImageOff className="w-16 h-16" />
          <p>No images found in the backend folder.</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODE-COMPARISON PREVIEW MODAL
      ═══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {previewImg && (
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0, y: 20 }}
              animate={{ scale: 1,    opacity: 1, y: 0  }}
              exit={{   scale: 0.88, opacity: 0, y: 20  }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl shadow-2xl shadow-black/60 overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                <div>
                  <p className="text-cyan-100 font-semibold text-lg">{previewImg.filename}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Pick a dehazing mode — the preview updates live so you can compare before committing.
                  </p>
                </div>
                <button onClick={closeModal}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 3-panel comparison strip */}
              <div className="grid grid-cols-4 gap-0 border-b border-slate-800">
                {/* Original */}
                <div className="relative border-r border-slate-800">
                  <div className="aspect-video bg-slate-950">
                    <img src={previewImg.url} alt="Original"
                      className="w-full h-full object-cover" />
                  </div>
                  <div className="px-3 py-1.5 bg-slate-900/80 text-center">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Original</span>
                  </div>
                </div>

                {/* Three mode panels */}
                {MODES.map(m => {
                  const isSelected = selectedMode === m.id;
                  const previewUrl = previews[m.id];
                  const MIcon = m.icon;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMode(m.id)}
                      className={`relative border-r border-slate-800 transition-all duration-200 text-left focus:outline-none ${
                        isSelected ? 'ring-2 ring-inset ' + m.accent : 'opacity-80 hover:opacity-100'
                      }`}
                    >
                      <div className="aspect-video bg-slate-950 relative">
                        {previewLoading && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                          </div>
                        )}
                        {previewError && !previewLoading && (
                          <div className="absolute inset-0 flex items-center justify-center px-2 text-center">
                            <span className="text-xs text-red-400">{previewError}</span>
                          </div>
                        )}
                        {previewUrl && !previewLoading && (
                          <img src={previewUrl} alt={m.label}
                            className="w-full h-full object-cover" />
                        )}
                        {/* Selected indicator */}
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5">
                            <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shadow">
                              <CheckCircle className="w-3.5 h-3.5 text-slate-900" />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className={`px-3 py-1.5 flex items-center justify-between gap-1 ${
                        isSelected ? 'bg-slate-800' : 'bg-slate-900/60'
                      }`}>
                        <div className="flex items-center gap-1.5">
                          <MIcon className="w-3.5 h-3.5 text-slate-300" />
                          <span className="text-xs font-semibold text-slate-200">{m.label}</span>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${m.tagBg}`}>
                          {m.tag}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Mode detail + Process button */}
              <div className="px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {/* Mode description */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`p-2 rounded-lg shrink-0 ${activeModeConfig.tagBg}`}>
                    <activeModeConfig.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-slate-200 font-semibold text-sm">
                      {activeModeConfig.label} mode selected
                    </p>
                    <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">
                      {activeModeConfig.description}
                    </p>
                  </div>
                </div>

                {/* Divider */}
                <div className="hidden sm:block w-px h-12 bg-slate-700 shrink-0" />

                {/* CTA */}
                <button
                  onClick={() => processImage(previewImg, selectedMode)}
                  disabled={previewLoading}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm transition-all shrink-0 ${
                    previewLoading
                      ? 'bg-slate-700 cursor-not-allowed opacity-50'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-lg hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-100'
                  }`}
                >
                  <Play className="w-4 h-4" />
                  Process with {activeModeConfig.label}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Image Grid ───────────────────────────────────────────────────────── */}
      {!loading && !error && images.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
        >
          {images.map((img, idx) => {
            const state = imageStates[img.filename] ?? 'idle';
            const isActive = activeImage === img.filename;
            return (
              <motion.div
                key={img.filename}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(idx * 0.04, 0.5) }}
                className={`relative group rounded-xl overflow-hidden border-2 cursor-pointer transition-all duration-200 ${stateBorder(state, isActive)}`}
                onClick={() => {
                  if (state === 'idle' || state === 'error') openPreview(img);
                }}
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-slate-800">
                  <img src={img.url} alt={img.filename} loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                </div>

                {/* Hover overlay */}
                {(state === 'idle' || state === 'error') && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-10 h-10 rounded-full bg-cyan-500/90 flex items-center justify-center shadow-lg shadow-cyan-500/50">
                        <Play className="w-5 h-5 text-white ml-0.5" />
                      </div>
                      <span className="text-xs text-white font-medium">Compare modes</span>
                    </div>
                  </div>
                )}

                {/* Processing overlay */}
                {state === 'processing' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                      <span className="text-xs text-cyan-300 font-medium">Processing…</span>
                    </div>
                  </div>
                )}

                {/* Done overlay */}
                {state === 'done' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-green-900/60">
                    <div className="flex flex-col items-center gap-1">
                      <CheckCircle className="w-8 h-8 text-green-400" />
                      <span className="text-xs text-green-200 font-medium">Done</span>
                    </div>
                  </div>
                )}

                {/* Label */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 flex items-center justify-between">
                  <span className="text-xs text-slate-200 truncate font-mono leading-tight">
                    {img.filename}
                  </span>
                  {stateIcon(state)}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
