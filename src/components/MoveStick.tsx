import React, { useRef, useState } from 'react';

interface MoveStickProps {
  onMove: (x: number, y: number) => void;
}

/**
 * Touch / pointer WALK joystick ("Walk: drag the stick", "WALK stick, bottom left").
 * Emits normalized (x, y) in [-1, 1] where y > 0 is forward and x > 0 is right.
 * Stops touch/pointer propagation so walking never interferes with canvas touch-look drag.
 */
export const MoveStick: React.FC<MoveStickProps> = ({ onMove }) => {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  const maxRadius = 28;

  const updateFromClientPos = (clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    setKnobOffset({ x: dx, y: dy });
    onMove(dx / maxRadius, -dy / maxRadius);
  };

  const resetStick = (e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    setActive(false);
    setKnobOffset({ x: 0, y: 0 });
    onMove(0, 0);
  };

  return (
    <div
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      className="flex flex-col items-center gap-1.5 pointer-events-auto select-none touch-none"
    >
      <div
        ref={baseRef}
        role="slider"
        aria-label="Walk: drag the stick"
        aria-valuemin={-1}
        aria-valuemax={1}
        aria-valuenow={Number((knobOffset.y / maxRadius).toFixed(1))}
        tabIndex={-1}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
          setActive(true);
          updateFromClientPos(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          e.stopPropagation();
          if (!active) return;
          updateFromClientPos(e.clientX, e.clientY);
        }}
        onPointerUp={resetStick}
        onPointerCancel={resetStick}
        className="relative w-20 h-20 min-w-[44px] min-h-[44px] rounded-full border border-[#ece7db]/30 bg-[#070907]/90 flex items-center justify-center touch-none cursor-grab active:cursor-grabbing"
      >
        <div
          className="w-8 h-8 rounded-full bg-[#fff0d4] border border-[#070907] transition-transform duration-75"
          style={{
            transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
          }}
        />
      </div>
      <span className="text-[10px] font-mono tracking-wider text-[#9e9a90]">
        Walk: drag the stick
      </span>
    </div>
  );
};
