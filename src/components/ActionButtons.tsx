import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import starIcon from "@/assets/star.png";
import starOnIcon from "@/assets/star-on.png";
import heartIcon from "@/assets/heart.png";
import heartRedIcon from "@/assets/heart-red.png";
import menuIcon from "@/assets/menu.png";
import accountIcon from "@/assets/account.png";
import circleIcon from "@/assets/circle-2.png";
import starRatingIcon from "@/assets/star-rating-icon.png";

interface ActionButtonsProps {
  likes: number;
  isLiked: boolean;
  averageRating: number;
  userRating: number | null;
  onLike: () => void;
  onRate: (rating: number) => void;
  showDock: boolean;
  onMenuClick: (pos: { dockTop?: number; menuLabelBottom?: number; menuCenterY?: number; menuCenterX?: number }) => void;
  onButtonsMeasure?: (pos: { menuCenterY?: number; accountCenterY?: number; menuCenterX?: number; circleCenterY?: number }) => void;
}

export const ActionButtons = ({
  likes,
  isLiked,
  averageRating,
  userRating,
  onLike,
  onRate,
  showDock,
  onMenuClick,
  onButtonsMeasure,
}: ActionButtonsProps) => {
  const navigate = useNavigate();
  const [showRating, setShowRating] = useState(false);
  const [selectedStar, setSelectedStar] = useState<number | null>(null);
  const circleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const menuLabelRef = useRef<HTMLSpanElement>(null);
  const accountRef = useRef<HTMLButtonElement>(null);

  const hasRated = userRating !== null;

  useEffect(() => {
    const measure = () => {
      const pos: { menuCenterY?: number; accountCenterY?: number; menuCenterX?: number; circleCenterY?: number } = {};
      if (menuRef.current) {
        const rect = menuRef.current.getBoundingClientRect();
        pos.menuCenterY = rect.top + rect.height / 2;
        pos.menuCenterX = rect.left + rect.width / 2;
      }
      if (accountRef.current) {
        const rect = accountRef.current.getBoundingClientRect();
        pos.accountCenterY = rect.top + rect.height / 2;
      }
      if (circleRef.current) {
        const rect = circleRef.current.getBoundingClientRect();
        pos.circleCenterY = rect.top + rect.height / 2;
      }
      onButtonsMeasure?.(pos);
    };
    
    // Measure immediately
    measure();
    
    // Also measure after a short delay to ensure layout is stable
    const timer = setTimeout(measure, 100);
    
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      clearTimeout(timer);
    };
  }, [onButtonsMeasure]);
  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "k";
    }
    return num.toString();
  };

  const handleRateClick = () => {
    setShowRating(!showRating);
  };

  const handleStarClick = (starRating: number) => {
    // Haptic feedback on mobile
    if ('vibrate' in navigator) {
      navigator.vibrate(50); // Short vibration (50ms)
    }
    
    setSelectedStar(starRating);
    // Keep feedback visible for 1 second
    setTimeout(() => {
      setShowRating(false);
      onRate(starRating);
      setTimeout(() => setSelectedStar(null), 100);
    }, 1000);
  };

  const handleLikeClick = () => {
    // Haptic feedback on mobile
    if ('vibrate' in navigator) {
      navigator.vibrate(50); // Short vibration (50ms)
    }
    onLike();
  };

  return (
    <div className="flex flex-col items-center relative z-10">
      {/* Star Rating */}
      <button
        onClick={handleRateClick}
        className="action-button flex flex-col items-center gap-1 relative z-10"
      >
        <div className="relative flex items-center justify-center">
          <img 
            src={hasRated ? starOnIcon : starIcon} 
            alt="Rate" 
            className="h-[30px] w-[30px] relative z-20 transition-all"
          />
          
          {/* 5 Rating Stars */}
          {showRating && (
            <div className="absolute bottom-full mb-2 flex flex-col gap-3 animate-slide-in-from-top">
              {[5, 4, 3, 2, 1].map((star) => (
                <div 
                  key={star}
                  className="relative flex items-center justify-center"
                >
                  {/* Yellow glow background when selected */}
                  {selectedStar === star && (
                    <div className="absolute inset-0 bg-yellow-400 rounded-full blur-xl scale-150 animate-pulse" />
                  )}
                  <button
                    onClick={() => handleStarClick(star)}
                    className={`relative transition-all duration-300 ${
                      selectedStar === star 
                        ? "scale-[2.5] z-50" 
                        : "hover:scale-110"
                    }`}
                  >
                    <img 
                      src={starRatingIcon} 
                      alt={`${star} stars`}
                      className={`h-[30px] w-[30px] transition-all duration-300 ${
                        selectedStar === star ? "brightness-0 saturate-100 invert-[.65] sepia-100 hue-rotate-[10deg]" : ""
                      }`}
                      style={{
                        filter: selectedStar === star ? "drop-shadow(0 0 16px gold)" : "none"
                      }}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <span className="text-xs font-semibold text-white drop-shadow-lg">
          {averageRating > 0 ? averageRating.toFixed(1) : "0.0"}
        </span>
      </button>

      {/* Heart/Like */}
      <button
        onClick={handleLikeClick}
        className="action-button flex flex-col items-center gap-1 mt-[40px]"
      >
        <img
          src={isLiked ? heartRedIcon : heartIcon}
          alt="Like"
          className="h-[30px] w-[30px] transition-all"
        />
        <span className="text-xs font-semibold text-white drop-shadow-lg">
          {formatNumber(likes)}
        </span>
      </button>

      {/* Account */}
      <button 
        onClick={() => navigate('/profile')}
        className="action-button flex flex-col items-center gap-1 mt-[40px]" 
        ref={accountRef}
      >
        <img src={accountIcon} alt="Account" className="h-[30px] w-[30px]" />
        <span className="text-xs font-semibold text-white drop-shadow-lg">
          account
        </span>
      </button>

      {/* Upload/Camera Button */}
      {/* Upload/Camera Button */}
      <button className="action-button mt-[40px]" ref={circleRef}>
        <img src={circleIcon} alt="Upload" className="h-[30px] w-[30px]" />
      </button>

      {/* Menu */}
      <button 
        className="action-button flex flex-col items-center gap-1 mt-[40px]"
        ref={menuRef}
        onClick={() => {
          let menuTop: number | undefined;
          let menuLabelBottom: number | undefined;
          let menuCenterY: number | undefined;
          let menuCenterX: number | undefined;
          if (menuRef.current) {
            const menuRect = menuRef.current.getBoundingClientRect();
            menuTop = menuRect.top - 20;
            menuCenterY = menuRect.top + menuRect.height / 2;
            menuCenterX = menuRect.left + menuRect.width / 2;
          }
          if (menuLabelRef.current) {
            const labelRect = menuLabelRef.current.getBoundingClientRect();
            menuLabelBottom = window.innerHeight - labelRect.bottom;
          }
          onMenuClick({ dockTop: menuTop, menuLabelBottom, menuCenterY, menuCenterX });
        }}
      >
        <img src={menuIcon} alt="Menu" className="h-[30px] w-[30px]" />
        <span className="text-xs font-semibold text-white drop-shadow-lg" ref={menuLabelRef}>
          menu
        </span>
      </button>
    </div>
  );
};
