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
        // Map favorites to video objects (using mock data structure)
        const mockVideos = [
          { id: 1, artistName: "The Rising Stars", artistUserId: user.id, videoUrl: "/videos/video1.mp4", likes: 1234, rating: 8.7, isFollowing: false, thumbnail: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=400&fit=crop" },
          { id: 2, artistName: "The Midnight Keys", artistUserId: user.id, videoUrl: "/videos/video2.mp4", likes: 892, rating: 9.2, isFollowing: true, thumbnail: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=400&h=400&fit=crop" },
          { id: 3, artistName: "Luna Eclipse", artistUserId: user.id, videoUrl: "/videos/video3.mp4", likes: 2156, rating: 7.8, isFollowing: false, thumbnail: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=400&h=400&fit=crop" },
        ];

        const favVideos = data
          .map(fav => mockVideos.find(v => v.id === fav.video_id))
          .filter(Boolean);

        setFavoriteVideos(favVideos);
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
