"use client";

import { useEffect, useRef } from "react";

interface Tactical2DOrbProps {
  subtle?: boolean;
}

export default function Tactical2DOrb({ subtle = false }: Tactical2DOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let angle = 0;
    let pulse = 0;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = motionPreference.matches;

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };
    const render = (_timestamp: number) => {
      animId = 0;
      if (document.hidden) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const baseR = Math.min(cx, cy) * 0.45;

      if (!reducedMotion) angle += subtle ? 0.005 : 0.015;
      pulse = reducedMotion ? 1 : Math.sin(angle * 2) * 0.15 + 1.0;

      // 1. Outer dashed ring
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle * 0.5);
      ctx.beginPath();
      ctx.arc(0, 0, baseR * 1.35, 0, Math.PI * 2);
      ctx.setLineDash([8, 14]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = subtle ? "rgba(0, 180, 220, 0.2)" : "rgba(0, 240, 255, 0.45)";
      ctx.stroke();
      ctx.restore();

      // 2. Middle segmented targeting arc
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-angle * 0.8);
      ctx.beginPath();
      ctx.arc(0, 0, baseR * 1.05, 0, Math.PI * 1.4);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = subtle ? "rgba(0, 144, 234, 0.25)" : "rgba(0, 144, 234, 0.65)";
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, baseR * 1.05, Math.PI * 1.55, Math.PI * 1.95);
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = subtle ? "rgba(0, 240, 255, 0.3)" : "rgba(0, 240, 255, 0.85)";
      ctx.stroke();
      ctx.restore();

      // 3. Inner core ring with radial glow
      const grad = ctx.createRadialGradient(cx, cy, baseR * 0.1, cx, cy, baseR * 0.75);
      grad.addColorStop(0, subtle ? "rgba(0, 240, 255, 0.2)" : "rgba(128, 247, 255, 0.55)");
      grad.addColorStop(0.5, subtle ? "rgba(0, 144, 234, 0.1)" : "rgba(0, 144, 234, 0.25)");
      grad.addColorStop(1, "rgba(0, 8, 20, 0)");

      ctx.beginPath();
      ctx.arc(cx, cy, baseR * 0.75 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // 4. Center reticle crosshair
      ctx.strokeStyle = subtle ? "rgba(0, 240, 255, 0.2)" : "rgba(0, 240, 255, 0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 20, cy);
      ctx.lineTo(cx + 20, cy);
      ctx.moveTo(cx, cy - 20);
      ctx.lineTo(cx, cy + 20);
      ctx.stroke();

      // 5. 2D Tactical mode badge
      ctx.fillStyle = "rgba(0, 240, 255, 0.5)";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText("TACTICAL 2D LOW-POWER VISUALIZER", cx, cy + baseR * 1.45);

      if (!reducedMotion) animId = requestAnimationFrame(render);
    };

    const scheduleRender = () => {
      if (!document.hidden && !animId && !reducedMotion) {
        animId = requestAnimationFrame(render);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(animId);
        animId = 0;
      } else if (reducedMotion) {
        render(performance.now());
      } else {
        scheduleRender();
      }
    };

    const handleMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      cancelAnimationFrame(animId);
      animId = 0;
      if (reducedMotion) render(performance.now());
      else scheduleRender();
    };

    const handleResize = () => {
      resize();
      if (reducedMotion && !document.hidden) render(performance.now());
    };

    resize();
    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    if (typeof motionPreference.addEventListener === "function") {
      motionPreference.addEventListener("change", handleMotionChange);
    } else {
      motionPreference.addListener(handleMotionChange);
    }
    if (reducedMotion) render(performance.now());
    else scheduleRender();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (typeof motionPreference.removeEventListener === "function") {
        motionPreference.removeEventListener("change", handleMotionChange);
      } else {
        motionPreference.removeListener(handleMotionChange);
      }
    };
  }, [subtle]);

  return <canvas ref={canvasRef} className="tactical-2d-canvas" />;
}
