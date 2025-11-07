import { X } from "lucide-react";
import { detectPlatform } from "@/utils/platformDetection";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

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

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-[#1a1a1a] rounded-t-3xl z-50 animate-slide-in-from-bottom"
        style={{ maxHeight: '33vh' }}
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
        <div className="px-6 pb-6 overflow-y-auto" style={{ maxHeight: 'calc(33vh - 60px)' }}>
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
                const { platform, icon } = detectPlatform(link.url);
                return (
                  <button
                    key={index}
                    onClick={() => handleLinkClick(link.url)}
                    className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 transition-colors p-4 rounded-xl"
                  >
                    <span className="text-2xl">{icon}</span>
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

          {links.length === 0 && (
            <div className="text-center py-8 text-white/40 text-sm">
              No links available
            </div>
          )}
        </div>
      </div>
    </>
  );
};
