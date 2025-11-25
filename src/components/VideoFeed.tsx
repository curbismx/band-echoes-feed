import { useState, useRef, useEffect } from "react";
import { VideoCard } from "./VideoCard";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export const VideoFeed = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [videos, setVideos] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isGloballyPaused, setIsGloballyPaused] = useState(false);
  const [isPlayingFavorites, setIsPlayingFavorites] = useState(false);
  const [originalVideos, setOriginalVideos] = useState<any[]>([]);
  const [originalIndex, setOriginalIndex] = useState(0);

  const touchStart = useRef(0);
  const touchEnd = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isAnyDrawerOpen, setIsAnyDrawerOpen] = useState(false);

  // Fetch videos
  useEffect(() => {
    const fetchAndSort = async () => {
      const { data: videosData } = await supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false });

      if (!videosData) return;

      const userIds = [...new Set(videosData.map(v => v.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, display_name, username")
        .in("id", userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      const sorted = videosData.map(v => {
        const profile = profilesMap.get(v.user_id);
        return {
          ...v,
          posterUrl: v.thumbnail_url,
          videoUrl: v.video_url,
          likes: v.likes_count || 0,
          artistName: profile?.display_name || profile?.username || "Unknown Artist",
          artistUserId: v.user_id,
          rating: 0,
          isFollowing: false
        };
      });

      setVideos(sorted);

      if (location.state?.favoriteVideos && location.state?.startIndex !== undefined) {
        setOriginalVideos(sorted);
        const savedIndex = sessionStorage.getItem("feedIndex");
        setOriginalIndex(savedIndex ? Number(savedIndex) : 0);
        setVideos(location.state.favoriteVideos);
        setCurrentIndex(location.state.startIndex);
        setIsPlayingFavorites(true);
        window.history.replaceState({}, document.title);
      } else if (location.state?.videoId) {
        const videoIndex = sorted.findIndex(v => v.id === location.state.videoId);
        if (videoIndex !== -1) {
          setCurrentIndex(videoIndex);
        }
        window.history.replaceState({}, document.title);
      } else {
        const savedIndex = sessionStorage.getItem("feedIndex");
        if (savedIndex) {
          const idx = Number(savedIndex);
          if (idx >= 0 && idx < sorted.length) {
            setCurrentIndex(idx);
          }
        }
      }
    };

    fetchAndSort();
  }, [location.state]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnyDrawerOpen) return;
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setCurrentIndex(i => (i > 0 ? i - 1 : videos.length - 1));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (isPlayingFavorites && currentIndex >= videos.length - 1) {
          setVideos(originalVideos);
          setCurrentIndex(originalIndex);
          setIsPlayingFavorites(false);
        } else {
          setCurrentIndex(i => (i < videos.length - 1 ? i + 1 : 0));
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [videos.length, currentIndex, isPlayingFavorites, originalVideos, originalIndex, isAnyDrawerOpen]);

  // Save index
  useEffect(() => {
    sessionStorage.setItem("feedIndex", String(currentIndex));
  }, [currentIndex]);

  // Swipe handlers
  const MIN_SWIPE = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    if (isAnyDrawerOpen) return;
    touchStart.current = e.targetTouches[0].clientY;
    touchEnd.current = e.targetTouches[0].clientY;
    setIsDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || isAnyDrawerOpen) return;
    touchEnd.current = e.targetTouches[0].clientY;
    setDragOffset(touchEnd.current - touchStart.current);
  };

  const onTouchEnd = () => {
    if (isAnyDrawerOpen) {
      setIsDragging(false);
      setDragOffset(0);
      return;
    }
    setIsDragging(false);

    const distance = touchStart.current - touchEnd.current;

    if (distance > MIN_SWIPE) {
      if (isPlayingFavorites && currentIndex >= videos.length - 1) {
        setVideos(originalVideos);
        setCurrentIndex(originalIndex);
        setIsPlayingFavorites(false);
      } else {
        setCurrentIndex(i => (i < videos.length - 1 ? i + 1 : 0));
      }
    } else if (distance < -MIN_SWIPE) {
      setCurrentIndex(i => (i > 0 ? i - 1 : videos.length - 1));
    }

    setDragOffset(0);
  };

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-black"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="relative h-full"
        style={{
          transform: `translateY(calc(-${currentIndex * 100}vh + ${dragOffset}px))`,
          transition: isDragging ? "none" : "transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)"
        }}
      >
        {videos.map((video, i) => (
          <VideoCard
            key={video.id}
            video={video}
            isActive={i === currentIndex}
            isMuted={isMuted}
            onUnmute={() => setIsMuted(false)}
            isGloballyPaused={isGloballyPaused}
            onTogglePause={setIsGloballyPaused}
            onDrawerStateChange={setIsAnyDrawerOpen}
          />
        ))}
      </div>
    </div>
  );
};