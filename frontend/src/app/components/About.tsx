import { motion } from 'motion/react';
import { CloudFog, Cpu, Camera, Wifi, Zap, CheckCircle, Users, Award } from 'lucide-react';

export default function About() {
  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-4xl mx-auto"
      >
        <div className="flex items-center justify-center gap-4 mb-6">
          <CloudFog className="w-16 h-16 text-cyan-400" />
          <Cpu className="w-12 h-12 text-cyan-400 animate-pulse" />
        </div>
        <h1 className="text-4xl font-bold text-cyan-100 mb-4">
          AI-Based Fog Image Enhancement System
        </h1>
        <p className="text-lg text-slate-400 leading-relaxed">
          An innovative highway safety solution using Raspberry Pi rover technology and advanced Dark
          Channel Prior (DCP) dehazing algorithms to enhance visibility in foggy conditions.
        </p>
      </motion.div>

      {/* Project Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-8"
      >
        <h2 className="text-2xl font-bold text-cyan-100 mb-6">Project Overview</h2>
        <div className="space-y-4 text-slate-300 leading-relaxed">
          <p>
            This system addresses the critical challenge of reduced visibility on highways during foggy
            conditions. By combining cutting-edge computer vision algorithms with IoT technology, we
            provide real-time image enhancement to improve road safety.
          </p>
          <p>
            The solution utilizes a mobile Raspberry Pi-equipped rover that captures foggy highway
            images through its camera module. These images are wirelessly transmitted to a central
            processing server where our optimized DCP (Dark Channel Prior) algorithm removes haze and
            fog, dramatically improving image clarity and visibility.
          </p>
        </div>
      </motion.div>

      {/* System Architecture */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid md:grid-cols-3 gap-6"
      >
        <div className="bg-slate-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-6">
          <div className="p-4 bg-cyan-500/20 rounded-2xl w-fit mb-4">
            <Camera className="w-8 h-8 text-cyan-400" />
          </div>
          <h3 className="text-xl font-semibold text-cyan-100 mb-3">Image Capture</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Raspberry Pi rover with camera module continuously captures high-resolution foggy highway
            images in real-time field conditions.
          </p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-blue-500/30 rounded-2xl p-6">
          <div className="p-4 bg-blue-500/20 rounded-2xl w-fit mb-4">
            <Wifi className="w-8 h-8 text-blue-400" />
          </div>
          <h3 className="text-xl font-semibold text-blue-100 mb-3">Wireless Transfer</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Secure wireless transmission sends captured images from the rover to the central processing
            server with minimal latency.
          </p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-purple-500/30 rounded-2xl p-6">
          <div className="p-4 bg-purple-500/20 rounded-2xl w-fit mb-4">
            <Cpu className="w-8 h-8 text-purple-400 animate-pulse" />
          </div>
          <h3 className="text-xl font-semibold text-purple-100 mb-3">DCP Processing</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Advanced Dark Channel Prior algorithm processes images on the server, removing fog and
            enhancing visibility instantly.
          </p>
        </div>
      </motion.div>

      {/* DCP Algorithm Details */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-2xl p-8"
      >
        <div className="flex items-center gap-3 mb-6">
          <Zap className="w-8 h-8 text-cyan-400" />
          <h2 className="text-2xl font-bold text-cyan-100">Dark Channel Prior Algorithm</h2>
        </div>

        <p className="text-slate-300 mb-6 leading-relaxed">
          The DCP algorithm is a powerful single-image dehazing technique based on the observation that
          most local patches in fog-free outdoor images contain pixels with very low intensity in at
          least one color channel (the "dark channel").
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-cyan-400 font-bold">1</span>
              </div>
              <div>
                <h4 className="font-semibold text-cyan-100 mb-2">Atmospheric Light Estimation</h4>
                <p className="text-sm text-slate-400">
                  Identifies the brightest regions in the hazy image to estimate global atmospheric
                  light conditions.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-cyan-400 font-bold">2</span>
              </div>
              <div>
                <h4 className="font-semibold text-cyan-100 mb-2">Dark Channel Extraction</h4>
                <p className="text-sm text-slate-400">
                  Computes the minimum intensity values across color channels in local patches to create
                  the dark channel prior map.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-cyan-400 font-bold">3</span>
              </div>
              <div>
                <h4 className="font-semibold text-cyan-100 mb-2">Transmission Map Generation</h4>
                <p className="text-sm text-slate-400">
                  Calculates fog density distribution across the image using the dark channel and
                  atmospheric light estimates.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-cyan-400 font-bold">4</span>
              </div>
              <div>
                <h4 className="font-semibold text-cyan-100 mb-2">Image Recovery</h4>
                <p className="text-sm text-slate-400">
                  Reconstructs the fog-free image using the atmospheric scattering model inversion with
                  refined transmission map.
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Technical Specifications */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid md:grid-cols-2 gap-6"
      >
        {/* Hardware */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6">
          <h3 className="text-xl font-semibold text-cyan-100 mb-6">Hardware Components</h3>
          <div className="space-y-3">
            {[
              { name: 'Raspberry Pi 4 Model B', spec: '8GB RAM' },
              { name: 'Camera Module V2', spec: '8MP, 1080p30' },
              { name: 'Wireless Module', spec: '802.11ac, 2.4/5GHz' },
              { name: 'Power Supply', spec: '5V 3A USB-C' },
              { name: 'Storage', spec: '64GB microSD' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
                <span className="text-slate-300 font-medium">{item.name}</span>
                <span className="text-cyan-400 text-sm">{item.spec}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Software */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6">
          <h3 className="text-xl font-semibold text-cyan-100 mb-6">Software Stack</h3>
          <div className="space-y-3">
            {[
              { name: 'Operating System', spec: 'Raspberry Pi OS' },
              { name: 'Vision Library', spec: 'OpenCV 4.x' },
              { name: 'Programming', spec: 'Python 3.9+' },
              { name: 'Communication', spec: 'MQTT Protocol' },
              { name: 'Web Interface', spec: 'React + Tailwind' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
                <span className="text-slate-300 font-medium">{item.name}</span>
                <span className="text-purple-400 text-sm">{item.spec}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Key Features */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-8"
      >
        <h2 className="text-2xl font-bold text-cyan-100 mb-6">Key Features & Benefits</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: CheckCircle, label: 'Real-time Processing', desc: '<2s latency' },
            { icon: Zap, label: 'High Accuracy', desc: '96%+ clarity improvement' },
            { icon: Wifi, label: 'Wireless Operation', desc: 'No physical connection needed' },
            { icon: Camera, label: 'High Resolution', desc: '1080p image capture' },
            { icon: Award, label: 'Robust Algorithm', desc: 'Optimized DCP v2.1' },
            { icon: Users, label: 'User-Friendly', desc: 'Intuitive web interface' },
          ].map((feature, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 p-4 bg-slate-800/50 rounded-xl hover:bg-slate-800 transition-colors"
            >
              <div className="p-2 bg-cyan-500/20 rounded-lg">
                <feature.icon className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-200 mb-1">{feature.label}</h4>
                <p className="text-xs text-slate-400">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Applications */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-2xl p-8"
      >
        <h2 className="text-2xl font-bold text-purple-100 mb-6">Real-World Applications</h2>
        <div className="grid md:grid-cols-2 gap-6 text-slate-300">
          <div>
            <h4 className="font-semibold text-purple-100 mb-3">Primary Use Cases:</h4>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-1">•</span>
                <span>Highway safety monitoring in foggy conditions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-1">•</span>
                <span>Traffic surveillance system enhancement</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-1">•</span>
                <span>Autonomous vehicle vision systems</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-1">•</span>
                <span>Weather-dependent infrastructure monitoring</span>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-purple-100 mb-3">Future Enhancements:</h4>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-1">•</span>
                <span>Multi-camera array for 360° coverage</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-1">•</span>
                <span>Deep learning-based enhancement models</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-1">•</span>
                <span>Edge computing for faster processing</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-1">•</span>
                <span>Integration with smart city infrastructure</span>
              </li>
            </ul>
          </div>
        </div>
      </motion.div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="text-center py-8 border-t border-slate-800"
      >
        <p className="text-slate-400 mb-2">
          AI-Based Fog Image Enhancement System • Version 2.1
        </p>
        <p className="text-sm text-slate-500">
          Powered by Raspberry Pi, OpenCV, and Dark Channel Prior Algorithm
        </p>
      </motion.div>
    </div>
  );
}
