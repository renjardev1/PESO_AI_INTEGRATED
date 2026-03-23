// pages/LandingPage.jsx
import React from "react";
import { useLocation } from "react-router-dom"; 
import { motion } from "framer-motion"; // Import framer-motion para sa animations
import Navbar from "../components/Navbar"; 
import FeatureCard from "../components/FeatureCard"; 
import Footer from "../components/Footer";
import "../index.css";

// 1. Animation Variants - Dito nakadefine kung paano gagalaw ang elements
const fadeInUp = {
  hidden: { opacity: 0, y: 60 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { duration: 0.8, ease: "easeOut" } 
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.3,
      staggerChildren: 0.2 // 0.2s na pagitan bago lumitaw ang susunod na card
    }
  }
};

const blobAnimation = {
  animate: {
    scale: [1, 1.1, 1],
    opacity: [0.4, 0.6, 0.4],
    transition: {
      duration: 8,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

export default function LandingPage() {
  const location = useLocation();                
  const shouldOpenLogin = location.state?.fromSwitch; 

  return (
    <div className="font-sans text-slate-900 bg-white selection:bg-blue-100">
      <Navbar openLogin={shouldOpenLogin} /> 

      {/* --- HERO SECTION --- */}
      <section id="home" className="relative flex flex-col items-center justify-center px-8 md:px-24 py-32 lg:py-48 bg-slate-50 overflow-hidden text-center">
        
        {/* Animated Background Blur */}
        <motion.div 
          variants={blobAnimation}
          animate="animate"
          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-100 rounded-full blur-[150px] z-0"
        ></motion.div>

        <motion.div 
          className="max-w-4xl z-10"
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
        >
          <h2 className="text-6xl md:text-8xl font-extrabold mb-8 leading-[1.1] tracking-tight text-slate-900">
            Plan. Earn. Save. <br />
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 1 }}
              className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600"
            >
              Optimize.
            </motion.span> 
          </h2>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 1 }}
            className="text-xl md:text-2xl text-slate-600 mb-12 leading-relaxed max-w-2xl mx-auto"
          >
            Take total control of your financial future. PESO AI combines smart expense tracking with powerful insights to help you manage your wealth anywhere, anytime.
          </motion.p>

          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <a href="#features" className="bg-blue-600 text-white px-8 py-4 rounded-full font-bold text-lg shadow-lg hover:bg-blue-700 transition-colors">
              Explore Features
              </a>
          </motion.div>
        </motion.div>
      </section>

      {/* --- FEATURES SECTION --- */}
      <section id="features" className="px-8 md:px-24 py-24 bg-white">
        <motion.div 
          className="text-center mb-20"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeInUp}
        >
          <h3 className="text-blue-600 font-bold uppercase tracking-[0.25em] text-xs mb-4">Why PESO AI</h3>
          <h4 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">Financial Freedom Simplified</h4>
        </motion.div>
        
        {/* Container ng Cards na may Stagger Effect */}
        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={staggerContainer}
        >
          {/* Card 1 */}
          <motion.div variants={fadeInUp} whileHover={{ y: -12, transition: { duration: 0.2 } }}>
            <FeatureCard title="Smart Tracking" description="Automated expense monitoring." icon="🛡️" />
          </motion.div>

          {/* Card 2 */}
          <motion.div variants={fadeInUp} whileHover={{ y: -12, transition: { duration: 0.2 } }}>
            <FeatureCard title="Real-time Insights" description="AI-driven financial advice." icon="📊" />
          </motion.div>

          {/* Card 3 */}
          <motion.div variants={fadeInUp} whileHover={{ y: -12, transition: { duration: 0.2 } }}>
            <FeatureCard title="Goal Setting" description="Achieve your dreams faster." icon="⚔️" />
          </motion.div>

          {/* Card 4 */}
          <motion.div variants={fadeInUp} whileHover={{ y: -12, transition: { duration: 0.2 } }}>
            <FeatureCard title="Secure Data" description="Your privacy is our priority." icon="🏗️" />
          </motion.div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
}