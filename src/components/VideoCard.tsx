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

export const VideoCard = ({ 
  video, 
  isActive, 
  isMuted, 
  onUnmute, 
  isGloballyPaused, 
  onTogglePause, 
  onDrawerStateChange 
}: VideoCardProps) => {
  const navigate = useNavigate();
  const [isFollowing, setIsFollowing] = useState(video.isFollowing);
  const [isLiked, setIsLiked] = useState(false);
  const [likes, setLikes] = useState(video.likes);
  const [artistAvatar, setArtistAvatar] = useState<string>("");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { averageRating, userRating, submitRating } = useVideoRatings(video.id);

  // Sync state with video prop changes
  useEffect(() => {
    setIsFollowing(video.isFollowing);
    setLikes(video.likes);
  }, [video.id, video.isFollowing, video.likes]);

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

  // Simple video play/pause logic
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if (!isActive || isGloballyPaused) {
      v.pause();
      return;
    }

    // Active - try to play
    v.muted = true;

    const tryPlay = () => {
      v.play()
        .then(() => {
          if (!isMuted) {
            setTimeout(() => {
              if (videoRef.current) videoRef.current.muted = false;
            }, 150);
          }
        })
        .catch(() => {
          v.muted = true;
          v.play().catch(() => {});
        });
    };

    if (v.readyState >= 2) {
      tryPlay();
    } else {
      v.addEventListener("canplay", tryPlay, { once: true });
      return () => v.removeEventListener("canplay", tryPlay);
    }
  }, [isActive, isGloballyPaused, isMuted, video.videoUrl]);

  const handleVideoClick = () => {
    onUnmute();
  };

  const handleFollow = async () => {
    const next = !isFollowing;
    setIsFollowing(next);

    const { data: { user } } = await supabase.auth.getUser();
    if (!video.artistUserId || !user) return;

    if (next) {
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: user.id, followed_id: video.artistUserId });
      if (error) setIsFollowing(!next);
    } else {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('followed_id', video.artistUserId);
      if (error) setIsFollowing(!next);
    }
  };

  const handleLike = async () => {
    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    setLikes((prev) => (isLiked ? prev - 1 : prev + 1));

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (newLikedState) {
      await supabase
        .from("favorites")
        .insert({ user_id: user.id, video_id: video.id });
    } else {
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

  useEffect(() => {
    onDrawerStateChange?.(isDrawerOpen);
  }, [isDrawerOpen, onDrawerStateChange]);

  return (
    <div className="relative h-screen w-screen">
      <video
        ref={videoRef}
        src={video.videoUrl}
        className={`absolute inset-0 w-full h-full object-cover ${isDrawerOpen ? 'pointer-events-none' : ''}`}
        loop
        playsInline
        {...({ webkitPlaysInline: true } as any)}
        preload="auto"
        muted
        poster={video.posterUrl || "/placeholder.svg"}
        onClick={handleVideoClick}
      />

      {/* Click area */}
      <div 
        className={`absolute inset-0 z-10 ${isDrawerOpen ? 'pointer-events-none' : ''}`}
        onClick={handleVideoClick} 
      />
      
      {/* Unmute indicator */}
      {isMuted && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none flex flex-col items-center gap-2 animate-pulse">
          <div className="bg-black/60 backdrop-blur-sm rounded-full p-4">
            <VolumeX className="w-8 h-8 text-white" />
          </div>
          <div className="text-white text-sm font-medium drop-shadow-lg">Tap to unmute</div>
        </div>
      )}
      
      {/* Video Info - Left Side */}
      <div
        className={`absolute z-20 ${isDrawerOpen ? 'pointer-events-none' : 'pointer-events-auto'}`}
        style={{ left: '30px', bottom: '60px', maxWidth: 'calc(65% - 50px)' }}
      >
        {artistAvatar && (
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/user/${video.artistUserId}`); }}
            className="block p-0 m-0 border-0 bg-transparent"
          >
            <img 
              src={artistAvatar} 
              alt={video.artistName}
              className="w-8 h-8 rounded-full object-cover mb-2 border-2 border-white"
            />
          </button>
        )}
        
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/user/${video.artistUserId}`); }}
          className="font-bold text-white drop-shadow-lg mb-1 hover:underline text-left"
        >
          {video.artistName}
        </button>
        
        {video.title && (
          <div className="font-medium text-white drop-shadow-lg mb-1 line-clamp-2">
            {video.title}
          </div>
        )}
        
        {video.caption && (
          <div className="text-white drop-shadow-lg text-sm mb-3 line-clamp-2">
            {video.caption}
          </div>
        )}
        
        <div className="flex gap-8 items-center">
          <button onClick={(e) => { e.stopPropagation(); handleFollow(); }}>
            <img 
              src={isFollowing ? followedIcon : infoFollowIcon} 
              alt={isFollowing ? "Following" : "Follow"} 
              className="h-8 w-auto" 
            />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setInfoOpen(true); }}>
            <img src={infoIcon} alt="Info" className="h-8 w-auto" />
          </button>
        </div>
      </div>
      
      {/* Action Buttons - Right Side */}
      <div className="absolute inset-0 flex flex-col justify-end p-4 pb-8 pr-8 pointer-events-none">
        <div className={`flex justify-end mb-3 ${isDrawerOpen ? 'pointer-events-none' : 'pointer-events-auto'}`}>
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
      </div>
      
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