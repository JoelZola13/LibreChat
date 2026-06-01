import { useEffect, useState } from 'react';

export function useAcademyNavScrolled(threshold = 8) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const isAcademyPageScrollTarget = (target: EventTarget | null | undefined) => {
      return (
        target instanceof Element &&
        Boolean(target.querySelector('nav[data-academy-top-nav="true"]'))
      );
    };

    const getPageScrollTop = (event?: Event) => {
      const target = event?.target;
      const academyPageScrollTop = isAcademyPageScrollTarget(target) ? target.scrollTop : 0;

      return Math.max(
        window.scrollY,
        document.documentElement.scrollTop,
        document.body.scrollTop,
        academyPageScrollTop,
      );
    };

    const handleScroll = (event?: Event) => {
      const target = event?.target;
      const isPageScroll =
        !target ||
        target === window ||
        target === document ||
        target === document.documentElement ||
        target === document.body ||
        target === document.scrollingElement ||
        isAcademyPageScrollTarget(target);

      if (!isPageScroll) {
        return;
      }

      setIsScrolled(getPageScrollTop(event) > threshold);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [threshold]);

  return isScrolled;
}
