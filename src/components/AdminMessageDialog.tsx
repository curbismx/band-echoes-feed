import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

interface AdminMessageDialogProps {
  userId: string;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AdminMessageDialog = ({ userId, userName, open, onOpenChange }: AdminMessageDialogProps) => {
  const [message, setMessage] = useState("");
  const [maxDisplays, setMaxDisplays] = useState(3);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    if (maxDisplays < 1) {
      toast.error("Display count must be at least 1");
      return;
    }

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      const { error } = await supabase
        .from("admin_messages")
        .insert({
          user_id: userId,
          message: message.trim(),
          max_displays: maxDisplays,
          created_by: user.id,
        });

      if (error) throw error;

      toast.success(`Message sent to ${userName}`);
      setMessage("");
      setMaxDisplays(3);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast.error(error.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send Message to {userName}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Message</label>
            <Textarea
              placeholder="e.g., Your recent uploads violate our content policy. Please review our guidelines..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Show this many times per session</label>
            <Input
              type="number"
              min="1"
              max="10"
              value={maxDisplays}
              onChange={(e) => setMaxDisplays(parseInt(e.target.value) || 1)}
            />
            <p className="text-xs text-muted-foreground">
              The message will appear once per login session, up to this many times total.
              User can also mark it as "acknowledged" to stop showing.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? "Sending..." : "Send Message"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
