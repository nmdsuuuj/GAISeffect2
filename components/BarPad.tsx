import React, { useRef } from 'react';

interface BarPadProps {
    barIndex: number;
    isActive: boolean;
    isLooping: boolean;
    isRecording: boolean; // NEW
    hasAutomation: boolean;
    onTap: (barIndex: number) => void;
    onSwipeUp: (barIndex: number) => void;
    onSwipeDown: (barIndex: number) => void;
}

const BarPad: React.FC<BarPadProps> = ({ barIndex, isActive, isLooping, isRecording, hasAutomation, onTap, onSwipeUp, onSwipeDown }) => {
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

    // --- Color Logic ---
    let baseClass = 'bg-white text-slate-500 border-2 border-slate-200'; // Default White
    
    if (hasAutomation) {
        baseClass = 'bg-sky-500 text-white border-2 border-sky-600 shadow-sm'; // Recorded Blue
    }
    
    if (isRecording) {
        baseClass = 'bg-rose-500 text-white border-2 border-rose-600 shadow-md animate-pulse'; // Recording Red
    }

    // Active State (Playhead)
    if (isActive) {
        // Boost brightness/visual weight to indicate playhead
        if (isRecording) {
             baseClass = 'bg-rose-600 text-white border-2 border-white ring-2 ring-rose-300';
        } else if (hasAutomation) {
             baseClass = 'bg-sky-400 text-white border-2 border-white ring-2 ring-sky-300';
        } else {
             baseClass = 'bg-emerald-100 text-emerald-800 border-2 border-emerald-400'; // Active but empty
        }
    }

    // Looping State (Override or overlay)
    let loopClass = '';
    if (isLooping) {
        loopClass = 'ring-4 ring-pink-500 ring-offset-1';
    }

    return (
        <button
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            className={`py-3 font-bold rounded-md transition-all duration-100 text-sm touch-none select-none relative
                ${baseClass} ${loopClass} ${isActive ? 'z-10 scale-105' : ''}`}
        >
            {barIndex + 1}
        </button>
    );
};

export default BarPad;