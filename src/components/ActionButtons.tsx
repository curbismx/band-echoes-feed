import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import starIcon from "@/assets/star.png";
import starOnIcon from "@/assets/star-on.png";
import starSingleIcon from "@/assets/star-single.png";
import heartIcon from "@/assets/heart.png";
import heartRedIcon from "@/assets/heart-red.png";
import accountIcon from "@/assets/account.png";
import circleIcon from "@/assets/circle-2.png";
import shareIcon from "@/assets/new_share.png";
import plusIcon from "@/assets/plus-3.png";
import commentsIcon from "@/assets/comments.png";
import followOffIcon from "@/assets/follow_OFF-2.png";
import followOnIcon from "@/assets/follow_ON-3.png";

interface ActionButtonsProps {
  likes: number;
  isLiked: boolean;
  averageRating: number;
  userRating: number | null;
  onLike: () => void;
  onRate: (rating: number) => void;
  artistAvatar?: string;
  artistUserId?: string;
  videoTitle?: string;
  artistName?: string;
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
  videoTitle = "Check out this video",
  artistName = "",
}: ActionButtonsProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [showRating, setShowRating] = useState(false);
  const [selectedStar, setSelectedStar] = useState<number | null>(null);
  const [hoverStar, setHoverStar] = useState<number | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const hasRated = userRating !== null;

  // Check if user is following the artist
  useEffect(() => {
    if (user && artistUserId && user.id !== artistUserId) {
      checkFollowStatus();
    }
  }, [user, artistUserId]);

  const checkFollowStatus = async () => {
    if (!user || !artistUserId) return;
    
    const { data } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("followed_id", artistUserId)
      .single();
    
    setIsFollowing(!!data);
  };

  const handleFollowToggle = async () => {
    setFollowLoading(true);

    // Optimistic UI toggle
    const next = !isFollowing;
    setIsFollowing(next);

    // If we don't have enough info to persist (no artist or self), just show UI change
    if (!artistUserId || !user || user.id === artistUserId) {
      setFollowLoading(false);
      return;
    }

    try {
      if (next) {
        // Follow
        await supabase
          .from("follows")
          .insert({
            follower_id: user.id,
            followed_id: artistUserId,
          });
        toast({
          title: "Following",
          description: `You are now following ${artistName}`,
        });
      } else {
        // Unfollow
        await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("followed_id", artistUserId);
        toast({
          title: "Unfollowed",
          description: `You unfollowed ${artistName}`,
        });
      }
    } catch (error) {
      // Revert on failure
      setIsFollowing(!next);
      toast({
        title: "Error",
        description: "Failed to update follow status",
        variant: "destructive",
      });
    } finally {
      setFollowLoading(false);
    }
  };

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

  const handleShare = async () => {
    if ("vibrate" in navigator) {
      navigator.vibrate(50);
    }

    const url = window.location.href;
    const shareData = {
      title: videoTitle,
      text: artistName ? `${videoTitle} by ${artistName}` : videoTitle,
      url: url
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled or share failed
        if (err instanceof Error && err.name !== 'AbortError') {
          // Share failed, copy to clipboard
          try {
            await navigator.clipboard.writeText(url);
            toast({
              title: "Link copied!",
              description: "Video link copied to clipboard",
            });
          } catch (clipboardErr) {
            toast({
              title: "Share failed",
              description: "Unable to share or copy link",
              variant: "destructive",
            });
          }
        }
      }
    } else {
      // Fallback for browsers that don't support Web Share API
      try {
        await navigator.clipboard.writeText(url);
        toast({
          title: "Link copied!",
          description: "Video link copied to clipboard",
        });
      } catch (err) {
        toast({
          title: "Copy failed",
          description: "Unable to copy link to clipboard",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="flex flex-col items-center relative z-40 -translate-y-[15px]">
      {/* Star Rating */}
      <div className="relative h-[30px] mt-0">
        <button
          onClick={handleRateClick}
          className="action-button flex items-center justify-center relative z-40"
          aria-expanded={showRating}
        >
            <img
              src={hasRated ? starOnIcon : starIcon}
              alt="Rate"
              className="h-[30px] w-auto relative z-20 transition-all"
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
                    className={`relative ${selectedStar === star ? "z-50 animate-pulse" : ""} transition-[filter,transform] duration-200 hover:scale-110 cursor-pointer`}
                  >
                    <img
                      src={starSingleIcon}
                      alt={`${star} stars`}
                      className={`inline-block object-contain w-auto h-[22px] transition-all duration-200 ${selectedStar === star ? "scale-125" : ""}`}
                      style={{ 
                        filter: ((selectedStar !== null && star <= selectedStar) || (hoverStar !== null && star <= hoverStar))
                          ? "brightness(0) saturate(100%) invert(85%) sepia(79%) saturate(2476%) hue-rotate(359deg) brightness(104%) contrast(101%)" 
                          : "brightness(0) invert(1)" 
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
      <div className="relative h-[30px] mt-[40px]">
        <button onClick={handleLikeClick} className="action-button flex items-center justify-center">
          <img src={isLiked ? heartRedIcon : heartIcon} alt="Like" className="h-[30px] w-[30px] transition-all" />
        </button>
        <span className="pointer-events-none absolute top-[34px] left-1/2 -translate-x-1/2 text-xs font-semibold text-white drop-shadow-lg">{formatNumber(likes)}</span>
      </div>

      {/* Comments */}
      <div className="relative h-[30px] mt-[40px]">
        <button className="action-button flex items-center justify-center">
          <img src={commentsIcon} alt="Comments" className="h-[30px] w-[30px]" />
        </button>
      </div>

      {/* Share */}
      <div className="relative h-[30px] mt-[40px]">
        <button onClick={handleShare} className="action-button flex items-center justify-center">
          <img src={shareIcon} alt="Share" className="h-[30px] w-[30px]" />
        </button>
      </div>

      {/* Follow Artist */}
      <div className="relative h-[30px] mt-[40px]">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            if ("vibrate" in navigator) {
              navigator.vibrate(50);
            }
            handleFollowToggle();
          }}
          disabled={followLoading}
          className="action-button flex items-center justify-center"
        >
          <img 
            src={isFollowing ? followOnIcon : followOffIcon} 
            alt={isFollowing ? "Unfollow" : "Follow"} 
            className="h-[30px] w-[30px]"
          />
        </button>
      </div>

      {/* Plus */}
      <div className="relative h-[30px] mt-[40px]">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            if ("vibrate" in navigator) {
              navigator.vibrate(50);
            }
            navigate("/upload");
          }}
          className="action-button flex items-center justify-center"
        >
          <img src={plusIcon} alt="Add" className="h-[30px] w-[30px]" />
        </button>
      </div>

      {/* Account */}
      <div className="relative h-[30px] mt-[40px]">
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
    </div>
  );
};