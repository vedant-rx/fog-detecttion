import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import DashboardLayout from './components/DashboardLayout';
import Home from './components/Home';
import LiveFeed from './components/LiveFeed';
import UploadImage from './components/UploadImage';
import Processing from './components/Processing';
import Results from './components/Results';
import About from './components/About';
import { Toaster } from 'sonner';
import { ThemeProvider } from './components/ThemeProvider';

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="fog-enhancement-theme">
      <Router>
        <div className="size-full bg-slate-950 text-slate-100">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<Home />} />
              <Route path="live-feed" element={<LiveFeed />} />
              <Route path="upload" element={<UploadImage />} />
              <Route path="processing" element={<Processing />} />
              <Route path="results" element={<Results />} />
              <Route path="about" element={<About />} />
            </Route>
          </Routes>
          <Toaster position="top-right" theme="dark" />
        </div>
      </Router>
    </ThemeProvider>
  );
}
