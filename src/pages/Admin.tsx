import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Upload, ChevronDown, ChevronRight, Trash2, Edit2 } from "lucide-react";


interface VideoInput {
  id: string;
  title: string;
}

interface VideoForm {
  file: File | null;
  previewUrl: string;
  title: string;
  description: string;
  itunes: string;
  spotify: string;
  tidal: string;
  youtube_music: string;
  uploading: boolean;
  searching: boolean;
  fileInputKey: number;
}

interface UserForm {
  icon: File | string | null;
  name: string;
  username: string;
  email: string;
  description: string;
  videos: VideoInput[];
}

const getDefaultVideoForm = (): VideoForm => ({
  file: null,
  previewUrl: "",
  title: "",
  description: "",
  itunes: "",
  spotify: "",
  tidal: "",
  youtube_music: "",
  uploading: false,
  searching: false,
  fileInputKey: Date.now(),
});

// Removed initialUsers - start fresh

const Admin = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [users, setUsers] = useState<UserForm[]>([]);
  const [createdUsers, setCreatedUsers] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [activeTab, setActiveTab] = useState<"accounts" | "users">("accounts");
  const [videoForms, setVideoForms] = useState<Record<string, VideoForm>>({});
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ username: string; display_name: string; email: string; bio: string; avatar: File | null }>({ username: "", display_name: "", email: "", bio: "", avatar: null });
  const [currentUser, setCurrentUser] = useState<UserForm>({
    icon: null,
    name: "",
    username: "",
    email: "",
    description: "",
    videos: [],
  });
  const [batchCount, setBatchCount] = useState(30);
  const [batchPrefix, setBatchPrefix] = useState("starter");
  const [batchDomain, setBatchDomain] = useState("example.com");
  const [collapsedUsers, setCollapsedUsers] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("admin-collapsed-users");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [userVideos, setUserVideos] = useState<Record<string, any[]>>({});
  const [editingVideo, setEditingVideo] = useState<string | null>(null);
  const [videoEditForm, setVideoEditForm] = useState<{ title: string; description: string; itunes: string; spotify: string; tidal: string; youtube_music: string; searching: boolean; newVideoFile: File | null; uploading: boolean }>({ title: "", description: "", itunes: "", spotify: "", tidal: "", youtube_music: "", searching: false, newVideoFile: null, uploading: false });


  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .rpc('has_role', { _user_id: user.id, _role: 'admin' as any });

      if (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
      } else {
        setIsAdmin(!!data);
      }
      setCheckingAdmin(false);
    };

    checkAdminStatus();
  }, [user]);

  useEffect(() => {
    document.title = "Admin | Starter Accounts";
  }, []);


  useEffect(() => {
    if (isAdmin && activeTab === "users") {
      fetchAllUsers();
    }
    if (isAdmin && activeTab === "accounts") {
      fetchCreatedUsers();
    }
  }, [isAdmin, activeTab]);

  const fetchCreatedUsers = async () => {
    if (!user) return;
    try {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, email, avatar_url, bio, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCreatedUsers(profiles || []);
      
      // Fetch videos for all users
      if (profiles && profiles.length > 0) {
        const userIds = profiles.map(p => p.id);
        const { data: videos, error: videosError } = await supabase
          .from("videos")
          .select("*")
          .in("user_id", userIds)
          .order("created_at", { ascending: false });
        
        if (!videosError && videos) {
          const videosByUser: Record<string, any[]> = {};
          videos.forEach(video => {
            if (!videosByUser[video.user_id]) {
              videosByUser[video.user_id] = [];
            }
            videosByUser[video.user_id].push(video);
          });
          setUserVideos(videosByUser);
        }
      }
    } catch (error: any) {
      console.error("Error fetching created users:", error);
      toast.error("Failed to load your created users");
    }
  };

  const handleBatchCreate = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-batch-create-users", {
        body: { count: batchCount, prefix: batchPrefix, domain: batchDomain },
      });
      if (error) throw error as any;
      const createdCount = (data as any)?.created_count ?? 0;
      const failedCount = (data as any)?.failed_count ?? 0;
      toast.success(`Created ${createdCount} accounts${failedCount ? `, ${failedCount} failed` : ""}`);
      fetchCreatedUsers();
    } catch (e: any) {
      console.error("Batch create error:", e);
      toast.error(e.message || "Failed to create accounts");
    }
  };


  // Health check for edge function on admin page load
  useEffect(() => {
    const checkEdgeFunctionHealth = async () => {
      if (!isAdmin) return;
      
      try {
        const { error } = await supabase.functions.invoke("admin-create-user", {
          method: "GET",
        });
        
        if (error) {
          console.error("Edge function health check failed:", error);
          toast.error("Warning: User creation service may be unavailable. Try refreshing the page.");
        }
      } catch (err) {
        console.error("Edge function health check error:", err);
        toast.warning("Unable to verify user creation service. You may encounter issues creating users.");
      }
    };

    checkEdgeFunctionHealth();
  }, [isAdmin]);

  const fetchAllUsers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, display_name, email, avatar_url")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch admin roles for all users
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("role", "admin");

      if (rolesError) throw rolesError;

      const adminIds = new Set(roles?.map(r => r.user_id) || []);

      const usersWithRoles = profiles?.map(profile => ({
        ...profile,
        isAdmin: adminIds.has(profile.id),
      })) || [];

      setAllUsers(usersWithRoles);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    }
  };

  const toggleAdminRole = async (userId: string, currentlyAdmin: boolean) => {
    try {
      if (currentlyAdmin) {
        // Remove admin role
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "admin");

        if (error) throw error;
        toast.success("Admin role removed");
      } else {
        // Add admin role
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "admin" });

        if (error) throw error;
        toast.success("Admin role granted");
      }

      // Refresh user list
      fetchAllUsers();
    } catch (error: any) {
      console.error("Error toggling admin role:", error);
      toast.error(error.message || "Failed to update admin role");
    }
  };

  const handleFindMusicLinks = async (userId: string) => {
    const form = videoForms[userId] || getDefaultVideoForm();
    
    if (!form.title || form.title.trim() === '') {
      toast.error('Please enter a video title first');
      return;
    }

    // Set searching state
    setVideoForms((prev) => ({
      ...prev,
      [userId]: { ...(prev[userId] || getDefaultVideoForm()), searching: true },
    }));

    try {
      const { data, error } = await supabase.functions.invoke('find-music-links', {
        body: { title: form.title },
      });

      if (error) throw error;

      if (data && data.links) {
        setVideoForms((prev) => ({
          ...prev,
          [userId]: {
            ...(prev[userId] || getDefaultVideoForm()),
            itunes: data.links.apple_music || prev[userId]?.itunes || '',
            spotify: data.links.spotify || prev[userId]?.spotify || '',
            tidal: data.links.tidal || prev[userId]?.tidal || '',
            youtube_music: data.links.youtube_music || prev[userId]?.youtube_music || '',
            searching: false,
          },
        }));
        toast.success(`Found links for: ${data.track_name || form.title}`);
      } else {
        toast.error('No results found for this track');
        setVideoForms((prev) => ({
          ...prev,
          [userId]: { ...(prev[userId] || getDefaultVideoForm()), searching: false },
        }));
      }
    } catch (e: any) {
      console.error('Find links error:', e);
      toast.error(e.message || 'Failed to find music links');
      setVideoForms((prev) => ({
        ...prev,
        [userId]: { ...(prev[userId] || getDefaultVideoForm()), searching: false },
      }));
    }
  };

  const handleDeleteFromManageAdmins = async (userId: string, username: string) => {
    if (!confirm(`Delete user ${username}? This will permanently remove their account.`)) return;
    try {
      const { error } = await supabase.functions.invoke("admin-delete-user", {
        body: { user_id: userId },
      });
      if (error) throw error as any;
      toast.success(`User ${username} deleted`);
      fetchAllUsers();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error(error.message || "Failed to delete user");
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth?redirect=/admin");
      return;
    }
  }, [user, loading, navigate]);

  const handleAddVideo = (userIndex: number) => {
    const updatedUsers = [...users];
    updatedUsers[userIndex].videos.push({
      id: crypto.randomUUID(),
      title: "",
    });
    setUsers(updatedUsers);
  };

  const handleVideoChange = (userIndex: number, videoIndex: number, value: string) => {
    const updatedUsers = [...users];
    updatedUsers[userIndex].videos[videoIndex].title = value;
    setUsers(updatedUsers);
  };

  const handleAddNewUser = () => {
    setUsers([
      ...users,
      {
        icon: null,
        name: "",
        username: "",
        email: "",
        description: "",
        videos: [],
      },
    ]);
  };

  const handleUserChange = (index: number, field: keyof UserForm, value: any) => {
    const updatedUsers = [...users];
    updatedUsers[index] = { ...updatedUsers[index], [field]: value };
    setUsers(updatedUsers);
  };

  const handleIconUpload = (index: number, file: File | null) => {
    handleUserChange(index, "icon", file);
  };

  const handleDeleteUser = (index: number) => {
    const updatedUsers = users.filter((_, i) => i !== index);
    setUsers(updatedUsers);
  };

  const handlePublishUser = async (index: number) => {
    const userForm = users[index];

    // Validation
    if (!userForm.username.trim() || !userForm.name.trim()) {
      toast.error("Please fill in required fields: username and name");
      return;
    }

    const providedEmail = (userForm.email || "").trim();
    const usernameRaw = (userForm.username || "").trim();
    const safeUsernameSlug = usernameRaw.toLowerCase().replace(/[^a-z0-9._-]/g, "");
    const safeDisplayName = (userForm.name || "").trim();

    try {
      let createdUserId: string | undefined;
      let emailToSave: string | undefined = undefined;

      // ALWAYS create an auth user first (required for profile to link to)
      const useEmail = providedEmail || `${safeUsernameSlug || 'user'}-${Date.now()}@temp-noemail.local`;
      const password = crypto.randomUUID();

    console.log("Creating auth user:", useEmail);
    const { data: fnData, error: fnError } = await supabase.functions.invoke("admin-create-user", {
      body: {
        email: useEmail,
        password,
        username: safeUsernameSlug || usernameRaw,
        display_name: safeDisplayName,
      },
    });

      if (fnError) {
        console.error("admin-create-user error:", fnError);
        if (fnError.message?.includes("already been registered") || fnError.message?.includes("email_exists")) {
          throw new Error("Email already exists. Please use a different email address.");
        }
        throw new Error(`Failed to create user: ${fnError.message || JSON.stringify(fnError)}`);
      }

      createdUserId = (fnData as any)?.user_id as string | undefined;
      if (!createdUserId) {
        console.error("No user_id returned:", fnData);
        throw new Error("User creation failed - no user ID returned");
      }
      
      // Only save email to profile if user actually provided one
      if (providedEmail) {
        emailToSave = providedEmail;
      }
      
      console.log("Auth user created:", createdUserId);

      // Prepare optional avatar
      let avatar_base64: string | undefined;
      let avatar_ext: string | undefined;
      if (userForm.icon) {
        let file: File;
        if (typeof userForm.icon === 'string') {
          const response = await fetch(userForm.icon);
          const blob = await response.blob();
          file = new File([blob], 'avatar', { type: blob.type });
          avatar_ext = (userForm.icon.split('.').pop() || 'jpg').toLowerCase();
        } else {
          file = userForm.icon;
          avatar_ext = (userForm.icon.name.split(".").pop() || 'jpg').toLowerCase();
        }
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        avatar_base64 = btoa(binary);
      }

      // Create/update profile with service function
      console.log("Updating profile for user:", createdUserId);
      const updatePayload: any = {
        user_id: createdUserId,
        username: safeUsernameSlug || usernameRaw,
        display_name: safeDisplayName,
        bio: userForm.description || null,
        avatar_base64,
        avatar_ext,
        created_by: user?.id,
      };
      
      // Only include email if user provided one
      if (emailToSave) {
        updatePayload.email = emailToSave;
      }

      const { data: updateData, error: updateError } = await supabase.functions.invoke("admin-update-profile", {
        body: updatePayload,
      });

      if (updateError) {
        console.error("admin-update-profile error:", updateError);
        throw new Error(`Failed to update profile: ${updateError.message || JSON.stringify(updateError)}`);
      }

      console.log("Profile updated successfully");
      toast.success(
        providedEmail
          ? `User ${userForm.name} created successfully!`
          : `Profile for ${userForm.name} created (no email/login)`
      );
      handleDeleteUser(index);
      fetchCreatedUsers(); // Refresh the list
    } catch (error: any) {
      console.error("Error creating user - full details:", error);
      toast.error(error.message || "Failed to create user");
    }
  };
  const handleSubmitAddVideo = async (userId: string) => {
    const form = videoForms[userId] || getDefaultVideoForm();
    if (form.uploading) return;
    try {
      if (!form.file) {
        toast.error("Please choose a video file");
        return;
      }

      // Set uploading state and show loading toast
      setVideoForms((prev) => ({
        ...prev,
        [userId]: { ...(prev[userId] || getDefaultVideoForm()), ...form, uploading: true },
      }));
      const toastId = (toast as any).loading ? (toast as any).loading("Uploading video...") : null;

      // Upload video file to storage
      const ext = form.file.name.split('.').pop();
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("videos")
        .upload(path, form.file);
      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("videos")
        .getPublicUrl(path);

      // Build links (iTunes, Spotify, Tidal, YouTube Music)
      const links = [form.itunes, form.spotify, form.tidal, form.youtube_music]
        .filter((u) => !!u && u.trim() !== "")
        .map((url) => ({ url }));

      const { error } = await supabase.functions.invoke("admin-add-video-record", {
        body: {
          user_id: userId,
          video_url: publicUrl,
          title: form.title || null,
          caption: form.description || null,
          links,
        },
      });

      if (error) throw error as any;

      if (toastId) (toast as any).success ? (toast as any).success("Video added", { id: toastId }) : toast.success("Video added");
      else toast.success("Video added");

      // Reset form so another upload can happen immediately
      setVideoForms((prev) => ({ ...prev, [userId]: getDefaultVideoForm() }));
      
      // Refresh video list
      fetchCreatedUsers();
    } catch (e: any) {
      console.error("Add video error:", e);
      if ((toast as any).error) (toast as any).error(e.message || "Failed to add video");
      else toast.error(e.message || "Failed to add video");
    } finally {
      // Ensure uploading resets if not already reset on success
      setVideoForms((prev) => {
        const current = prev[userId];
        if (!current) return prev;
        if (current.file === null && current.title === "" && current.description === "" && current.uploading === false) {
          return prev;
        }
        return { ...prev, [userId]: { ...current, uploading: false } };
      });
    }
  };

  const handleDeleteCreatedUser = async (userId: string, username: string) => {
    if (!confirm(`Delete user ${username}? This will permanently remove their account.`)) return;

    try {
      const { error } = await supabase.functions.invoke("admin-delete-user", {
        body: { user_id: userId },
      });
      if (error) throw error as any;

      toast.success(`User ${username} deleted`);
      fetchCreatedUsers();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error(error.message || "Failed to delete user");
    }
  };

  const handleEditUser = (usr: any) => {
    setEditingUser(usr.id);
    setEditForm({
      username: usr.username || "",
      display_name: usr.display_name || "",
      email: usr.email || "",
      bio: usr.bio || "",
      avatar: null,
    });
  };

  const handleSaveEdit = async (userId: string) => {
    try {
      let avatar_base64: string | undefined;
      let avatar_ext: string | undefined;
      if (editForm.avatar) {
        const arrayBuffer = await editForm.avatar.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        avatar_base64 = btoa(binary);
        avatar_ext = editForm.avatar.name.split(".").pop() || 'jpg';
      }

      const { error } = await supabase.functions.invoke("admin-update-profile", {
        body: {
          user_id: userId,
          username: editForm.username,
          display_name: editForm.display_name,
          email: editForm.email,
          bio: editForm.bio,
          avatar_base64,
          avatar_ext,
          created_by: user?.id,
        },
      });
      if (error) throw error as any;

      toast.success("User updated");
      setEditingUser(null);
      fetchCreatedUsers();
    } catch (e: any) {
      console.error("Edit error:", e);
      toast.error(e.message || "Failed to update user");
    }
  };

  const toggleUserCollapse = (userId: string) => {
    setCollapsedUsers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      // Persist to localStorage
      try {
        localStorage.setItem("admin-collapsed-users", JSON.stringify(Array.from(newSet)));
      } catch (e) {
        console.error("Failed to save collapse state:", e);
      }
      return newSet;
    });
  };

  const handleDeleteVideo = async (videoId: string, userId: string) => {
    if (!confirm("Delete this video?")) return;
    try {
      // Immediately update local state for instant UI feedback
      setUserVideos((prev) => ({
        ...prev,
        [userId]: (prev[userId] || []).filter((v) => v.id !== videoId),
      }));

      const { error } = await supabase.functions.invoke("admin-delete-video", {
        body: { video_id: videoId },
      });
      
      if (error) throw error;
      toast.success("Video deleted");
      
      // Refresh to ensure everything is in sync
      fetchCreatedUsers();
    } catch (e: any) {
      console.error("Delete video error:", e);
      toast.error(e.message || "Failed to delete video");
      // Revert on error
      fetchCreatedUsers();
    }
  };

  const handleEditVideo = (video: any) => {
    setEditingVideo(video.id);
    const links = video.links || [];
    const itunes = links.find((l: any) => l.url?.includes("apple.com") || l.url?.includes("itunes"))?.url || "";
    const spotify = links.find((l: any) => l.url?.includes("spotify.com"))?.url || "";
    const tidal = links.find((l: any) => l.url?.includes("tidal.com"))?.url || "";
    const youtube_music = links.find((l: any) => l.url?.includes("music.youtube.com"))?.url || "";
    
    setVideoEditForm({
      title: video.title || "",
      description: video.caption || "",
      itunes,
      spotify,
      tidal,
      youtube_music,
      searching: false,
      newVideoFile: null,
      uploading: false,
    });
  };

  const handleFindLinksForEdit = async () => {
    if (!videoEditForm.title.trim()) {
      toast.error("Please add a title first to search for music links");
      return;
    }

    setVideoEditForm({ ...videoEditForm, searching: true });
    try {
      const { data, error } = await supabase.functions.invoke('find-music-links', {
        body: { title: videoEditForm.title.trim() }
      });

      if (error) throw error;

      if (data.success && data.links) {
        setVideoEditForm({
          ...videoEditForm,
          itunes: data.links.apple_music || videoEditForm.itunes,
          spotify: data.links.spotify || videoEditForm.spotify,
          tidal: data.links.tidal || videoEditForm.tidal,
          youtube_music: data.links.youtube_music || videoEditForm.youtube_music,
          searching: false,
        });
        
        toast.success(`Found links for: ${data.track_name || videoEditForm.title}`);
      } else {
        toast.error("No links found. Try adding artist name to the title");
        setVideoEditForm({ ...videoEditForm, searching: false });
      }
    } catch (error) {
      console.error("Find links error:", error);
      toast.error("Unable to find music links. Please try again.");
      setVideoEditForm({ ...videoEditForm, searching: false });
    }
  };

  const handleSaveVideoEdit = async (videoId: string, userId: string) => {
    if (videoEditForm.uploading) return;
    
    try {
      setVideoEditForm({ ...videoEditForm, uploading: true });
      
      let videoUrl: string | undefined;
      
      // If a new video file is provided, upload it
      if (videoEditForm.newVideoFile) {
        const fileExt = videoEditForm.newVideoFile.name.split(".").pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${userId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("videos")
          .upload(filePath, videoEditForm.newVideoFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("videos")
          .getPublicUrl(filePath);

        videoUrl = publicUrl;
      }

      const links = [videoEditForm.itunes, videoEditForm.spotify, videoEditForm.tidal, videoEditForm.youtube_music]
        .filter(u => !!u && u.trim() !== "")
        .map(url => ({ url }));

      const updateData: any = {
        title: videoEditForm.title || null,
        caption: videoEditForm.description || null,
        links,
      };

      // Only update video_url if a new video was uploaded
      if (videoUrl) {
        updateData.video_url = videoUrl;
      }

      const { error } = await supabase
        .from("videos")
        .update(updateData)
        .eq("id", videoId);

      if (error) throw error;
      toast.success("Video updated");
      setEditingVideo(null);
      setVideoEditForm({ ...videoEditForm, uploading: false, newVideoFile: null });
      fetchCreatedUsers();
    } catch (e: any) {
      console.error("Update video error:", e);
      toast.error(e.message || "Failed to update video");
      setVideoEditForm({ ...videoEditForm, uploading: false });
    }
  };


  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading || checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-semibold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground">You don't have admin privileges.</p>
          <Button onClick={handleLogout} variant="outline">
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8 overflow-y-auto">
      <div className="max-w-7xl mx-auto pb-20">
        {/* Header */}
        <div className="flex items-center gap-8 mb-8 pb-4 border-b border-border">
          <h1 className="text-xl font-normal text-foreground">Admin</h1>
          <button 
            onClick={() => setActiveTab("accounts")}
            className={`text-xl font-normal transition-colors ${
              activeTab === "accounts"
                ? "text-primary border-b-2 border-primary pb-1"
                : "text-foreground hover:text-primary"
            }`}
          >
            User Accounts
          </button>
          <button 
            onClick={() => setActiveTab("users")}
            className={`text-xl font-normal transition-colors ${
              activeTab === "users"
                ? "text-primary border-b-2 border-primary pb-1"
                : "text-foreground hover:text-primary"
            }`}
          >
            Manage Admins
          </button>
          <button 
            onClick={() => navigate("/settings")}
            className="text-xl font-normal text-foreground hover:text-primary transition-colors"
          >
            Settings
          </button>
          <button 
            onClick={handleLogout}
            className="text-xl font-normal text-foreground hover:text-primary transition-colors ml-auto"
          >
            Logout
          </button>
        </div>

        {activeTab === "accounts" && (
          <>
            {/* Add New User Button */}
            <button
              onClick={handleAddNewUser}
              className="flex items-center gap-2 mb-8 text-primary hover:text-primary/80 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg border-2 border-primary flex items-center justify-center">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-base">Add new user</span>
            </button>

            {/* User Forms */}
            <div className="space-y-8 mb-8">
              {users.map((userForm, userIndex) => (
            <div key={userIndex} className="border-b border-border pb-8">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 mb-4 text-sm text-muted-foreground">
                <div className="col-span-1">Icon</div>
                <div className="col-span-2">Name</div>
                <div className="col-span-2">Username</div>
                <div className="col-span-3">email address</div>
                <div className="col-span-4">Description</div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-12 gap-4 mb-4">
                {/* Icon Upload */}
                <div className="col-span-1">
                  <label className="w-10 h-10 rounded-full border-2 border-input flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleIconUpload(userIndex, e.target.files?.[0] || null)}
                    />
                    {userForm.icon ? (
                      <img
                        src={typeof userForm.icon === 'string' ? userForm.icon : URL.createObjectURL(userForm.icon)}
                        alt="icon"
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <Plus className="w-5 h-5 text-muted-foreground" />
                    )}
                  </label>
                </div>

                <div className="col-span-2">
                  <Input
                    placeholder="text"
                    value={userForm.name}
                    onChange={(e) => handleUserChange(userIndex, "name", e.target.value)}
                  />
                </div>

                <div className="col-span-2">
                  <Input
                    placeholder="text"
                    value={userForm.username}
                    onChange={(e) => handleUserChange(userIndex, "username", e.target.value)}
                  />
                </div>

                <div className="col-span-3">
                  <Input
                    type="email"
                    placeholder="text"
                    value={userForm.email}
                    onChange={(e) => handleUserChange(userIndex, "email", e.target.value)}
                  />
                </div>

                <div className="col-span-4">
                  <Input
                    placeholder="text"
                    value={userForm.description}
                    onChange={(e) => handleUserChange(userIndex, "description", e.target.value)}
                  />
                </div>
              </div>

              {/* Videos Section */}
              <div className="grid grid-cols-12 gap-4 mb-4">
                <div className="col-span-1"></div>
                <div className="col-span-11 flex flex-wrap gap-4">
                  {userForm.videos.map((video, videoIndex) => (
                    <div key={video.id} className="flex items-center gap-2">
                      <button className="w-10 h-10 rounded-lg border-2 border-input flex items-center justify-center">
                        <Plus className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <Input
                        placeholder="Text for video"
                        className="w-40"
                        value={video.title}
                        onChange={(e) => handleVideoChange(userIndex, videoIndex, e.target.value)}
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => handleAddVideo(userIndex)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    add more videos...
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-4 mt-4">
                <button
                  onClick={() => handlePublishUser(userIndex)}
                  className="text-sm text-foreground hover:text-primary transition-colors"
                >
                  Publish to App
                </button>
                <button
                  onClick={() => handleDeleteUser(userIndex)}
                  className="text-sm text-destructive hover:text-destructive/80 transition-colors"
                >
                  Delete User
                </button>
              </div>
            </div>
              ))}
            </div>

            {/* Created Users List */}
            {createdUsers.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-medium text-foreground mb-4">
                  All Users ({createdUsers.length}) • {Object.values(userVideos).flat().length} Videos
                </h2>
                <div className="space-y-4">
                  {createdUsers.map((usr) => (
                    <div key={usr.id}>
                      {editingUser === usr.id ? (
                        <div className="bg-muted/30 p-4 rounded-lg">
                          {/* First row: Edit fields */}
                          <div className="grid grid-cols-12 gap-4 items-center mb-3">
                            <div className="col-span-1">
                              <label className="w-10 h-10 rounded-full border-2 border-input flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => setEditForm({ ...editForm, avatar: e.target.files?.[0] || null })} />
                                {editForm.avatar ? (
                                  <img src={URL.createObjectURL(editForm.avatar)} alt="avatar" className="w-full h-full rounded-full object-cover" />
                                ) : usr.avatar_url ? (
                                  <img src={usr.avatar_url} alt={usr.display_name} className="w-10 h-10 rounded-full object-cover" />
                                ) : (
                                  <Plus className="w-5 h-5 text-muted-foreground" />
                                )}
                              </label>
                            </div>
                            <Input className="col-span-2" placeholder="Display Name" value={editForm.display_name} onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })} />
                            <Input className="col-span-2" placeholder="Username" value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} />
                            <Input className="col-span-3" placeholder="Email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                            <Input className="col-span-4" placeholder="Bio" value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} />
                          </div>
                          {/* Second row: Action buttons */}
                          <div className="flex gap-2 pl-16">
                            <Button variant="default" size="sm" onClick={() => handleSaveEdit(usr.id)}>Save</Button>
                            <Button variant="ghost" size="sm" onClick={() => setEditingUser(null)}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Border around entire user section */}
                          <div className="border border-border rounded-lg overflow-hidden">
                            {/* Line 1: User info with collapse button, Edit and Del buttons */}
                            <div className="p-4 bg-card hover:bg-muted/50 transition-colors">
                              {/* First row: User info */}
                              <div className="flex items-center gap-4 mb-3">
                                {/* Collapse button */}
                                <button
                                  onClick={() => toggleUserCollapse(usr.id)}
                                  className="flex items-center justify-center hover:text-primary transition-colors shrink-0"
                                >
                                  {collapsedUsers.has(usr.id) ? (
                                    <ChevronRight className="w-5 h-5" />
                                  ) : (
                                    <ChevronDown className="w-5 h-5" />
                                  )}
                                </button>
                                
                                <div className="shrink-0">
                                  {usr.avatar_url ? (
                                    <img src={usr.avatar_url} alt={usr.display_name} className="w-10 h-10 rounded-full object-cover" />
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                      <span className="text-muted-foreground text-sm">{usr.display_name?.[0]?.toUpperCase() || "?"}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="text-foreground font-medium min-w-0 truncate flex-1">{usr.display_name || "—"}</div>
                                <div className="text-muted-foreground min-w-0 truncate flex-1">{usr.username || "—"}</div>
                                <div className="text-muted-foreground text-sm min-w-0 truncate flex-1">{usr.email || "—"}</div>
                                <div className="text-muted-foreground text-sm min-w-0 truncate flex-1">{usr.bio || "—"}</div>
                              </div>
                              
                              {/* Second row: Action buttons */}
                              <div className="flex gap-2 pl-16">
                                <Button variant="ghost" size="sm" onClick={() => handleEditUser(usr)}>Edit</Button>
                                <Button variant="destructive" size="sm" onClick={() => handleDeleteCreatedUser(usr.id, usr.username || usr.display_name)}>Del</Button>
                              </div>
                            </div>

                            {/* Show rest of content only when NOT collapsed */}
                            {!collapsedUsers.has(usr.id) && (
                              <>
                                {/* Existing videos list */}
                                {userVideos[usr.id] && userVideos[usr.id].length > 0 && (
                                  <div className="border-t border-border bg-muted/10 p-4">
                                    <h3 className="text-sm font-medium text-foreground mb-3">Videos ({userVideos[usr.id].length})</h3>
                                    <div className="space-y-2">
                                      {userVideos[usr.id].map((video) => (
                                        <div key={video.id} className="bg-card rounded-lg p-3 border border-border">
                                           {editingVideo === video.id ? (
                                            <div className="space-y-2">
                                              <div className="flex items-center gap-2">
                                                <video src={video.video_url} className="w-32 h-20 object-cover rounded" controls />
                                                <div className="flex-1">
                                                  <label className="cursor-pointer">
                                                    <input
                                                      type="file"
                                                      accept="video/*"
                                                      className="hidden"
                                                      disabled={videoEditForm.uploading}
                                                      onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                          setVideoEditForm({ ...videoEditForm, newVideoFile: file });
                                                        }
                                                      }}
                                                    />
                                                    <Button
                                                      type="button"
                                                      variant="outline"
                                                      size="sm"
                                                      disabled={videoEditForm.uploading}
                                                      asChild
                                                    >
                                                      <span>
                                                        <Upload className="w-4 h-4 mr-2" />
                                                        {videoEditForm.newVideoFile ? "New video selected" : "Replace Video"}
                                                      </span>
                                                    </Button>
                                                  </label>
                                                </div>
                                              </div>
                                              <Input
                                                placeholder="Video Title"
                                                value={videoEditForm.title}
                                                onChange={(e) => setVideoEditForm({ ...videoEditForm, title: e.target.value })}
                                                className="h-8"
                                              />
                                              <Textarea
                                                placeholder="Description"
                                                rows={2}
                                                value={videoEditForm.description}
                                                onChange={(e) => setVideoEditForm({ ...videoEditForm, description: e.target.value })}
                                                className="min-h-[60px] resize-none"
                                              />
                                              <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs text-muted-foreground">Music Links</span>
                                                <Button
                                                  onClick={handleFindLinksForEdit}
                                                  disabled={videoEditForm.searching || !videoEditForm.title.trim()}
                                                  variant="outline"
                                                  size="sm"
                                                  className="text-xs h-7"
                                                >
                                                  {videoEditForm.searching ? "Searching..." : "Find Links"}
                                                </Button>
                                              </div>
                                              <Input
                                                placeholder="iTunes Link"
                                                value={videoEditForm.itunes}
                                                onChange={(e) => setVideoEditForm({ ...videoEditForm, itunes: e.target.value })}
                                                className="h-8"
                                              />
                                              <Input
                                                placeholder="Spotify Link"
                                                value={videoEditForm.spotify}
                                                onChange={(e) => setVideoEditForm({ ...videoEditForm, spotify: e.target.value })}
                                                className="h-8"
                                              />
                                              <Input
                                                placeholder="Tidal Link"
                                                value={videoEditForm.tidal}
                                                onChange={(e) => setVideoEditForm({ ...videoEditForm, tidal: e.target.value })}
                                                className="h-8"
                                              />
                                              <Input
                                                placeholder="YouTube Music Link"
                                                value={videoEditForm.youtube_music}
                                                onChange={(e) => setVideoEditForm({ ...videoEditForm, youtube_music: e.target.value })}
                                                className="h-8"
                                              />
                                              <div className="flex gap-2">
                                                <Button 
                                                  size="sm" 
                                                  onClick={() => handleSaveVideoEdit(video.id, usr.id)}
                                                  disabled={videoEditForm.uploading}
                                                >
                                                  {videoEditForm.uploading ? "Saving..." : "Save"}
                                                </Button>
                                                <Button 
                                                  variant="ghost" 
                                                  size="sm" 
                                                  onClick={() => setEditingVideo(null)}
                                                  disabled={videoEditForm.uploading}
                                                >
                                                  Cancel
                                                </Button>
                                                <Button
                                                  variant="destructive"
                                                  size="sm"
                                                  onClick={() => {
                                                    setEditingVideo(null);
                                                    handleDeleteVideo(video.id, usr.id);
                                                  }}
                                                  disabled={videoEditForm.uploading}
                                                  className="ml-auto"
                                                >
                                                  <Trash2 className="w-4 h-4 mr-2" />
                                                  Delete
                                                </Button>
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="flex items-start justify-between gap-4">
                                              <div className="flex-1 min-w-0">
                                                <video src={video.video_url} className="w-32 h-20 object-cover rounded mb-2" controls />
                                                <p className="text-sm font-medium text-foreground truncate">{video.title || "Untitled"}</p>
                                                <p className="text-xs text-muted-foreground line-clamp-2">{video.caption || "No description"}</p>
                                                {video.links && video.links.length > 0 && (
                                                  <div className="flex gap-2 mt-1">
                                                    {video.links.map((link: any, idx: number) => (
                                                      <a
                                                        key={idx}
                                                        href={link.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-primary hover:underline"
                                                      >
                                                        Link {idx + 1}
                                                      </a>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                              <div className="flex gap-1 shrink-0">
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => handleEditVideo(video)}
                                                  className="h-8 w-8 p-0"
                                                >
                                                  <Edit2 className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => handleDeleteVideo(video.id, usr.id)}
                                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                                >
                                                  <Trash2 className="w-4 h-4" />
                                                </Button>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Line 2: File upload, title, description */}
                                {(() => { const form = videoForms[usr.id] || getDefaultVideoForm(); return (
                              <>
                                <div className="grid grid-cols-12 gap-3 p-4 border-t border-border bg-muted/20">
                                  {/* Video File */}
                                  <div className="col-span-12 md:col-span-3">
                                    <label className="block text-xs text-muted-foreground mb-1">Choose File</label>
                                    <input
                                      key={form.fileInputKey}
                                      type="file"
                                      accept="video/*"
                                      disabled={form.uploading}
                                      onChange={(e) => {
                                        const file = e.target.files?.[0] || null;
                                        setVideoForms((prev) => ({
                                          ...prev,
                                          [usr.id]: {
                                            ...(prev[usr.id] || getDefaultVideoForm()),
                                            file,
                                            previewUrl: file ? URL.createObjectURL(file) : "",
                                          },
                                        }));
                                      }}
                                      className="block w-full text-xs text-muted-foreground file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                                    />
                                  </div>

                                  {/* Title */}
                                  <div className="col-span-12 md:col-span-3">
                                    <label className="block text-xs text-muted-foreground mb-1">Video Title</label>
                                    <Input
                                      placeholder="Enter title"
                                      value={form.title}
                                      disabled={form.uploading}
                                      onChange={(e) => setVideoForms((prev) => ({
                                        ...prev,
                                        [usr.id]: { ...(prev[usr.id] || getDefaultVideoForm()), title: e.target.value },
                                      }))}
                                      className="h-9"
                                    />
                                  </div>

                                  {/* Description */}
                                  <div className="col-span-12 md:col-span-6">
                                    <label className="block text-xs text-muted-foreground mb-1">Description</label>
                                    <Textarea
                                      placeholder="Enter description"
                                      rows={1}
                                      value={form.description}
                                      disabled={form.uploading}
                                      onChange={(e) => setVideoForms((prev) => ({
                                        ...prev,
                                        [usr.id]: { ...(prev[usr.id] || getDefaultVideoForm()), description: e.target.value },
                                      }))}
                                      className="min-h-[36px] resize-none"
                                    />
                                  </div>
                                </div>

                                {/* Line 3: iTunes, Spotify, other links */}
                                <div className="grid grid-cols-12 gap-3 p-4 border-t border-border bg-card">
                                  {/* iTunes */}
                                  <div className="col-span-12 md:col-span-4">
                                    <label className="block text-xs text-muted-foreground mb-1">iTunes Link</label>
                                    <Input
                                      type="url"
                                      placeholder="https://music.apple.com/..."
                                      value={form.itunes}
                                      disabled={form.uploading}
                                      onChange={(e) => setVideoForms((prev) => ({
                                        ...prev,
                                        [usr.id]: { ...(prev[usr.id] || getDefaultVideoForm()), itunes: e.target.value },
                                      }))}
                                      className="h-9"
                                    />
                                  </div>

                                  {/* Spotify */}
                                  <div className="col-span-12 md:col-span-4">
                                    <label className="block text-xs text-muted-foreground mb-1">Spotify Link</label>
                                    <Input
                                      type="url"
                                      placeholder="https://open.spotify.com/..."
                                      value={form.spotify}
                                      disabled={form.uploading}
                                      onChange={(e) => setVideoForms((prev) => ({
                                        ...prev,
                                        [usr.id]: { ...(prev[usr.id] || getDefaultVideoForm()), spotify: e.target.value },
                                      }))}
                                      className="h-9"
                                    />
                                  </div>

                                  {/* Tidal */}
                                  <div className="col-span-12 md:col-span-3">
                                    <label className="block text-xs text-muted-foreground mb-1">Tidal Link</label>
                                    <Input
                                      type="url"
                                      placeholder="https://listen.tidal.com/..."
                                      value={form.tidal}
                                      disabled={form.uploading}
                                      onChange={(e) => setVideoForms((prev) => ({
                                        ...prev,
                                        [usr.id]: { ...(prev[usr.id] || getDefaultVideoForm()), tidal: e.target.value },
                                      }))}
                                      className="h-9"
                                    />
                                  </div>

                                  {/* YouTube Music */}
                                  <div className="col-span-12 md:col-span-3">
                                    <label className="block text-xs text-muted-foreground mb-1">YouTube Music Link</label>
                                    <Input
                                      type="url"
                                      placeholder="https://music.youtube.com/..."
                                      value={form.youtube_music}
                                      disabled={form.uploading}
                                      onChange={(e) => setVideoForms((prev) => ({
                                        ...prev,
                                        [usr.id]: { ...(prev[usr.id] || getDefaultVideoForm()), youtube_music: e.target.value },
                                      }))}
                                      className="h-9"
                                    />
                                  </div>

                                  {/* Find Links Button */}
                                  <div className="col-span-12">
                                    <Button
                                      onClick={() => handleFindMusicLinks(usr.id)}
                                      size="sm"
                                      variant="outline"
                                      disabled={!form.title || form.title.trim() === '' || form.searching || form.uploading}
                                      className="w-full md:w-auto"
                                    >
                                      {form.searching ? "Searching..." : "🔍 Find Links"}
                                    </Button>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Auto-search for Spotify, Apple Music, Tidal, and YouTube Music links
                                    </p>
                                  </div>

                                  {/* Add Video Button & Uploading Indicator */}
                                  <div className="col-span-12 flex items-center justify-between">
                                    {form.uploading && (
                                      <div className="flex-1 mr-4">
                                        <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                                          <div className="h-full w-1/2 bg-primary animate-pulse" />
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground">Uploading...</p>
                                      </div>
                                    )}
                                    <Button onClick={() => handleSubmitAddVideo(usr.id)} size="sm" disabled={!form.file || form.uploading}>
                                      {form.uploading ? "Uploading..." : "Add Video"}
                                    </Button>
                                  </div>
                                </div>
                              </>
                            ); })()}
                            </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </>
        )}

        {activeTab === "users" && (
          <div className="space-y-6">
            {/* Search */}
            <div className="max-w-md">
              <Input
                type="email"
                placeholder="Search by email..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Users Table */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="grid grid-cols-12 gap-4 bg-muted px-6 py-3 text-sm font-medium text-muted-foreground">
                <div className="col-span-1">Avatar</div>
                <div className="col-span-3">Display Name</div>
                <div className="col-span-2">Username</div>
                <div className="col-span-3">Email</div>
                <div className="col-span-1">Role</div>
                <div className="col-span-2">Actions</div>
              </div>

              <div className="divide-y divide-border">
                {allUsers
                  .filter(u => !searchEmail || u.email?.toLowerCase().includes(searchEmail.toLowerCase()))
                  .map((userItem) => (
                    <div key={userItem.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-muted/50 transition-colors">
                      <div className="col-span-1">
                        {userItem.avatar_url ? (
                          <img
                            src={userItem.avatar_url}
                            alt={userItem.display_name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            <span className="text-muted-foreground text-sm">
                              {userItem.display_name?.[0]?.toUpperCase() || "?"}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="col-span-3 text-foreground">{userItem.display_name || "—"}</div>
                      <div className="col-span-2 text-muted-foreground">{userItem.username || "—"}</div>
                      <div className="col-span-3 text-muted-foreground">{userItem.email || "—"}</div>
                      <div className="col-span-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          userItem.isAdmin 
                            ? "bg-primary/10 text-primary" 
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {userItem.isAdmin ? "Admin" : "User"}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <div className="flex flex-col gap-2">
                          <Button
                            variant={userItem.isAdmin ? "destructive" : "default"}
                            size="sm"
                            onClick={() => toggleAdminRole(userItem.id, userItem.isAdmin)}
                            disabled={userItem.id === user?.id}
                            className="w-full"
                          >
                            {userItem.isAdmin ? "Remove" : "Grant"}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteFromManageAdmins(userItem.id, userItem.username || userItem.display_name || "user")}
                            disabled={userItem.id === user?.id}
                            className="w-full"
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              {allUsers.filter(u => !searchEmail || u.email?.toLowerCase().includes(searchEmail.toLowerCase())).length === 0 && (
                <div className="px-6 py-8 text-center text-muted-foreground">
                  No users found
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
