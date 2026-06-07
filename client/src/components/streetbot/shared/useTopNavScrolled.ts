import { useEffect, useState } from 'react';

export function useTopNavScrolled(threshold = 0) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const readScrollTop = (event?: Event) => {
      const target = event?.target;
      const targetScrollTop = target instanceof Element ? target.scrollTop : 0;

      return Math.max(
        window.scrollY,
        document.documentElement.scrollTop,
        document.body.scrollTop,
        targetScrollTop,
      );
    };

    const handleScroll = (event?: Event) => {
      setIsScrolled(readScrollTop(event) > threshold);
    };

    const handleScrollIntent = (event: WheelEvent | TouchEvent) => {
      const isWheelDown = event instanceof WheelEvent && event.deltaY > 0;
      const isTouchMove = event instanceof TouchEvent;
      if (isWheelDown || isTouchMove) {
        setIsScrolled(true);
      }
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    window.addEventListener('wheel', handleScrollIntent, { passive: true });
    window.addEventListener('touchmove', handleScrollIntent, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('wheel', handleScrollIntent);
      window.removeEventListener('touchmove', handleScrollIntent);
    };
  }, [threshold]);

  return isScrolled;
}
