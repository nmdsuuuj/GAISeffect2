import { useRef, useCallback } from 'react';

const MAX_TAPS = 4; // Number of taps to average for calculation
const TIMEOUT_MS = 2000; // Reset after 2 seconds of inactivity

/**
 * A custom hook to handle BPM calculation from tap events.
 * @param onBpmCalculated - A callback function that is invoked with the new BPM value.
 * @returns An object containing the handleTap function.
 */
export const useBpmTap = (onBpmCalculated: (bpm: number) => void) => {
    const taps = useRef<number[]>([]);

    const handleTap = useCallback(() => {
        const now = performance.now();

        // If the last tap was too long ago, reset the taps array
        if (taps.current.length > 0 && now - taps.current[taps.current.length - 1] > TIMEOUT_MS) {
            taps.current = [];
        }

        taps.current.push(now);

        // Keep the array at a maximum size
        if (taps.current.length > MAX_TAPS) {
            taps.current.shift();
        }

        // Calculate BPM if we have at least 2 taps
        if (taps.current.length >= 2) {
            const intervals = [];
            for (let i = 1; i < taps.current.length; i++) {
                intervals.push(taps.current[i] - taps.current[i - 1]);
            }

            const averageInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            
            if (averageInterval > 0) {
                const bpm = 60000 / averageInterval;
                // Filter out extreme values
                if (bpm >= 40 && bpm <= 280) {
                    onBpmCalculated(bpm);
                }
            }
        }
    }, [onBpmCalculated]);

    return { handleTap };
};
