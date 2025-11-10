import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const AdminMessagePopup = () => {
  const { user } = useAuth();
  const [message, setMessage] = useState<any>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user) return;

    const checkForMessages = async () => {
      try {
        // Get unacknowledged messages for this user
        const { data: messages, error } = await supabase
          .from("admin_messages")
          .select("*")
          .eq("user_id", user.id)
          .eq("acknowledged", false)
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (messages && messages.length > 0) {
          const msg = messages[0];

          // Check how many times this message has been viewed
          const { data: views, error: viewsError } = await supabase
            .from("admin_message_views")
            .select("*")
            .eq("message_id", msg.id);

          if (viewsError) throw viewsError;

          const viewCount = views?.length || 0;

          // Show message if it hasn't reached max displays
          if (viewCount < msg.max_displays) {
            setMessage(msg);
            setVisible(true);

            // Record this view
            await supabase
              .from("admin_message_views")
              .insert({ message_id: msg.id });
          }
        }
      } catch (error) {
        console.error("Error checking for admin messages:", error);
      }
    };

    checkForMessages();
  }, [user]);

  const handleClose = () => {
    setVisible(false);
  };

  const handleAcknowledge = async () => {
    if (!message) return;

    try {
      const { error } = await supabase
        .from("admin_messages")
        .update({ 
          acknowledged: true, 
          acknowledged_at: new Date().toISOString() 
        })
        .eq("id", message.id);

      if (error) throw error;

      setVisible(false);
    } catch (error) {
      console.error("Error acknowledging message:", error);
    }
  };

  if (!visible || !message) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="relative w-full max-w-md bg-black border border-white/20 rounded-lg p-6 shadow-xl">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white">Message from Administrator</h2>
          
          <div className="text-white/90 whitespace-pre-wrap">
            {message.message}
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleClose}
              variant="outline"
              className="flex-1 bg-white/10 text-white border-white/20 hover:bg-white/20"
            >
              Close
            </Button>
            <Button
              onClick={handleAcknowledge}
              className="flex-1 bg-white text-black hover:bg-white/90"
            >
              Acknowledge
            </Button>
          </div>

          <p className="text-xs text-white/60 text-center">
            This message will show {message.max_displays} time(s) total unless acknowledged
          </p>
        </div>
      </div>
    </div>
  );
};
