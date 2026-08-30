const LOCAL_CARD_WEBP_PATTERN = /^\/images\/(?:beings|spells)\/[^/]+\.webp$/;

export const getResponsiveCardSrcSet = (src: string): string | undefined => (
  LOCAL_CARD_WEBP_PATTERN.test(src)
    ? `${src.replace(/\.webp$/, '-360.webp')} 360w, ${src} 720w`
    : undefined
);
