import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useStore } from '../../store/useStore';
import { generateDeviceCode, pollForToken } from '../../services/traktAuth';
import type { DeviceCodeResponse } from '../../services/traktAuth';
import { X, Tv, Smartphone, KeyRound, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

export const TraktAuthModal = () => {
  const { isTraktAuthModalOpen, setIsTraktAuthModalOpen, setTraktAccessToken } = useStore();
  const [deviceData, setDeviceData] = useState<DeviceCodeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isTraktAuthModalOpen) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      setDeviceData(null);
      setIsSuccess(false);
      setError(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    const initAuth = async () => {
      const data = await generateDeviceCode();
      if (!isMounted) return;
      
      if (data) {
        setDeviceData(data);
        setIsLoading(false);

        // Start polling for token
        pollIntervalRef.current = setInterval(async () => {
          try {
            const token = await pollForToken(data.device_code);
            if (token) {
              clearInterval(pollIntervalRef.current!);
              setTraktAccessToken(token);
              setIsSuccess(true);
              setTimeout(() => {
                setIsTraktAuthModalOpen(false);
              }, 3000);
            }
          } catch (err: any) {
            clearInterval(pollIntervalRef.current!);
            setError(err.message || "Failed to authenticate.");
            setIsLoading(false);
          }
        }, data.interval * 1000);
      } else {
        setError("Failed to connect to Trakt.tv");
        setIsLoading(false);
      }
    };

    initAuth();

    return () => {
      isMounted = false;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isTraktAuthModalOpen, setIsTraktAuthModalOpen, setTraktAccessToken]);

  if (!isTraktAuthModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Background Overlay */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={() => !isSuccess && setIsTraktAuthModalOpen(false)}
      />

      {/* Modal Container */}
      <div className="relative bg-[#141414] rounded-2xl w-full max-w-[600px] border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        
        {/* Close Button */}
        {!isSuccess && (
          <button 
            onClick={() => setIsTraktAuthModalOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        )}

        <div className="p-8 md:p-10 flex flex-col items-center text-center">
          
          <div className="w-16 h-16 bg-red-600/20 rounded-2xl flex items-center justify-center mb-6 border border-red-500/30">
            <Tv className="text-red-500 w-8 h-8" />
          </div>

          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Connect Trakt.tv
          </h2>
          <p className="text-white/60 mb-8 max-w-[400px]">
            Sync your real "Continue Watching" progress and full watch history directly to your TV dashboard.
          </p>

          {isLoading && !error && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-red-500 animate-spin mb-4" />
              <p className="text-white/40">Generating secure connection code...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-8">
              <AlertTriangle className="w-12 h-12 text-yellow-500 mb-4" />
              <p className="text-red-400 font-medium">{error}</p>
              <p className="text-white/40 text-sm mt-2 max-w-[300px]">
                Please ensure you have configured your VITE_TRAKT_CLIENT_SECRET environment variable.
              </p>
            </div>
          )}

          {isSuccess && (
            <div className="flex flex-col items-center justify-center py-8 animate-in slide-in-from-bottom-4">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Connected Successfully!</h3>
              <p className="text-green-400/80">Loading your real watch history...</p>
            </div>
          )}

          {deviceData && !isSuccess && !error && (
            <div className="w-full flex flex-col md:flex-row gap-8 items-center justify-center bg-white/5 rounded-xl p-6 border border-white/10">
              
              {/* QR Code */}
              <div className="bg-white p-3 rounded-xl shadow-inner shrink-0">
                <QRCodeSVG 
                  value={deviceData.verification_url} 
                  size={120}
                  level="Q"
                  includeMargin={false}
                />
              </div>

              <div className="flex flex-col items-center md:items-start text-center md:text-left">
                <div className="flex items-center gap-2 text-white/50 text-sm mb-3 font-medium uppercase tracking-wider">
                  <Smartphone className="w-4 h-4" />
                  <span>Scan or visit on mobile</span>
                </div>
                
                <a 
                  href={deviceData.verification_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-red-400 hover:text-red-300 font-medium text-lg mb-4 transition-colors"
                >
                  {deviceData.verification_url.replace('https://', '')}
                </a>

                <div className="flex items-center gap-2 text-white/50 text-sm mb-2 font-medium uppercase tracking-wider">
                  <KeyRound className="w-4 h-4" />
                  <span>Enter Code</span>
                </div>
                
                <div className="flex gap-2">
                  {deviceData.user_code.split('').map((char, i) => (
                    <div 
                      key={i} 
                      className="w-10 h-12 bg-black/40 border border-white/20 rounded-lg flex items-center justify-center text-xl font-bold text-white shadow-inner"
                    >
                      {char}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!isSuccess && !error && (
            <p className="text-white/30 text-xs mt-8">
              This screen will automatically close once you authorize the app on your device.
            </p>
          )}

        </div>
      </div>
    </div>
  );
};
