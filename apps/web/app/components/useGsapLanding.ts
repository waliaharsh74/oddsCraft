
'use client';
import { useLayoutEffect } from 'react';
import gsap from 'gsap';

export default function useGsapLanding() {
  useLayoutEffect(() => {
    const tl = gsap.timeline({ defaults: { duration: 1, ease: 'power3.out' }});
    tl.from('.hero-tagline', { y: 80, opacity: 0 })
      .from('.hero-sub', { y: 40, opacity: 0 }, '-=0.6')
      .from('.hero-chart', { scale: 0.8, opacity: 0 }, '-=0.6');
  }, []);
}
