import { useState, useRef } from "react";
import starIcon from "@/assets/star.png";
import heartIcon from "@/assets/heart.png";
import menuIcon from "@/assets/menu.png";
import accountIcon from "@/assets/account.png";

interface ActionButtonsProps {
  likes: number;
  isLiked: boolean;
  rating: number;
  onLike: () => void;
  onRate: (rating: number) => void;
  showDock: boolean;
  onMenuClick: (pos: { dockTop?: number; menuLabelBottom?: number; menuCenterY?: number; menuCenterX?: number }) => void;
  followButton?: React.ReactNode;
}

export const ActionButtons = ({
  likes,
  isLiked,
  rating,
  onLike,
  onRate,
  showDock,
  onMenuClick,
  followButton,
}: ActionButtonsProps) => {
  const [showRating, setShowRating] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const menuLabelRef = useRef<HTMLSpanElement>(null);

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "k";
    }
    return num.toString();
  };

  const handleRateClick = () => {
    setShowRating(!showRating);
  };

  const handleRatingSelect = (selectedRating: number) => {
    onRate(selectedRating);
    setShowRating(false);
  };

  return (
    <div className="flex flex-col items-center relative z-10">
      {/* Star Rating */}
      <button
        onClick={handleRateClick}
        className="action-button flex flex-col items-center gap-1"
      >
        <div className="relative">
          <img src={starIcon} alt="Rate" className="h-[30px] w-[30px]" />
          {showRating && (
            <div className="absolute right-16 top-0 flex gap-1 rounded-lg bg-black/80 p-2 backdrop-blur-sm">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                <button
                  key={num}
                  onClick={() => handleRatingSelect(num)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-sm font-semibold text-white transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  {num}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="text-xs font-semibold text-white drop-shadow-lg">
          {rating.toFixed(1)}
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
      <button className="action-button flex flex-col items-center gap-1 mt-[40px]">
        <img src={accountIcon} alt="Account" className="h-[30px] w-[30px]" />
        <span className="text-xs font-semibold text-white drop-shadow-lg">
          account
        </span>
      </button>

      {/* Follow Button - rendered when in state 2 */}
      {followButton && (
        <div className="action-button mt-[40px]">
          {followButton}
        </div>
      )}

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
