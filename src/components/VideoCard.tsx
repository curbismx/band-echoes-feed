import { useState, useRef, useEffect } from "react";
import { ActionButtons } from "./ActionButtons";
import { Button } from "./ui/button";

interface Video {
  id: number;
  artistName: string;
  videoUrl: string;
  likes: number;
  rating: number;
  isFollowing: boolean;
}

interface VideoCardProps {
  video: Video;
  isActive: boolean;
}

export const VideoCard = ({ video, isActive }: VideoCardProps) => {
  const [isFollowing, setIsFollowing] = useState(video.isFollowing);
  const [isLiked, setIsLiked] = useState(false);
  const [likes, setLikes] = useState(video.likes);
  const [rating, setRating] = useState(video.rating);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        videoRef.current.play().catch(() => {
          // Handle autoplay restrictions
        });
      } else {
        videoRef.current.pause();
      }
    }
  }, [isActive]);

  const handleFollow = () => {
    setIsFollowing(!isFollowing);
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikes((prev) => (isLiked ? prev - 1 : prev + 1));
  };

  const handleRate = (newRating: number) => {
    setRating(newRating);
  };

  return (
    <div className="relative h-screen w-screen">
      {/* Video Background */}
      <video
        ref={videoRef}
        src={video.videoUrl}
        className="absolute inset-0 h-full w-full object-cover"
        loop
        playsInline
        muted
      />

      {/* Dark overlay for better text visibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />

      {/* Content Overlay */}
      <div className="absolute inset-0 flex flex-col justify-between p-4 pb-8">
        {/* Bottom Content */}
        <div className="mt-auto flex items-end justify-between">
          {/* Artist Info */}
          <div className="flex-1 space-y-3">
            <h2 className="text-2xl font-bold text-white drop-shadow-lg">
              {video.artistName}
            </h2>
            <Button
              onClick={handleFollow}
              variant={isFollowing ? "secondary" : "default"}
              className={`rounded-full px-8 ${
                isFollowing
                  ? "border border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              {isFollowing ? "Following" : "Follow"}
            </Button>
          </div>

          {/* Action Buttons */}
          <ActionButtons
            likes={likes}
            isLiked={isLiked}
            rating={rating}
            onLike={handleLike}
            onRate={handleRate}
          />
        </div>
      </div>
    </div>
  );
};
