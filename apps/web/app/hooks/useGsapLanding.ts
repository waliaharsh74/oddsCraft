
'use client';
import { useLayoutEffect, useState } from 'react';
import gsap from 'gsap';

export default function useGsapLanding() {


  useLayoutEffect(() => {
    gsap.set('.hero-tagline', { opacity: 1, y: 0 });
    gsap.set('.hero-sub', { opacity: 1, y: 0 });
    gsap.set('.hero-chart', { opacity: 1, scale: 1 });

    const tl = gsap.timeline({ defaults: { duration: 1, ease: 'power3.out' } });
    tl.from('.hero-tagline', { y: 80, opacity: 0 })
      .from('.hero-sub', { y: 40, opacity: 0 }, '-=0.6')
      .from('.hero-chart', { scale: 0.8, opacity: 0 }, '-=0.6');

    return () => {
      tl.kill();
    };
  }, []);
}
