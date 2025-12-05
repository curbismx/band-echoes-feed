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
  artistAvatar?: string | null;
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
  onDrawerStateChange?: (isOpen: boolean) => void;
}

export const VideoCard = ({ 
  video, 
  isActive, 
  isMuted, 
  onUnmute, 
  onDrawerStateChange 
}: VideoCardProps) => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isFollowing, setIsFollowing] = useState(video.isFollowing);
  const [isLiked, setIsLiked] = useState(false);
  const [likes, setLikes] = useState(video.likes);
  const [artistAvatar, setArtistAvatar] = useState<string>(video.artistAvatar || "");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const { averageRating, userRating, submitRating } = useVideoRatings(video.id);
  const isDrawerOpen = commentsOpen || infoOpen;

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

  // Sync artist avatar with video prop
  useEffect(() => {
    setArtistAvatar(video.artistAvatar || "");
  }, [video.artistAvatar]);

  // Check follow status
  useEffect(() => {
    const checkFollowStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !video.artistUserId) return;
      
      const { data } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("followed_id", video.artistUserId)
        .maybeSingle();
      
      setIsFollowing(!!data);
    };
    checkFollowStatus();
  }, [video.artistUserId]);

  // VIDEO PLAYBACK - Simple as possible
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.play().catch(() => {
        // Silently fail - user will tap to unmute anyway
      });
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [isActive]);

  // Handle mute separately
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = isMuted;
    }
  }, [isMuted]);

  const handleFollow = async () => {
    const next = !isFollowing;
    setIsFollowing(next);
    const { data: { user } } = await supabase.auth.getUser();
    if (!video.artistUserId || !user) return;
    if (next) {
      const { error } = await supabase.from('follows').insert({ follower_id: user.id, followed_id: video.artistUserId });
      if (error) setIsFollowing(!next);
    } else {
      const { error } = await supabase.from('follows').delete().eq('follower_id', user.id).eq('followed_id', video.artistUserId);
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
      await supabase.from("favorites").insert({ user_id: user.id, video_id: video.id });
    } else {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("video_id", video.id);
    }
  };

  useEffect(() => {
    onDrawerStateChange?.(isDrawerOpen);
  }, [isDrawerOpen, onDrawerStateChange]);

  return (
    <div className="relative h-screen w-screen bg-black">
      <video
        ref={videoRef}
        src={video.videoUrl}
        poster={video.posterUrl}
        className="absolute inset-0 w-full h-full object-cover"
        loop
        muted
        playsInline
        onClick={onUnmute}
      />

      {/* Tap to unmute */}
      {isMuted && (
        <div 
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none flex flex-col items-center gap-2 animate-pulse"
        >
          <div className="bg-black/60 backdrop-blur-sm rounded-full p-4">
            <VolumeX className="w-8 h-8 text-white" />
          </div>
          <div className="text-white text-sm font-medium drop-shadow-lg">Tap to unmute</div>
        </div>
      )}

      {/* Left side info */}
      <div
        className="absolute z-20 pointer-events-auto"
        style={{ left: 38, bottom: 60, maxWidth: 'calc(65% - 50px)' }}
      >
        <button onClick={(e) => { e.stopPropagation(); navigate(`/user/${video.artistUserId}`); }} className="block bg-transparent border-0 p-0 m-0">
          <img 
            src={artistAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(video.artistName)}&background=${video.artistUserId.slice(0, 6)}&color=fff&size=64`} 
            alt="" 
            className="w-8 h-8 rounded-full object-cover mb-2 border-2 border-white" 
          />
        </button>
        <button onClick={(e) => { e.stopPropagation(); navigate(`/user/${video.artistUserId}`); }} className="font-bold text-white drop-shadow-lg mb-1 hover:underline text-left bg-transparent border-0 p-0">
          {video.artistName}
        </button>
        {video.title && <div className="font-medium text-white drop-shadow-lg mb-1 line-clamp-2">{video.title}</div>}
        {video.caption && <div className="text-white drop-shadow-lg text-sm line-clamp-2">{video.caption}</div>}
        <div className="flex gap-8 items-center mt-3">
          <button onClick={(e) => { e.stopPropagation(); handleFollow(); }}>
            <img src={isFollowing ? followedIcon : infoFollowIcon} alt="" className="h-8 w-auto" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setInfoOpen(true); }}>
            <img src={infoIcon} alt="" className="h-8 w-auto" />
          </button>
        </div>
      </div>

      {/* Right side actions */}
      <div className="absolute right-4 bottom-20 z-20 pointer-events-auto">
        <ActionButtons
          likes={likes}
          isLiked={isLiked}
          averageRating={averageRating}
          userRating={userRating}
          onLike={handleLike}
          onRate={submitRating}
          artistAvatar={artistAvatar}
          artistUserId={video.artistUserId}
          videoTitle={video.title || ""}
          artistName={video.artistName}
          videoId={video.id.toString()}
          onOpenComments={() => setCommentsOpen(true)}
        />
      </div>

      <CommentsDrawer videoId={video.id.toString()} isOpen={commentsOpen} onClose={() => setCommentsOpen(false)} />
      <InfoDrawer isOpen={infoOpen} onClose={() => setInfoOpen(false)} videoId={video.id.toString()} videoTitle={video.title} artistName={video.artistName} caption={video.caption} links={video.links} />
    </div>
  );
};