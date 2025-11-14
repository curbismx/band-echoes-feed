import { useEffect, useRef, useState } from "react";
import { ActionButtons } from "./ActionButtons";
import { InfoDrawer } from "./InfoDrawer";
import { CommentsDrawer } from "./CommentsDrawer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useVideoRatings } from "@/hooks/useVideoRatings";

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
}

export const VideoCard = ({ video }: VideoCardProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(video.likes);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);

  const { averageRating, userRating, submitRating } = useVideoRatings(video.id);

  const handleVideoClick = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  };

  // Check if user has liked this video
  useEffect(() => {
    if (!user) return;
    
    const checkLike = async () => {
      const { data } = await supabase
        .from("favorites")
        .select("id")
        .eq("user_id", user.id)
        .eq("video_id", video.id)
        .single();
      
      setIsLiked(!!data);
    };
    
    checkLike();
  }, [user, video.id]);

  const handleLike = async () => {
    if (!user) return;
    
    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    
    if (newLikedState) {
      await supabase.from("favorites").insert({
        user_id: user.id,
        video_id: video.id,
      });
      setLikesCount(prev => prev + 1);
    } else {
      await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("video_id", video.id);
      setLikesCount(prev => prev - 1);
    }
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    // Ensure iOS inline playback attributes
    try {
      v.setAttribute('playsinline', 'true');
      v.setAttribute('webkit-playsinline', 'true');
    } catch {}

    const onVis = () => {
      if (document.visibilityState !== 'visible') v.pause();
    };
    document.addEventListener('visibilitychange', onVis);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            const p = v.play();
            if (p && typeof (p as any).catch === 'function') {
              (p as Promise<void>).catch(() => {});
            }
          } else {
            v.pause();
          }
        });
      },
      { threshold: [0, 0.6, 1] }
    );

    observer.observe(v);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return (
    <div className="h-screen w-screen relative">
      <video
        ref={videoRef}
        src={video.videoUrl}
        autoPlay
        muted
        playsInline
        preload="metadata"
        onClick={handleVideoClick}
        style={{ width: "100%", height: "100%", objectFit: "cover", background: "transparent", cursor: "pointer" }}
      />
      
      {/* Video Info Overlay */}
      <div className="absolute bottom-24 left-4 right-20 z-10 text-white">
        <h3 className="text-lg font-semibold mb-1">{video.artistName}</h3>
        {video.title && <p className="text-sm opacity-90">{video.title}</p>}
      </div>

      {/* Action Buttons */}
      <div className="absolute right-4 bottom-24 z-10">
        <ActionButtons
          likes={likesCount}
          isLiked={isLiked}
          averageRating={averageRating}
          userRating={userRating}
          onLike={handleLike}
          onRate={submitRating}
          artistUserId={video.artistUserId}
          videoTitle={video.title}
          artistName={video.artistName}
          videoId={video.id}
          onOpenComments={() => setIsCommentsOpen(true)}
        />
      </div>

      {/* Info Drawer */}
      <InfoDrawer
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
        videoId={video.id}
        videoTitle={video.title}
        artistName={video.artistName}
        caption={video.caption}
        links={video.links}
      />

      {/* Comments Drawer */}
      <CommentsDrawer
        isOpen={isCommentsOpen}
        onClose={() => setIsCommentsOpen(false)}
        videoId={video.id}
      />
    </div>
  );
};
