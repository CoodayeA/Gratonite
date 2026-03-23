'use client';

import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
gsap.defaults({ ease: 'power3.out', duration: 0.6 });

export function GsapProvider() {
  useEffect(() => {
    // Refresh ScrollTrigger after all content is loaded
    ScrollTrigger.refresh();
  }, []);
  return null;
}
