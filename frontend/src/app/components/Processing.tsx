import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Loader, CheckCircle, Cpu, Activity, Zap, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

type ProcessStep = {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'complete';
  progress: number;
  duration: string;
};

export default function Processing() {
  const navigate = useNavigate();
  const [overallProgress, setOverallProgress] = useState(0);
  const [steps, setSteps] = useState<ProcessStep[]>([
    {
      id: '1',
      name: 'Atmospheric Light Estimation',
      status: 'pending',
      progress: 0,
      duration: '0.3s',
    },
    {
      id: '2',
      name: 'Dark Channel Extraction',
      status: 'pending',
      progress: 0,
      duration: '0.5s',
    },
    {
      id: '3',
      name: 'Transmission Map Generation',
      status: 'pending',
      progress: 0,
      duration: '0.6s',
    },
    {
      id: '4',
      name: 'Image Recovery & Enhancement',
      status: 'pending',
      progress: 0,
      duration: '0.4s',
    },
  ]);
  const [logs, setLogs] = useState<string[]>([
    '[00:00.000] Initializing DCP algorithm...',
    '[00:00.125] Loading image data...',
    '[00:00.250] Image loaded successfully (1920x1080)',
  ]);

  useEffect(() => {
    // Simulate processing steps
    const processSteps = async () => {
      for (let i = 0; i < steps.length; i++) {
        // Update step to processing
        setSteps((prev) =>
          prev.map((step, idx) =>
            idx === i ? { ...step, status: 'processing' } : step
          )
        );

        const stepName = steps[i].name;
        setLogs((prev) => [...prev, `[00:0${i}.${i * 300}] Starting: ${stepName}...`]);

        // Simulate progress
        for (let progress = 0; progress <= 100; progress += 10) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          setSteps((prev) =>
            prev.map((step, idx) =>
              idx === i ? { ...step, progress } : step
            )
          );
          setOverallProgress(((i * 100 + progress) / steps.length));
        }

        // Mark as complete
        setSteps((prev) =>
          prev.map((step, idx) =>
            idx === i ? { ...step, status: 'complete', progress: 100 } : step
          )
        );
        setLogs((prev) => [...prev, `[00:0${i}.${(i + 1) * 300}] Completed: ${stepName}`]);
      }

      // Processing complete
      setLogs((prev) => [
        ...prev,
        '[00:01.800] Image enhancement complete!',
        '[00:01.825] Generating comparison data...',
        '[00:01.900] All processing finished successfully',
      ]);
      toast.success('Image enhancement complete!');

      setTimeout(() => {
        navigate('/dashboard/results');
      }, 1500);
    };

    processSteps();
  }, []);

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-3xl font-bold text-cyan-100 mb-2">Processing Image</h1>
          <p className="text-slate-400">DCP dehazing algorithm in progress...</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 border border-cyan-500/50 rounded-xl">
          <Loader className="w-5 h-5 text-cyan-400 animate-spin" />
          <span className="text-cyan-100 font-medium">Processing</span>
        </div>
      </motion.div>

      {/* Overall Progress */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-slate-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-8"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Cpu className="w-8 h-8 text-cyan-400 animate-pulse" />
            <div>
              <h2 className="text-2xl font-bold text-cyan-100">
                {overallProgress.toFixed(0)}% Complete
              </h2>
              <p className="text-sm text-slate-400">Estimated time remaining: {((100 - overallProgress) * 0.018).toFixed(1)}s</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-400 mb-1">Processing Speed</p>
            <p className="text-lg font-bold text-green-400">Fast</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-4 bg-slate-800 rounded-full overflow-hidden relative">
          <motion.div
            className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 rounded-full relative overflow-hidden"
            initial={{ width: 0 }}
            animate={{ width: `${overallProgress}%` }}
            transition={{ duration: 0.3 }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          </motion.div>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Processing Steps */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <Activity className="w-6 h-6 text-cyan-400" />
            <h3 className="text-xl font-semibold text-cyan-100">Processing Pipeline</h3>
          </div>

          <div className="space-y-4">
            {steps.map((step, idx) => (
              <div key={step.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {step.status === 'complete' ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : step.status === 'processing' ? (
                      <Loader className="w-5 h-5 text-cyan-400 animate-spin" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-600" />
                    )}
                    <span
                      className={`font-medium ${
                        step.status === 'complete'
                          ? 'text-green-100'
                          : step.status === 'processing'
                          ? 'text-cyan-100'
                          : 'text-slate-500'
                      }`}
                    >
                      {step.name}
                    </span>
                  </div>
                  <span className="text-sm text-slate-400">{step.duration}</span>
                </div>

                {/* Step Progress Bar */}
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden ml-8">
                  <motion.div
                    className={`h-full rounded-full ${
                      step.status === 'complete'
                        ? 'bg-green-400'
                        : step.status === 'processing'
                        ? 'bg-cyan-400'
                        : 'bg-slate-700'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${step.progress}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="mt-6 pt-6 border-t border-slate-800 grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-800/50 rounded-xl">
              <p className="text-xs text-slate-400 mb-1">CPU Usage</p>
              <p className="text-lg font-bold text-cyan-400">76%</p>
            </div>
            <div className="p-3 bg-slate-800/50 rounded-xl">
              <p className="text-xs text-slate-400 mb-1">Memory</p>
              <p className="text-lg font-bold text-purple-400">4.2 GB</p>
            </div>
          </div>
        </motion.div>

        {/* Processing Logs */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <Zap className="w-6 h-6 text-cyan-400" />
            <h3 className="text-xl font-semibold text-cyan-100">Processing Logs</h3>
          </div>

          {/* Terminal-style logs */}
          <div className="bg-black/40 rounded-xl p-4 h-96 overflow-y-auto font-mono text-xs space-y-1 border border-slate-700">
            {logs.map((log, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="text-green-400"
              >
                {log}
              </motion.div>
            ))}
            <div className="flex items-center gap-2 text-cyan-400 animate-pulse">
              <span>&gt;</span>
              <span className="animate-blink">_</span>
            </div>
          </div>

          {/* Info Cards */}
          <div className="mt-6 space-y-3">
            <div className="p-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl flex items-center gap-3">
              <Clock className="w-5 h-5 text-cyan-400" />
              <div>
                <p className="text-sm text-cyan-100 font-medium">Processing Time</p>
                <p className="text-xs text-slate-400">Current: 1.2s / Expected: ~1.8s</p>
              </div>
            </div>

            <div className="p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl flex items-center gap-3">
              <Cpu className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-sm text-purple-100 font-medium">Algorithm Status</p>
                <p className="text-xs text-slate-400">DCP v2.1 - Optimized for highways</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
