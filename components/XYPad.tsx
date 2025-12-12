import React, { useRef, useState, useEffect } from 'react';

interface XYPadProps {
    x: number; // 0-1
    y: number; // 0-1
    xLabel?: string;
    yLabel?: string;
    onChange: (x: number, y: number) => void;
    color?: string;
}

const XYPad: React.FC<XYPadProps> = ({ x, y, xLabel, yLabel, onChange, color = 'bg-sky-400' }) => {
    const padRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleInteraction = (clientX: number, clientY: number) => {
        if (!padRef.current) return;
        const rect = padRef.current.getBoundingClientRect();
        
        // Calculate raw position relative to element
        let newX = (clientX - rect.left) / rect.width;
        let newY = 1 - ((clientY - rect.top) / rect.height); // Y is usually inverted in audio UIs (bottom=0)

        // Clamp values
        newX = Math.max(0, Math.min(1, newX));
        newY = Math.max(0, Math.min(1, newY));

        onChange(newX, newY);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        handleInteraction(e.clientX, e.clientY);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        e.preventDefault(); // Prevent scroll
        setIsDragging(true);
        handleInteraction(e.touches[0].clientX, e.touches[0].clientY);
    };

    useEffect(() => {
        const handleMove = (e: MouseEvent | TouchEvent) => {
            if (!isDragging) return;
            
            let clientX, clientY;
            if (window.TouchEvent && e instanceof TouchEvent) {
                e.preventDefault(); // Prevent scrolling while dragging
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = (e as MouseEvent).clientX;
                clientY = (e as MouseEvent).clientY;
            }
            handleInteraction(clientX, clientY);
        };

        const handleUp = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('touchmove', handleMove, { passive: false });
            window.addEventListener('mouseup', handleUp);
            window.addEventListener('touchend', handleUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchend', handleUp);
        };
    }, [isDragging]);

    return (
        <div className="relative w-full h-full min-h-[140px] bg-slate-800 rounded-lg overflow-hidden touch-none border border-slate-700 shadow-inner" ref={padRef}
             onMouseDown={handleMouseDown}
             onTouchStart={handleTouchStart}
        >
            {/* Grid lines */}
            <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 pointer-events-none opacity-20">
                {Array.from({ length: 16 }).map((_, i) => (
                    <div key={i} className="border border-slate-500/30"></div>
                ))}
            </div>

            {/* Labels */}
            {xLabel && <div className="absolute bottom-1 right-2 text-[10px] font-bold text-slate-400 select-none pointer-events-none">{xLabel} →</div>}
            {yLabel && <div className="absolute top-1 left-2 text-[10px] font-bold text-slate-400 select-none pointer-events-none">↑ {yLabel}</div>}

            {/* Puck */}
            <div 
                className={`absolute w-6 h-6 rounded-full border-2 border-white shadow-lg transform -translate-x-1/2 translate-y-1/2 pointer-events-none ${color} ${isDragging ? 'scale-110 brightness-110' : ''} transition-transform duration-75`}
                style={{ 
                    left: `${x * 100}%`, 
                    bottom: `${y * 100}%` 
                }}
            />
            
            {/* Crosshairs (visible on drag) */}
            {isDragging && (
                <>
                    <div className="absolute h-full w-px bg-white/30 pointer-events-none" style={{ left: `${x * 100}%` }} />
                    <div className="absolute w-full h-px bg-white/30 pointer-events-none" style={{ bottom: `${y * 100}%` }} />
                </>
            )}
        </div>
    );
};

export default React.memo(XYPad);