import { useState, useRef, useEffect } from "react";
import starIcon from "@/assets/star.png";
import heartIcon from "@/assets/heart.png";
import menuIcon from "@/assets/menu.png";
import accountIcon from "@/assets/account.png";
import circleIcon from "@/assets/circle-2.png";
import starsSlider from "@/assets/stars-slider.png";

interface ActionButtonsProps {
  likes: number;
  isLiked: boolean;
  rating: number;
  onLike: () => void;
  onRate: (rating: number) => void;
  showDock: boolean;
  onMenuClick: (pos: { dockTop?: number; menuLabelBottom?: number; menuCenterY?: number; menuCenterX?: number }) => void;
  onButtonsMeasure?: (pos: { menuCenterY?: number; accountCenterY?: number; menuCenterX?: number; circleCenterY?: number }) => void;
}

export const ActionButtons = ({
  likes,
  isLiked,
  rating,
  onLike,
  onRate,
  showDock,
  onMenuClick,
  onButtonsMeasure,
}: ActionButtonsProps) => {
  const [showRating, setShowRating] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [currentRating, setCurrentRating] = useState(rating);
  const circleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const menuLabelRef = useRef<HTMLSpanElement>(null);
  const accountRef = useRef<HTMLButtonElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

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
    if (!hasRated) {
      setShowRating(!showRating);
    }
  };

  const calculateRating = (clientY: number) => {
    if (!sliderRef.current) return currentRating;
    
    const rect = sliderRef.current.getBoundingClientRect();
    const y = clientY - rect.top;
    const height = rect.height;
    
    // Calculate rating from 5 (top) to 0 (bottom)
    let rating = 5 - (y / height) * 5;
    rating = Math.max(0, Math.min(5, rating));
    rating = Math.round(rating * 10) / 10; // Round to 0.1 step
    
    return rating;
  };

  const handleSliderStart = (clientY: number) => {
    setIsDragging(true);
    const newRating = calculateRating(clientY);
    setCurrentRating(newRating);
  };

  const handleSliderMove = (clientY: number) => {
    if (isDragging) {
      const newRating = calculateRating(clientY);
      setCurrentRating(newRating);
    }
  };

  const handleSliderEnd = () => {
    if (isDragging) {
      setIsDragging(false);
      setShowRating(false);
      setHasRated(true);
      onRate(currentRating);
    }
  };

  useEffect(() => {
    if (isDragging) {
      const handleTouchMove = (e: TouchEvent) => {
        handleSliderMove(e.touches[0].clientY);
      };
      const handleMouseMove = (e: MouseEvent) => {
        handleSliderMove(e.clientY);
      };
      const handleTouchEnd = () => {
        handleSliderEnd();
      };
      const handleMouseUp = () => {
        handleSliderEnd();
      };

      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('touchend', handleTouchEnd);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('touchend', handleTouchEnd);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, currentRating]);

  return (
    <div className="flex flex-col items-center relative z-10">
      {/* Star Rating */}
      <button
        onClick={handleRateClick}
        className="action-button flex flex-col items-center gap-1 relative"
      >
        <div className="relative">
          <img 
            src={starIcon} 
            alt="Rate" 
            className={`h-[30px] w-[30px] transition-all ${
              hasRated ? "brightness-0 saturate-100 invert-[.65] sepia-100 hue-rotate-[10deg]" : ""
            }`}
          />
          
          {/* Star Rating Slider */}
          {showRating && (
            <div 
              ref={sliderRef}
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 animate-slide-in-from-top"
              onTouchStart={(e) => handleSliderStart(e.touches[0].clientY)}
              onMouseDown={(e) => handleSliderStart(e.clientY)}
              style={{
                touchAction: 'none',
              }}
            >
              <div className="relative w-[50px] h-[250px] rounded-full bg-black/70 backdrop-blur-md flex items-center justify-center">
                <img 
                  src={starsSlider} 
                  alt="Rating" 
                  className="w-[30px] h-auto pointer-events-none"
                  draggable={false}
                />
              </div>
            </div>
          )}
        </div>
        <span className="text-xs font-semibold text-white drop-shadow-lg">
          {hasRated ? currentRating.toFixed(1) : rating.toFixed(1)}
        </span>
      </button>

      {/* Heart/Like */}
      <button
        onClick={onLike}
        className="action-button flex flex-col items-center gap-1 mt-[40px]"
      >
        <img
          src={heartIcon}
          alt="Like"
          className={`h-[30px] w-[30px] transition-all ${
            isLiked ? "scale-110 brightness-0 saturate-100 invert-[.35] sepia-100 hue-rotate-[340deg]" : ""
          }`}
        />
        <span className="text-xs font-semibold text-white drop-shadow-lg">
          {formatNumber(likes)}
        </span>
      </button>

      {/* Account */}
      <button className="action-button flex flex-col items-center gap-1 mt-[40px]" ref={accountRef}>
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
