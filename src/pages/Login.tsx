import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Login() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };

  // Fake auth handler for demonstration
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate auth success and redirect to profiles selection
    navigate('/profiles');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col items-center justify-center relative overflow-hidden select-none" style={{ fontFamily: 'NetflixSans, system-ui, sans-serif' }}>
      
      {/* Cinematic Background Glow */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div 
          className="absolute top-[20%] left-[20%] w-[60%] h-[60%] blur-[120px] rounded-full opacity-30 mix-blend-screen"
          style={{ background: 'radial-gradient(circle, #7A00FF 0%, #2A00E6 50%, transparent 100%)' }}
        />
        <div 
          className="absolute bottom-0 left-[-10%] w-[50%] h-[50%] blur-[100px] rounded-full opacity-20 mix-blend-screen"
          style={{ background: 'radial-gradient(circle, #D433FF 0%, transparent 100%)' }}
        />
      </div>

      <div className="relative z-10 w-full max-w-[400px] px-6 flex flex-col items-center">
        
        {/* Logo Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex items-center gap-4 md:gap-5 mb-8"
        >
          <div 
            onMouseMove={handleMouseMove}
            className="w-10 h-10 md:w-12 md:h-12 glass-button-active rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(122,0,255,0.2)] rotate-45 relative"
          >
            <Play className="w-5 h-5 md:w-6 md:h-6 text-[#9e00ff] fill-[#9e00ff] -rotate-45 ml-1 relative z-10" />
          </div>
          <span 
            className="text-3xl md:text-4xl tracking-tight"
            style={{ fontFamily: '"Rekalgera-Regular", "Rekalgera", sans-serif' }}
          >
            Stremio
          </span>
        </motion.div>

        {/* Titles */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-center mb-10"
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-3 tracking-tight">Freedom to Stream</h1>
          <p className="text-white/50 text-sm md:text-base">All the video content you enjoy in one place</p>
        </motion.div>

        {/* Form Container */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full flex flex-col gap-4"
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
            
            <AnimatePresence mode="popLayout">
              <motion.div layout className="flex flex-col gap-3">
                <input 
                  type="email" 
                  placeholder="E-mail" 
                  required
                  className="w-full bg-[#141414] border border-white/5 rounded-md px-4 py-3.5 text-sm md:text-base text-white placeholder-white/40 focus:outline-none focus:border-[#7A00FF]/50 focus:ring-1 focus:ring-[#7A00FF]/50 transition-all"
                />
                
                <input 
                  type="password" 
                  placeholder="Password" 
                  required
                  className="w-full bg-[#141414] border border-white/5 rounded-md px-4 py-3.5 text-sm md:text-base text-white placeholder-white/40 focus:outline-none focus:border-[#7A00FF]/50 focus:ring-1 focus:ring-[#7A00FF]/50 transition-all"
                />

                {!isLogin && (
                  <motion.input 
                    initial={{ opacity: 0, height: 0, marginTop: -12 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
                    exit={{ opacity: 0, height: 0, marginTop: -12 }}
                    transition={{ duration: 0.3 }}
                    type="password" 
                    placeholder="Confirm password" 
                    required
                    className="w-full bg-[#141414] border border-white/5 rounded-md px-4 py-3.5 text-sm md:text-base text-white placeholder-white/40 focus:outline-none focus:border-[#7A00FF]/50 focus:ring-1 focus:ring-[#7A00FF]/50 transition-all"
                  />
                )}
              </motion.div>
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {isLogin ? (
                <motion.div 
                  key="login-extras"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex justify-end mt-1 mb-2"
                >
                  <button type="button" className="text-white/50 text-xs md:text-sm hover:text-white transition-colors">
                    Forgot password?
                  </button>
                </motion.div>
              ) : (
                <motion.div 
                  key="signup-extras"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-3 mt-2 mb-4"
                >
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center mt-0.5">
                      <input type="checkbox" className="peer appearance-none w-4 h-4 rounded bg-[#141414] border border-white/10 checked:bg-[#7A00FF] checked:border-[#7A00FF] transition-colors" required />
                      <div className="absolute opacity-0 peer-checked:opacity-100 pointer-events-none text-white">
                        <svg className="w-3 h-3" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 5L4.5 8.5L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                    <span className="text-xs md:text-sm text-white/50 leading-tight">
                      I have read and agree with the Stremio <button type="button" className="text-[#9e00ff] hover:underline">Terms and Conditions</button>
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center mt-0.5">
                      <input type="checkbox" className="peer appearance-none w-4 h-4 rounded bg-[#141414] border border-white/10 checked:bg-[#7A00FF] checked:border-[#7A00FF] transition-colors" required />
                      <div className="absolute opacity-0 peer-checked:opacity-100 pointer-events-none text-white">
                        <svg className="w-3 h-3" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 5L4.5 8.5L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                    <span className="text-xs md:text-sm text-white/50 leading-tight">
                      I have read and agree with the Stremio <button type="button" className="text-[#9e00ff] hover:underline">Privacy Policy</button>
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center mt-0.5">
                      <input type="checkbox" className="peer appearance-none w-4 h-4 rounded bg-[#141414] border border-white/10 checked:bg-[#7A00FF] checked:border-[#7A00FF] transition-colors" />
                      <div className="absolute opacity-0 peer-checked:opacity-100 pointer-events-none text-white">
                        <svg className="w-3 h-3" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 5L4.5 8.5L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                    <span className="text-xs md:text-sm text-white/50 leading-tight">
                      I agree to receive marketing communications from Stremio
                    </span>
                  </label>
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              type="submit" 
              onMouseMove={handleMouseMove}
              className="w-full relative glass-button-active text-white font-medium rounded-full py-3.5 transition-all duration-300 active:scale-[0.98]"
            >
              <span className="relative z-10">{isLogin ? 'Log in' : 'Sign up'}</span>
            </button>
          </form>

          {isLogin ? (
            <button 
              type="button"
              onClick={() => setIsLogin(false)}
              onMouseMove={handleMouseMove}
              className="w-full relative glass-button-hover text-white font-medium rounded-full py-3.5 transition-all duration-300 mt-2 active:scale-[0.98] border border-white/20"
            >
              <span className="relative z-10">Sign up with email</span>
            </button>
          ) : (
            <div className="flex items-center justify-center mt-4">
              <span className="text-white/50 text-sm">
                Already have an account?{' '}
                <button type="button" onClick={() => setIsLogin(true)} className="text-white hover:underline font-medium">
                  Log in
                </button>
              </span>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
