import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isMobileDevice() {
  return /android|iphone|ipad|ipod/i.test(window.navigator.userAgent) || window.matchMedia('(max-width: 768px)').matches;
}

const DISMISS_KEY = 'daylife_pwa_banner_dismissed';

export function usePwaInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(isStandaloneMode);
  const [bannerDismissed, setBannerDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');

  useEffect(() => {
    const onChange = () => setIsStandalone(isStandaloneMode());
    window.matchMedia('(display-mode: standalone)').addEventListener('change', onChange);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onChange);

    return () => {
      window.matchMedia('(display-mode: standalone)').removeEventListener('change', onChange);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onChange);
    };
  }, []);

  const install = useCallback(async () => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (outcome === 'accepted') setIsStandalone(isStandaloneMode());
    return outcome === 'accepted';
  }, [installPrompt]);

  const dismissBanner = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, '1');
    setBannerDismissed(true);
  }, []);

  const canInstall = !!installPrompt && !isStandalone;
  const showIosHint = isIosDevice() && !isStandalone && isMobileDevice() && !bannerDismissed;
  const showAndroidInstall = canInstall && !bannerDismissed;

  return {
    canInstall,
    install,
    isStandalone,
    isIos: isIosDevice(),
    isMobile: isMobileDevice(),
    showBanner: (showIosHint || showAndroidInstall) && !isStandalone,
    showIosHint,
    showAndroidInstall,
    dismissBanner,
  };
}
