import { useState } from "react";
import { useNavigate } from "react-router-dom";
import starIcon from "@/assets/star.png";
import starOnIcon from "@/assets/star-on.png";
import heartIcon from "@/assets/heart.png";
import heartRedIcon from "@/assets/heart-red.png";
import accountIcon from "@/assets/account.png";
import circleIcon from "@/assets/circle-2.png";
import starRatingIcon from "@/assets/star-rating-icon.png";
import shareIcon from "@/assets/new_share.png";

interface ActionButtonsProps {
  likes: number;
  isLiked: boolean;
  averageRating: number;
  userRating: number | null;
  onLike: () => void;
  onRate: (rating: number) => void;
}

export const ActionButtons = ({
  likes,
  isLiked,
  averageRating,
  userRating,
  onLike,
  onRate,
}: ActionButtonsProps) => {
  const navigate = useNavigate();
  const [showRating, setShowRating] = useState(false);
  const [selectedStar, setSelectedStar] = useState<number | null>(null);

  const hasRated = userRating !== null;

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
    if ("vibrate" in navigator) {
      navigator.vibrate(50);
    }

    setSelectedStar(starRating);
    setTimeout(() => {
      setShowRating(false);
      onRate(starRating);
      setTimeout(() => setSelectedStar(null), 100);
    }, 1000);
  };

  const handleLikeClick = () => {
    if ("vibrate" in navigator) {
      navigator.vibrate(50);
    }
    onLike();
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator
        .share({ url })
        .catch(() => navigator.clipboard?.writeText(url));
    } else {
      navigator.clipboard?.writeText(url);
    }
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

          {showRating && (
            <div className="absolute bottom-full mb-2 flex flex-col gap-3">
              {[5, 4, 3, 2, 1].map((star) => (
                <div key={star} className="relative flex items-center justify-center">
                  {selectedStar === star && (
                    <div className="absolute inset-0 bg-yellow-400 rounded-full blur-xl scale-150 animate-pulse" />
                  )}
                  <button
                    onClick={() => handleStarClick(star)}
                    className={`relative transition-all duration-300 ${
                      selectedStar === star ? "scale-[2.5] z-50" : "hover:scale-110"
                    }`}
                  >
                    <img
                      src={starRatingIcon}
                      alt={`${star} stars`}
                      className={`h-[30px] w-[30px] transition-all duration-300 ${
                        selectedStar === star
                          ? "brightness-0 saturate-100 invert-[.65] sepia-100 hue-rotate-[10deg]"
                          : ""
                      }`}
                      style={{ filter: selectedStar === star ? "drop-shadow(0 0 16px gold)" : "none" }}
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
      <button onClick={handleLikeClick} className="action-button flex flex-col items-center gap-1 mt-[40px]">
        <img src={isLiked ? heartRedIcon : heartIcon} alt="Like" className="h-[30px] w-[30px] transition-all" />
        <span className="text-xs font-semibold text-white drop-shadow-lg">{formatNumber(likes)}</span>
      </button>

      {/* Share */}
      <button onClick={handleShare} className="action-button flex flex-col items-center gap-1 mt-[40px]">
        <img src={shareIcon} alt="Share" className="h-[30px] w-[30px]" />
      </button>

      {/* Account */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          navigate("/profile");
        }}
        className="action-button flex flex-col items-center gap-1 mt-[40px]"
      >
        <img src={accountIcon} alt="Account" className="h-[30px] w-[30px]" />
      </button>

      {/* Upload/Camera */}
      <button className="action-button mt-[40px]">
        <img src={circleIcon} alt="Upload" className="h-[30px] w-[30px]" />
      </button>
    </div>
  );
};