import { useState, useRef, useEffect } from "react";
import { ActionButtons } from "./ActionButtons";
import followIcon from "@/assets/follow-new.png";
import heart2Icon from "@/assets/heart_2-2.png";
import plusIcon from "@/assets/plus-2.png";
import shareIcon from "@/assets/share-2.png";
import dotsIcon from "@/assets/3-dots.png";
import favsIcon from "@/assets/favs_new.png";
import addIcon from "@/assets/new_add.png";
import shareNewIcon from "@/assets/new_share.png";

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
  const [menuCenterY, setMenuCenterY] = useState<number | null>(null);
  const [accountCenterY, setAccountCenterY] = useState<number | null>(null);
  const [menuCenterX, setMenuCenterX] = useState<number | null>(null);
  const [circleCenterY, setCircleCenterY] = useState<number | null>(null);
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
    
    // Close dock when video becomes inactive
    if (!isActive && showDock) {
      setShowDock(false);
    }
  }, [isActive, isPaused, showDock]);

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

      {/* Click area for video pause/play */}
      <div className="absolute inset-0 pointer-events-auto" onClick={handleVideoClick} />
      
      {/* Artist/Song Text - Above Follow Button */}
      <div
        className="absolute pointer-events-none z-20"
        style={{
          left: '30px',
          bottom: showDock && circleCenterY !== null
            ? `calc(100vh - ${circleCenterY}px + 15px + 30px)` 
            : menuCenterY !== null 
              ? `calc(100vh - ${menuCenterY - 10}px + 15px + 30px)`
              : '150px',
        }}
      >
        <div className="font-bold text-white drop-shadow-lg">The Bands Name</div>
        <div className="font-medium text-white drop-shadow-lg">The songs name</div>
      </div>

      {/* Follow Button - Left Side */}
      <button
        onClick={handleFollow}
        className="absolute pointer-events-auto z-20 p-0 border-0 bg-transparent"
        style={{
          left: '30px',
          top: showDock && circleCenterY !== null
            ? `${circleCenterY}px` 
            : menuCenterY !== null
              ? `${menuCenterY - 10}px`
              : '100px',
          transform: 'translateY(-50%)',
          height: '30px',
        }}
      >
        <img
          src={followIcon}
          alt="Follow"
          className={`h-[30px] w-auto transition-all ${
            isFollowing ? "opacity-50" : ""
          }`}
        />
      </button>
      
      <div className="absolute inset-0 flex flex-col justify-between p-4 pb-8 pr-[30px] pointer-events-none">
        {/* Bottom Content */}
        <div className="mt-auto flex items-end justify-end pointer-events-auto">
          {/* Action Buttons */}
          <ActionButtons
            likes={likes}
            isLiked={isLiked}
            rating={rating}
            onLike={handleLike}
            onRate={handleRate}
            showDock={showDock}
            onMenuClick={(pos) => { if (pos?.dockTop !== undefined) setDockTop(pos.dockTop!); if (pos?.menuLabelBottom !== undefined) setMenuLabelBottom(pos.menuLabelBottom!); if (pos?.menuCenterY !== undefined) setMenuCenterY(pos.menuCenterY!); if (pos?.menuCenterX !== undefined) setMenuCenterX(pos.menuCenterX!); setShowDock(!showDock); }}
            onButtonsMeasure={(pos) => { if (pos?.menuCenterY !== undefined) setMenuCenterY(pos.menuCenterY!); if (pos?.accountCenterY !== undefined) setAccountCenterY(pos.accountCenterY!); if (pos?.menuCenterX !== undefined) setMenuCenterX(pos.menuCenterX!); if (pos?.circleCenterY !== undefined) setCircleCenterY(pos.circleCenterY!); }}
          />
        </div>

        {/* Bottom Dock */}
        <div
          className={`absolute left-0 right-0 bottom-0 bg-black/70 backdrop-blur-md overflow-hidden transition-transform duration-300 ${showDock ? 'translate-y-0' : 'translate-y-full'}`}
          style={{ height: dockTop !== null ? `calc(100vh - ${dockTop}px)` : '0px' }}
        >
          {/* Dock icons row aligned to fixed Menu position */}
          <div
            className="absolute"
            style={{
              left: '40px',
              width: menuCenterX !== null ? `${menuCenterX + 15 - 40}px` : 'calc(100vw - 110px)',
              top: menuCenterY !== null && dockTop !== null ? `${menuCenterY - dockTop}px` : '0px',
              transform: 'translateY(-50%)',
            }}
          >
            <div className="flex items-center justify-between">
              {/* Favs */}
              <button className="flex flex-col items-center gap-1 action-button">
                <img src={favsIcon} alt="Favorites" className="h-[30px] w-[30px]" />
                <span className="text-xs font-semibold text-white drop-shadow-lg">favs</span>
              </button>

              {/* Add */}
              <button className="flex flex-col items-center gap-1 action-button">
                <img src={addIcon} alt="Add" className="h-[30px] w-[30px]" />
                <span className="text-xs font-semibold text-white drop-shadow-lg">add</span>
              </button>

              {/* Share */}
              <button className="flex flex-col items-center gap-1 action-button">
                <img src={shareNewIcon} alt="Share" className="h-[30px] w-[30px]" />
                <span className="text-xs font-semibold text-white drop-shadow-lg">share</span>
              </button>

              {/* Invisible placeholder matching Menu width (keeps spacing equal) */}
              <div aria-hidden="true" className="h-[30px]" style={{ width: '30px' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
