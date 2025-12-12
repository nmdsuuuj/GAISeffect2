import React, { useRef } from 'react';

interface BarPadProps {
    barIndex: number;
    isActive: boolean;
    isLooping: boolean;
    hasAutomation: boolean;
    onTap: (barIndex: number) => void;
    onSwipeUp: (barIndex: number) => void;
    onSwipeDown: (barIndex: number) => void;
}

const BarPad: React.FC<BarPadProps> = ({ barIndex, isActive, isLooping, hasAutomation, onTap, onSwipeUp, onSwipeDown }) => {
    const touchStartRef = useRef<{ y: number; time: number } | null>(null);

    const handleTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
        touchStartRef.current = { y: e.touches[0].clientY, time: Date.now() };
    };

    const handleTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
        if (!touchStartRef.current) return;

        const touchEnd = { y: e.changedTouches[0].clientY, time: Date.now() };
        const deltaY = touchStartRef.current.y - touchEnd.y;
        const deltaTime = touchEnd.time - touchStartRef.current.time;

        const SWIPE_THRESHOLD_Y = 30; // Min vertical distance for a swipe
        const SWIPE_THRESHOLD_TIME = 300; // Max time for a swipe

        if (deltaTime < SWIPE_THRESHOLD_TIME) {
            if (deltaY > SWIPE_THRESHOLD_Y) {
                // Swipe Up
                onSwipeUp(barIndex);
            } else if (deltaY < -SWIPE_THRESHOLD_Y) {
                // Swipe Down
                onSwipeDown(barIndex);
            } else {
                // Tap
                onTap(barIndex);
            }
        }

        touchStartRef.current = null;
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
        // Simple tap for mouse users
        onTap(barIndex);
    };

    let bgClass = 'bg-slate-700 hover:bg-slate-600 active:bg-pink-500';
    if (hasAutomation) {
        bgClass = 'bg-slate-600 hover:bg-slate-500 active:bg-pink-500';
    }
    if (isActive) {
        bgClass = 'bg-sky-400';
    }
    if (isLooping) {
        bgClass = 'bg-pink-500 animate-pulse';
    }

    return (
        <button
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            className={`py-3 text-white font-bold rounded-md transition-colors text-sm touch-none ${bgClass}`}
        >
            {barIndex + 1}
        </button>
    );
};

export default BarPad;