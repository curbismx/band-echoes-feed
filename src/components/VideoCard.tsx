import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ActionButtons } from "./ActionButtons";
import { useVideoRatings } from "@/hooks/useVideoRatings";
import { supabase } from "@/integrations/supabase/client";
import { CommentsDrawer } from "./CommentsDrawer";
import followOffIcon from "@/assets/follow_OFF.png";
import followOnIcon from "@/assets/follow_ON.png";
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
}

interface VideoCardProps {
  video: Video;
  isActive: boolean;
  isMuted: boolean;
  onUnmute: () => void;
}

export const VideoCard = ({ video, isActive, isMuted, onUnmute }: VideoCardProps) => {
  const navigate = useNavigate();
  const [isFollowing, setIsFollowing] = useState(video.isFollowing);
  const [isLiked, setIsLiked] = useState(false);
  const [likes, setLikes] = useState(video.likes);
  const [isPaused, setIsPaused] = useState(false);
  const [artistAvatar, setArtistAvatar] = useState<string>("");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { averageRating, userRating, submitRating } = useVideoRatings(video.id);

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
    if (videoRef.current) {
      if (isActive && !isPaused) {
        videoRef.current.play().catch(() => {
          // Handle autoplay restrictions
        });
      } else {
        videoRef.current.pause();
      }
    }
  }, [isActive, isPaused]);

  const handleVideoClick = () => {
    if (!videoRef.current) return;

    // On first interaction: unmute and ensure playback without pausing
    if (isMuted) {
      videoRef.current.muted = false;
      onUnmute();
      videoRef.current.play().catch(() => {});
      setIsPaused(false);
      return;
    }

    if (isPaused) {
      videoRef.current.play();
      setIsPaused(false);
    } else {
      videoRef.current.pause();
      setIsPaused(true);
    }
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
        playsInline
        muted={isMuted}
        onClick={handleVideoClick}
      />

      {/* Click area for video pause/play */}
      <div 
        className="absolute inset-0 z-10" 
        style={{ pointerEvents: 'auto' }}
        onClick={handleVideoClick} 
      />
      
      {/* Video Info Text - Left Side */}
      <div
        className="absolute z-20 max-w-[65%] pointer-events-auto"
        style={{
          left: '30px',
          bottom: '50px',
        }}
      >
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
          <div className="font-medium text-white drop-shadow-lg mb-1 pointer-events-none">
            {video.title}
          </div>
        )}
        {video.caption && (
          <div className="font-normal text-white drop-shadow-lg text-sm leading-relaxed mb-3 pointer-events-none">
            {video.caption}
          </div>
        )}
        
        {/* Info and Follow buttons */}
        <div className="flex gap-2 items-center">
          <button 
            onClick={(e) => e.stopPropagation()}
            className="h-[30px] w-[30px] flex items-center justify-center"
          >
            <img src={infoIcon} alt="Info" className="h-full w-full object-contain" />
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleFollow();
            }}
            className="h-[30px] w-[30px] flex items-center justify-center"
          >
            <img src={infoFollowIcon} alt="Follow" className="h-full w-full object-contain" />
          </button>
        </div>
      </div>
      
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
      
      <CommentsDrawer 
        videoId={video.id.toString()}
        isOpen={commentsOpen}
        onClose={() => setCommentsOpen(false)}
      />
    </div>
  );
};
