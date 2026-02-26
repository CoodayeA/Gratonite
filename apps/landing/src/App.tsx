/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, useScroll, useTransform, useSpring, AnimatePresence } from "motion/react";
import {
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Link, 
  useLocation,
  useNavigate,
  useParams
} from "react-router-dom";
import {
  Download,
  Compass,
  ChevronRight,
  Users,
  Zap,
  Shield,
  Globe,
  Monitor,
  Smartphone,
  Cpu,
  Heart,
  Lock,
  Coffee,
  ArrowLeft,
  Mail,
  User,
  ExternalLink,
  Calendar,
  Clock,
  Sun,
  Moon,
  Search,
  Github,
  HeartHandshake,
  Sparkles,
  Menu,
  X,
  Palette,
  MessageSquare,
  Headphones,
  Video,
  StickyNote,
  Smile as SmileIcon,
  UsersRound,
  FileText,
  HelpCircle,
  Lightbulb,
  Bug,
  ArrowUpRight
} from "lucide-react";
import { useRef, useState, useEffect } from "react";

// --- Components ---

const Navbar = ({ isDark, toggleDark }: { isDark: boolean, toggleDark: () => void }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === "/";

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  const NavLink = ({ to, href, children, hasDropdown = false }: { to?: string, href?: string, children: React.ReactNode, hasDropdown?: boolean }) => {
    const content = (
      <span className="text-sm font-medium text-ink/60 dark:text-slate-400 hover:text-gratonite transition-colors flex items-center gap-1">
        {children}
        {hasDropdown && <ChevronRight size={14} className="rotate-90" />}
      </span>
    );
    
    if (to) return <Link to={to}>{content}</Link>;
    return <a href={href}>{content}</a>;
  };

  return (
    <motion.header 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled || !isHome || mobileMenuOpen
          ? "bg-white/95 dark:bg-[#1a1025]/95 backdrop-blur-xl border-b border-gratonite/10" 
          : "bg-transparent"
      }`}
    >
      <div className={`flex items-center justify-between px-6 py-4 md:px-12 ${isScrolled || !isHome ? "py-3" : "py-5"}`}>
        <Link to="/" className="flex items-center gap-3 group cursor-pointer">
          <motion.div
            whileHover={{ rotate: -10, scale: 1.1 }}
            className="w-10 h-10 rounded-2xl overflow-hidden shadow-lg shadow-[#7C3AED]/30"
          >
            <img src="/gratonite-icon.png" alt="Gratonite" className="w-full h-full object-cover" />
          </motion.div>
          <div>
            <span className="block font-display font-bold text-xl leading-none text-gradient">Gratonite</span>
          </div>
        </Link>
        
        <nav className="hidden lg:flex items-center gap-6">
          <NavLink to="/download">Download</NavLink>
          <NavLink to="/discover" hasDropdown>Discover</NavLink>
          <NavLink to="/safety">Safety</NavLink>
          <NavLink to="/support" hasDropdown>Support</NavLink>
          <NavLink to="/blog" hasDropdown>Blog</NavLink>
        </nav>

        <div className="flex items-center gap-2">
          <motion.button 
            onClick={toggleDark}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="p-2.5 rounded-xl bg-gratonite-purple-soft/20 dark:bg-[#2d1f3d] text-gratonite hover:bg-gratonite-purple-soft/40 dark:hover:bg-slate-700 transition-all"
            aria-label="Toggle Dark Mode"
          >
            <motion.div
              animate={{ rotate: isDark ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </motion.div>
          </motion.button>
          
          <a
            href="/app/login"
            className="hidden sm:block px-5 py-2.5 rounded-2xl text-ink dark:text-white text-sm font-semibold hover:text-gratonite transition-colors"
          >
            Log In
          </a>
          <a
            href="/app/"
            className="px-5 py-2.5 rounded-2xl gratonite-gradient text-white text-sm font-bold shadow-lg shadow-[#7C3AED]/40 hover:shadow-[#7C3AED]/100 transition-all"
          >
            Open App
          </a>
          
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2.5 rounded-xl text-ink dark:text-white"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>
      
      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-white dark:bg-[#1a1025] border-t border-gratonite/10 overflow-hidden"
          >
            <div className="px-6 py-4 space-y-4">
              <Link to="/discover" className="block py-2 text-ink dark:text-white font-medium">Discover</Link>
              <Link to="/safety" className="block py-2 text-ink dark:text-white font-medium">Safety</Link>
              <Link to="/support" className="block py-2 text-ink dark:text-white font-medium">Support</Link>
              <Link to="/blog" className="block py-2 text-ink dark:text-white font-medium">Blog</Link>
              <hr className="border-gratonite/10" />
              <Link to="/download" className="block py-2 text-ink dark:text-white font-medium">Download</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
};

const Hero = () => {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const FloatingHexagon = ({ size, delay, className, icon: Icon }: any) => (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.8 }}
      className={`absolute ${className}`}
      style={{ width: size, height: size }}
    >
      <motion.div
        animate={{ 
          y: [0, -20, 0],
          rotate: [0, 5, 0],
        }}
        transition={{ 
          duration: 6 + Math.random() * 2, 
          repeat: Infinity, 
          ease: "easeInOut",
          delay: Math.random() * 2
        }}
        className="w-full h-full hexagon"
        style={{
          background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.6) 0%, rgba(168, 85, 247, 0.4) 50%, rgba(236, 72, 153, 0.3) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }}
      >
        {Icon && (
          <div className="w-full h-full flex items-center justify-center">
            <Icon size={size * 0.4} className="text-white/80" />
          </div>
        )}
      </motion.div>
    </motion.div>
  );

  const ChatBubble = ({ delay, className }: any) => (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.5 }}
      animate={{ 
        opacity: [0.8, 0.4, 0],
        y: [-50],
        scale: [1, 0.5]
      }}
      transition={{ 
        duration: 4 + Math.random() * 2, 
        repeat: Infinity, 
        delay,
        ease: "easeOut"
      }}
      className={`absolute ${className}`}
    >
      <div className="px-4 py-2 rounded-2xl bg-white/80 dark:bg-[#1a1025]/80 border border-gratonite/20 shadow-lg backdrop-blur-sm">
        <div className="w-2 h-2 rounded-full bg-gratonite animate-pulse" />
      </div>
    </motion.div>
  );

  const Particle = ({ delay, className }: { delay: number, className: string }) => (
    <motion.div
      initial={{ opacity: 0, y: 100 }}
      animate={{ 
        opacity: [0, 0.6, 0],
        y: -100,
        x: [0, Math.random() * 40 - 20]
      }}
      transition={{ 
        duration: 8 + Math.random() * 4, 
        repeat: Infinity, 
        delay,
        ease: "linear"
      }}
      className={`absolute rounded-full ${className}`}
    />
  );

  return (
    <section ref={containerRef} className="relative min-h-screen flex flex-col items-center justify-center pt-32 pb-20 px-6 overflow-hidden bg-paper dark:bg-[#0f0a1a] transition-colors duration-300">
      <motion.div 
        animate={{ 
          x: [0, 30, 0], 
          y: [0, 40, 0],
          scale: [1, 1.1, 1]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className="organic-blob w-[600px] h-[600px] bg-gratonite/20 -top-40 -left-20" 
      />
      <motion.div 
        animate={{ 
          x: [0, -20, 0], 
          y: [0, 30, 0],
          scale: [1, 1.05, 1]
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="organic-blob w-[500px] h-[500px] bg-gratonite-pink/10 top-40 -right-20" 
      />
      <motion.div 
        animate={{ 
          x: [0, 20, 0], 
          y: [0, -20, 0],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className="organic-blob w-[400px] h-[400px] bg-gratonite-teal/10 bottom-20 left-1/3" 
      />

      {/* Floating particles */}
      <Particle delay={0} className="w-1 h-1 bg-gratonite/60 left-[10%] bottom-0" />
      <Particle delay={2} className="w-2 h-2 bg-gratonite-light/40 left-[20%] bottom-0" />
      <Particle delay={4} className="w-1 h-1 bg-gratonite-pink/50 left-[30%] bottom-0" />
      <Particle delay={1} className="w-1.5 h-1.5 bg-gratonite-teal/40 left-[40%] bottom-0" />
      <Particle delay={3} className="w-1 h-1 bg-gratonite/60 left-[50%] bottom-0" />
      <Particle delay={5} className="w-2 h-2 bg-gratonite-light/30 left-[60%] bottom-0" />
      <Particle delay={2.5} className="w-1 h-1 bg-gratonite-pink/50 left-[70%] bottom-0" />
      <Particle delay={4.5} className="w-1.5 h-1.5 bg-gratonite-teal/40 left-[80%] bottom-0" />
      <Particle delay={1.5} className="w-1 h-1 bg-gratonite/60 left-[90%] bottom-0" />
      <Particle delay={3.5} className="w-2 h-2 bg-gratonite-light/40 left-[15%] bottom-0" />
      <Particle delay={0.5} className="w-1 h-1 bg-gratonite-pink/50 left-[85%] bottom-0" />
      <Particle delay={2.2} className="w-1.5 h-1.5 bg-gratonite-teal/40 left-[45%] bottom-0" />

      <FloatingHexagon size={120} delay={0.2} className="top-1/4 left-[10%] animate-float" icon={Users} />
      <FloatingHexagon size={80} delay={0.4} className="top-1/3 right-[15%] animate-float-reverse" icon={Zap} />
      <FloatingHexagon size={60} delay={0.6} className="bottom-1/4 left-[20%] animate-float-slow" />
      <FloatingHexagon size={100} delay={0.8} className="bottom-1/3 right-[10%] animate-float" />
      <FloatingHexagon size={50} delay={1} className="top-[15%] right-[25%] animate-float-reverse" />
      <FloatingHexagon size={40} delay={1.2} className="top-[40%] left-[5%] animate-float-slow" />
      <FloatingHexagon size={35} delay={1.4} className="bottom-[20%] right-[25%] animate-float" />
      <FloatingHexagon size={45} delay={1.6} className="top-[60%] left-[8%] animate-float-reverse" />
      <FloatingHexagon size={30} delay={1.8} className="top-[25%] right-[40%] animate-float-slow" />

      <ChatBubble delay={0} className="top-[20%] left-[15%]" />
      <ChatBubble delay={1.5} className="top-[25%] right-[20%]" />
      <ChatBubble delay={3} className="bottom-[30%] left-[25%]" />

      <motion.div 
        style={{ y, opacity }}
        className="relative z-10 max-w-5xl text-center"
      >
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.8 }}
          className="text-5xl md:text-7xl lg:text-8xl font-display font-bold tracking-tight mb-6 leading-[0.95] text-ink dark:text-white"
        >
          Your space.<br />
          <span className="text-gradient animate-gradient bg-clip-text text-transparent bg-[length:200%_200%]">Your people.</span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="text-lg md:text-xl text-ink-light dark:text-slate-400 max-w-2xl mx-auto mb-8 leading-relaxed"
        >
          Hang out with your community. No ads, no tracking, no nonsense. 
          Just a place to chat with the people who matter most to you.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="flex flex-wrap items-center justify-center gap-4 mb-10"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gratonite/10 text-gratonite text-sm font-medium">
            <Sparkles size={16} />
            100% Free
          </span>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gratonite-pink/10 text-gratonite-pink text-sm font-medium">
            <Heart size={16} />
            Open Source
          </span>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gratonite-teal/10 text-gratonite-teal text-sm font-medium">
            <Users size={16} />
            Built for Communities
          </span>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-6"
        >
          <motion.button 
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            className="w-full sm:w-auto px-10 py-5 rounded-[2rem] gratonite-gradient text-white font-bold text-xl shadow-2xl shadow-[#7C3AED]/50 hover:shadow-gratonite/60 transition-all flex items-center justify-center gap-3 animate-pulse-glow"
          >
            <Download size={24} />
            Get Gratonite
          </motion.button>
          <a
            href="/app/"
            className="w-full sm:w-auto px-10 py-5 rounded-[2rem] bg-white dark:bg-[#1a1025] border-2 border-gratonite/20 text-gratonite font-bold text-xl transition-all flex items-center justify-center gap-3 hover:bg-gratonite/5 hover:border-gratonite/40"
          >
            <ExternalLink size={24} />
            Open in Browser
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
};

const FeatureCard = ({ icon: Icon, title, description, delay }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay, duration: 0.8 }}
    whileHover={{ y: -8 }}
    className="p-10 rounded-[3rem] bg-white dark:bg-[#1a1025] border border-gratonite/5 shadow-sm hover:shadow-xl hover:shadow-[#7C3AED]/10 transition-all group"
  >
    <div className="w-16 h-16 rounded-2xl bg-gratonite-purple-soft/30 dark:bg-[#2d1f3d] flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
      <Icon size={32} className="text-gratonite" />
    </div>
    <h3 className="text-3xl font-bold mb-4 text-ink dark:text-white">{title}</h3>
    <p className="text-ink/40 dark:text-slate-400 leading-relaxed text-lg">{description}</p>
  </motion.div>
);

const BentoCard = ({ icon: Icon, title, description, delay, className = "", accentColor = "gratonite" }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 40 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay, duration: 0.8, ease: "easeOut" }}
    whileHover={{ y: -12, scale: 1.02 }}
    className={`p-8 rounded-[2.5rem] bg-white dark:bg-[#1a1025]/60 border border-gratonite/5 dark:border-gratonite-dark/20 shadow-lg shadow-gratonite-500/5 hover:shadow-2xl hover:shadow-gratonite-500/15 transition-all group ${className}`}
  >
    <div className={`w-14 h-14 rounded-2xl bg-${accentColor}/10 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
      <Icon size={28} className={`text-${accentColor}`} />
    </div>
    <h3 className="text-2xl font-bold mb-3 text-ink dark:text-white group-hover:text-gratonite transition-colors">{title}</h3>
    <p className="text-ink-light dark:text-slate-400 leading-relaxed">{description}</p>
  </motion.div>
);

const Features = () => {
  const features = [
    { icon: MessageSquare, title: "Text Chat That Rocks", description: "Drop into channels when you're free. No need to call anyone or send invites. Just show up and chat.", delay: 0.1, accentColor: "gratonite" },
    { icon: Headphones, title: "Voice Chats", description: "Hop in and out whenever you want. No setup needed. Just click and talk with your people.", delay: 0.15, accentColor: "gratonite-teal" },
    { icon: Video, title: "Video Hangouts", description: "Turn your camera on and chill with friends. Crystal clear video when your connection cooperates.", delay: 0.2, accentColor: "gratonite-pink" },
    { icon: Globe, title: "Your Own Portals", description: "Build spaces for your gaming nights, study groups, or just random banter with your people.", delay: 0.25, accentColor: "gratonite" },
    { icon: Palette, title: "Custom Emojis", description: "Make it yours. Upload your own emojis, stickers, and reactions. Show off your vibe.", delay: 0.3, accentColor: "gratonite-yellow" },
    { icon: SmileIcon, title: "Profile Vibes", description: "Pick an avatar, write a status, deck out your profile. Show up to chats your way.", delay: 0.35, accentColor: "gratonite-pink" },
    { icon: UsersRound, title: "See Who's Around", description: "Check who's online, what they're playing, or just hanging out. No awkward 'you there?' messages.", delay: 0.4, accentColor: "gratonite-teal" },
    { icon: StickyNote, title: "Threads & Topics", description: "Keep conversations organized. Spin off into threads so the main chat stays clean.", delay: 0.45, accentColor: "gratonite" },
    { icon: Lock, title: "Actually Private", description: "Your messages are yours. We can't read them, we don't sell your data, and we won't ever.", delay: 0.5, accentColor: "gratonite" },
    { icon: Smartphone, title: "Works Everywhere", description: "Laptop, phone, browser — your chats follow you. Pick up where you left off, anywhere.", delay: 0.55, accentColor: "gratonite-yellow" },
    { icon: Compass, title: "Discover Stuff", description: "Find new servers, cool bots, and themes made by the community. There's always something new.", delay: 0.6, accentColor: "gratonite-pink" },
    { icon: Github, title: "Open Source", description: "The code is out there. Poke around, build bots, or fork it. No secrets here.", delay: 0.65, accentColor: "gratonite-teal" },
  ];

  return (
    <section id="features" className="py-24 px-6 max-w-7xl mx-auto">
      <div className="text-center mb-16">
        <motion.h2 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-4xl md:text-6xl font-bold tracking-tight mb-4 dark:text-white"
        >
          Make it yours.
        </motion.h2>
        <motion.p 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="text-lg text-ink-light dark:text-slate-400 max-w-2xl mx-auto"
        >
          All the fun stuff you'd want in a chat app, without the stuff that sucks.
        </motion.p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {features.map((feature, idx) => (
          <BentoCard key={idx} {...feature} />
        ))}
      </div>
    </section>
  );
};

const PhilosophySection = () => {
  const pillars = [
    { icon: Shield, title: "Privacy", subtitle: "By Architecture", color: "gratonite", description: "Your conversations stay yours. Always." },
    { icon: Users, title: "Community", subtitle: "Owned & Operated", color: "gratonite-teal", description: "Built by humans, for humans." },
    { icon: Zap, title: "Creativity", subtitle: "No Limits", color: "gratonite-pink", description: "Express yourself without bounds." },
  ];

  return (
    <section className="py-40 px-6 bg-gradient-to-b from-gratonite-purple-soft/30 to-transparent dark:from-[#1a1025] dark:to-[#0f0a1a] relative overflow-hidden">
      <motion.div 
        animate={{ 
          x: [0, 30, 0], 
          y: [0, 20, 0],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className="organic-blob w-[500px] h-[500px] bg-gratonite/10 -top-20 left-1/2 -translate-x-1/2" 
      />
      
      <div className="max-w-5xl mx-auto text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="mb-8"
        >
          <Shield size={48} className="text-gratonite mx-auto" />
        </motion.div>
        <h2 className="text-4xl md:text-6xl font-bold mb-6 text-ink dark:text-white">A Sanctuary for Connection.</h2>
        <p className="text-xl md:text-2xl text-ink-light dark:text-slate-400 leading-relaxed mb-16 font-serif italic">
          "More than just a tool; it's a foundation for movements, hobbies, and secure connections."
        </p>
        
        <div className="grid md:grid-cols-3 gap-6">
          {pillars.map((pillar, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.15, duration: 0.6 }}
              whileHover={{ y: -8, scale: 1.02 }}
              className={`p-8 rounded-[2.5rem] bg-white dark:bg-[#1a1025]/80 border border-${pillar.color}/20 shadow-lg hover:shadow-xl transition-all`}
            >
              <div className={`w-16 h-16 rounded-2xl bg-${pillar.color}/10 flex items-center justify-center mb-6 mx-auto`}>
                <pillar.icon size={32} className={`text-${pillar.color}`} />
              </div>
              <span className="block text-2xl font-bold text-ink dark:text-white mb-1">{pillar.title}</span>
              <span className="text-sm font-bold text-ink-light dark:text-slate-500 uppercase tracking-widest">{pillar.subtitle}</span>
              <p className="text-ink-light dark:text-slate-400 mt-4">{pillar.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const DownloadSection = () => (
  <section id="download" className="py-32 px-6 overflow-hidden relative">
    <div className="max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="text-center mb-12"
      >
        <h2 className="text-4xl md:text-6xl font-bold mb-4 dark:text-white">Get Gratonite</h2>
        <p className="text-lg text-ink-light dark:text-slate-400 mb-8">
          $0.00. No credit card. No catch.
        </p>
      </motion.div>
      
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { name: 'macOS', icon: Cpu, href: '#', comingSoon: true },
          { name: 'Windows', icon: Monitor, href: '/Gratonite-Setup.exe' },
          { name: 'Linux', icon: Globe, href: '#', comingSoon: true },
          { name: 'Mobile', icon: Smartphone, href: '#', comingSoon: true },
        ].map((os) => (
          os.comingSoon ? (
            <motion.div
              key={os.name}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-4 p-5 rounded-[1.5rem] bg-white dark:bg-[#1a1025] border border-gratonite/10 hover:border-gratonite/30 transition-all text-left group opacity-60 cursor-not-allowed"
            >
              <div className="w-10 h-10 rounded-xl bg-gratonite/10 flex items-center justify-center group-hover:bg-gratonite group-hover:text-white transition-colors">
                <os.icon size={20} />
              </div>
              <span className="font-medium text-ink dark:text-white">{os.name}</span>
              <span className="ml-auto text-xs text-gray-400">Soon</span>
            </motion.div>
          ) : (
            <a
              key={os.name}
              href={os.href}
              download
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-4 p-5 rounded-[1.5rem] bg-white dark:bg-[#1a1025] border border-gratonite/10 hover:border-gratonite/30 transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-xl bg-gratonite/10 flex items-center justify-center group-hover:bg-gratonite group-hover:text-white transition-colors">
                <os.icon size={20} />
              </div>
              <span className="font-medium text-ink dark:text-white">{os.name}</span>
            </a>
          )
        ))}
      </div>

      <p className="text-center mt-8 text-sm text-ink-light dark:text-slate-500">
        Or just use it in your browser. No install needed.
      </p>
    </div>
  </section>
);

const DownloadPage = () => {
  const [macArch, setMacArch] = useState("arm64");
  
  const downloads = [
    { 
      name: 'Windows', 
      icon: Monitor, 
      href: '/Gratonite-Setup-0.1.0.exe',
      description: 'Windows 10 or later'
    },
    { 
      name: 'macOS', 
      icon: Cpu, 
      href: macArch === 'arm64' ? '/Gratonite-0.1.0-arm64.dmg' : '/Gratonite-0.1.0-x64.dmg',
      description: macArch === 'arm64' ? 'Apple Silicon (M1, M2, M3)' : 'Intel Mac',
      showDropdown: true
    },
    { 
      name: 'Linux', 
      icon: Globe, 
      href: '#',
      comingSoon: true,
      description: 'Coming soon'
    },
    { 
      name: 'Mobile', 
      icon: Smartphone, 
      href: '#',
      comingSoon: true,
      description: 'Coming soon'
    },
  ];

  return (
    <div className="min-h-screen pt-32 pb-20 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-6xl font-bold mb-4 dark:text-white">Download Gratonite</h1>
          <p className="text-lg text-ink-light dark:text-slate-400">
            Choose your platform. Free forever. No credit card required.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-6">
          {downloads.map((app) => (
            app.comingSoon ? (
              <motion.div
                key={app.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="p-8 rounded-3xl bg-white dark:bg-[#1a1025] border border-gratonite/10 opacity-60"
              >
                <div className="w-16 h-16 rounded-2xl bg-gratonite/10 flex items-center justify-center mb-4">
                  <app.icon size={32} className="text-gratonite" />
                </div>
                <h3 className="text-xl font-bold mb-2 dark:text-white">{app.name}</h3>
                <p className="text-ink-light dark:text-slate-400 mb-4">{app.description}</p>
                <span className="inline-block px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm font-medium text-gray-500">
                  Coming Soon
                </span>
              </motion.div>
            ) : (
              <motion.div
                key={app.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="p-8 rounded-3xl bg-white dark:bg-[#1a1025] border border-gratonite/10 hover:border-gratonite/30 transition-all"
              >
                <div className="w-16 h-16 rounded-2xl bg-gratonite flex items-center justify-center mb-4">
                  <app.icon size={32} className="text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2 dark:text-white">{app.name}</h3>
                <p className="text-ink-light dark:text-slate-400 mb-4">{app.description}</p>
                {app.showDropdown ? (
                  <div className="flex flex-col gap-3">
                    <select 
                      value={macArch}
                      onChange={(e) => setMacArch(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-gratonite-purple-soft/20 dark:bg-[#2d1f3d] border border-gratonite/20 text-ink dark:text-white focus:outline-none focus:border-gratonite/40 cursor-pointer"
                    >
                      <option value="arm64">Apple Silicon (M1, M2, M3)</option>
                      <option value="x64">Intel Mac</option>
                    </select>
                    <a
                      href={app.href}
                      download
                      className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gratonite text-white font-medium hover:bg-gratonite-pink transition-colors"
                    >
                      <Download size={16} />
                      Download for {macArch === 'arm64' ? 'Apple Silicon' : 'Intel'}
                    </a>
                  </div>
                ) : (
                  <a
                    href={app.href}
                    download
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gratonite text-white font-medium"
                  >
                    <Download size={16} />
                    Download
                  </a>
                )}
              </motion.div>
            )
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-12 text-center"
        >
          <p className="text-ink-light dark:text-slate-400">
            Or just use it in your browser. <a href="/app" className="text-gratonite hover:underline">No install needed.</a>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

const CommunitySection = () => (
  <section className="py-32 px-6 relative overflow-hidden">
    <div className="max-w-3xl mx-auto text-center">
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <h2 className="text-3xl md:text-5xl font-bold mb-6 text-ink dark:text-white">
          Come hang out with us.
        </h2>
        <p className="text-lg text-ink-light dark:text-slate-400 mb-8 leading-relaxed">
          No sales calls. No enterprise plans. Just a place to chat with your people. 
          Worth trying, right?
        </p>
        
        <motion.a
          href="/app/register"
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
          className="px-10 py-5 rounded-[2rem] gratonite-gradient text-white font-bold text-xl shadow-2xl shadow-[#7C3AED]/50 flex items-center justify-center gap-3 mx-auto no-underline"
        >
          <Users size={24} />
          Start Chatting — It's Free
        </motion.a>

        <p className="mt-8 text-sm text-ink-light dark:text-slate-500">
          Open source. No ads. No subscriptions. Ever.
        </p>
      </motion.div>
    </div>
  </section>
);

const Footer = () => (
  <footer className="py-20 px-6 border-t border-gratonite/10 relative overflow-hidden bg-white dark:bg-[#0f0a1a]">
    <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
      <div className="max-w-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl overflow-hidden">
            <img src="/gratonite-icon.png" alt="Gratonite" className="w-full h-full object-cover" />
          </div>
          <span className="font-display font-bold text-2xl tracking-tight text-ink dark:text-white">Gratonite</span>
        </div>
        <p className="text-ink-light dark:text-slate-400 text-base leading-relaxed mb-6">
          Made by a few folks who just wanted a better place to chat with friends. No investors. No boss.
        </p>
        <div className="flex items-center gap-2 text-gratonite text-sm font-medium">
          <Github size={16} />
          <span>Open source on GitHub</span>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-12">
        <div>
          <h4 className="font-semibold mb-4 text-sm text-ink dark:text-white">Use</h4>
          <ul className="space-y-3 text-sm text-ink-light dark:text-slate-400">
            <li><a href="/download" className="hover:text-gratonite transition-colors">Download</a></li>
            <li><a href="#features" className="hover:text-gratonite transition-colors">Features</a></li>
            <li><Link to="/blog" className="hover:text-gratonite transition-colors">Blog</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-4 text-sm text-ink dark:text-white">Legal</h4>
          <ul className="space-y-3 text-sm text-ink-light dark:text-slate-400">
            <li><a href="#" className="hover:text-gratonite transition-colors">Privacy</a></li>
            <li><a href="#" className="hover:text-gratonite transition-colors">Terms</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-4 text-sm text-ink dark:text-white">Say hi</h4>
          <ul className="space-y-3 text-sm text-ink-light dark:text-slate-400">
            <li><a href="#" className="hover:text-gratonite transition-colors">Twitter</a></li>
            <li><a href="#" className="hover:text-gratonite transition-colors">Email</a></li>
          </ul>
        </div>
      </div>
    </div>
    
    <div className="max-w-5xl mx-auto mt-16 pt-8 border-t border-gratonite/5 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-ink-light dark:text-slate-500">
      <p>© 2026 Gratonite. Built by humans, for humans.</p>
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1">
          <Lock size={14} />
          Your messages are yours
        </span>
      </div>
    </div>
  </footer>
);

// --- Pages ---

const Home = () => (
  <>
    <Hero />
    <Features />
    <DownloadSection />
    <CommunitySection />
  </>
);

const AuthPage = ({ mode }: { mode: 'login' | 'register' }) => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen pt-32 pb-20 px-6 flex items-center justify-center bg-paper dark:bg-[#0f0a1a] relative overflow-hidden transition-colors duration-300">
      <div className="organic-blob w-[400px] h-[400px] bg-gratonite/10 -top-20 -left-20" />
      <div className="organic-blob w-[300px] h-[300px] bg-gratonite-purple-soft/30 -bottom-20 -right-20" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-white dark:bg-[#1a1025] p-10 rounded-[3rem] shadow-2xl shadow-[#7C3AED]/15 border border-gratonite/5">
          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-6 shadow-lg shadow-[#7C3AED]/30">
              <img src="/gratonite-icon.png" alt="Gratonite" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-3xl font-bold text-ink dark:text-white mb-2">
              {mode === 'login' ? 'Welcome back' : 'Get Started'}
            </h1>
            <p className="text-ink/40 dark:text-slate-400">
              {mode === 'login' ? 'Ready to chat with your people?' : 'Join your community.'}
            </p>
          </div>

          <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
            {mode === 'register' && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-slate-500 ml-4">Handle</label>
                <div className="relative">
                  <User className="absolute left-5 top-1/2 -translate-y-1/2 text-gratonite/40" size={18} />
                  <input 
                    type="text" 
                    placeholder="e.g. wanderer" 
                    className="w-full pl-12 pr-6 py-4 rounded-2xl bg-gratonite-purple-soft/20 dark:bg-[#2d1f3d] border border-transparent focus:bg-white dark:focus:bg-slate-950 focus:border-gratonite/30 focus:ring-4 focus:ring-gratonite/5 transition-all outline-none dark:text-white"
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-slate-500 ml-4">Email</label>
              <div className="relative">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-gratonite/40" size={18} />
                <input 
                  type="email" 
                  placeholder="hello@example.com" 
                  className="w-full pl-12 pr-6 py-4 rounded-2xl bg-gratonite-purple-soft/20 dark:bg-[#2d1f3d] border border-transparent focus:bg-white dark:focus:bg-slate-950 focus:border-gratonite/30 focus:ring-4 focus:ring-gratonite/5 transition-all outline-none dark:text-white"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-slate-500 ml-4">Password</label>
              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-gratonite/40" size={18} />
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  className="w-full pl-12 pr-6 py-4 rounded-2xl bg-gratonite-purple-soft/20 dark:bg-[#2d1f3d] border border-transparent focus:bg-white dark:focus:bg-slate-950 focus:border-gratonite/30 focus:ring-4 focus:ring-gratonite/5 transition-all outline-none dark:text-white"
                />
              </div>
            </div>

            <motion.button 
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (mode === 'register') {
                  navigate('/verify');
                }
              }}
              className="w-full py-5 rounded-2xl bg-gratonite text-white font-bold text-lg shadow-xl shadow-[#7C3AED]/30 hover:shadow-[#7C3AED]/50 transition-all mt-4"
            >
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </motion.button>
          </form>

          <div className="mt-10 pt-8 border-t border-gratonite/5 text-center">
            <p className="text-ink/40 dark:text-slate-500 text-sm">
              {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
              <Link 
                to={mode === 'login' ? "/register" : "/login"} 
                className="ml-2 font-bold text-gratonite hover:underline"
              >
                {mode === 'login' ? 'Register' : 'Login'}
              </Link>
            </p>
          </div>
        </div>
        
        <button 
          onClick={() => navigate('/')}
          className="mt-8 flex items-center gap-2 text-ink/40 dark:text-slate-500 hover:text-gratonite transition-colors mx-auto font-bold text-sm"
        >
          <ArrowLeft size={16} />
          Back to Home
        </button>
      </motion.div>
    </div>
  );
};

const VerifyPage = () => {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen pt-32 pb-20 px-6 flex items-center justify-center bg-paper dark:bg-[#0f0a1a] relative overflow-hidden transition-colors duration-300">
      <div className="organic-blob w-[400px] h-[400px] bg-gratonite/10 -top-20 -left-20" />
      <div className="organic-blob w-[300px] h-[300px] bg-gratonite-pink/10 -bottom-20 -right-20" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          className="w-20 h-20 rounded-full bg-gratonite/10 flex items-center justify-center mx-auto mb-8"
        >
          <Mail size={40} className="text-gratonite" />
        </motion.div>
        
        <h1 className="text-3xl font-bold text-ink dark:text-white mb-4">
          Check your email
        </h1>
        
        <p className="text-ink-light dark:text-slate-400 mb-8 leading-relaxed">
          We sent a verification link to your inbox. 
          Click the link to activate your account.
        </p>
        
        <div className="p-6 rounded-2xl bg-gratonite-purple-soft/20 dark:bg-[#1a1025] border border-gratonite/10 mb-8">
          <p className="text-sm text-ink-light dark:text-slate-400">
            <span className="font-semibold text-ink dark:text-white">Pro tip:</span> If you don't see it, check your spam folder. Email can be tricky like that.
          </p>
        </div>

        <button 
          onClick={() => navigate('/login')}
          className="text-gratonite font-semibold hover:underline"
        >
          Back to Login
        </button>
      </motion.div>
    </div>
  );
};

const BlogPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  
  const posts = [
    {
      id: 1,
      slug: "welcome-to-gratonite",
      title: "Welcome to Gratonite — What We're Building and Why",
      excerpt: "Gratonite is a new kind of communication platform built for communities, gamers, and creators. Here's the vision behind it and where we're headed.",
      author: "Coodaye",
      date: "Feb 24, 2026",
      readTime: "4 min read",
      category: "Announcement",
      featured: true,
      content: "Gratonite is more than just a chat app — it's a space built for communities that want to connect without the noise. We're creating something different from the big tech platforms: no ads, no data selling, no corporate interference.\n\nOur focus is on three things: communities, gaming, and creators. Whether you're running a Discord server, streaming on Twitch, or building a fan community for your creative work, Gratonite gives you the tools to make it happen.\n\nWe're building this from the ground up with privacy and user control at the core. Your data stays yours. Your community, your rules."
    },
    {
      id: 2,
      slug: "desktop-app-released",
      title: "Desktop App Now Available: Download for Windows and Mac",
      excerpt: "The Gratonite desktop app is here. Download for Windows or Mac (Apple Silicon & Intel supported). Includes auto-updates and native notifications.",
      author: "Coodaye",
      date: "Feb 25, 2026",
      readTime: "2 min read",
      category: "Announcement",
      featured: true,
      content: "Good news — you can now download the Gratonite desktop app for both Windows and macOS!\n\n**What's included:**\n- Native desktop experience with system tray support\n- Auto-updates so you're always on the latest version\n- Native notifications that work with your OS\n- Better performance than the web version\n\n**Downloads:**\n- Windows: Gratonite-0.1.0.exe\n- macOS Apple Silicon (M1, M2, M3): Gratonite-0.1.0-arm64.dmg\n- macOS Intel: Gratonite-0.1.0-x64.dmg\n\nJust head to our download page and pick your version. No sign-up required to download — you can use the app or stick with the web version. Either way, your account works the same."
    },
    {
      id: 3,
      slug: "getting-started",
      title: "Getting Started with Gratonite: Your First Server",
      excerpt: "A step-by-step walkthrough for creating your first server, setting up channels, inviting friends, and customizing your space on Gratonite.",
      author: "Coodaye",
      date: "Feb 22, 2026",
      readTime: "5 min read",
      category: "Guide"
    },
    {
      id: 4,
      slug: "gratonites-currency",
      title: "Introducing Gratonites: Our Virtual Currency System",
      excerpt: "Earn Gratonites by chatting, logging in daily, and hitting milestones. Spend them in the Shop on profile cosmetics, decorations, and more.",
      author: "Coodaye",
      date: "Feb 20, 2026",
      readTime: "3 min read",
      category: "Feature"
    },
    {
      id: 5,
      slug: "voice-video-calls",
      title: "Voice & Video Calls on Gratonite",
      excerpt: "Low-latency voice and video calling is live. Jump into voice channels with your server or start private calls in DMs — no third-party apps needed.",
      author: "Coodaye",
      date: "Feb 18, 2026",
      readTime: "3 min read",
      category: "Feature"
    },
    {
      id: 6,
      slug: "profile-customization",
      title: "Customize Your Profile: Banners, Bios, and Cosmetics",
      excerpt: "Express yourself with custom avatars, profile banners, bios, color themes, animated decorations, and more. Your profile, your rules.",
      author: "Coodaye",
      date: "Feb 15, 2026",
      readTime: "4 min read",
      category: "Guide"
    },
    {
      id: 7,
      slug: "gratonite-shop",
      title: "The Gratonite Shop: What's Available Right Now",
      excerpt: "Browse avatar decorations, profile effects, nameplates, and animated frames in the Shop. Everything is earnable through Gratonites — no real money required.",
      author: "Coodaye",
      date: "Feb 12, 2026",
      readTime: "3 min read",
      category: "Feature"
    },
    {
      id: 8,
      slug: "server-discovery",
      title: "Server Discovery: Find Your Community",
      excerpt: "Use the Discover page to browse and join public servers across gaming, art, music, tech, and more. Filter by tags and find your people.",
      author: "Coodaye",
      date: "Feb 10, 2026",
      readTime: "3 min read",
      category: "Guide"
    },
    {
      id: 9,
      slug: "beta-roadmap",
      title: "Gratonite Beta Roadmap: What's Coming Next",
      excerpt: "A look at what's on deck for Gratonite — keyboard shortcuts, DM redesign, emoji system, leaderboard, bot integrations, and the mobile app.",
      author: "Coodaye",
      date: "Feb 08, 2026",
      readTime: "5 min read",
      category: "Roadmap"
    },
  ];

  const filteredPosts = searchQuery 
    ? posts.filter(p => 
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : posts;

  const featuredPost = searchQuery ? null : posts.find(p => p.featured);
  const regularPosts = filteredPosts.filter(p => !p.featured || searchQuery);

  return (
    <div className="min-h-screen pt-32 pb-20 px-6 bg-paper dark:bg-[#0f0a1a] transition-colors duration-300">
      <div className="max-w-6xl mx-auto">
        <div className="mb-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-5xl md:text-7xl font-bold text-ink dark:text-white mb-4">The Blog</h1>
            <p className="text-lg text-ink/50 dark:text-slate-400 max-w-xl mx-auto mb-8">
              Updates, guides, and stories from the Gratonite team.
            </p>
            
            <div className="max-w-md mx-auto">
              <div className="relative">
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/40" />
                <input
                  type="text"
                  placeholder="Search posts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white dark:bg-[#1a1025] border border-gratonite/20 text-ink dark:text-white placeholder:text-ink/40 focus:outline-none focus:border-gratonite/40 transition-colors"
                />
              </div>
            </div>
          </motion.div>
        </div>

        {featuredPost && (
          <Link to={`/blog/${featuredPost.slug}`}>
            <motion.article 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-16 group relative overflow-hidden rounded-[4rem] bg-white dark:bg-[#1a1025] border border-gratonite/10 shadow-2xl shadow-[#7C3AED]/10 flex flex-col lg:flex-row cursor-pointer"
            >
              <div className="lg:w-1/2 h-64 lg:h-auto bg-gratonite-purple-soft/20 relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <img src="/gratonite-icon.png" alt="Gratonite" className="w-32 h-32 object-cover opacity-20" />
                </div>
              </div>
              <div className="lg:w-1/2 p-10 md:p-16 flex flex-col justify-center">
                <div className="flex items-center gap-4 mb-6">
                  <span className="px-4 py-1.5 rounded-full bg-gratonite text-white text-xs font-bold uppercase tracking-widest">
                    Featured: {featuredPost.category}
                  </span>
                  <span className="text-ink/30 text-sm font-medium">{featuredPost.date}</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-bold text-ink dark:text-white mb-6 group-hover:text-gratonite transition-colors">
                  {featuredPost.title}
                </h2>
                <p className="text-xl text-ink/50 dark:text-slate-400 mb-10 leading-relaxed font-serif">
                  {featuredPost.excerpt}
                </p>
                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gratonite-purple-soft/40" />
                    <span className="font-bold text-ink/60 dark:text-slate-400">{featuredPost.author}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gratonite font-bold group-hover:translate-x-2 transition-transform">
                    <span>Read Story</span>
                    <ChevronRight size={20} />
                  </div>
                </div>
              </div>
            </motion.article>
          </Link>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {regularPosts.map((post, idx) => (
            <Link key={post.id} to={`/blog/${post.slug}`}>
              <motion.article 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ y: -8 }}
                className="group bg-white dark:bg-[#1a1025] p-10 rounded-[3rem] border border-gratonite/5 shadow-sm hover:shadow-2xl hover:shadow-[#7C3AED]/15 transition-all cursor-pointer flex flex-col h-full"
              >
                <div className="flex items-center gap-4 mb-6">
                  <span className="px-3 py-1 rounded-full bg-gratonite-purple-soft/20 text-gratonite text-[10px] font-bold uppercase tracking-widest">
                    {post.category}
                  </span>
                  <span className="text-ink/20 text-xs font-medium">{post.date}</span>
                </div>
                
                <h3 className="text-2xl font-bold text-ink dark:text-white mb-4 group-hover:text-gratonite transition-colors leading-tight">
                  {post.title}
                </h3>
                <p className="text-ink/50 dark:text-slate-400 mb-8 leading-relaxed line-clamp-3">
                  {post.excerpt}
                </p>
                
                <div className="mt-auto pt-6 border-t border-gratonite/5 flex items-center justify-between">
                  <span className="text-xs font-bold text-ink/30 uppercase tracking-wider">{post.readTime}</span>
                  <div className="w-8 h-8 rounded-full bg-gratonite-purple-soft/20 flex items-center justify-center text-gratonite group-hover:bg-gratonite group-hover:text-white transition-all">
                    <ChevronRight size={16} />
                  </div>
                </div>
              </motion.article>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

const BlogPostPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  
  const posts = [
    {
      id: 1,
      slug: "welcome-to-gratonite",
      title: "Welcome to Gratonite — What We're Building and Why",
      excerpt: "Gratonite is a new kind of communication platform built for communities, gamers, and creators. Here's the vision behind it and where we're headed.",
      author: "Coodaye",
      date: "Feb 24, 2026",
      readTime: "4 min read",
      category: "Announcement",
      featured: true,
      content: "Gratonite is more than just a chat app — it's a space built for communities that want to connect without the noise. We're creating something different from the big tech platforms: no ads, no data selling, no corporate interference.\n\nOur focus is on three things: communities, gaming, and creators. Whether you're running a Discord server, streaming on Twitch, or building a fan community for your creative work, Gratonite gives you the tools to make it happen.\n\nWe're building this from the ground up with privacy and user control at the core. Your data stays yours. Your community, your rules."
    },
    {
      id: 2,
      slug: "desktop-app-released",
      title: "Desktop App Now Available: Download for Windows and Mac",
      excerpt: "The Gratonite desktop app is here. Download for Windows or Mac (Apple Silicon & Intel supported). Includes auto-updates and native notifications.",
      author: "Coodaye",
      date: "Feb 25, 2026",
      readTime: "2 min read",
      category: "Announcement",
      featured: true,
      content: "Good news — you can now download the Gratonite desktop app for both Windows and macOS!\n\n**What's included:**\n- Native desktop experience with system tray support\n- Auto-updates so you're always on the latest version\n- Native notifications that work with your OS\n- Better performance than the web version\n\n**Downloads:**\n- Windows: Gratonite-0.1.0.exe\n- macOS Apple Silicon (M1, M2, M3): Gratonite-0.1.0-arm64.dmg\n- macOS Intel: Gratonite-0.1.0-x64.dmg\n\nJust head to our download page and pick your version. No sign-up required to download — you can use the app or stick with the web version. Either way, your account works the same."
    },
    {
      id: 3,
      slug: "getting-started",
      title: "Getting Started with Gratonite: Your First Server",
      excerpt: "A step-by-step walkthrough for creating your first server, setting up channels, inviting friends, and customizing your space on Gratonite.",
      author: "Coodaye",
      date: "Feb 22, 2026",
      readTime: "5 min read",
      category: "Guide",
      content: "Welcome to Gratonite! This guide will walk you through setting up your first server.\n\n**Creating Your Server**\n1. Click the + button in the sidebar\n2. Select \"Create Server\"\n3. Give your server a name\n4. Choose an icon (optional)\n\n**Setting Up Channels**\nYour server comes with text and voice channels by default. You can:\n- Rename channels by right-clicking them\n- Create new categories for organization\n- Set channel permissions for different roles\n\n**Inviting Friends**\n1. Click \"Invite Members\" in your server\n2. Copy the invite link\n3. Share it anywhere!\n\n**Customizing Your Space**\n- Set server icon and banner\n- Create custom emojis\n- Set up roles with different permissions"
    },
    {
      id: 4,
      slug: "gratonites-currency",
      title: "Introducing Gratonites: Our Virtual Currency System",
      excerpt: "Earn Gratonites by chatting, logging in daily, and hitting milestones. Spend them in the Shop on profile cosmetics, decorations, and more.",
      author: "Coodaye",
      date: "Feb 20, 2026",
      readTime: "3 min read",
      category: "Feature"
    },
    {
      id: 5,
      slug: "voice-video-calls",
      title: "Voice & Video Calls on Gratonite",
      excerpt: "Low-latency voice and video calling is live. Jump into voice channels with your server or start private calls in DMs — no third-party apps needed.",
      author: "Coodaye",
      date: "Feb 18, 2026",
      readTime: "3 min read",
      category: "Feature"
    },
    {
      id: 6,
      slug: "profile-customization",
      title: "Customize Your Profile: Banners, Bios, and Cosmetics",
      excerpt: "Express yourself with custom avatars, profile banners, bios, color themes, animated decorations, and more. Your profile, your rules.",
      author: "Coodaye",
      date: "Feb 15, 2026",
      readTime: "4 min read",
      category: "Guide"
    },
    {
      id: 7,
      slug: "gratonite-shop",
      title: "The Gratonite Shop: What's Available Right Now",
      excerpt: "Browse avatar decorations, profile effects, nameplates, and animated frames in the Shop. Everything is earnable through Gratonites — no real money required.",
      author: "Coodaye",
      date: "Feb 12, 2026",
      readTime: "3 min read",
      category: "Feature"
    },
    {
      id: 8,
      slug: "server-discovery",
      title: "Server Discovery: Find Your Community",
      excerpt: "Use the Discover page to browse and join public servers across gaming, art, music, tech, and more. Filter by tags and find your people.",
      author: "Coodaye",
      date: "Feb 10, 2026",
      readTime: "3 min read",
      category: "Guide"
    },
    {
      id: 9,
      slug: "beta-roadmap",
      title: "Gratonite Beta Roadmap: What's Coming Next",
      excerpt: "A look at what's on deck for Gratonite — keyboard shortcuts, DM redesign, emoji system, leaderboard, bot integrations, and the mobile app.",
      author: "Coodaye",
      date: "Feb 08, 2026",
      readTime: "5 min read",
      category: "Roadmap"
    },
  ];

  const post = posts.find(p => p.slug === slug);
  
  if (!post) {
    return (
      <div className="min-h-screen pt-32 pb-20 px-6 bg-paper dark:bg-[#0f0a1a]">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4 dark:text-white">Post Not Found</h1>
          <p className="text-ink-light dark:text-slate-400 mb-8">The blog post you're looking for doesn't exist.</p>
          <button onClick={() => navigate('/blog')} className="text-gratonite hover:underline">
            ← Back to Blog
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen pt-32 pb-20 px-6 bg-paper dark:bg-[#0f0a1a] transition-colors duration-300">
      <div className="max-w-3xl mx-auto">
        <button 
          onClick={() => navigate('/blog')}
          className="flex items-center gap-2 text-gratonite mb-8 hover:underline"
        >
          <ArrowLeft size={20} />
          Back to Blog
        </button>
        
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-4 mb-6">
            <span className="px-4 py-1.5 rounded-full bg-gratonite text-white text-xs font-bold uppercase tracking-widest">
              {post.category}
            </span>
            <span className="text-ink/40 text-sm font-medium">{post.date}</span>
            <span className="text-ink/40 text-sm font-medium">{post.readTime}</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold mb-6 dark:text-white">
            {post.title}
          </h1>
          
          <div className="flex items-center gap-3 mb-12 pb-12 border-b border-gratonite/10">
            <div className="w-12 h-12 rounded-full bg-gratonite-purple-soft/40" />
            <span className="font-bold text-ink/60 dark:text-slate-400">{post.author}</span>
          </div>
          
          <div className="prose prose-lg dark:prose-invert max-w-none">
            {post.content ? (
              <div className="text-lg text-ink/70 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {post.content}
              </div>
            ) : (
              <div className="text-lg text-ink/50 dark:text-slate-400">
                {post.excerpt}
                <p className="mt-4">This post is coming soon. Check back later for updates!</p>
              </div>
            )}
          </div>
        </motion.article>
      </div>
    </div>
  );
};

const DiscoverPage = () => {
  const [activeTab, setActiveTab] = useState<"portals" | "bots" | "themes">("portals");
  
  const portals = [
    { name: "Gratonite HQ", members: "5.2k", desc: "Official Gratonite community server" },
    { name: "Indie Game Devs", members: "1.8k", desc: "Share your projects and get feedback" },
    { name: "Lo-Fi Beats", members: "2.1k", desc: "Chill music and good vibes" },
    { name: "Web Dev Hub", members: "3.4k", desc: "Frontend, backend, and everything between" },
    { name: "Digital Art Studio", members: "940", desc: "Share your art and get inspired" },
    { name: "Anime & Manga", members: "2.7k", desc: "Talk shows, share recommendations" },
  ];
  
  const bots = [
    { name: "MusicBot", desc: "Play tunes in your voice chats", icon: "🎵" },
    { name: "ModTools", desc: "Keep your server in line", icon: "🛡️" },
    { name: "GameStats", desc: "Track your gaming sessions", icon: "🎮" },
    { name: "PollMaster", desc: "Make decisions as a group", icon: "📊" },
  ];
  
  const themes = [
    { name: "Midnight Purple", author: "nightowl", preview: "bg-[#1a1025]" },
    { name: "Solar Flare", author: "sunbeam", preview: "bg-gradient-to-br from-orange-400 to-pink-500" },
    { name: "Ocean Deep", author: "waves", preview: "bg-gradient-to-br from-blue-400 to-teal-500" },
    { name: "Mint Fresh", author: "minty", preview: "bg-gradient-to-br from-green-400 to-teal-500" },
    { name: "Retro Wave", author: "neon", preview: "bg-gradient-to-br from-purple-500 to-pink-500" },
    { name: "Simple Light", author: "clean", preview: "bg-gray-100" },
  ];

  return (
    <div className="min-h-screen pt-32 pb-20 px-6 bg-paper dark:bg-[#0f0a1a] transition-colors duration-300">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-ink dark:text-white mb-4">Discover</h1>
          <p className="text-lg text-ink-light dark:text-slate-400 max-w-xl mx-auto">
            Find new stuff. Meet new people. Make Gratonite yours.
          </p>
        </div>
        
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {[
            { id: "portals", label: "Portals", icon: Globe },
            { id: "bots", label: "Bots", icon: Compass },
            { id: "themes", label: "Themes Shop", icon: Palette },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-medium transition-all ${
                activeTab === tab.id 
                  ? "gratonite-gradient text-white shadow-lg shadow-gratonite/30" 
                  : "bg-white dark:bg-[#1a1025] text-ink-light dark:text-slate-400 hover:bg-gratonite-purple-soft/30"
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "portals" && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {portals.map((portal, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ y: -4 }}
                className="p-6 rounded-3xl bg-white dark:bg-[#1a1025] border border-gratonite/10 hover:border-gratonite/30 transition-all cursor-pointer"
              >
                <div className="w-12 h-12 rounded-2xl bg-gratonite/10 flex items-center justify-center mb-4">
                  <Globe size={24} className="text-gratonite" />
                </div>
                <h3 className="text-xl font-bold text-ink dark:text-white mb-1">{portal.name}</h3>
                <p className="text-sm text-ink-light dark:text-slate-400 mb-3">{portal.desc}</p>
                <span className="text-xs font-medium text-gratonite">{portal.members} members</span>
              </motion.div>
            ))}
          </div>
        )}

        {activeTab === "bots" && (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {bots.map((bot, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ y: -4 }}
                className="p-6 rounded-3xl bg-white dark:bg-[#1a1025] border border-gratonite/10 hover:border-gratonite/30 transition-all cursor-pointer text-center"
              >
                <div className="text-4xl mb-4">{bot.icon}</div>
                <h3 className="text-lg font-bold text-ink dark:text-white mb-2">{bot.name}</h3>
                <p className="text-sm text-ink-light dark:text-slate-400">{bot.desc}</p>
              </motion.div>
            ))}
          </div>
        )}

        {activeTab === "themes" && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {themes.map((theme, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ y: -4 }}
                className="rounded-3xl overflow-hidden bg-white dark:bg-[#1a1025] border border-gratonite/10 hover:border-gratonite/30 transition-all cursor-pointer"
              >
                <div className={`h-32 ${theme.preview}`} />
                <div className="p-5">
                  <h3 className="text-lg font-bold text-ink dark:text-white mb-1">{theme.name}</h3>
                  <p className="text-sm text-ink-light dark:text-slate-400">by {theme.author}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <div className="mt-16 text-center">
          <a
            href="/app/discover"
            className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl gratonite-gradient text-white font-bold text-lg shadow-xl shadow-[#7C3AED]/30 hover:shadow-[#7C3AED]/50 transition-all no-underline"
          >
            <Compass size={20} />
            Explore All Servers in the App
          </a>
        </div>
      </div>
    </div>
  );
};

const SupportPage = () => {
  const topics = [
    {
      icon: HelpCircle,
      title: "Help Center",
      desc: "Find answers, browse guides, figure stuff out",
      link: "/blog"
    },
    {
      icon: Bug,
      title: "Report a Bug",
      desc: "Something broken? Let us know what went wrong",
      link: "mailto:bugs@gratonite.chat?subject=Bug%20Report"
    },
    {
      icon: Lightbulb,
      title: "Suggest Features",
      desc: "Got an idea? We actually read these. Sometimes we even build them.",
      link: "mailto:features@gratonite.chat?subject=Feature%20Suggestion"
    },
  ];

  return (
    <div className="min-h-screen pt-32 pb-20 px-6 bg-paper dark:bg-[#0f0a1a] transition-colors duration-300">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-ink dark:text-white mb-4">Support</h1>
        <p className="text-lg text-ink-light dark:text-slate-400 mb-16">
          We're just humans. We'll help if we can.
        </p>
        
        <div className="grid md:grid-cols-3 gap-6">
          {topics.map((topic, idx) => (
            <motion.a
              key={idx}
              href={topic.link}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ y: -4 }}
              className="p-8 rounded-3xl bg-white dark:bg-[#1a1025] border border-gratonite/10 hover:border-gratonite/30 transition-all cursor-pointer text-center block"
            >
              <div className="w-14 h-14 rounded-2xl bg-gratonite/10 flex items-center justify-center mx-auto mb-4">
                <topic.icon size={28} className="text-gratonite" />
              </div>
              <h3 className="text-lg font-bold text-ink dark:text-white mb-2">{topic.title}</h3>
              <p className="text-sm text-ink-light dark:text-slate-400">{topic.desc}</p>
            </motion.a>
          ))}
        </div>

        <div className="mt-16 p-8 rounded-3xl bg-gratonite-purple-soft/20 dark:bg-[#1a1025] border border-gratonite/10">
          <h3 className="text-lg font-bold text-ink dark:text-white mb-2">Can't find what you need?</h3>
          <p className="text-ink-light dark:text-slate-400 mb-4">
            Just shoot us an email. We actually reply. No bots, no autoresponders.
          </p>
          <a href="mailto:hello@gratonite.chat" className="text-gratonite font-medium hover:underline">
            hello@gratonite.chat
          </a>
        </div>
      </div>
    </div>
  );
};

const SafetyPage = () => (
  <div className="min-h-screen pt-32 pb-20 px-6 bg-paper dark:bg-[#0f0a1a] transition-colors duration-300">
    <div className="max-w-3xl mx-auto">
      <h1 className="text-4xl md:text-6xl font-bold text-ink dark:text-white mb-6">Safety</h1>
      <p className="text-lg text-ink-light dark:text-slate-400 mb-12">
        Your safety matters. Here's how we keep things chill.
      </p>
      
      <div className="space-y-8">
        {[
          { title: "Your Data is Yours", desc: "We don't sell your info. We don't build profiles on you. We don't even want your phone number." },
          { title: "End-to-End Encryption", desc: "Your messages are scrambled in a way only you and the recipient can read. Even we can't peek." },
          { title: "Block & Report", desc: "Got a jerk? Block them. Report them. We've got tools to keep the bad vibes away." },
          { title: "No Tracking", desc: "We don't track what you type, where you go, or who you talk to. That's the whole point." },
        ].map((item, idx) => (
          <div key={idx} className="p-6 rounded-2xl bg-white dark:bg-[#1a1025] border border-gratonite/10">
            <h3 className="text-xl font-bold text-ink dark:text-white mb-2">{item.title}</h3>
            <p className="text-ink-light dark:text-slate-400">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const NotFoundPage = () => {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen pt-32 pb-20 px-6 flex items-center justify-center bg-paper dark:bg-[#0f0a1a] relative overflow-hidden">
      <div className="organic-blob w-[400px] h-[400px] bg-gratonite/10 -top-20 -left-20" />
      <div className="organic-blob w-[300px] h-[300px] bg-gratonite-pink/10 -bottom-20 -right-20" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center relative z-10"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.2 }}
          className="text-9xl font-bold text-gradient mb-4"
        >
          404
        </motion.div>
        
        <h1 className="text-3xl font-bold text-ink dark:text-white mb-4">
          Uh oh. Lost in the void.
        </h1>
        
        <p className="text-ink-light dark:text-slate-400 mb-8 max-w-md">
          This page doesn't exist. Maybe it never did. Maybe it got lost along the way. 
          Either way, let's get you back home.
        </p>
        
        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/')}
          className="px-8 py-4 rounded-2xl gratonite-gradient text-white font-bold text-lg shadow-lg"
        >
          Back to Gratonite
        </motion.button>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleDark = () => setIsDark(!isDark);

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  return (
    <Router>
      <div className="font-sans selection:bg-gratonite/20 selection:text-ink dark:selection:text-white scroll-smooth transition-colors duration-300">
        <motion.div 
          className="fixed top-0 left-0 right-0 h-1.5 bg-gratonite z-[60] origin-left" 
          style={{ scaleX }} 
        />
        
        <Navbar isDark={isDark} toggleDark={toggleDark} />
        
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/download" element={<DownloadPage />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route path="/verify" element={<VerifyPage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
            <Route path="/discover" element={<DiscoverPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/safety" element={<SafetyPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
        
        <Footer />
      </div>
    </Router>
  );
}
