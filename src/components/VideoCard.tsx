import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ActionButtons } from "./ActionButtons";
import { useVideoRatings } from "@/hooks/useVideoRatings";
import { supabase } from "@/integrations/supabase/client";
import { CommentsDrawer } from "./CommentsDrawer";
import { InfoDrawer } from "./InfoDrawer";
import Hls from "hls.js";
import { PreloadedVideo } from "@/utils/videoPreloader";
import followOffIcon from "@/assets/follow_OFF.png";
import followOnIcon from "@/assets/follow_ON.png";
import followedIcon from "@/assets/followed.png";
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
  links?: Array<{ url: string }>;
  posterUrl?: string;
}

interface VideoCardProps {
  video: Video;
  isActive: boolean;
  isMuted: boolean;
  onUnmute: () => void;
  isGloballyPaused: boolean;
  onTogglePause: (paused: boolean) => void;
  preloadedVideo?: PreloadedVideo | null;
}

export const VideoCard = ({ video, isActive, isMuted, onUnmute, isGloballyPaused, onTogglePause, preloadedVideo }: VideoCardProps) => {
  const navigate = useNavigate();
  const [isFollowing, setIsFollowing] = useState(video.isFollowing);
  const [isLiked, setIsLiked] = useState(false);
  const [likes, setLikes] = useState(video.likes);
  const [artistAvatar, setArtistAvatar] = useState<string>("");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [isUIHidden, setIsUIHidden] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resumeTimeRef = useRef<number | null>(null);
  const hasStartedPlayingRef = useRef(false);
  const [firstFrameShown, setFirstFrameShown] = useState(false);
  const playerHostRef = useRef<HTMLDivElement>(null);
  const usingPreloadedRef = useRef(false);
  const currentVideoElRef = useRef<HTMLVideoElement | null>(null);

  const { averageRating, userRating, submitRating } = useVideoRatings(video.id);
  const shouldUsePreloaded = !!preloadedVideo && preloadedVideo.url === video.videoUrl && preloadedVideo.isReady && !video.videoUrl.includes('.m3u8');
  

  // Sync state with video prop changes
  useEffect(() => {
    setIsFollowing(video.isFollowing);
    setLikes(video.likes);
  }, [video.id, video.isFollowing, video.likes]);

  // IntersectionObserver for viewport detection
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsInView(entry.isIntersecting && entry.intersectionRatio > 0.5);
        });
      },
      {
        threshold: [0, 0.5, 1],
        rootMargin: '100px 0px', // Preload when within 100px of viewport
      }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Reset UI visibility and playback state when switching videos
  useEffect(() => {
    if (isActive) {
      setIsUIHidden(false);
      hasStartedPlayingRef.current = false;
    }
  }, [isActive]);


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
    const container = playerHostRef.current;
    if (!container) return;

    const pauseAndPersist = () => {
      const v = currentVideoElRef.current;
      if (v) {
        v.pause();
        try {
          sessionStorage.setItem(`videoTime_${video.id}`, String(v.currentTime || 0));
        } catch {}
      }
    };

    if (!isActive) {
      pauseAndPersist();
      return;
    }

    const ensureMountedAndPlaying = async () => {
      // Already mounted: just control playback
      if (currentVideoElRef.current) {
        const v = currentVideoElRef.current;
        v.muted = true;
        if (!isGloballyPaused && isInView) {
          v.play().catch(() => {});
        } else {
          v.pause();
        }
        return;
      }

      // Build off-DOM video (prefer preloaded for progressive)
      let v: HTMLVideoElement;
      if (shouldUsePreloaded && preloadedVideo) {
        v = preloadedVideo.videoElement;
        v.autoplay = true;
        v.setAttribute('autoplay', '');
        v.muted = true;
        v.playsInline = true;
        v.setAttribute('playsinline', 'true');
        v.setAttribute('webkit-playsinline', 'true');
        v.preload = 'auto';
        v.loop = true;
      } else {
        v = document.createElement('video');
        v.autoplay = true;
        v.setAttribute('autoplay', '');
        v.muted = true;
        v.playsInline = true;
        v.setAttribute('playsinline', 'true');
        v.setAttribute('webkit-playsinline', 'true');
        v.preload = 'auto';
        v.crossOrigin = 'anonymous';
        v.loop = true;

        if (video.videoUrl.includes('.m3u8')) {
          if (Hls.isSupported()) {
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: true,
              startFragPrefetch: true,
            });
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              console.debug('[HLS] Manifest parsed', video.videoUrl);
              if (!isGloballyPaused && isActive && isInView) {
                v.play().catch(() => {});
              }
            });
            hls.on(Hls.Events.ERROR, (_e, data) => {
              console.error('[HLS] Error', data);
            });
            hls.loadSource(video.videoUrl);
            hls.attachMedia(v);
          } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
            v.src = video.videoUrl;
            v.load();
          } else {
            v.src = video.videoUrl;
            v.load();
          }
        } else {
          v.src = video.videoUrl;
          v.load();
        }
      }

      // Universal styles for instant frame and no black background
      const styleAny = v.style as any;
      Object.assign(styleAny, {
        position: 'absolute',
        inset: '0px',
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        background: 'transparent',
        opacity: '0',
        transition: 'opacity 150ms ease-in',
      });
      try { v.style.setProperty('background', 'transparent', 'important'); } catch {}

      // Mount early so the browser can start fetching/decoding while hidden
      if (!container.contains(v)) {
        container.appendChild(v);
      }

      // Restore resume time when metadata ready
      const onLoadedMetadata = () => {
        try {
          const key = `videoTime_${video.id}`;
          const saved = sessionStorage.getItem(key);
          const t = saved ? parseFloat(saved) : (resumeTimeRef.current ?? 0);
          if (!Number.isNaN(t) && t >= 0) {
            v.currentTime = t;
          }
        } catch {}
      };
      v.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });

      const onLoadedData = () => {
        // Reveal instantly once first frame is decoded
        v.style.opacity = '1';
        currentVideoElRef.current = v;
        if (!isGloballyPaused && isActive && isInView) {
          v.play().catch(() => {});
        }
        hasStartedPlayingRef.current = true;
      };

      // If already buffered/decoded (e.g., preloaded), reveal immediately; otherwise wait for loadeddata
      if (v.readyState >= 2) {
        onLoadedData();
      } else {
        v.addEventListener('loadeddata', onLoadedData, { once: true });
      }

      const onCanPlay = () => {
        // Safety: if canplay fires before loadeddata
        if (!currentVideoElRef.current) onLoadedData();
      };
      v.addEventListener('canplay', onCanPlay, { once: true });

      v.addEventListener('error', () => {
        console.error('[VIDEO] Element error', v.error, video.videoUrl);
      });

      const onTimeUpdate = () => {
        try {
          sessionStorage.setItem(`videoTime_${video.id}`, String(v.currentTime || 0));
        } catch {}
      };
      v.addEventListener('timeupdate', onTimeUpdate);
    };

    ensureMountedAndPlaying();

    return () => {
      // Intentionally do not remove video immediately to avoid flashes.
    };
  }, [isActive, isInView, isGloballyPaused, shouldUsePreloaded, preloadedVideo, video.videoUrl, video.id]);

  // On unmount, persist last position
  useEffect(() => {
    return () => {
      const v = currentVideoElRef.current;
      if (v) {
        try {
          sessionStorage.setItem(`videoTime_${video.id}`, String(v.currentTime || 0));
        } catch {}
      }
    };
  }, [video.id]);

  const handleVideoClick = () => {
    if (!currentVideoElRef.current) return;

    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;
    
    // Double tap detection (within 300ms)
    if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
      // Clear any pending single tap action
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      
      // Double tap: toggle UI visibility only
      setIsUIHidden(!isUIHidden);
      lastTapRef.current = 0; // Reset
      return;
    }
    
    lastTapRef.current = now;

    // Single tap: do nothing (no play/pause on tap)
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = null;
    }
    // No action for single tap
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
    <div ref={containerRef} className="relative h-screen w-screen">
      {/* Video Host Container - we mount prepared <video> here only after loadeddata */}
      <div
        ref={playerHostRef}
        className="absolute inset-0 w-[100vw] h-[100vh]"
        style={{ background: 'transparent' }}
      />

      {/* Click area for video pause/play */}
      <div 
        className="absolute inset-0 z-10" 
        style={{ pointerEvents: 'auto' }}
        onClick={handleVideoClick} 
      />
      
      {/* Video Info Text - Left Side */}
      {!isUIHidden && (
        <div
          className="absolute z-20 pointer-events-auto"
          style={{
            left: '30px',
            bottom: '60px',
            maxWidth: 'calc(65% - 50px)',
          }}
        >
        {/* Artist Avatar */}
        {artistAvatar && (
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
            className="block cursor-pointer hover:opacity-80 transition-opacity touch-manipulation p-0 m-0 border-0 bg-transparent"
          >
            <img 
              src={artistAvatar} 
              alt={video.artistName}
              className="w-[32px] h-[32px] rounded-full object-cover mb-2 border-2 border-white"
            />
          </button>
        )}
        
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
          <div className="font-medium text-white drop-shadow-lg mb-1 pointer-events-none line-clamp-2">
            {video.title}
          </div>
        )}
        {video.caption && (
          <div className="font-normal text-white drop-shadow-lg text-sm leading-relaxed mb-3 pointer-events-none line-clamp-2">
            {video.caption}
          </div>
        )}
        
        {/* Follow and Info buttons */}
        <div className="flex gap-[30px] items-center" style={{ transform: 'translateY(3px)' }}>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleFollow();
            }}
            className="flex items-center justify-center"
          >
            <img 
              src={isFollowing ? followedIcon : infoFollowIcon} 
              alt={isFollowing ? "Following" : "Follow"} 
              className="h-[30px] w-auto" 
            />
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setInfoOpen(true);
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setInfoOpen(true);
            }}
            className="flex items-center justify-center"
          >
            <img src={infoIcon} alt="Info" className="h-[30px] w-auto" />
          </button>
        </div>
      </div>
      )}
      
      {!isUIHidden && (
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
      )}
      
      <CommentsDrawer 
        videoId={video.id.toString()}
        isOpen={commentsOpen}
        onClose={() => setCommentsOpen(false)}
      />

      <InfoDrawer 
        isOpen={infoOpen}
        onClose={() => setInfoOpen(false)}
        videoId={video.id.toString()}
        videoTitle={video.title}
        artistName={video.artistName}
        caption={video.caption}
        links={video.links}
      />
    </div>
  );
};
