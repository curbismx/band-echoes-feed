import { useState } from "react";
import starIcon from "@/assets/star.png";
import heartIcon from "@/assets/heart.png";
import menuIcon from "@/assets/menu.png";
import accountIcon from "@/assets/account.png";
import circleIcon from "@/assets/circle.png";

interface ActionButtonsProps {
  likes: number;
  isLiked: boolean;
  rating: number;
  onLike: () => void;
  onRate: (rating: number) => void;
}

export const ActionButtons = ({
  likes,
  isLiked,
  rating,
  onLike,
  onRate,
}: ActionButtonsProps) => {
  const [showRating, setShowRating] = useState(false);

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
    <div className="flex flex-col items-center gap-6">
      {/* Star Rating */}
      <button
        onClick={handleRateClick}
        className="action-button flex flex-col items-center gap-1"
      >
        <div className="relative">
          <img src={starIcon} alt="Rate" className="h-10 w-10" />
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
        className="action-button flex flex-col items-center gap-1"
      >
        <img
          src={heartIcon}
          alt="Like"
          className={`h-10 w-10 transition-all ${
            isLiked ? "scale-110 brightness-0 saturate-100 invert-[.35] sepia-100 hue-rotate-[340deg]" : ""
          }`}
        />
        <span className="text-xs font-semibold text-white drop-shadow-lg">
          {formatNumber(likes)}
        </span>
      </button>

      {/* Menu */}
      <button className="action-button flex flex-col items-center gap-1">
        <img src={menuIcon} alt="Menu" className="h-10 w-10" />
        <span className="text-xs font-semibold text-white drop-shadow-lg">
          menu
        </span>
      </button>

      {/* Account */}
      <button className="action-button flex flex-col items-center gap-1">
        <img src={accountIcon} alt="Account" className="h-10 w-10" />
        <span className="text-xs font-semibold text-white drop-shadow-lg">
          account
        </span>
      </button>

      {/* Upload/Camera Button */}
      <button className="action-button mt-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/50">
        <img src={circleIcon} alt="Upload" className="h-7 w-7" />
      </button>
    </div>
  );
};
