const LOCAL_CARD_WEBP_PATTERN = /^\/images\/(?:beings|spells)\/[^/]+\.webp$/;
const CARD_ART_REVISION = 'srgb-20260918';

// Image responses can stay in browser caches for a week; update both candidates.
export const getCardArtworkSrc = (src: string): string => (
  LOCAL_CARD_WEBP_PATTERN.test(src) ? `${src}?v=${CARD_ART_REVISION}` : src
);

export const getResponsiveCardSrcSet = (src: string): string | undefined => (
  LOCAL_CARD_WEBP_PATTERN.test(src)
    ? `${getCardArtworkSrc(src.replace(/\.webp$/, '-360.webp'))} 360w, ${getCardArtworkSrc(src)} 720w`
    : undefined
);
