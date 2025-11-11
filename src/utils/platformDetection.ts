export interface PlatformLink {
  url: string;
  platform: string;
  icon: string;
}

export const detectPlatform = (url: string): { platform: string; icon: string } => {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('spotify.com')) {
    return { platform: 'Spotify', icon: '🎵' };
  } else if (urlLower.includes('music.apple.com') || urlLower.includes('itunes.apple.com')) {
    return { platform: 'Apple Music', icon: '🍎' };
  } else if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
    return { platform: 'YouTube Music', icon: '▶️' };
  } else if (urlLower.includes('soundcloud.com')) {
    return { platform: 'SoundCloud', icon: '☁️' };
  } else if (urlLower.includes('tidal.com')) {
    return { platform: 'Tidal', icon: '🌊' };
  } else if (urlLower.includes('deezer.com')) {
    return { platform: 'Deezer', icon: '🎧' };
  } else if (urlLower.includes('music.amazon')) {
    return { platform: 'Amazon Music', icon: '🛒' };
  } else if (urlLower.includes('pandora.com')) {
    return { platform: 'Pandora', icon: '📻' };
  } else {
    return { platform: 'Link', icon: '🔗' };
  }
};

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};
