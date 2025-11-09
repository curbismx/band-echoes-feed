import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Upload } from "lucide-react";


interface VideoInput {
  id: string;
  title: string;
}

interface UserForm {
  icon: File | string | null;
  name: string;
  username: string;
  email: string;
  description: string;
  videos: VideoInput[];
}

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
  const [addVideoForUser, setAddVideoForUser] = useState<string | null>(null);
  const [newVideo, setNewVideo] = useState<{ url: string; title: string; caption: string; linksText: string }>({ url: "", title: "", caption: "", linksText: "" });
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
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCreatedUsers(profiles || []);
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
    if (!userForm.username || !userForm.name) {
      toast.error("Please fill in required fields: username and name");
      return;
    }
    
    // Generate email if not provided
    let email = userForm.email || `${userForm.username}@temp.com`;

    try {
      // Create user account via backend function (keeps current admin session)
      const password = crypto.randomUUID(); // Generate random password

      const attemptCreate = async () => {
        const { data, error } = await supabase.functions.invoke("admin-create-user", {
          body: {
            email,
            password,
            username: userForm.username,
            display_name: userForm.name,
          },
        });
        return { data, error };
      };

      let { data: fnData, error: fnError } = await attemptCreate();

      // If email was auto-generated and already exists, retry once with a unique alias
      const autoGenerated = !userForm.email;
      if (fnError && autoGenerated && (fnError.message?.includes("already been registered") || fnError.message?.includes("email_exists"))) {
        email = `${userForm.username}+${Math.floor(Math.random() * 1e6)}@temp.com`;
        ({ data: fnData, error: fnError } = await attemptCreate());
      }

      if (fnError) {
        // Surface clear guidance when email collides
        if (fnError.message?.includes("already been registered") || fnError.message?.includes("email_exists")) {
          throw new Error("Email already exists. Please use a different email address.");
        }
        throw fnError as any;
      }

      const createdUserId = (fnData as any)?.user_id as string | undefined;
      if (!createdUserId) throw new Error("User creation failed");

      // Update profile via backend function (service role)
      let avatar_base64: string | undefined;
      let avatar_ext: string | undefined;
      if (userForm.icon) {
        let file: File;
        if (typeof userForm.icon === 'string') {
          // Fetch the image from the URL and convert to File
          const response = await fetch(userForm.icon);
          const blob = await response.blob();
          file = new File([blob], 'avatar', { type: blob.type });
          avatar_ext = (userForm.icon.split('.').pop() || 'jpg').toLowerCase();
        } else {
          // Use the uploaded File directly
          file = userForm.icon;
          avatar_ext = (userForm.icon.name.split(".").pop() || 'jpg').toLowerCase();
        }
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        avatar_base64 = btoa(binary);
      }

      const { data: updateData, error: updateError } = await supabase.functions.invoke("admin-update-profile", {
        body: {
          user_id: createdUserId,
          username: userForm.username,
          display_name: userForm.name,
          email,
          bio: userForm.description || null,
          avatar_base64,
          avatar_ext,
          created_by: user?.id,
        },
      });

      if (updateError) throw updateError as any;

      toast.success(`User ${userForm.name} created successfully!`);
      handleDeleteUser(index);
      fetchCreatedUsers(); // Refresh the list
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error(error.message || "Failed to create user");
    }
  };

  const handleSubmitAddVideo = async (userId: string) => {
    try {
      if (!newVideo.url) {
        toast.error("Please provide a video URL");
        return;
      }
      const links = newVideo.linksText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((u) => ({ url: u }));

      const { error } = await supabase.functions.invoke("admin-add-video-record", {
        body: {
          user_id: userId,
          video_url: newVideo.url,
          title: newVideo.title || null,
          caption: newVideo.caption || null,
          links,
        },
      });

      if (error) throw error as any;

      toast.success("Video added");
      setAddVideoForUser(null);
      setNewVideo({ url: "", title: "", caption: "", linksText: "" });
    } catch (e: any) {
      console.error("Add video error:", e);
      toast.error(e.message || "Failed to add video");
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
            onClick={handleLogout}
            className="text-xl font-normal text-foreground hover:text-primary transition-colors ml-auto"
          >
            Logout
          </button>
        </div>

        {activeTab === "accounts" && (
          <>
            {/* Created Users List */}

            {createdUsers.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-medium text-foreground mb-4">Your Created Users ({createdUsers.length})</h2>
                <div className="space-y-4">
                  {createdUsers.map((usr) => (
                    <div key={usr.id}>
                      {editingUser === usr.id ? (
                        <div className="grid grid-cols-12 gap-4 items-center bg-muted/30 p-4 rounded-lg">
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
                          <Input className="col-span-3" placeholder="Bio" value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} />
                          <div className="col-span-1 flex gap-1">
                            <Button variant="default" size="sm" onClick={() => handleSaveEdit(usr.id)}>Save</Button>
                            <Button variant="ghost" size="sm" onClick={() => setEditingUser(null)}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-12 gap-4 items-center p-4 hover:bg-muted/50 transition-colors rounded-lg border border-border">
                            <div className="col-span-1">
                              {usr.avatar_url ? (
                                <img src={usr.avatar_url} alt={usr.display_name} className="w-10 h-10 rounded-full object-cover" />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                  <span className="text-muted-foreground text-sm">{usr.display_name?.[0]?.toUpperCase() || "?"}</span>
                                </div>
                              )}
                            </div>
                            <div className="col-span-2 text-foreground">{usr.display_name || "—"}</div>
                            <div className="col-span-2 text-muted-foreground">{usr.username || "—"}</div>
                            <div className="col-span-3 text-muted-foreground text-sm">{usr.email || "—"}</div>
                            <div className="col-span-3 text-muted-foreground text-sm truncate">{usr.bio || "—"}</div>
                            <div className="col-span-1">
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => handleEditUser(usr)}>Edit</Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    setAddVideoForUser(usr.id === addVideoForUser ? null : usr.id);
                                    setNewVideo({ url: "", title: "", caption: "", linksText: "" });
                                  }}
                                >
                                  Video
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => handleDeleteCreatedUser(usr.id, usr.username || usr.display_name)}>Del</Button>
                              </div>
                            </div>
                          </div>
                          {addVideoForUser === usr.id && (
                            <div className="mt-4 p-6 border border-border rounded-lg bg-card/50">
                              <h3 className="text-sm font-medium text-foreground mb-4">Add Video for {usr.display_name}</h3>
                              
                              {/* Video Upload */}
                              <div className="mb-4">
                                <label className="block text-sm text-muted-foreground mb-2">Video File</label>
                                <input
                                  type="file"
                                  accept="video/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      setNewVideo({ ...newVideo, url: URL.createObjectURL(file) });
                                    }
                                  }}
                                  className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                                />
                              </div>

                              {/* Title */}
                              <div className="mb-4">
                                <label className="block text-sm text-muted-foreground mb-2">Title</label>
                                <Input placeholder="Video title" value={newVideo.title} onChange={(e) => setNewVideo({ ...newVideo, title: e.target.value })} />
                              </div>

                              {/* Caption */}
                              <div className="mb-4">
                                <label className="block text-sm text-muted-foreground mb-2">Caption</label>
                                <Textarea placeholder="Video caption" value={newVideo.caption} onChange={(e) => setNewVideo({ ...newVideo, caption: e.target.value })} rows={3} />
                              </div>

                              {/* Links (iTunes, Spotify, etc) */}
                              <div className="mb-4">
                                <label className="block text-sm text-muted-foreground mb-2">Music Links (iTunes, Spotify, etc.)</label>
                                <div className="space-y-2">
                                  {newVideo.linksText.split(',').filter(l => l.trim()).map((link, idx) => (
                                    <Input
                                      key={idx}
                                      placeholder="Add music link (iTunes, Spotify, etc.)"
                                      value={link.trim()}
                                      onChange={(e) => {
                                        const links = newVideo.linksText.split(',').filter(l => l.trim());
                                        links[idx] = e.target.value;
                                        setNewVideo({ ...newVideo, linksText: links.join(',') });
                                      }}
                                    />
                                  ))}
                                  <Input
                                    placeholder="Add music link (iTunes, Spotify, etc.)"
                                    onFocus={(e) => {
                                      if (!newVideo.linksText.trim()) {
                                        setNewVideo({ ...newVideo, linksText: '' });
                                      }
                                    }}
                                    onChange={(e) => {
                                      const existing = newVideo.linksText.split(',').filter(l => l.trim());
                                      setNewVideo({ ...newVideo, linksText: [...existing, e.target.value].join(',') });
                                    }}
                                  />
                                  <button
                                    onClick={() => {
                                      const existing = newVideo.linksText.split(',').filter(l => l.trim());
                                      setNewVideo({ ...newVideo, linksText: [...existing, ''].join(',') });
                                    }}
                                    className="flex items-center gap-2 text-primary hover:text-primary/80 text-sm font-medium"
                                  >
                                    <Plus className="w-4 h-4" />
                                    Add another link
                                  </button>
                                </div>
                              </div>

                              <div className="flex gap-2">
                                <Button onClick={() => handleSubmitAddVideo(usr.id)}>Add Video</Button>
                                <Button variant="ghost" onClick={() => setAddVideoForUser(null)}>Cancel</Button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

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
            <div className="space-y-8">
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
                <div className="col-span-2">Role</div>
                <div className="col-span-1">Actions</div>
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
                      <div className="col-span-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          userItem.isAdmin 
                            ? "bg-primary/10 text-primary" 
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {userItem.isAdmin ? "Admin" : "User"}
                        </span>
                      </div>
                      <div className="col-span-1">
                        <div className="flex gap-1">
                          <Button
                            variant={userItem.isAdmin ? "destructive" : "default"}
                            size="sm"
                            onClick={() => toggleAdminRole(userItem.id, userItem.isAdmin)}
                            disabled={userItem.id === user?.id}
                          >
                            {userItem.isAdmin ? "Remove" : "Grant"}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteFromManageAdmins(userItem.id, userItem.username || userItem.display_name || "user")}
                            disabled={userItem.id === user?.id}
                          >
                            Del
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
