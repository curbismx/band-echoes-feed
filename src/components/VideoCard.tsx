import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ActionButtons } from "./ActionButtons";
import { useVideoRatings } from "@/hooks/useVideoRatings";
import { supabase } from "@/integrations/supabase/client";
import { CommentsDrawer } from "./CommentsDrawer";
import { InfoDrawer } from "./InfoDrawer";
import followOffIcon from "@/assets/follow_OFF.png";
import followOnIcon from "@/assets/follow_ON.png";
import followedIcon from "@/assets/followed.png";
import infoIcon from "@/assets/info.png";
import infoFollowIcon from "@/assets/info-follow.png";

interface Video {
  id: string;
  artistName: string;
  artistUserId: string;
  videoUrl: string;
  likes: number;
  rating: number;
  isFollowing: boolean;
  title?: string;
  caption?: string;
  links?: Array<{ url: string }>;
  posterUrl?: string;
}

interface VideoCardProps {
  video: Video;
  isActive: boolean;
  isMuted: boolean;
  onUnmute: () => void;
  isGloballyPaused: boolean;
  onTogglePause: (paused: boolean) => void;
  preloadStrategy?: "auto" | "metadata" | "none";
}

export const VideoCard = ({ video, isActive, isMuted, onUnmute, isGloballyPaused, onTogglePause, preloadStrategy = "metadata" }: VideoCardProps) => {
  const navigate = useNavigate();
  const [isFollowing, setIsFollowing] = useState(video.isFollowing);
  const [isLiked, setIsLiked] = useState(false);
  const [likes, setLikes] = useState(video.likes);
  const [artistAvatar, setArtistAvatar] = useState<string>("");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [isUIHidden, setIsUIHidden] = useState(false);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastTapRef = useRef<number>(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resumeTimeRef = useRef<number | null>(null);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { averageRating, userRating, submitRating } = useVideoRatings(video.id);

  // Sync state with video prop changes
  useEffect(() => {
    setIsFollowing(video.isFollowing);
    setLikes(video.likes);
  }, [video.id, video.isFollowing, video.likes]);

  // Reset UI visibility and loading state when switching to a new video
  useEffect(() => {
    if (isActive) {
      setIsUIHidden(false);
      setVideoLoading(true);
      setVideoError(false);
      
      // Set a timeout to detect videos that never load (30 seconds)
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
      
      loadTimeoutRef.current = setTimeout(() => {
        if (videoLoading && isActive) {
          console.error("Video load timeout:", video.videoUrl);
          setVideoError(true);
          setVideoLoading(false);
        }
      }, 30000);
    }
    
    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, [isActive, video.id]);

  // Check if video is favorited
  useEffect(() => {
    const checkFavorite = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("favorites")
        .select("id")
        .eq("user_id", user.id)
        .eq("video_id", video.id)
        .maybeSingle();

      setIsLiked(!!data);
    };

    checkFavorite();
  }, [video.id]);

  // Fetch artist profile avatar
  useEffect(() => {
    if (!video.artistUserId) return;
    const fetchArtistProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", video.artistUserId)
        .maybeSingle();
      
      if (data?.avatar_url) {
        setArtistAvatar(data.avatar_url);
      }
    };

    fetchArtistProfile();
  }, [video.artistUserId]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    // CRITICAL: Pause immediately when inactive to prevent audio overlap
    if (!isActive) {
      v.pause();
      // Save current time when deactivated
      try {
        sessionStorage.setItem(`videoTime_${video.id}`, String(v.currentTime || 0));
      } catch {}
      return;
    }

    // Always unmute for native app experience and preview
    v.muted = false;

    if (!isGloballyPaused) {
      // Try to resume from saved position
      const key = `videoTime_${video.id}`;
      const saved = sessionStorage.getItem(key);
      if (saved) {
        const t = parseFloat(saved);
        if (!Number.isNaN(t) && t >= 0) {
          try {
            if (v.readyState >= 1) {
              v.currentTime = t;
            } else {
              resumeTimeRef.current = t;
            }
          } catch {}
        }
      }
      const playPromise = v.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.log("Autoplay attempt:", error);
        });
      }
    } else {
      v.pause();
    }
  }, [isActive, isGloballyPaused, video.id]);

  // On unmount, persist last position
  useEffect(() => {
    return () => {
      const v = videoRef.current;
      if (v) {
        try {
          sessionStorage.setItem(`videoTime_${video.id}`, String(v.currentTime || 0));
        } catch {}
      }
    };
  }, [video.id]);

  const handleVideoClick = () => {
    if (!videoRef.current) return;

    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;
    
    // Double tap detection (within 300ms)
    if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
      // Clear any pending single tap action
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      
      // Double tap: toggle UI visibility only
      setIsUIHidden(!isUIHidden);
      lastTapRef.current = 0; // Reset
      return;
    }
    
    lastTapRef.current = now;

    // Single tap: do nothing (no play/pause on tap)
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = null;
    }
    // No action for single tap
  };

  const handleFollow = async () => {
    // Optimistic UI toggle
    const next = !isFollowing;
    setIsFollowing(next);

    // Attempt to persist if logged in and we have an artist id
    const { data: { user } } = await supabase.auth.getUser();
    if (!video.artistUserId || !user) {
      return; // keep optimistic state locally
    }

    if (next) {
      // Follow
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: user.id, followed_id: video.artistUserId });
      if (error) setIsFollowing(!next); // revert on error
    } else {
      // Unfollow
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('followed_id', video.artistUserId);
      if (error) setIsFollowing(!next); // revert on error
    }
  };

  const handleLike = async () => {
    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    setLikes((prev) => (isLiked ? prev - 1 : prev + 1));

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (newLikedState) {
      // Add to favorites
      await supabase
        .from("favorites")
        .insert({ user_id: user.id, video_id: video.id });
    } else {
      // Remove from favorites
      await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("video_id", video.id);
    }
  };

  const handleRate = (newRating: number) => {
    submitRating(newRating);
  };

  return (
    <div className="relative h-screen w-screen">
      {/* Video Background */}
      <video
        ref={videoRef}
        src={video.videoUrl}
        className="absolute inset-0 w-[100vw] h-[100vh] object-cover cursor-pointer"
        loop
        autoPlay
        playsInline
        muted={false}
        preload={preloadStrategy}
        poster={video.posterUrl || "/placeholder.svg"}
        onClick={handleVideoClick}
        onError={(e) => {
          console.error("Video load error:", video.videoUrl, e);
          setVideoError(true);
          setVideoLoading(false);
          if (loadTimeoutRef.current) {
            clearTimeout(loadTimeoutRef.current);
          }
        }}
        onLoadedData={() => {
          console.log("Video loaded successfully:", video.videoUrl);
          setVideoLoading(false);
          setVideoError(false);
          if (loadTimeoutRef.current) {
            clearTimeout(loadTimeoutRef.current);
          }
        }}
        onWaiting={() => {
          console.log("Video buffering:", video.videoUrl);
        }}
        onStalled={() => {
          console.warn("Video stalled:", video.videoUrl);
        }}
        onLoadedMetadata={(e) => {
          try {
            const key = `videoTime_${video.id}`;
            const saved = sessionStorage.getItem(key);
            const t = saved ? parseFloat(saved) : (resumeTimeRef.current ?? 0);
            if (!Number.isNaN(t) && t > 0 && t < (e.currentTarget.duration || Infinity)) {
              e.currentTarget.currentTime = t;
            } else if (e.currentTarget.currentTime < 0.1) {
              e.currentTarget.currentTime = 0.1; // avoid black frame on some devices
            }
          } catch {}
        }}
        onTimeUpdate={(e) => {
          try {
            sessionStorage.setItem(`videoTime_${video.id}`, String(e.currentTarget.currentTime || 0));
          } catch {}
        }}
      />

      {/* Loading and Error States */}
      {videoLoading && !videoError && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-white/80 text-sm">Loading video...</p>
          </div>
        </div>
      )}
      
      {videoError && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 pointer-events-none">
          <div className="flex flex-col items-center gap-3 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-medium mb-1">Unable to load video</p>
              <p className="text-white/60 text-xs">This video may be processing or temporarily unavailable</p>
            </div>
          </div>
        </div>
      )}

      {/* Click area for video pause/play */}
      <div 
        className="absolute inset-0 z-10" 
        style={{ pointerEvents: 'auto' }}
        onClick={handleVideoClick} 
      />
      
      {/* Video Info Text - Left Side */}
      {!isUIHidden && (
        <div
          className="absolute z-20 pointer-events-auto"
          style={{
            left: '30px',
            bottom: '60px',
            maxWidth: 'calc(65% - 50px)',
          }}
        >
        {/* Artist Avatar */}
        {artistAvatar && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/user/${video.artistUserId}`);
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              e.preventDefault();
              navigate(`/user/${video.artistUserId}`);
            }}
            className="block cursor-pointer hover:opacity-80 transition-opacity touch-manipulation p-0 m-0 border-0 bg-transparent"
          >
            <img 
              src={artistAvatar} 
              alt={video.artistName}
              className="w-[32px] h-[32px] rounded-full object-cover mb-2 border-2 border-white"
            />
          </button>
        )}
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/user/${video.artistUserId}`);
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            e.preventDefault();
            navigate(`/user/${video.artistUserId}`);
          }}
          className="font-bold text-white drop-shadow-lg mb-1 cursor-pointer hover:underline text-left touch-manipulation"
        >
          {video.artistName}
        </button>
        {video.title && (
          <div className="font-medium text-white drop-shadow-lg mb-1 pointer-events-none line-clamp-2">
            {video.title}
          </div>
        )}
        {video.caption && (
          <div className="font-normal text-white drop-shadow-lg text-sm leading-relaxed mb-3 pointer-events-none line-clamp-2">
            {video.caption}
          </div>
        )}
        
        {/* Follow and Info buttons */}
        <div className="flex gap-[30px] items-center" style={{ transform: 'translateY(3px)' }}>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleFollow();
            }}
            className="flex items-center justify-center"
          >
            <img 
              src={isFollowing ? followedIcon : infoFollowIcon} 
              alt={isFollowing ? "Following" : "Follow"} 
              className="h-[30px] w-auto" 
            />
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setInfoOpen(true);
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setInfoOpen(true);
            }}
            className="flex items-center justify-center"
          >
            <img src={infoIcon} alt="Info" className="h-[30px] w-auto" />
          </button>
        </div>
      </div>
      )}
      
      {!isUIHidden && (
        <div className="absolute inset-0 flex flex-col justify-between p-4 pb-8 pr-[30px] pointer-events-none">
        {/* Bottom Content */}
        <div className="mt-auto flex items-end justify-end pointer-events-auto">
          {/* Action Buttons */}
      <ActionButtons
        likes={likes}
        isLiked={isLiked}
        averageRating={averageRating}
        userRating={userRating}
        onLike={handleLike}
        onRate={handleRate}
        artistAvatar={artistAvatar}
        artistUserId={video.artistUserId}
        videoTitle="The songs name"
        artistName={video.artistName}
        videoId={video.id.toString()}
        onOpenComments={() => setCommentsOpen(true)}
      />
        </div>

      </div>
      )}
      
      <CommentsDrawer 
        videoId={video.id.toString()}
        isOpen={commentsOpen}
        onClose={() => setCommentsOpen(false)}
      />

      <InfoDrawer 
        isOpen={infoOpen}
        onClose={() => setInfoOpen(false)}
        videoId={video.id.toString()}
        videoTitle={video.title}
        artistName={video.artistName}
        caption={video.caption}
        links={video.links}
      />
    </div>
  );
};
