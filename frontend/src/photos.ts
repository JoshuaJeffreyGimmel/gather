/**
 * Crop hints for the stock photography. Every photo is a wide group shot, so
 * the interesting part is rarely the geometric centre — these keep faces in
 * the top half where the scrim is lightest.
 */
const POSITION: Record<string, string> = {
  'hero.jpg': '50% 26%',
  'sport.jpg': '50% 34%',
  'park.jpg': '52% 30%',
  'rooftop.jpg': '54% 32%',
  'bridge.jpg': '50% 30%',
  'garden.jpg': '30% 20%',
  'spritz.jpg': '52% 28%'
};

export const photoUrl = (photo: string) => `/img/${photo}`;
export const photoPosition = (photo: string | null) => (photo && POSITION[photo]) || '50% 40%';
