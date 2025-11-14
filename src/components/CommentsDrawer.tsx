import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { formatDistanceToNow } from "date-fns";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  likes_count: number;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

interface CommentsDrawerProps {
  videoId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const CommentsDrawer = ({ videoId, isOpen, onClose }: CommentsDrawerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  const emojis = ["❤️", "🙌", "🔥", "👏", "😢", "😍", "😮", "😂"];

  // Fetch current user's avatar
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .single();
      
      if (data?.avatar_url) {
        setUserAvatar(data.avatar_url);
      }
    };
    fetchUserProfile();
  }, [user]);

  useEffect(() => {
    if (isOpen) {
      fetchComments();
    }
  }, [isOpen, videoId]);

  const fetchComments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("comments")
      .select(`
        *,
        profiles:user_id (
          username,
          avatar_url
        )
      `)
      .eq("video_id", videoId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching comments:", error);
    } else {
      setComments(data as any || []);
    }
    setLoading(false);
  };

  const handleSubmitComment = async () => {
    if (!user) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to comment",
        variant: "destructive",
      });
      return;
    }

    if (!newComment.trim()) return;

    setSubmitting(true);
    const { error } = await supabase.from("comments").insert({
      video_id: videoId,
      user_id: user.id,
      content: newComment.trim(),
    });

    if (error) {
      console.error("Comment insert error:", error);
      toast({
        title: "Error",
        description: "Failed to post comment",
        variant: "destructive",
      });
    } else {
      setNewComment("");
      // Wait a bit for the database to update, then refetch
      setTimeout(() => {
        fetchComments();
      }, 300);
    }
    setSubmitting(false);
  };

  const handleEmojiClick = (emoji: string) => {
    setNewComment((prev) => prev + emoji);
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="h-[50vh] flex flex-col rounded-t-3xl">
        <DrawerHeader className="border-b border-border">
          <DrawerTitle className="text-center">Comments</DrawerTitle>
        </DrawerHeader>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {loading ? (
            <div className="text-center text-muted-foreground">Loading...</div>
          ) : comments.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No comments yet. Be the first to comment!
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage src={comment.profiles.avatar_url || undefined} />
                  <AvatarFallback>
                    {comment.profiles.username?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">
                      {comment.profiles.username}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed break-words">
                    {comment.content}
                  </p>
                  <button className="text-xs text-muted-foreground mt-2 hover:text-foreground">
                    Reply
                  </button>
                </div>
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <button className="text-muted-foreground hover:text-red-500 transition-colors">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </button>
                  {comment.likes_count > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {comment.likes_count}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Emoji Bar */}
        <div className="border-t border-border px-4 py-3">
          <div className="flex justify-around items-center">
            {emojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleEmojiClick(emoji)}
                className="text-2xl hover:scale-125 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Comment Input */}
        <div className="border-t border-border p-4">
          <div className="flex gap-3 items-start">
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarImage src={userAvatar || undefined} />
              <AvatarFallback>
                {user?.email?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Textarea
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[60px] resize-none"
                disabled={submitting}
              />
            </div>
            <Button
              onClick={handleSubmitComment}
              disabled={!newComment.trim() || submitting}
              size="sm"
              className="mt-2"
            >
              Post
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
