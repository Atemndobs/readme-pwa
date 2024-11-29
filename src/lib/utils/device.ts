// Device detection utilities
export const isIOS = () => {
  if (typeof window === 'undefined') return false;
  
  return [
    'iPad Simulator',
    'iPhone Simulator',
    'iPod Simulator',
    'iPad',
    'iPhone',
    'iPod',
  ].includes(navigator.platform)
  // iPad on iOS 13 detection
  || (navigator.userAgent.includes("Mac") && "ontouchend" in document);
};

export const isSafari = () => {
  if (typeof window === 'undefined') return false;
  
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('safari') && !ua.includes('chrome');
};

export const isIOSSafari = () => isIOS() && isSafari();
