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
import { Volume2, VolumeX, Play } from "lucide-react";

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
  onDrawerStateChange?: (isOpen: boolean) => void;
  hasUserInteracted: boolean;
  onUserInteraction: () => void;
}

export const VideoCard = ({ 
  video, 
  isActive, 
  isMuted, 
  onUnmute, 
  isGloballyPaused, 
  onTogglePause, 
  preloadStrategy = "metadata", 
  onDrawerStateChange,
  hasUserInteracted,
  onUserInteraction
}: VideoCardProps) => {
  const navigate = useNavigate();
  const [isFollowing, setIsFollowing] = useState(video.isFollowing);
  const [isLiked, setIsLiked] = useState(false);
  const [likes, setLikes] = useState(video.likes);
  const [artistAvatar, setArtistAvatar] = useState<string>("");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [isUIHidden, setIsUIHidden] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  // Fetch artist profile avatar (only when video becomes active to reduce duplicate requests)
  useEffect(() => {
    if (!video.artistUserId || !isActive) return;
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
  }, [video.artistUserId, isActive]);

  // ===========================================
  // VIDEO PLAYBACK
  // ===========================================
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    // Always pause non-active videos immediately
    if (!isActive || isGloballyPaused) {
      v.pause();
      setIsPlaying(false);
      return;
    }

    // Don't try to autoplay until user has interacted (iOS requirement)
    if (!hasUserInteracted) {
      setIsPlaying(false);
      return;
    }

    // This video IS active and user has interacted - play it
    v.muted = isMuted;
    v.currentTime = 0;

    const attemptPlay = () => {
      const playPromise = v.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch((err) => {
            console.log("Play failed:", err);
            // Try muted as fallback
            v.muted = true;
            v.play()
              .then(() => setIsPlaying(true))
              .catch(() => setIsPlaying(false));
          });
      }
    };

    if (v.readyState >= 2) {
      attemptPlay();
    } else {
      const onCanPlay = () => {
        attemptPlay();
      };
      v.addEventListener("canplay", onCanPlay, { once: true });
      return () => v.removeEventListener("canplay", onCanPlay);
    }
  }, [isActive, isGloballyPaused, hasUserInteracted, video.id]);

  // Handle mute changes separately
  useEffect(() => {
    const v = videoRef.current;
    if (v && isActive && isPlaying) {
      v.muted = isMuted;
    }
  }, [isMuted, isActive, isPlaying]);

  const handleVideoClick = () => {
    // Mark that user has interacted
    if (!hasUserInteracted) {
      onUserInteraction();
    }
    
    // Try to play current video if not playing
    const v = videoRef.current;
    if (v && isActive && !isPlaying) {
      v.muted = true; // Start muted for first play
      v.play()
        .then(() => {
          setIsPlaying(true);
          // Now unmute if user preference
          if (!isMuted) {
            v.muted = false;
          }
        })
        .catch(() => {});
      return;
    }
    
    // If already playing, handle unmute
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

  const isDrawerOpen = commentsOpen || infoOpen;

  // Notify parent when drawer state changes
  useEffect(() => {
    onDrawerStateChange?.(isDrawerOpen);
  }, [isDrawerOpen, onDrawerStateChange]);

  // Show tap to play overlay when active but not playing (iOS initial state)
  const showTapToPlay = isActive && !isPlaying && !hasUserInteracted;

  return (
    <div className="relative h-screen w-screen">
      {/* Video Background */}
      <video
        ref={videoRef}
        src={video.videoUrl}
        className={`absolute inset-0 w-[100vw] h-[100vh] object-cover cursor-pointer ${isDrawerOpen ? 'pointer-events-none' : ''}`}
        loop
        playsInline
        {...({ 'webkit-playsinline': 'true' } as any)}
        preload={preloadStrategy}
        muted
        poster={video.posterUrl || "/placeholder.svg"}
        style={{ width: "100%", height: "100%", objectFit: "cover", background: "black" }}
        onClick={handleVideoClick}
        onError={(e) => {
          console.error("Video load error:", video.videoUrl, e);
        }}
        onLoadedData={() => {
          console.log("Video loaded successfully:", video.videoUrl);
        }}
      />

      {/* Click area for video */}
      <div 
        className={`absolute inset-0 z-10 ${isDrawerOpen ? 'pointer-events-none' : ''}`}
        style={{ pointerEvents: isDrawerOpen ? 'none' : 'auto' }}
        onClick={handleVideoClick} 
      />
      
      {/* Tap to play indicator (iOS first interaction) */}
      {showTapToPlay && (
        <div 
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none flex flex-col items-center gap-2"
        >
          <div className="bg-black/60 backdrop-blur-sm rounded-full p-5">
            <Play className="w-10 h-10 text-white" fill="white" />
          </div>
          <div className="text-white text-sm font-medium drop-shadow-lg">Tap to play</div>
        </div>
      )}
      
      {/* Unmute indicator (only show when playing but muted) */}
      {isMuted && isPlaying && (
        <div 
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none flex flex-col items-center gap-2"
          style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
        >
          <div className="bg-black/60 backdrop-blur-sm rounded-full p-4">
            <VolumeX className="w-8 h-8 text-white" />
          </div>
          <div className="text-white text-sm font-medium drop-shadow-lg">Tap to unmute</div>
        </div>
      )}
      
      {/* Video Info Text - Left Side */}
      {!isUIHidden && (
        <div
          className={`absolute z-20 ${isDrawerOpen ? 'pointer-events-none' : 'pointer-events-auto'}`}
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
        <div className={`mt-auto flex items-end justify-end mb-[10px] ${isDrawerOpen ? 'pointer-events-none' : 'pointer-events-auto'}`}>
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
