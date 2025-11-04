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
  artistAvatar?: string;
  artistUserId?: string;
}

export const ActionButtons = ({
  likes,
  isLiked,
  averageRating,
  userRating,
  onLike,
  onRate,
  artistAvatar,
  artistUserId,
}: ActionButtonsProps) => {
  const navigate = useNavigate();
  const [showRating, setShowRating] = useState(false);
  const [selectedStar, setSelectedStar] = useState<number | null>(null);
  const [hoverStar, setHoverStar] = useState<number | null>(null);

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
    <div className="flex flex-col items-center relative z-40 -translate-y-[15px]">
      {/* Star Rating */}
      <div className="relative h-[30px] mt-0">
        <button
          onClick={handleRateClick}
          className={`action-button flex items-center justify-center relative z-40 ${showRating ? 'pointer-events-none' : ''}`}
          aria-expanded={showRating}
        >
            <img
              src={hasRated ? starOnIcon : starIcon}
              alt="Rate"
              className="h-[30px] w-[30px] relative z-20 transition-all"
            />
          </button>
          {showRating && (
            <div
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex flex-col gap-3 z-50 pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {[5, 4, 3, 2, 1].map((star) => (
                <div key={star} className="relative flex items-center justify-center">
                  {selectedStar === star && (
                    <div className="absolute inset-0 bg-yellow-400 rounded-full blur-xl scale-[3] animate-pulse" />
                  )}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); handleStarClick(star); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleStarClick(star); } }}
                    onMouseEnter={() => setHoverStar(star)}
                    onMouseLeave={() => setHoverStar(null)}
                    aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                    className={`relative ${selectedStar === star ? "z-50" : ""} transition-[filter,transform] duration-200 hover:scale-110 cursor-pointer`}
                  >
                    <img
                      src={starRatingIcon}
                      alt={`${star} stars`}
                      className="h-[22px] w-[22px] transition-all duration-200"
                      style={{ 
                        filter: ((selectedStar !== null && star <= selectedStar) || (hoverStar !== null && star <= hoverStar))
                          ? "sepia(1) saturate(5) hue-rotate(5deg) brightness(1.15) drop-shadow(0 0 12px rgba(255,215,0,0.8))" 
                          : "none" 
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        <span className="pointer-events-none absolute top-[34px] left-1/2 -translate-x-1/2 text-xs font-semibold text-white drop-shadow-lg">
          {averageRating > 0 ? averageRating.toFixed(1) : "0.0"}
        </span>
      </div>

      {/* Heart/Like */}
      <div className="relative h-[30px] mt-[50px]">
        <button onClick={handleLikeClick} className="action-button flex items-center justify-center">
          <img src={isLiked ? heartRedIcon : heartIcon} alt="Like" className="h-[30px] w-[30px] transition-all" />
        </button>
        <span className="pointer-events-none absolute top-[34px] left-1/2 -translate-x-1/2 text-xs font-semibold text-white drop-shadow-lg">{formatNumber(likes)}</span>
      </div>

      {/* Share */}
      <div className="relative h-[30px] mt-[50px]">
        <button onClick={handleShare} className="action-button flex items-center justify-center">
          <img src={shareIcon} alt="Share" className="h-[30px] w-[30px]" />
        </button>
      </div>

      {/* Account */}
      <div className="relative h-[30px] mt-[50px]">
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate("/profile");
          }}
          className="action-button flex items-center justify-center"
        >
          <img src={accountIcon} alt="Account" className="h-[30px] w-[30px]" />
        </button>
      </div>

      {/* Upload/Camera */}
      <div className="relative h-[30px] mt-[50px]">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            if (artistUserId) {
              navigate(`/user/${artistUserId}`);
            }
          }}
          className="action-button flex items-center justify-center"
        >
          {artistAvatar ? (
            <img 
              src={artistAvatar} 
              alt="Artist" 
              className="h-[30px] w-[30px] rounded-full object-cover border-2 border-white"
            />
          ) : (
            <img src={circleIcon} alt="Upload" className="h-[30px] w-[30px]" />
          )}
        </button>
      </div>
    </div>
  );
};