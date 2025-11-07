import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function Favorites() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [favoriteVideos, setFavoriteVideos] = useState<any[]>([]);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
    }
  }, [user, navigate]);

  // Fetch real favorite videos
  useEffect(() => {
    if (!user) return;

    const fetchFavorites = async () => {
      const { data } = await supabase
        .from("favorites")
        .select("video_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (data) {
        // Fetch actual videos that are favorited
        const videoIds = data.map(fav => fav.video_id);
        
        if (videoIds.length > 0) {
          const { data: videosData } = await supabase
            .from("videos")
            .select("*")
            .in("id", videoIds);

          if (videosData) {
            // Fetch profiles for video owners
            const userIds = [...new Set(videosData.map(v => v.user_id))];
            const { data: profilesData } = await supabase
              .from("profiles")
              .select("id, username, display_name, avatar_url")
              .in("id", userIds);

            const profilesMap = new Map(
              profilesData?.map(p => [p.id, p]) || []
            );

            const favVideos = videosData.map((video: any) => {
              const profile = profilesMap.get(video.user_id);
              return {
                id: video.id,
                artistName: profile?.display_name || profile?.username || "Unknown Artist",
                artistUserId: video.user_id,
                videoUrl: video.video_url,
                likes: video.likes_count || 0,
                rating: 0,
                isFollowing: false,
                title: video.title,
                caption: video.caption,
                thumbnail: video.thumbnail_url
              };
            });

            setFavoriteVideos(favVideos);
          }
        }
      }
    };

    fetchFavorites();
  }, [user]);

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: "#252525" }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <button 
          onClick={() => navigate("/profile")}
          className="p-2 -ml-2"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <span className="font-semibold text-lg">Your Favorites</span>
        <div className="w-10"></div> {/* Spacer for centering */}
      </div>

      {/* Video Grid */}
      <div className="mt-1">
        <div className="grid grid-cols-3 gap-1">
          {favoriteVideos.map((video, index) => (
            <div 
              key={video.id} 
              className="relative aspect-[9/16] bg-white/5 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => navigate("/", { state: { favoriteVideos, startIndex: index } })}
            >
              <img
                src={video.thumbnail}
                alt="Video thumbnail"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 text-white text-xs font-semibold drop-shadow-lg">
                {video.artistName}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
