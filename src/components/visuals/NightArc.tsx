import { useEffect, useRef } from 'react';

type NightArcProps = {
  className?: string;
};

/**
 * A small, local-only canvas treatment for the lobby. Adapted from ThreeUI's
 * DataPixelArcCanvas, with a static reduced-motion fallback.
 */
export function NightArc({ className = '' }: NightArcProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { alpha: true });
    if (!host || !canvas || !context) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let width = 1;
    let height = 1;
    let time = 0;
    let frame = 0;
    let visible = true;

    const resize = () => {
      const bounds = host.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const render = () => {
      context.clearRect(0, 0, width, height);
      const size = 9;
      const cols = Math.ceil(width / size);
      const rows = Math.ceil(height / size);
      const centerY = height * 0.3;
      const drop = height * 0.62;
      const thickness = height * 0.31;
      for (let x = 0; x < cols; x += 1) {
        for (let y = 0; y < rows; y += 1) {
          const px = x * size;
          const py = y * size;
          const normalizedX = (px / width) * 2 - 1;
          const curveY = centerY + Math.pow(Math.abs(normalizedX), 1.8) * drop;
          let intensity = Math.max(0, 1 - Math.abs(py - curveY) / thickness);
          if (intensity <= 0.025) continue;
          intensity += Math.sin(normalizedX * 5 - time * 1.25) * 0.08;
          intensity += Math.cos(py * 0.013 + time) * 0.05;
          intensity *= Math.max(0, 1 - Math.pow(Math.abs(normalizedX), 2.35));
          if (intensity <= 0.045) continue;
          const core = Math.pow(Math.min(1, intensity), 2.4);
          context.fillStyle = `rgb(${Math.round(110 + core * 125)}, ${Math.round(56 + intensity * 120)}, ${Math.round(47 + intensity * 65)})`;
          context.globalAlpha = Math.min(0.6, intensity * 0.58);
          context.fillRect(px, py, size - 2, size - 2);
        }
      }
      context.globalAlpha = 1;
    };
    const tick = () => {
      render();
      time += 0.015;
      if (visible && !document.hidden && !reduceMotion.matches) frame = requestAnimationFrame(tick);
    };
    const refresh = () => {
      if (reduceMotion.matches) {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        render();
      } else if (visible && !document.hidden && !frame) {
        frame = requestAnimationFrame(tick);
      }
    };
    const resizeObserver = new ResizeObserver(() => {
      resize();
      render();
    });
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      refresh();
    });
    const onVisibility = () => refresh();

    resizeObserver.observe(host);
    visibilityObserver.observe(host);
    reduceMotion.addEventListener('change', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    resize();
    render();
    refresh();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      reduceMotion.removeEventListener('change', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <div className={`night-arc ${className}`} aria-hidden="true" ref={hostRef}>
      <canvas ref={canvasRef} />
    </div>
  );
}
