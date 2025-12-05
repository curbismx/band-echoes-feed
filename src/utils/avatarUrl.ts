/**
 * Generate a consistent avatar URL with cache-busting and deterministic fallbacks
 */
export const getAvatarUrl = (
  avatarUrl: string | null | undefined,
  userName: string,
  userId?: string
): string => {
  if (avatarUrl && avatarUrl.trim() !== '') {
    // Add cache-busting for Supabase storage URLs
    const separator = avatarUrl.includes('?') ? '&' : '?';
    return `${avatarUrl}${separator}v=${Date.now()}`;
  }
  // Fallback to UI Avatars with deterministic color based on userId
  const colorSeed = userId ? userId.substring(0, 6).replace(/-/g, '') : '888888';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(userName || 'User')}&background=${colorSeed}&color=fff&size=128`;
};
