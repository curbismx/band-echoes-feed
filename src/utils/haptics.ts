import { Haptics, ImpactStyle } from "@capacitor/haptics";

export const triggerHaptic = async (style: ImpactStyle = ImpactStyle.Light) => {
  try {
    await Haptics.impact({ style });
  } catch (error) {
    // Fallback for web or if haptics not available
    if ("vibrate" in navigator) {
      navigator.vibrate(style === ImpactStyle.Heavy ? 100 : 50);
    }
  }
};

export const hapticLight = () => triggerHaptic(ImpactStyle.Light);
export const hapticMedium = () => triggerHaptic(ImpactStyle.Medium);
export const hapticHeavy = () => triggerHaptic(ImpactStyle.Heavy);
