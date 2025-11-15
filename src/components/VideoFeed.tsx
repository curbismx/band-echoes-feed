import { useState, useRef, useEffect } from "react";
import { VideoCard } from "./VideoCard";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import backIcon from "@/assets/back.png";
import favsIcon from "@/assets/favs.png";

export const VideoFeed = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [videos, setVideos] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isGloballyPaused, setIsGloballyPaused] = useState(false);
  const [isPlayingFavorites, setIsPlayingFavorites] = useState(false);

  const touchStart = useRef(0);
  const touchEnd = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  /* --------------------------------------------------
      FETCH + SORT VIDEOS
  -------------------------------------------------- */
  useEffect(() => {
    const fetchAndSort = async () => {
      const { data: videosData } = await supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false });

      if (!videosData) return;

      // Basic sort: newest first
      const sorted = videosData.map(v => ({
        ...v,
        posterUrl: v.thumbnail_url,
        videoUrl: v.video_url
      }));

      setVideos(sorted);

      // restore index session
      const savedIndex = sessionStorage.getItem("feedIndex");
      if (savedIndex) {
        const idx = Number(savedIndex);
        if (idx >= 0 && idx < sorted.length) {
          setCurrentIndex(idx);
        }
      }
    };

    fetchAndSort();
  }, []);

  /* --------------------------------------------------
      SAVE INDEX PERSISTENTLY
  -------------------------------------------------- */
  useEffect(() => {
    sessionStorage.setItem("feedIndex", String(currentIndex));
  }, [currentIndex]);

  /* --------------------------------------------------
      SWIPE HANDLERS
  -------------------------------------------------- */
  const MIN_SWIPE = 60;

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.targetTouches[0].clientY;
    setIsDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    touchEnd.current = e.targetTouches[0].clientY;
    setDragOffset(touchEnd.current - touchStart.current);
  };

  const onTouchEnd = () => {
    setIsDragging(false);

    const distance = touchStart.current - touchEnd.current;

    if (distance > MIN_SWIPE) {
      // swipe UP
      setCurrentIndex(i =>
        i < videos.length - 1 ? i + 1 : 0
      );
    } else if (distance < -MIN_SWIPE) {
      // swipe DOWN
      setCurrentIndex(i =>
        i > 0 ? i - 1 : videos.length - 1
      );
    }

    setDragOffset(0);
  };

  /* --------------------------------------------------
      BACK FROM FAVORITES
  -------------------------------------------------- */
  const handleBack = () => {
    setIsPlayingFavorites(false);
    navigate("/", { replace: true });
  };

  /* --------------------------------------------------
      RENDER
  -------------------------------------------------- */
  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-black"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Back button when viewing favorites */}
      {isPlayingFavorites && (
        <div className="absolute top-[100px] left-[30px] z-30 flex items-center gap-3">
          <button onClick={handleBack}>
            <img src={backIcon} className="h-[30px]" />
          </button>
          <img src={favsIcon} className="h-[30px]" />
        </div>
      )}

      <div
        className="relative h-full"
        style={{
          transform: `translateY(calc(-${currentIndex * 100}vh + ${dragOffset}px))`,
          transition: isDragging ? "none" : "transform 0.4s ease-out"
        }}
      >
        {videos.map((video, i) => (
          <VideoCard
            key={video.id}
            video={{
              ...video,
              videoUrl: video.videoUrl,
              posterUrl: video.posterUrl
            }}
            isActive={i === currentIndex}
            isMuted={isMuted}
            onUnmute={() => setIsMuted(false)}
            isGloballyPaused={isGloballyPaused}
            onTogglePause={setIsGloballyPaused}
          />
        ))}
      </div>
    </div>
  );
};
