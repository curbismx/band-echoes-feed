/**
 * Generate a consistent avatar URL with cache-busting and deterministic fallbacks
 */
export const getAvatarUrl = (
  avatarUrl: string | null | undefined,
  userName: string,
  userId?: string
): string => {
  // Handle null, undefined, or empty strings
  if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim() !== '') {
    // Use hourly cache-bust instead of per-render to prevent flickering
    const cacheBust = Math.floor(Date.now() / 3600000);
    const separator = avatarUrl.includes('?') ? '&' : '?';
    return `${avatarUrl}${separator}v=${cacheBust}`;
  }
  // Fallback to UI Avatars with deterministic color based on userId
  const colorSeed = userId ? userId.substring(0, 6).replace(/-/g, '') : '888888';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(userName || 'User')}&background=${colorSeed}&color=fff&size=128`;
};
