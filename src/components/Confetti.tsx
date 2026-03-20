"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#f43f5e"];

export function Confetti({ trigger }: { trigger: boolean }) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!trigger || firedRef.current) return;
    firedRef.current = true;

    const container = document.createElement("div");
    container.style.cssText =
      "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;";
    document.body.appendChild(container);

    const pieces: HTMLElement[] = [];
    for (let i = 0; i < 80; i++) {
      const el = document.createElement("div");
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const size = 6 + Math.random() * 8;
      const left = Math.random() * 100;
      const delay = Math.random() * 600;
      const duration = 1200 + Math.random() * 1000;
      const isCircle = Math.random() > 0.5;

      el.style.cssText = `
        position:absolute;
        top:-20px;
        left:${left}%;
        width:${size}px;
        height:${size}px;
        background:${color};
        border-radius:${isCircle ? "50%" : "2px"};
        animation:confetti-fall ${duration}ms ${delay}ms ease-in forwards;
        opacity:1;
      `;
      container.appendChild(el);
      pieces.push(el);
    }

    const cleanup = setTimeout(() => {
      container.remove();
    }, 2400);

    return () => {
      clearTimeout(cleanup);
      container.remove();
    };
  }, [trigger]);

  return null;
}
