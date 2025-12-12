
import React, { useState, useRef, useCallback, useEffect } from 'react';

interface ModulationNodeProps {
    value: number; // -1 to 1
    onChange: (value: number) => void;
    label: string;
}

const ModulationNode: React.FC<ModulationNodeProps> = ({ value, onChange, label }) => {
    const nodeRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef<{ y: number; value: number } | null>(null);
    const tapTimeout = useRef<number | null>(null);

    const handleInteractionStart = useCallback((clientY: number) => {
        setIsDragging(true);
        dragStartRef.current = { y: clientY, value: value };
    }, [value]);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        handleInteractionStart(e.clientY);
    };

    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        handleInteractionStart(e.touches[0].clientY);
    };

    const handleValueChange = useCallback((clientY: number) => {
        if (!isDragging || !nodeRef.current || !dragStartRef.current) return;
        
        const rect = nodeRef.current.getBoundingClientRect();
        const deltaY = dragStartRef.current.y - clientY;
        const sensitivity = 2; // Adjust for faster/slower response
        const change = (deltaY / rect.height) * sensitivity;
        
        const newValue = Math.max(-1, Math.min(1, dragStartRef.current.value + change));
        onChange(newValue);

    }, [isDragging, onChange]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        e.preventDefault();
        handleValueChange(e.clientY);
    }, [handleValueChange]);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        // Prevent default scroll behavior during drag
        e.preventDefault();
        handleValueChange(e.touches[0].clientY);
    }, [handleValueChange]);

    const handleInteractionEnd = useCallback(() => {
        setIsDragging(false);
        dragStartRef.current = null;
    }, []);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('touchmove', handleTouchMove, { passive: false });
            window.addEventListener('mouseup', handleInteractionEnd);
            window.addEventListener('touchend', handleInteractionEnd);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('mouseup', handleInteractionEnd);
            window.removeEventListener('touchend', handleInteractionEnd);
        };
    }, [isDragging, handleMouseMove, handleTouchMove, handleInteractionEnd]);

    const handleReset = useCallback(() => {
        onChange(0);
    }, [onChange]);
    
    const handleDoubleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        handleReset();
    };

    const handleSingleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
        if (dragStartRef.current && Math.abs(e.changedTouches[0].clientY - dragStartRef.current.y) > 5) {
            // It was a drag, not a tap, so don't trigger reset logic
            return;
        }

        if (tapTimeout.current) {
            // This is the second tap, so it's a double tap.
            clearTimeout(tapTimeout.current);
            tapTimeout.current = null;
            handleReset();
            e.preventDefault(); // Prevent zoom.
        } else {
            // This is the first tap. Set a timeout to wait for a potential second tap.
            tapTimeout.current = window.setTimeout(() => {
                tapTimeout.current = null; // Timeout expired, it was a single tap.
            }, 300);
        }
    };
    
    const barHeight = `${Math.abs(value) * 50}%`;
    const barColor = value > 0 ? 'bg-rose-400' : 'bg-sky-400';

    return (
        <div
            ref={nodeRef}
            className="w-full h-16 bg-emerald-100 rounded-sm cursor-ns-resize relative overflow-hidden touch-none flex flex-col items-center justify-center"
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onDoubleClick={handleDoubleClick}
            onTouchEnd={handleSingleTouchEnd}
        >
            <div
                className={`absolute w-full ${barColor} transition-colors duration-100`}
                style={{
                    height: barHeight,
                    ...(value > 0 ? { bottom: '50%' } : { top: '50%' }),
                }}
            />
            <div className="absolute inset-0 border border-emerald-200 rounded-sm" />
            
            {/* Overlay for Text */}
            <div className="relative z-10 flex flex-col items-center justify-center pointer-events-none text-slate-800 select-none drop-shadow">
                 <span className="text-[10px] font-bold leading-tight truncate">{label}</span>
                 <span className="text-xs font-mono leading-tight">{(value * 100).toFixed(0)}</span>
            </div>
        </div>
    );
};

export default React.memo(ModulationNode);
