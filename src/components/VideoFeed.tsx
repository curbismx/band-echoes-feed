import { useState, useRef, useEffect, useCallback } from "react";
import { VideoCard } from "./VideoCard";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';

// Storage keys for persistent progress tracking
const STORAGE_KEYS = {
  CURRENT_INDEX: 'video_feed_current_index',
  WATCHED_IDS: 'video_feed_watched_ids',
  LAST_VIDEO_ID: 'video_feed_last_video_id',
};

const saveProgress = async (index: number, videoId: string, watchedIds: string[]) => {
  try {
    await Preferences.set({ key: STORAGE_KEYS.CURRENT_INDEX, value: index.toString() });
    await Preferences.set({ key: STORAGE_KEYS.LAST_VIDEO_ID, value: videoId });
    await Preferences.set({ key: STORAGE_KEYS.WATCHED_IDS, value: JSON.stringify(watchedIds) });
  } catch (e) {
    console.error('Failed to save progress:', e);
  }
};

const loadProgress = async (): Promise<{ lastIndex: number; lastVideoId: string | null; watchedIds: string[] }> => {
  try {
    const indexResult = await Preferences.get({ key: STORAGE_KEYS.CURRENT_INDEX });
    const videoIdResult = await Preferences.get({ key: STORAGE_KEYS.LAST_VIDEO_ID });
    const watchedResult = await Preferences.get({ key: STORAGE_KEYS.WATCHED_IDS });
    
    return {
      lastIndex: indexResult.value ? parseInt(indexResult.value, 10) : 0,
      lastVideoId: videoIdResult.value || null,
      watchedIds: watchedResult.value ? JSON.parse(watchedResult.value) : [],
    };
  } catch (e) {
    console.error('Failed to load progress:', e);
    return { lastIndex: 0, lastVideoId: null, watchedIds: [] };
  }
};

export const VideoFeed = () => {
  const location = useLocation();
  const [videos, setVideos] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isAnyDrawerOpen, setIsAnyDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [watchedIds, setWatchedIds] = useState<string[]>([]);
  const [progressLoaded, setProgressLoaded] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);

  // Fetch videos on mount
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Load saved progress first
        const { lastIndex, lastVideoId, watchedIds: savedWatchedIds } = await loadProgress();
        setWatchedIds(savedWatchedIds);
        
        const { data: videosData, error: videosError } = await supabase
          .from("videos")
          .select("*")
          .order("created_at", { ascending: false });

        if (videosError) {
          console.error("Error fetching videos:", videosError);
          setError("Failed to load videos. Please refresh the page.");
          setLoading(false);
          return;
        }

        if (!videosData || videosData.length === 0) {
          setVideos([]);
          setLoading(false);
          return;
        }

        const userIds = [...new Set(videosData.map(v => v.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", userIds);

        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        console.log('📸 Profiles loaded:', profilesData?.length, 'profiles');

        const formatted = videosData.map((v, index) => {
          const profile = profilesMap.get(v.user_id);
          console.log(`Video ${index}: user_id=${v.user_id}, profile_found=${!!profile}, avatar=${profile?.avatar_url || 'null'}`);
          return {
            ...v,
            posterUrl: v.thumbnail_url,
            videoUrl: v.video_url,
            likes: v.likes_count || 0,
            artistName: profile?.display_name || profile?.username || "Unknown Artist",
            artistAvatar: profile?.avatar_url || null,
            artistUserId: v.user_id,
            rating: 0,
            isFollowing: false
          };
        });

        setVideos(formatted);
        setLoading(false);
        setProgressLoaded(true);

        // Handle navigation from other pages (takes priority)
        if (location.state?.videoId) {
          const idx = formatted.findIndex(v => v.id === location.state.videoId);
          if (idx !== -1) {
            setCurrentIndex(idx);
            setTimeout(() => {
              containerRef.current?.scrollTo({ top: idx * window.innerHeight, behavior: 'auto' });
            }, 0);
          }
          window.history.replaceState({}, document.title);
        } 
        // Otherwise restore saved position
        else if (lastVideoId) {
          const idx = formatted.findIndex(v => v.id === lastVideoId);
          if (idx !== -1) {
            setCurrentIndex(idx);
            setTimeout(() => {
              containerRef.current?.scrollTo({ top: idx * window.innerHeight, behavior: 'auto' });
            }, 0);
          } else if (lastIndex < formatted.length) {
            // Video was deleted, go to saved index or start
            setCurrentIndex(lastIndex);
            setTimeout(() => {
              containerRef.current?.scrollTo({ top: lastIndex * window.innerHeight, behavior: 'auto' });
            }, 0);
          }
        }
      } catch (err) {
        console.error("Unexpected error fetching videos:", err);
        setError("Something went wrong. Please refresh the page.");
        setLoading(false);
      }
    };

    fetchVideos();
  }, [location.state]);

  // Save progress when video changes
  useEffect(() => {
    if (!progressLoaded || videos.length === 0) return;
    
    const currentVideo = videos[currentIndex];
    if (!currentVideo) return;
    
    // Add to watched list if not already there
    const newWatchedIds = watchedIds.includes(currentVideo.id) 
      ? watchedIds 
      : [...watchedIds, currentVideo.id];
    
    if (!watchedIds.includes(currentVideo.id)) {
      setWatchedIds(newWatchedIds);
    }
    
    // Save progress to device storage
    saveProgress(currentIndex, currentVideo.id, newWatchedIds);
    
  }, [currentIndex, videos, progressLoaded]);

  // Handle app state changes (pause video when app goes to background)
  useEffect(() => {
    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const setupListener = async () => {
      listenerHandle = await App.addListener('appStateChange', ({ isActive }) => {
        const videoElements = document.querySelectorAll('video');
        if (!isActive) {
          // App went to background - pause all videos
          videoElements.forEach(v => v.pause());
        } else {
          // App came to foreground - resume current video
          const currentVideoEl = containerRef.current?.querySelector(`[data-index="${currentIndex}"] video`) as HTMLVideoElement;
          if (currentVideoEl) {
            currentVideoEl.play().catch(() => {});
          }
        }
      });
    };

    setupListener();

    return () => {
      listenerHandle?.remove();
    };
  }, [currentIndex]);

  // Detect which video is currently visible
  const handleScroll = useCallback(() => {
    if (!containerRef.current || isAnyDrawerOpen) return;
    
    const scrollTop = containerRef.current.scrollTop;
    const videoHeight = window.innerHeight;
    const newIndex = Math.round(scrollTop / videoHeight);
    
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < videos.length) {
      setCurrentIndex(newIndex);
    }
    
    // Loop back to start when scrolling past last video
    if (scrollTop >= videos.length * videoHeight) {
      containerRef.current.scrollTo({ top: 0, behavior: 'auto' });
      setCurrentIndex(0);
    }
  }, [currentIndex, videos.length, isAnyDrawerOpen]);

  // Keyboard navigation with loop
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (isAnyDrawerOpen || videos.length === 0) return;
      
      if (e.key === "ArrowDown") {
        const nextIndex = currentIndex >= videos.length - 1 ? 0 : currentIndex + 1;
        containerRef.current?.scrollTo({ 
          top: nextIndex * window.innerHeight, 
          behavior: nextIndex === 0 ? 'auto' : 'smooth' 
        });
        setCurrentIndex(nextIndex);
      } else if (e.key === "ArrowUp") {
        const prevIndex = currentIndex <= 0 ? videos.length - 1 : currentIndex - 1;
        containerRef.current?.scrollTo({ 
          top: prevIndex * window.innerHeight, 
          behavior: prevIndex === videos.length - 1 ? 'auto' : 'smooth' 
        });
        setCurrentIndex(prevIndex);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex, videos.length, isAnyDrawerOpen]);

  // Handle loop on mobile swipe past last video
  useEffect(() => {
    if (!containerRef.current || videos.length === 0) return;
    
    let touchStartY = 0;
    
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };
    
    const handleTouchEnd = (e: TouchEvent) => {
      if (isAnyDrawerOpen) return;
      
      const touchEndY = e.changedTouches[0].clientY;
      const diff = touchStartY - touchEndY;
      const container = containerRef.current;
      if (!container) return;
      
      // Swiped up (trying to go to next video) while on last video
      if (diff > 50 && currentIndex >= videos.length - 1) {
        container.scrollTo({ top: 0, behavior: 'auto' });
        setCurrentIndex(0);
      }
      
      // Swiped down (trying to go to previous video) while on first video
      if (diff < -50 && currentIndex <= 0) {
        container.scrollTo({ top: (videos.length - 1) * window.innerHeight, behavior: 'auto' });
        setCurrentIndex(videos.length - 1);
      }
    };
    
    const container = containerRef.current;
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [currentIndex, videos.length, isAnyDrawerOpen]);

  // Loading state
  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading videos...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-black">
        <div className="text-center px-6">
          <p className="text-red-500 text-lg mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-3 bg-primary text-black rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (videos.length === 0) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-black">
        <div className="text-center px-6">
          <p className="text-white text-lg">No videos yet</p>
          <p className="text-white/60 text-sm mt-2">Check back later for new content!</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="h-screen w-screen overflow-y-scroll overflow-x-hidden bg-black video-feed-container"
      style={{
        scrollSnapType: isAnyDrawerOpen ? 'none' : 'y mandatory',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      <style>{`
        .video-feed-container::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        .video-feed-container {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
      `}</style>
      
      {videos.map((video, index) => (
        <div
          key={video.id}
          data-index={index}
          style={{
            height: '100vh',
            width: '100vw',
            scrollSnapAlign: 'start',
            scrollSnapStop: 'always',
          }}
        >
          <VideoCard
            video={video}
            isActive={index === currentIndex}
            isMuted={isMuted}
            onUnmute={() => setIsMuted(false)}
            onDrawerStateChange={setIsAnyDrawerOpen}
          />
        </div>
      ))}
    </div>
  );
};
