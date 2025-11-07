import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ChevronLeft, MoreVertical, Trash2, Edit, Share2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Profile() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [following, setFollowing] = useState<any[]>([]);
  const [followers, setFollowers] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  const triggerHaptic = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (error) {
      if ("vibrate" in navigator) {
        navigator.vibrate(50);
      }
    }
  };

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile(data);
      }
      
      // Fetch following list
      const { data: followsData } = await supabase
        .from("follows")
        .select(`
          followed_id,
          profiles:followed_id (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq("follower_id", user.id);
      
      if (followsData) {
        setFollowing(followsData.map((f: any) => f.profiles));
      }
      
      // Fetch followers list
      const { data: followersData } = await supabase
        .from("follows")
        .select(`
          follower_id,
          profiles:follower_id (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq("followed_id", user.id);
      
      if (followersData) {
        setFollowers(followersData.map((f: any) => f.profiles));
      }

      // Fetch user's videos
      const { data: videosData } = await supabase
        .from("videos")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      
      if (videosData) {
        setVideos(videosData);
      }
      
      setLoading(false);
    };

    fetchProfile();
  }, [user, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleShareProfile = async () => {
    const profileUrl = `${window.location.origin}/profile`;
    try {
      await navigator.clipboard.writeText(profileUrl);
      toast({
        title: "Link copied!",
        description: "Profile link copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  const handleDeleteVideo = async () => {
    if (!videoToDelete) return;

    triggerHaptic();

    try {
      const { error } = await supabase
        .from("videos")
        .delete()
        .eq("id", videoToDelete);

      if (error) throw error;

      // Remove from local state
      setVideos(videos.filter(v => v.id !== videoToDelete));

      toast({
        title: "Video deleted",
        description: "Your video has been deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting video:", error);
      toast({
        title: "Error",
        description: "Failed to delete video",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setVideoToDelete(null);
    }
  };

  const handleShareVideo = async (videoId: string) => {
    triggerHaptic();
    const videoUrl = `${window.location.origin}/?video=${videoId}`;
    
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Check out this video",
          url: videoUrl
        });
      } else {
        await navigator.clipboard.writeText(videoUrl);
        toast({
          title: "Link copied!",
          description: "Video link copied to clipboard",
        });
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        toast({
          title: "Error",
          description: "Failed to share video",
          variant: "destructive",
        });
      }
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#252525" }}>
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
  };

  return (
    <div className="h-screen flex flex-col text-white overflow-hidden" style={{ backgroundColor: "#252525" }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
        <button 
          onClick={() => navigate("/")}
          className="p-2 -ml-2"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <span className="font-semibold text-lg">{profile.username || "user"}</span>
        <button className="px-3 py-1 text-sm font-semibold" onClick={handleSignOut}>
          Logout
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Profile Info */}
        <div className="p-4">
        {/* Profile Picture and Stats */}
        <div className="flex items-center gap-6 mb-4">
          <img
            src={profile.avatar_url || "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop"}
            alt="Profile"
            className="w-20 h-20 rounded-full object-cover"
          />
          
          <div className="flex-1 flex justify-around">
            <div className="text-center">
              <div className="font-semibold text-lg">{profile.posts_count || 0}</div>
              <div className="text-sm text-white/60">posts</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-lg">{formatNumber(profile.followers_count || 0)}</div>
              <div className="text-sm text-white/60">followers</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-lg">{profile.following_count || 0}</div>
              <div className="text-sm text-white/60">following</div>
            </div>
          </div>
        </div>

        {/* Name and Bio */}
        <div className="mb-4">
          <div className="font-semibold mb-1">{profile.display_name || profile.username}</div>
          <div className="text-sm text-white/80 whitespace-pre-line">
            {profile.bio || "No bio yet"}
          </div>
          
          {/* Website and Email Links */}
          <div className="mt-3 space-y-2">
            {profile.website && (
              <a
                href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                </svg>
                {profile.website}
              </a>
            )}
            {profile.email && (
              <a
                href={`mailto:${profile.email}`}
                className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
                {profile.email}
              </a>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button 
            onClick={() => navigate("/edit-profile")}
            className="bg-white/10 hover:bg-white/20 transition-colors py-2 rounded-lg font-semibold text-sm"
          >
            Edit Profile
          </button>
          <button 
            onClick={() => {
              triggerHaptic();
              navigate("/upload");
            }}
            className="bg-white/10 hover:bg-white/20 transition-colors py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Upload Video
          </button>
          <button 
            onClick={() => navigate("/favorites")}
            className="bg-white/10 hover:bg-white/20 transition-colors py-2 rounded-lg font-semibold text-sm"
          >
            View Favs
          </button>
          <button 
            onClick={handleShareProfile}
            className="bg-white/10 hover:bg-white/20 transition-colors py-2 rounded-lg font-semibold text-sm"
          >
            Share Profile
          </button>
        </div>
      </div>

      {/* Followers List */}
      {followers.length > 0 && (
        <div className="p-4 border-t border-white/10">
          <h2 className="font-semibold text-lg mb-3">Followers</h2>
          <div className="space-y-3">
            {followers.map((follower) => (
              <div key={follower.id} className="flex items-center gap-3">
                <img
                  src={follower.avatar_url || "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=80&h=80&fit=crop"}
                  alt={follower.username}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div className="flex-1">
                  <div className="font-semibold">{follower.display_name || follower.username}</div>
                  <div className="text-sm text-white/60">@{follower.username}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Following List */}
      {following.length > 0 && (
        <div className="p-4 border-t border-white/10">
          <h2 className="font-semibold text-lg mb-3">Following</h2>
          <div className="space-y-3">
            {following.map((followedUser) => (
              <div key={followedUser.id} className="flex items-center gap-3">
                <img
                  src={followedUser.avatar_url || "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=80&h=80&fit=crop"}
                  alt={followedUser.username}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div className="flex-1">
                  <div className="font-semibold">{followedUser.display_name || followedUser.username}</div>
                  <div className="text-sm text-white/60">@{followedUser.username}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Video Grid */}
      <div className="border-t border-white/10">
        {videos.length === 0 ? (
          <div className="p-8 text-center text-white/60">
            <p className="mb-2">No videos yet</p>
            <p className="text-sm">Share your first video!</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {videos.map((video) => (
              <div 
                key={video.id} 
                className="relative aspect-[9/16] bg-white/5 group"
              >
                <div 
                  className="w-full h-full cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => navigate(`/`)}
                >
                  {video.thumbnail_url ? (
                    <img
                      src={video.thumbnail_url}
                      alt="Video thumbnail"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <video
                      src={video.video_url}
                      className="w-full h-full object-cover"
                    />
                  )}
                  
                  {/* Stats Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 space-y-1">
                    {/* Views */}
                    <div className="flex items-center gap-1 text-white text-xs font-semibold drop-shadow-lg">
                      <svg className="w-3.5 h-3.5" fill="white" viewBox="0 0 24 24">
                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                      </svg>
                      <span>{formatNumber(video.views_count || 0)}</span>
                    </div>
                    
                    {/* Likes */}
                    <div className="flex items-center gap-1 text-white text-xs font-semibold drop-shadow-lg">
                      <svg className="w-3.5 h-3.5" fill="white" viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                      </svg>
                      <span>{formatNumber(video.likes_count || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Three-dot menu */}
                <div className="absolute top-2 right-2 z-10">
                  <DropdownMenu>
                    <DropdownMenuTrigger 
                      className="bg-black/60 hover:bg-black/80 p-1.5 rounded-full transition-colors backdrop-blur-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic();
                      }}
                    >
                      <MoreVertical className="w-4 h-4 text-white" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-[#1a1a1a] border-white/10">
                      <DropdownMenuItem 
                        className="text-white hover:bg-white/10 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic();
                          handleShareVideo(video.id);
                        }}
                      >
                        <Share2 className="w-4 h-4 mr-2" />
                        Share
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-white hover:bg-white/10 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic();
                          navigate(`/upload?edit=${video.id}`);
                        }}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-red-400 hover:bg-red-500/10 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic();
                          setVideoToDelete(video.id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#1a1a1a] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Video</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">
              Are you sure you want to delete this video? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/10 text-white hover:bg-white/20 border-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteVideo}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}
