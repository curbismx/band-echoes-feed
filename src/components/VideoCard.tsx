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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);        // 0–1
  const [duration, setDuration] = useState(0);        // seconds
  const [isScrubbing, setIsScrubbing] = useState(false);

  const { averageRating, userRating, submitRating } = useVideoRatings(video.id);

  // Sync state with video prop changes
  useEffect(() => {
    setIsFollowing(video.isFollowing);
    setLikes(video.likes);
  }, [video.id, video.isFollowing, video.likes]);

  // Reset UI visibility when switching to a new video
  useEffect(() => {
    if (isActive) {
      setIsUIHidden(false);
    }
  }, [isActive]);

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

  // Simple video playback control
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if (!isActive || isGloballyPaused) {
      v.pause();
      return;
    }

    // Reset video to ensure fresh playback
    v.currentTime = 0;
    v.muted = isMuted;
    
    // Small delay to ensure video is ready
    const timer = setTimeout(() => {
      const playPromise = v.play();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise.catch((error) => {
          console.log("Autoplay blocked, retrying muted:", error);
          // If autoplay fails, force mute and retry
          v.muted = true;
          v.play().catch(err => console.log("Retry failed:", err));
        });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isActive, isGloballyPaused, isMuted]);

  const handleVideoClick = () => {
    onUnmute();
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

  const seekFromClientX = (clientX: number, element: HTMLDivElement | null) => {
    const v = videoRef.current;
    if (!v || !element || !duration) return;
    const rect = element.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    v.currentTime = ratio * duration;
    setProgress(ratio);
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
        {...({ 'webkit-playsinline': 'true' } as any)}
        muted={isMuted}
        preload={preloadStrategy || "metadata"}
        style={{ width: "100%", height: "100%", objectFit: "cover", background: "black" }}
        poster={video.posterUrl || "/placeholder.svg"}
        onClick={handleVideoClick}
        onError={(e) => {
          console.error("Video load error:", video.videoUrl, e);
        }}
        onLoadedData={() => {
          console.log("Video loaded successfully:", video.videoUrl);
        }}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (v.duration && !Number.isNaN(v.duration)) {
            setDuration(v.duration);
          }
        }}
        onTimeUpdate={(e) => {
          if (isScrubbing) return;
          const v = e.currentTarget;
          if (v.duration && v.currentTime >= 0) {
            setProgress(v.currentTime / v.duration);
          }
        }}
      />

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
        <div className="mt-auto flex items-end justify-end pointer-events-auto mb-[10px]">
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

      {/* Thin playback bar at bottom */}
      {duration > 0 && (
        <div
          className="absolute left-0 right-0 bottom-[24px] z-30 flex justify-center pointer-events-auto px-[5px]"
        >
          <div
            className="relative w-[90%] h-[3px] rounded-full bg-white/30 overflow-hidden"
            onMouseDown={(e) => {
              e.stopPropagation();
              setIsScrubbing(true);
              seekFromClientX(e.clientX, e.currentTarget);
            }}
            onMouseUp={(e) => {
              e.stopPropagation();
              setIsScrubbing(false);
            }}
            onMouseLeave={() => {
              setIsScrubbing(false);
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              const touch = e.touches[0];
              if (!touch) return;
              setIsScrubbing(true);
              seekFromClientX(touch.clientX, e.currentTarget);
            }}
            onTouchMove={(e) => {
              e.stopPropagation();
              const touch = e.touches[0];
              if (!touch) return;
              seekFromClientX(touch.clientX, e.currentTarget);
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              setIsScrubbing(false);
            }}
            onClick={(e) => {
              e.stopPropagation();
              const el = e.currentTarget as HTMLDivElement;
              seekFromClientX(e.clientX, el);
            }}
          >
            <div
              className="absolute left-0 top-0 bottom-0 rounded-full bg-white"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
