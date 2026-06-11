import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { CloudFog, Camera, Cpu, ArrowRight, Wifi, MapPin } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 py-20">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="flex items-center justify-center gap-4 mb-6">
            <CloudFog className="w-16 h-16 text-cyan-400" />
            <Cpu className="w-12 h-12 text-cyan-400 animate-pulse" />
          </div>

          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
            AI-Based Fog Image Enhancement System
          </h1>

          <p className="text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
            Real-time highway visibility enhancement using Raspberry Pi rover and DCP dehazing algorithm.
            Cutting-edge computer vision technology for safer driving conditions.
          </p>
        </motion.div>

        {/* Feature Cards */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid md:grid-cols-3 gap-6 mb-16"
        >
          {/* Feature 1 */}
          <div className="group relative bg-slate-900/50 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-8 hover:border-cyan-500/50 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <Camera className="w-12 h-12 text-cyan-400 mb-4" />
              <h3 className="text-xl font-semibold mb-3 text-cyan-100">Live Capture</h3>
              <p className="text-slate-400">
                Raspberry Pi rover captures foggy highway images in real-time with wireless transmission
              </p>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="group relative bg-slate-900/50 backdrop-blur-xl border border-blue-500/20 rounded-2xl p-8 hover:border-blue-500/50 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <Cpu className="w-12 h-12 text-blue-400 mb-4 animate-pulse" />
              <h3 className="text-xl font-semibold mb-3 text-blue-100">DCP Algorithm</h3>
              <p className="text-slate-400">
                Advanced Dark Channel Prior dehazing algorithm processes images for maximum clarity
              </p>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="group relative bg-slate-900/50 backdrop-blur-xl border border-purple-500/20 rounded-2xl p-8 hover:border-purple-500/50 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <Wifi className="w-12 h-12 text-purple-400 mb-4" />
              <h3 className="text-xl font-semibold mb-3 text-purple-100">Real-time Processing</h3>
              <p className="text-slate-400">
                Instant wireless transmission and server-side processing for immediate results
              </p>
            </div>
          </div>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-wrap justify-center gap-6"
        >
          <button
            onClick={() => navigate('/dashboard/upload')}
            className="group relative px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl font-semibold text-lg hover:shadow-lg hover:shadow-cyan-500/50 transition-all duration-300 flex items-center gap-3"
          >
            <Camera className="w-6 h-6" />
            Upload Image
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={() => navigate('/dashboard/live-feed')}
            className="group relative px-8 py-4 bg-slate-900/50 backdrop-blur-xl border-2 border-cyan-500/50 rounded-xl font-semibold text-lg hover:bg-cyan-500/10 hover:border-cyan-500 transition-all duration-300 flex items-center gap-3"
          >
            <Wifi className="w-6 h-6 text-cyan-400" />
            Live Rover Feed
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={() => navigate('/dashboard')}
            className="group relative px-8 py-4 bg-slate-900/50 backdrop-blur-xl border-2 border-purple-500/50 rounded-xl font-semibold text-lg hover:bg-purple-500/10 hover:border-purple-500 transition-all duration-300 flex items-center gap-3"
          >
            <MapPin className="w-6 h-6 text-purple-400" />
            View Dashboard
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>

        {/* Stats Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6"
        >
          <div className="text-center p-6 bg-slate-900/30 backdrop-blur-sm rounded-xl border border-slate-800">
            <div className="text-4xl font-bold text-cyan-400 mb-2">98%</div>
            <div className="text-slate-400">Clarity Improvement</div>
          </div>
          <div className="text-center p-6 bg-slate-900/30 backdrop-blur-sm rounded-xl border border-slate-800">
            <div className="text-4xl font-bold text-blue-400 mb-2">&lt;2s</div>
            <div className="text-slate-400">Processing Time</div>
          </div>
          <div className="text-center p-6 bg-slate-900/30 backdrop-blur-sm rounded-xl border border-slate-800">
            <div className="text-4xl font-bold text-purple-400 mb-2">24/7</div>
            <div className="text-slate-400">Live Monitoring</div>
          </div>
          <div className="text-center p-6 bg-slate-900/30 backdrop-blur-sm rounded-xl border border-slate-800">
            <div className="text-4xl font-bold text-cyan-400 mb-2">100%</div>
            <div className="text-slate-400">Automated</div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
