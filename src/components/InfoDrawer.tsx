import { X } from "lucide-react";
import { detectPlatform } from "@/utils/platformDetection";
import { getPlatformIcon } from "./PlatformIcons";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface InfoDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  videoTitle?: string;
  artistName?: string;
  caption?: string;
  links?: Array<{ url: string }>;
}

export const InfoDrawer = ({
  isOpen,
  onClose,
  videoTitle,
  artistName,
  caption,
  links = [],
}: InfoDrawerProps) => {
  const [drawerHeight, setDrawerHeight] = useState(50); // percentage of viewport
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startHeight, setStartHeight] = useState(50);
  
  // Reset drawer height when opening
  useEffect(() => {
    if (isOpen) {
      setDrawerHeight(50);
      setIsDragging(false);
    }
  }, [isOpen]);
  
  const triggerHaptic = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (error) {
      if ("vibrate" in navigator) {
        navigator.vibrate(50);
      }
    }
  };

  const handleLinkClick = async (url: string) => {
    triggerHaptic();
    window.open(url, '_blank');
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
    setStartHeight(drawerHeight);
    setIsDragging(true);
    e.stopPropagation();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    e.stopPropagation();
    
    const currentY = e.touches[0].clientY;
    const deltaY = startY - currentY;
    const viewportHeight = window.innerHeight;
    const deltaPercentage = (deltaY / viewportHeight) * 100;
    
    // Calculate new height with bounds (30% to 90%)
    const newHeight = Math.max(30, Math.min(90, startHeight + deltaPercentage));
    setDrawerHeight(newHeight);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    setIsDragging(false);
    
    const endY = e.changedTouches[0].clientY;
    const diff = startY - endY;
    
    // Snap to closest standard height based on final position
    if (drawerHeight < 40) {
      // Close if dragged below 40%
      onClose();
    } else if (drawerHeight < 65) {
      // Snap to 50% (default)
      setDrawerHeight(50);
    } else {
      // Snap to 80% (expanded)
      setDrawerHeight(80);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 animate-fade-in"
        style={{ zIndex: 9998 }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-[#1a1a1a] rounded-t-3xl animate-slide-in-from-bottom"
        style={{ 
          zIndex: 9999,
          height: `${drawerHeight}vh`,
          transition: isDragging ? 'none' : 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-white/30 rounded-full" />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="px-6 pb-6 overflow-y-auto" style={{ height: `calc(${drawerHeight}vh - 60px)` }}>
          {/* Video Info */}
          {(videoTitle || artistName || caption) && (
            <div className="mb-4">
              {videoTitle && (
                <h3 className="text-white font-semibold text-lg mb-1">{videoTitle}</h3>
              )}
              {artistName && (
                <p className="text-white/80 text-sm mb-2">{artistName}</p>
              )}
              {caption && (
                <p className="text-white/60 text-sm">{caption}</p>
              )}
            </div>
          )}

          {/* Links */}
          {links.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-white/80 text-sm font-semibold mb-2">Listen on:</h4>
              {links.map((link, index) => {
                const { platform } = detectPlatform(link.url);
                return (
                  <button
                    key={index}
                    onClick={() => handleLinkClick(link.url)}
                    className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 transition-colors p-4 rounded-xl"
                  >
                    <div className="text-white">
                      {getPlatformIcon(platform)}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-white font-medium">Listen on {platform}</p>
                    </div>
                    <svg
                      className="w-5 h-5 text-white/40"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </>,
    document.body
  );
};
