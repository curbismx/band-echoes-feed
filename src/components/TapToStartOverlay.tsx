import { Play } from "lucide-react";

interface TapToStartOverlayProps {
  posterUrl?: string;
  onTap: () => void;
}

export const TapToStartOverlay = ({ posterUrl, onTap }: TapToStartOverlayProps) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      onClick={onTap}
      style={{ touchAction: 'manipulation' }}
    >
      {posterUrl && (
        <img
          src={posterUrl}
          alt="Video poster"
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />
      )}
      <div className="relative z-10 flex flex-col items-center gap-4 text-white">
        <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
          <Play className="w-10 h-10 fill-white" />
        </div>
        <p className="text-xl font-medium">Tap to start</p>
      </div>
    </div>
  );
};
