import { useState, useRef, useEffect, useCallback } from "react";
import { VideoCard } from "./VideoCard";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Only render videos within this range of the active index
const RENDER_WINDOW = 2;

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
  const [isAnyDrawerOpen, setIsAnyDrawerOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  // ============================================
  // FETCH VIDEOS
  // ============================================
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

      // Handle favorites from location state
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

  // ============================================
  // SCROLL TO CURRENT INDEX
  // ============================================
  useEffect(() => {
    const container = containerRef.current;
    if (!container || videos.length === 0) return;

    // Scroll to current video without animation on mount/index change
    const targetScroll = currentIndex * window.innerHeight;
    container.scrollTo({ top: targetScroll, behavior: 'auto' });
  }, [currentIndex, videos.length]);

  // ============================================
  // INTERSECTION OBSERVER FOR ACTIVE VIDEO
  // ============================================
  useEffect(() => {
    const container = containerRef.current;
    if (!container || videos.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const index = Number(entry.target.getAttribute('data-index'));
            if (!isNaN(index) && index !== currentIndex) {
              setCurrentIndex(index);
            }
          }
        });
      },
      {
        root: container,
        threshold: 0.5,
      }
    );

    // Observe all video items
    const items = container.querySelectorAll('[data-index]');
    items.forEach(item => observer.observe(item));

    return () => observer.disconnect();
  }, [videos.length, currentIndex]);

  // ============================================
  // KEYBOARD NAVIGATION
  // ============================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnyDrawerOpen) return;

      if (e.key === "ArrowUp" && currentIndex > 0) {
        e.preventDefault();
        scrollToIndex(currentIndex - 1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (isPlayingFavorites && currentIndex >= videos.length - 1) {
          exitFavorites();
        } else if (currentIndex < videos.length - 1) {
          scrollToIndex(currentIndex + 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, videos.length, isPlayingFavorites, isAnyDrawerOpen]);

  // ============================================
  // SAVE INDEX
  // ============================================
  useEffect(() => {
    if (!isPlayingFavorites) {
      sessionStorage.setItem("feedIndex", String(currentIndex));
    }
  }, [currentIndex, isPlayingFavorites]);

  // ============================================
  // HELPERS
  // ============================================
  const scrollToIndex = useCallback((index: number) => {
    const container = containerRef.current;
    if (!container) return;

    const clampedIndex = Math.max(0, Math.min(index, videos.length - 1));
    container.scrollTo({
      top: clampedIndex * window.innerHeight,
      behavior: 'smooth'
    });
  }, [videos.length]);

  const exitFavorites = useCallback(() => {
    setIsPlayingFavorites(false);
    setVideos(originalVideos);
    setCurrentIndex(originalIndex);
  }, [originalVideos, originalIndex]);

  // Check if a video should be rendered (windowed rendering)
  const shouldRenderVideo = useCallback((index: number) => {
    return Math.abs(index - currentIndex) <= RENDER_WINDOW;
  }, [currentIndex]);

  // ============================================
  // HANDLE SCROLL END FOR FAVORITES
  // ============================================
  const handleScroll = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      // Check if at end of favorites
      if (isPlayingFavorites && currentIndex >= videos.length - 1) {
        const container = containerRef.current;
        if (container) {
          const scrollTop = container.scrollTop;
          const maxScroll = (videos.length - 1) * window.innerHeight;
          // If user tried to scroll past end
          if (scrollTop > maxScroll + 50) {
            exitFavorites();
          }
        }
      }
    }, 150);
  }, [isPlayingFavorites, currentIndex, videos.length, exitFavorites]);

  // ============================================
  // RENDER
  // ============================================
  return (
    <div
      ref={containerRef}
      className="h-screen w-screen overflow-y-scroll overflow-x-hidden bg-black"
      style={{
        scrollSnapType: isAnyDrawerOpen ? 'none' : 'y mandatory',
        WebkitOverflowScrolling: 'touch',
        overscrollBehaviorY: 'contain',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
      onScroll={handleScroll}
    >
      <style>{`
        div::-webkit-scrollbar { display: none; }
      `}</style>

      {videos.map((video, index) => (
        <div
          key={video.id}
          data-index={index}
          className="w-screen"
          style={{
            height: '100dvh',
            scrollSnapAlign: 'start',
            scrollSnapStop: 'always',
          }}
        >
          {shouldRenderVideo(index) ? (
            <VideoCard
              video={video}
              isActive={index === currentIndex}
              isMuted={isMuted}
              onUnmute={() => setIsMuted(false)}
              isGloballyPaused={isGloballyPaused}
              onTogglePause={setIsGloballyPaused}
              onDrawerStateChange={setIsAnyDrawerOpen}
            />
          ) : (
            // Placeholder for videos outside render window
            <div className="w-full h-full bg-black flex items-center justify-center">
              {video.posterUrl && (
                <img
                  src={video.posterUrl}
                  alt=""
                  className="w-full h-full object-cover opacity-50"
                  loading="lazy"
                />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};