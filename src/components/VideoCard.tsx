import { useState, useRef, useEffect, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { ActionButtons } from "./ActionButtons";
import { useVideoRatings } from "@/hooks/useVideoRatings";
import { supabase } from "@/integrations/supabase/client";
import { CommentsDrawer } from "./CommentsDrawer";
import { InfoDrawer } from "./InfoDrawer";
import followedIcon from "@/assets/followed.png";
import infoIcon from "@/assets/info.png";
import infoFollowIcon from "@/assets/info-follow.png";
import { VolumeX } from "lucide-react";

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
  onDrawerStateChange?: (isOpen: boolean) => void;
}

const VideoCardComponent = ({
  video,
  isActive,
  isMuted,
  onUnmute,
  isGloballyPaused,
  onTogglePause,
  onDrawerStateChange,
}: VideoCardProps) => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // UI State
  const [isFollowing, setIsFollowing] = useState(video.isFollowing);
  const [isLiked, setIsLiked] = useState(false);
  const [likes, setLikes] = useState(video.likes);
  const [artistAvatar, setArtistAvatar] = useState<string>("");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  
  // Video progress
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const { averageRating, userRating, submitRating } = useVideoRatings(video.id);
  const isDrawerOpen = commentsOpen || infoOpen;

  // Sync props to state
  useEffect(() => {
    setIsFollowing(video.isFollowing);
    setLikes(video.likes);
  }, [video.id, video.isFollowing, video.likes]);

  // ============================================
  // CORE VIDEO PLAYBACK - Single useEffect
  // ============================================
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    // Not active or globally paused = stop
    if (!isActive || isGloballyPaused) {
      v.pause();
      return;
    }

    // Active - attempt to play
    v.muted = true; // Always start muted for autoplay
    
    const playVideo = async () => {
      try {
        // Reset to start when becoming active
        v.currentTime = 0;
        await v.play();
        
        // If user has unmuted, apply after play starts
        if (!isMuted) {
          v.muted = false;
        }
      } catch (err) {
        // Autoplay blocked - stay muted and try again
        v.muted = true;
        v.play().catch(() => {});
      }
    };

    // Play immediately if ready, otherwise wait
    if (v.readyState >= 2) {
      playVideo();
    } else {
      const handleCanPlay = () => {
        playVideo();
        v.removeEventListener("canplay", handleCanPlay);
      };
      v.addEventListener("canplay", handleCanPlay);
      return () => v.removeEventListener("canplay", handleCanPlay);
    }
  }, [isActive, isGloballyPaused]);

  // Handle mute state changes separately (simpler)
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isActive) return;
    v.muted = isMuted;
  }, [isMuted, isActive]);

  // ============================================
  // DATA FETCHING
  // ============================================
  useEffect(() => {
    if (!isActive) return;
    
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
  }, [video.id, isActive]);

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

  // ============================================
  // EVENT HANDLERS
  // ============================================
  const handleVideoClick = useCallback(() => {
    if (isDrawerOpen) return;
    onUnmute();
  }, [isDrawerOpen, onUnmute]);

  const handleFollow = useCallback(async () => {
    const next = !isFollowing;
    setIsFollowing(next);

    const { data: { user } } = await supabase.auth.getUser();
    if (!video.artistUserId || !user) return;

    const { error } = next
      ? await supabase.from('follows').insert({ follower_id: user.id, followed_id: video.artistUserId })
      : await supabase.from('follows').delete().eq('follower_id', user.id).eq('followed_id', video.artistUserId);
    
    if (error) setIsFollowing(!next);
  }, [isFollowing, video.artistUserId]);

  const handleLike = useCallback(async () => {
    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    setLikes(prev => newLikedState ? prev + 1 : prev - 1);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (newLikedState) {
      await supabase.from("favorites").insert({ user_id: user.id, video_id: video.id });
    } else {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("video_id", video.id);
    }
  }, [isLiked, video.id]);

  const handleRate = useCallback((newRating: number) => {
    submitRating(newRating);
  }, [submitRating]);

  const seekFromClientX = useCallback((clientX: number, element: HTMLDivElement | null) => {
    const v = videoRef.current;
    if (!v || !element || !duration) return;
    const rect = element.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    v.currentTime = ratio * duration;
    setProgress(ratio);
  }, [duration]);

  const navigateToArtist = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigate(`/user/${video.artistUserId}`);
  }, [navigate, video.artistUserId]);

  // Notify parent of drawer state
  useEffect(() => {
    onDrawerStateChange?.(isDrawerOpen);
  }, [isDrawerOpen, onDrawerStateChange]);

  return (
    <div className="relative h-full w-full bg-black">
      {/* Video */}
      <video
        ref={videoRef}
        src={video.videoUrl}
        poster={video.posterUrl || "/placeholder.svg"}
        className="absolute inset-0 w-full h-full object-cover"
        loop
        playsInline
        muted
        preload="auto"
        onClick={handleVideoClick}
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

      {/* Click overlay */}
      {!isDrawerOpen && (
        <div className="absolute inset-0 z-10" onClick={handleVideoClick} />
      )}

      {/* Mute indicator */}
      {isMuted && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none flex flex-col items-center gap-2 animate-pulse">
          <div className="bg-black/60 backdrop-blur-sm rounded-full p-4">
            <VolumeX className="w-8 h-8 text-white" />
          </div>
          <div className="text-white text-sm font-medium drop-shadow-lg">Tap to unmute</div>
        </div>
      )}

      {/* Left side info */}
      {!isDrawerOpen && (
        <div
          className="absolute z-20 left-[30px] bottom-[60px]"
          style={{ maxWidth: 'calc(65% - 50px)' }}
        >
          {artistAvatar && (
            <button onClick={navigateToArtist} className="block p-0 m-0 border-0 bg-transparent">
              <img
                src={artistAvatar}
                alt={video.artistName}
                className="w-8 h-8 rounded-full object-cover mb-2 border-2 border-white"
              />
            </button>
          )}

          <button
            onClick={navigateToArtist}
            className="font-bold text-white drop-shadow-lg mb-1 cursor-pointer hover:underline text-left"
          >
            {video.artistName}
          </button>

          {video.title && (
            <div className="font-medium text-white drop-shadow-lg mb-1 line-clamp-2">
              {video.title}
            </div>
          )}

          {video.caption && (
            <div className="font-normal text-white drop-shadow-lg text-sm leading-relaxed mb-3 line-clamp-2">
              {video.caption}
            </div>
          )}

          <div className="flex gap-[30px] items-center" style={{ transform: 'translateY(3px)' }}>
            <button onClick={(e) => { e.stopPropagation(); handleFollow(); }} className="flex items-center justify-center">
              <img src={isFollowing ? followedIcon : infoFollowIcon} alt={isFollowing ? "Following" : "Follow"} className="h-[30px] w-auto" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setInfoOpen(true); }} className="flex items-center justify-center">
              <img src={infoIcon} alt="Info" className="h-[30px] w-auto" />
            </button>
          </div>
        </div>
      )}

      {/* Right side actions */}
      {!isDrawerOpen && (
        <div className="absolute bottom-[70px] right-[30px] z-20">
          <ActionButtons
            likes={likes}
            isLiked={isLiked}
            averageRating={averageRating}
            userRating={userRating}
            onLike={handleLike}
            onRate={handleRate}
            artistAvatar={artistAvatar}
            artistUserId={video.artistUserId}
            videoTitle={video.title || ""}
            artistName={video.artistName}
            videoId={video.id.toString()}
            onOpenComments={() => setCommentsOpen(true)}
          />
        </div>
      )}

      {/* Progress bar */}
      {duration > 0 && !isDrawerOpen && (
        <div className="absolute left-0 right-0 bottom-[24px] z-30 flex justify-center px-[5px]">
          <div
            className="relative w-[90%] h-[3px] rounded-full bg-white/30 overflow-hidden cursor-pointer"
            onMouseDown={(e) => { e.stopPropagation(); setIsScrubbing(true); seekFromClientX(e.clientX, e.currentTarget); }}
            onMouseUp={() => setIsScrubbing(false)}
            onMouseLeave={() => setIsScrubbing(false)}
            onTouchStart={(e) => { e.stopPropagation(); setIsScrubbing(true); seekFromClientX(e.touches[0]?.clientX, e.currentTarget); }}
            onTouchMove={(e) => { e.stopPropagation(); seekFromClientX(e.touches[0]?.clientX, e.currentTarget); }}
            onTouchEnd={() => setIsScrubbing(false)}
            onClick={(e) => { e.stopPropagation(); seekFromClientX(e.clientX, e.currentTarget); }}
          >
            <div className="absolute left-0 top-0 bottom-0 rounded-full bg-white" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      )}

      <CommentsDrawer videoId={video.id.toString()} isOpen={commentsOpen} onClose={() => setCommentsOpen(false)} />
      <InfoDrawer isOpen={infoOpen} onClose={() => setInfoOpen(false)} videoId={video.id.toString()} videoTitle={video.title} artistName={video.artistName} caption={video.caption} links={video.links} />
    </div>
  );
};

export const VideoCard = memo(VideoCardComponent);