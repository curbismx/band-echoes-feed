import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { createPortal } from "react-dom";

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
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const commentsListRef = useRef<HTMLDivElement>(null);

  const emojis = ["❤️", "🙌", "🔥", "👏", "😢", "😍", "😮", "😂"];

  // Handle iOS keyboard with visualViewport API
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      if (window.visualViewport) {
        const keyboardH = window.innerHeight - window.visualViewport.height;
        setKeyboardHeight(keyboardH > 0 ? keyboardH : 0);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      window.visualViewport.addEventListener('scroll', handleResize);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
        window.visualViewport.removeEventListener('scroll', handleResize);
      }
    };
  }, [isOpen]);

  // Scroll to bottom when keyboard opens
  useEffect(() => {
    if (keyboardHeight > 0 && commentsListRef.current) {
      commentsListRef.current.scrollTop = commentsListRef.current.scrollHeight;
    }
  }, [keyboardHeight]);

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
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, videoId]);

  const fetchComments = async () => {
    setLoading(true);
    
    const { data: commentsData, error: commentsError } = await supabase
      .from("comments")
      .select("*")
      .eq("video_id", videoId)
      .order("created_at", { ascending: false });

    if (commentsError) {
      console.error("Error fetching comments:", commentsError);
      setLoading(false);
      return;
    }

    const userIds = [...new Set(commentsData?.map(c => c.user_id) || [])];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", userIds);

    const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
    const enrichedComments = commentsData?.map(comment => ({
      ...comment,
      profiles: profilesMap.get(comment.user_id) || { username: "Unknown", avatar_url: null }
    })) || [];

    setComments(enrichedComments);
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
      inputRef.current?.blur();
      setTimeout(() => {
        fetchComments();
      }, 300);
    }
    setSubmitting(false);
  };

  const handleEmojiClick = (emoji: string) => {
    setNewComment((prev) => prev + emoji);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      inputRef.current?.blur();
      setTimeout(onClose, 100);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[9998]"
        onClick={handleBackdropClick}
      />

      {/* Drawer */}
      <div
        className="fixed left-0 right-0 z-[9999] flex flex-col rounded-t-3xl"
        style={{ 
          backgroundColor: "#0A1014",
          bottom: keyboardHeight > 0 ? keyboardHeight : 0,
          height: keyboardHeight > 0 ? 'auto' : '60vh',
          maxHeight: keyboardHeight > 0 ? `calc(100vh - ${keyboardHeight}px - env(safe-area-inset-top))` : '60vh',
          transition: keyboardHeight > 0 ? 'none' : 'bottom 0.3s ease-out',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-center p-4 border-b border-white/10 flex-shrink-0 relative">
          <div className="w-10 h-1 bg-white/30 rounded-full absolute top-2" />
          <span className="font-semibold text-white">Comments</span>
          <button 
            onClick={onClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comments List */}
        <div 
          ref={commentsListRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-6 min-h-0"
          style={{ maxHeight: keyboardHeight > 0 ? '30vh' : undefined }}
        >
          {loading ? (
            <div className="text-center text-white/60">Loading...</div>
          ) : comments.length === 0 ? (
            <div className="text-center text-white/60 py-8">
              No comments yet. Be the first to comment!
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage src={comment.profiles.avatar_url || undefined} />
                  <AvatarFallback className="bg-white/20 text-white">
                    {comment.profiles.username?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-white">
                      {comment.profiles.username}
                    </span>
                    <span className="text-xs text-white/50">
                      {formatDistanceToNow(new Date(comment.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-white leading-relaxed break-words">
                    {comment.content}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Emoji Bar */}
        <div className="border-t border-white/10 px-4 py-2 flex-shrink-0">
          <div className="flex justify-around items-center">
            {emojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleEmojiClick(emoji)}
                className="text-xl hover:scale-125 transition-transform active:scale-95"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Comment Input */}
        <div 
          className="border-t border-white/10 p-3 flex-shrink-0"
          style={{ paddingBottom: keyboardHeight > 0 ? 12 : 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <div className="flex gap-3 items-center">
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarImage src={userAvatar || undefined} />
              <AvatarFallback className="bg-white/20 text-white text-sm">
                {user?.email?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 flex items-center gap-2 bg-white/10 rounded-full px-4 py-2">
              <input
                ref={inputRef}
                type="text"
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitComment();
                  }
                }}
                className="flex-1 bg-transparent text-white placeholder:text-white/50 text-sm outline-none"
                disabled={submitting}
              />
              <Button
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || submitting}
                size="sm"
                variant="ghost"
                className="text-blue-400 hover:text-blue-300 hover:bg-transparent px-2 h-auto font-semibold"
              >
                Post
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};
