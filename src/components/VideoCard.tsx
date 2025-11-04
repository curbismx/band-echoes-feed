import { useState, useRef, useEffect } from "react";
import { ActionButtons } from "./ActionButtons";
import { useVideoRatings } from "@/hooks/useVideoRatings";
import { supabase } from "@/integrations/supabase/client";
import followOffIcon from "@/assets/follow_OFF.png";
import followOnIcon from "@/assets/follow_ON.png";

interface Video {
  id: number;
  artistName: string;
  artistUserId: string;
  videoUrl: string;
  likes: number;
  rating: number;
  isFollowing: boolean;
}

interface VideoCardProps {
  video: Video;
  isActive: boolean;
  isMuted: boolean;
  onUnmute: () => void;
}

export const VideoCard = ({ video, isActive, isMuted, onUnmute }: VideoCardProps) => {
  const [isFollowing, setIsFollowing] = useState(video.isFollowing);
  const [isLiked, setIsLiked] = useState(false);
  const [likes, setLikes] = useState(video.likes);
  const [isPaused, setIsPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { averageRating, userRating, submitRating } = useVideoRatings(video.id);

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

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikes((prev) => (isLiked ? prev - 1 : prev + 1));
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
      
      {/* Artist/Song Text - Above Follow Button */}
      <div
        className="absolute pointer-events-none z-20"
        style={{
          left: '30px',
          bottom: '99px',
        }}
      >
        <div className="font-bold text-white drop-shadow-lg">The Bands Name</div>
        <div className="font-medium text-white drop-shadow-lg">The songs name</div>
      </div>

      {/* Follow Button - Left Side, aligned with circle icon */}
      <button
        onClick={handleFollow}
        className="absolute pointer-events-auto z-20 p-0 border-0 bg-transparent"
        style={{
          left: '30px',
          bottom: '49px',
          height: '30px',
        }}
      >
        <img
          src={isFollowing ? followOnIcon : followOffIcon}
          alt="Follow"
          className="h-[30px] w-auto transition-all"
        />
      </button>
      
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
          />
        </div>

      </div>
    </div>
  );
};
