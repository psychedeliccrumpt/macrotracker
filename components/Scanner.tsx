import React, { useRef, useState, useEffect } from 'react';
import { X, Image as ImageIcon, RotateCcw, Camera } from 'lucide-react';
import { analyzeFoodLabel } from '../services/geminiService';
import { SearchResult } from '../types';

interface ScannerProps {
  onScanComplete: (data: SearchResult) => void;
  onClose: () => void;
}

const Scanner: React.FC<ScannerProps> = ({ onScanComplete, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Connect stream to video element when both are ready
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      // Explicit play call for mobile browsers
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error("Auto-play was prevented:", error);
        });
      }
    }
  }, [stream]);

  const startCamera = async () => {
    setError(null);

    // Diagnostic: Check for secure context (HTTPS or localhost)
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setError("Camera access requires HTTPS. Please deploy to Vercel or use a secure connection to test on mobile.");
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Camera API not available on this browser. Try using the Upload button instead.");
      return;
    }

    try {
      // Try with ideal constraints first
      let constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(stream);
        setIsStreaming(true);
      } catch (e) {
        console.warn("Retrying with minimal constraints...");
        // Fallback to minimal constraints
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        setStream(fallbackStream);
        setIsStreaming(true);
      }
    } catch (err) {
      console.error("Camera error:", err);
      // Determine user-friendly error message
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError("Camera permission denied.");
      } else if (err instanceof DOMException && err.name === 'NotFoundError') {
        setError("No camera found.");
      } else {
        setError("Unable to access camera.");
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsStreaming(false);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsProcessing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      processImage(base64Image);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      stopCamera(); // Stop camera stream if uploading
      setIsProcessing(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Strip the data:image/jpeg;base64, prefix
        const base64String = result.split(',')[1];
        processImage(base64String);
      };
      reader.onerror = () => {
        setError("Failed to read file.");
        setIsProcessing(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async (base64String: string) => {
    try {
      const result = await analyzeFoodLabel(base64String);
      onScanComplete(result);
    } catch (err) {
      console.error(err);
      setError("Failed to analyze label. Please try again or ensure the text is clear.");
      setIsProcessing(false);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileUpload}
      />

      <div className="absolute top-4 right-4 z-20">
        <button onClick={onClose} className="p-3 bg-white border-3 border-black text-black hover:bg-accent hover:border-white hover:text-white transition-colors shadow-[4px_4px_0px_white]">
          <X size={24} strokeWidth={3} />
        </button>
      </div>

      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        {error ? (
          <div className="text-white p-8 text-center border-4 border-white m-4 bg-secondary w-full max-w-sm shadow-[8px_8px_0px_#FB7185]">
            <p className="mb-2 font-black uppercase tracking-widest text-xl text-accent">Camera Error</p>
            <p className="mb-8 font-mono text-sm">{error}</p>

            <div className="flex flex-col gap-4">
              <button
                onClick={() => { setError(null); startCamera(); }}
                className="w-full py-4 bg-white text-black font-black uppercase border-4 border-black hover:bg-highlight transition-colors shadow-[4px_4px_0px_black] flex items-center justify-center gap-2"
              >
                <RotateCcw size={20} strokeWidth={3} /> Retry Camera
              </button>

              <div className="text-center font-mono text-xs opacity-50">- OR -</div>

              <button
                onClick={triggerFileUpload}
                className="w-full py-4 bg-primary text-white font-black uppercase border-4 border-black hover:bg-violet-600 transition-colors shadow-[4px_4px_0px_black] flex items-center justify-center gap-2"
              >
                <ImageIcon size={20} strokeWidth={3} /> Upload Photo
              </button>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transition-opacity duration-300 ${isStreaming ? 'opacity-90' : 'opacity-0'}`}
            />

            {!isStreaming && (
              <div className="absolute inset-0 bg-secondary flex items-center justify-center">
                {isProcessing ? null : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                    <div className="text-white font-mono uppercase tracking-widest text-sm">Accessing Camera...</div>
                  </div>
                )}
              </div>
            )}

            {/* Neobrutalist Guide overlay */}
            {!isProcessing && isStreaming && (
              <div className="absolute inset-0 border-[8px] border-white m-8 pointer-events-none flex items-center justify-center">
                <div className="absolute top-0 left-0 w-12 h-12 bg-primary border-r-4 border-b-4 border-black"></div>
                <div className="absolute top-0 right-0 w-12 h-12 bg-accent border-l-4 border-b-4 border-black"></div>
                <div className="absolute bottom-0 left-0 w-12 h-12 bg-highlight border-r-4 border-t-4 border-black"></div>
                <div className="absolute bottom-0 right-0 w-12 h-12 bg-white border-l-4 border-t-4 border-black"></div>
                <span className="text-secondary font-black uppercase text-lg bg-white px-6 py-3 border-4 border-black shadow-[6px_6px_0px_#A78BFA] transform -rotate-2">Scan Label</span>
              </div>
            )}
          </>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Controls */}
      <div className="p-8 bg-white border-t-4 border-black flex justify-between items-center gap-4">
        <button
          onClick={triggerFileUpload}
          className="p-4 bg-white border-4 border-black shadow-[4px_4px_0px_black] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all active:bg-gray-100"
        >
          <ImageIcon size={28} strokeWidth={2.5} />
        </button>

        <button
          onClick={captureAndAnalyze}
          disabled={(!isStreaming && !isProcessing) || !!error}
          className={`w-24 h-24 rounded-full border-4 border-black flex items-center justify-center transition-transform ${isProcessing ? 'bg-black' : 'bg-accent active:scale-95 hover:bg-primary'}`}
        >
          {isProcessing ? (
            <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <div className="w-20 h-20 bg-white rounded-full border-4 border-black"></div>
          )}
        </button>

        {/* Spacer to balance layout */}
        <div className="w-[68px]"></div>
      </div>
    </div>
  );
};

export default Scanner;