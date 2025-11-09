import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Upload } from "lucide-react";
import user1 from "@/assets/user-profiles/user1.jpg";
import user2 from "@/assets/user-profiles/user2.jpg";
import user3 from "@/assets/user-profiles/user3.jpg";
import user4 from "@/assets/user-profiles/user4.jpg";
import user5 from "@/assets/user-profiles/user5.jpg";
import user6 from "@/assets/user-profiles/user6.jpg";
import user7 from "@/assets/user-profiles/user7.jpg";
import user8 from "@/assets/user-profiles/user8.jpg";
import user9 from "@/assets/user-profiles/user9.jpg";
import user10 from "@/assets/user-profiles/user10.jpg";

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

const initialUsers: UserForm[] = [
  {
    icon: user1,
    name: "Sarah Martinez",
    username: "soundwave_sara",
    email: "sarah.martinez@musiclabel.com",
    description: "Music producer and songwriter based in LA",
    videos: [],
  },
  {
    icon: user2,
    name: "Michael Thompson",
    username: "mikebeats",
    email: "michael.thompson@studioworks.com",
    description: "Audio engineer with 15 years experience",
    videos: [],
  },
  {
    icon: user3,
    name: "Emma Wilson",
    username: "artsy.emma",
    email: "emma.wilson@creativemedia.com",
    description: "Creative director and visual artist",
    videos: [],
  },
  {
    icon: user4,
    name: "David Chen",
    username: "techbeats_dave",
    email: "david.chen@techstudio.com",
    description: "Tech entrepreneur and music enthusiast",
    videos: [],
  },
  {
    icon: user5,
    name: "Jennifer Roberts",
    username: "hendrix_fan",
    email: "jennifer.roberts@executive.com",
    description: "Entertainment industry executive",
    videos: [],
  },
  {
    icon: user6,
    name: "Alex Rodriguez",
    username: "alexdrum",
    email: "alex.rodriguez@indie.com",
    description: "Indie musician and content creator",
    videos: [],
  },
  {
    icon: user7,
    name: "Rachel Anderson",
    username: "vinyl_queen",
    email: "rachel.anderson@management.com",
    description: "Artist manager and talent scout",
    videos: [],
  },
  {
    icon: user8,
    name: "Robert Sullivan",
    username: "classic_rock_bob",
    email: "robert.sullivan@legacy.com",
    description: "Music industry veteran and consultant",
    videos: [],
  },
  {
    icon: user9,
    name: "Nina Patel",
    username: "ninarocks",
    email: "nina.patel@startup.com",
    description: "Digital marketing specialist for artists",
    videos: [],
  },
  {
    icon: user10,
    name: "James Mitchell",
    username: "live_music_jam",
    email: "james.mitchell@venue.com",
    description: "Live event producer and booking agent",
    videos: [],
  },
];

const Admin = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [users, setUsers] = useState<UserForm[]>(initialUsers);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [activeTab, setActiveTab] = useState<"accounts" | "users">("accounts");
  const [currentUser, setCurrentUser] = useState<UserForm>({
    icon: null,
    name: "",
    username: "",
    email: "",
    description: "",
    videos: [],
  });

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
    if (isAdmin && activeTab === "users") {
      fetchAllUsers();
    }
  }, [isAdmin, activeTab]);

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
    const email = userForm.email || `${userForm.username}@temp.com`;

    try {
      // Create user account
      // Create user account via backend function (keeps current admin session)
      const password = crypto.randomUUID(); // Generate random password
      const { data: fnData, error: fnError } = await supabase.functions.invoke("admin-create-user", {
        body: {
          email,
          password,
          username: userForm.username,
          display_name: userForm.name,
        },
      });

      if (fnError) throw fnError as any;
      const createdUserId = (fnData as any)?.user_id as string | undefined;
      if (!createdUserId) throw new Error("User creation failed");

      // Upload avatar if provided
      let avatarUrl = null;
      if (userForm.icon) {
        let fileToUpload: File;
        let fileExt: string;
        
        if (typeof userForm.icon === 'string') {
          // Fetch the image from the URL and convert to File
          const response = await fetch(userForm.icon);
          const blob = await response.blob();
          fileExt = userForm.icon.split('.').pop() || 'jpg';
          fileToUpload = new File([blob], `avatar.${fileExt}`, { type: blob.type });
        } else {
          // Use the uploaded File directly
          fileToUpload = userForm.icon;
          fileExt = userForm.icon.name.split(".").pop() || 'jpg';
        }
        
        const fileName = `${createdUserId}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(fileName, fileToUpload, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("avatars")
          .getPublicUrl(fileName);
        avatarUrl = publicUrl;
      }

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          bio: userForm.description,
          avatar_url: avatarUrl,
        })
        .eq("id", createdUserId);

      if (profileError) throw profileError;

      toast.success(`User ${userForm.name} created successfully!`);
      handleDeleteUser(index);
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error(error.message || "Failed to create user");
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
                <div className="col-span-1">Action</div>
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
                        <Button
                          variant={userItem.isAdmin ? "destructive" : "default"}
                          size="sm"
                          onClick={() => toggleAdminRole(userItem.id, userItem.isAdmin)}
                          disabled={userItem.id === user?.id}
                        >
                          {userItem.isAdmin ? "Remove" : "Grant"}
                        </Button>
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
