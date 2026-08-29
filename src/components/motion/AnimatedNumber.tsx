// Source: beUI @beui/animated-number (MIT), adapted only to local relative imports.
import { animate, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { EASE_OUT } from '../../lib/ease';

export interface AnimatedNumberProps {
  value: number;
  duration?: number;
  format?: (value: number) => string;
  className?: string;
  startOnView?: boolean;
}

export function AnimatedNumber({
  value,
  duration = 1.2,
  format = (current) => Math.round(current).toLocaleString(),
  className,
  startOnView = true,
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (startOnView && !inView) return;
    if (reduce) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }
    const controls = animate(fromRef.current, value, {
      duration,
      ease: EASE_OUT,
      onUpdate: (current) => setDisplay(current),
    });
    fromRef.current = value;
    return () => controls.stop();
  }, [value, duration, inView, startOnView, reduce]);

  return (
    <span ref={ref} className={['tabular-nums', className].filter(Boolean).join(' ')}>
      {format(display)}
    </span>
  );
}
