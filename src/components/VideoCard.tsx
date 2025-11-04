import { useState, useRef, useEffect } from "react";
import { ActionButtons } from "./ActionButtons";
import followIcon from "@/assets/follow-2.png";
import heart2Icon from "@/assets/heart_2-2.png";
import plusIcon from "@/assets/plus-2.png";
import shareIcon from "@/assets/share-2.png";
import dotsIcon from "@/assets/3-dots.png";
import favsIcon from "@/assets/favs_new.png";

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
  const [isPaused, setIsPaused] = useState(false);
  const [showDock, setShowDock] = useState(false);
  const [dockTop, setDockTop] = useState<number | null>(null);
  const [menuLabelBottom, setMenuLabelBottom] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

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
    if (videoRef.current) {
      if (isPaused) {
        videoRef.current.play();
        setIsPaused(false);
      } else {
        videoRef.current.pause();
        setIsPaused(true);
      }
    }
  };

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
        className="absolute inset-0 w-[100vw] h-[100vh] object-cover cursor-pointer"
        loop
        playsInline
        muted
        onClick={handleVideoClick}
      />

      <div className="absolute inset-0 flex flex-col justify-between p-4 pb-8 pr-[30px]">
        {/* Bottom Content */}
        <div className="mt-auto flex items-end justify-between">
          {/* Artist Info and Follow */}
          <div className={`flex items-center gap-3 pb-[20px] transition-all duration-300 ${showDock ? '-translate-y-[70px]' : ''}`}>
            <h2 className="text-2xl font-bold text-white drop-shadow-lg">
              The Rising Stars
            </h2>
            <button
              onClick={handleFollow}
              className="flex items-center"
            >
              <img src={followIcon} alt="Follow" className="h-[30px]" />
            </button>
          </div>

          {/* Action Buttons */}
          <ActionButtons
            likes={likes}
            isLiked={isLiked}
            rating={rating}
            onLike={handleLike}
            onRate={handleRate}
            showDock={showDock}
            onMenuClick={(pos) => { if (pos?.dockTop !== undefined) setDockTop(pos.dockTop!); if (pos?.menuLabelBottom !== undefined) setMenuLabelBottom(pos.menuLabelBottom!); setShowDock(!showDock); }}
          />
        </div>

        {/* Bottom Dock */}
        <div
          className={`absolute left-0 right-0 bottom-0 bg-black/80 backdrop-blur-md transition-transform duration-300 ${showDock ? 'translate-y-0' : 'translate-y-full'}`}
          style={{ height: dockTop !== null ? `calc(100vh - ${dockTop}px)` : '0px' }}
        >
          <div className="absolute bottom-0 left-[30px]" style={{ paddingBottom: menuLabelBottom ?? 0 }}>
            <button className="flex flex-col items-center gap-1">
              <img src={favsIcon} alt="Favs" className="h-[30px] w-[30px]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
