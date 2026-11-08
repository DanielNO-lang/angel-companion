import React, { useEffect, useRef, useState } from 'react';
import { Camera, Monitor, X } from 'lucide-react';
import { mediaStreamService } from '../../services/mediaStreamService';

interface MediaStreamOverlaysProps {
  onCaptureCameraFrame?: (frameDataUrl: string) => void;
}

export const MediaStreamOverlays: React.FC<MediaStreamOverlaysProps> = ({ onCaptureCameraFrame }) => {
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(() => mediaStreamService.getCameraStream());
  const [screenStream, setScreenStream] = useState<MediaStream | null>(() => mediaStreamService.getScreenStream());
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const unsubscribe = mediaStreamService.subscribe({
      onCameraStreamChanged: (stream) => setCameraStream(stream),
      onScreenStreamChanged: (stream) => setScreenStream(stream),
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch((err) => console.warn('[CameraOverlay] Video play error:', err));
    }
  }, [cameraStream]);

  const handleStopScreenShare = () => {
    mediaStreamService.stopScreenShare();
  };

  const handleStopCamera = () => {
    mediaStreamService.stopCamera();
  };

  const handleCaptureSnapshot = () => {
    if (!videoRef.current || !cameraStream) return;
    try {
      const videoEl = videoRef.current;
      const offCanvas = document.createElement('canvas');
      offCanvas.width = videoEl.videoWidth || 640;
      offCanvas.height = videoEl.videoHeight || 480;
      const ctx = offCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoEl, 0, 0, offCanvas.width, offCanvas.height);
        const dataUrl = offCanvas.toDataURL('image/png');
        if (onCaptureCameraFrame) {
          onCaptureCameraFrame(dataUrl);
        }
      }
    } catch (err) {
      console.warn('[CameraOverlay] Snapshot capture error:', err);
    }
  };

  return (
    <>
      {/* 1. SCREEN SHARING VIEWPORT OUTLINE & TOP-RIGHT FLOATING CONTROLS */}
      {screenStream && (
        <>
          {/* Glowing Animated Viewport Outline Line flush with sidebar edge */}
          <div className="fixed top-0 bottom-0 right-0 left-0 md:left-16 lg:left-64 pointer-events-none z-40 border-4 border-cyan-400 shadow-[inset_0_0_30px_rgba(56,189,248,0.5)] animate-pulse transition-all duration-300" />

          {/* Floating Control Badge at Top Right */}
          <div className="fixed top-3 right-4 z-50 p-2.5 rounded-2xl bg-[#080c22]/95 border border-cyan-400/70 text-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.85),0_0_20px_rgba(56,189,248,0.4)] backdrop-blur-2xl flex items-center gap-3 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <Monitor className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Screen Sharing Active</span>
            </div>
            <button
              onClick={handleStopScreenShare}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md cursor-pointer shrink-0"
              title="End Screen Share"
            >
              <X className="w-3.5 h-3.5" />
              <span>Stop Screen Share</span>
            </button>
          </div>
        </>
      )}

      {/* 2. CAMERA LIVE PREVIEW HUD OVERLAY WINDOW */}
      {cameraStream && (
        <div className="fixed bottom-20 right-4 z-50 w-72 sm:w-80 rounded-3xl bg-[#080c22]/95 border border-cyan-400/60 shadow-[0_12px_45px_rgba(0,0,0,0.9),0_0_25px_rgba(56,189,248,0.35)] backdrop-blur-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
          {/* Header Controls */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-800/80 bg-slate-950/60">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <Camera className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Live Camera Feed</span>
            </div>
            <button
              onClick={handleStopCamera}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close Camera Feed"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Live Video Preview element */}
          <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />
          </div>

          {/* Actions Footer */}
          <div className="p-2.5 flex items-center justify-between gap-2 bg-slate-950/60 border-t border-slate-800/80">
            <button
              onClick={handleCaptureSnapshot}
              className="flex-1 py-1.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Capture Snapshot</span>
            </button>
            <button
              onClick={handleStopCamera}
              className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
            >
              End Feed
            </button>
          </div>
        </div>
      )}
    </>
  );
};
