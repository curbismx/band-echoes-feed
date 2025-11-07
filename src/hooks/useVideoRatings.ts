import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Generate or retrieve a unique session ID for anonymous users
const getSessionId = () => {
  let sessionId = localStorage.getItem('video_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem('video_session_id', sessionId);
  }
  return sessionId;
};

export const useVideoRatings = (videoId: string) => {
  const [averageRating, setAverageRating] = useState<number>(0);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const sessionId = getSessionId();

  const fetchRatings = async () => {
    try {
      setIsLoading(true);

      // Fetch all ratings for this video
      const { data: ratings, error } = await supabase
        .from('video_ratings')
        .select('rating, user_session')
        .eq('video_id', videoId);

      if (error) throw error;

      if (ratings && ratings.length > 0) {
        // Calculate average
        const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
        const avg = sum / ratings.length;
        setAverageRating(avg);

        // Find user's rating
        const userRate = ratings.find(r => r.user_session === sessionId);
        setUserRating(userRate ? userRate.rating : null);
      } else {
        setAverageRating(0);
        setUserRating(null);
      }
    } catch (error) {
      console.error('Error fetching ratings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const submitRating = async (rating: number) => {
    try {
      const { error } = await supabase
        .from('video_ratings')
        .upsert(
          {
            video_id: videoId,
            user_session: sessionId,
            rating: rating,
          },
          {
            onConflict: 'video_id,user_session',
          }
        );

      if (error) throw error;

      // Refresh ratings after submission
      await fetchRatings();
    } catch (error) {
      console.error('Error submitting rating:', error);
    }
  };

  useEffect(() => {
    fetchRatings();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`video_ratings_${videoId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'video_ratings',
          filter: `video_id=eq.${videoId}`,
        },
        () => {
          fetchRatings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [videoId]);

  return {
    averageRating,
    userRating,
    isLoading,
    submitRating,
  };
};
