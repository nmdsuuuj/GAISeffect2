import { useState, useEffect, useRef } from 'react';
import { AppState, Action, ActionType } from '../types';

export const useAutomationEngine = (state: AppState, dispatch: React.Dispatch<Action>) => {
    const { isPlaying, bpm, audioContext, performanceFx } = state;
    const [clock, setClock] = useState({ position: 0, bar: 0 });
    const startTimeRef = useRef(0);
    const animationFrameRef = useRef<number | null>(null);

    useEffect(() => {
        if (!isPlaying || !audioContext) {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            setClock({ position: 0, bar: 0 }); // Reset clock when stopped
            return;
        }

        startTimeRef.current = audioContext.currentTime;

        const tick = () => {
            if (!state.isPlaying || !state.audioContext) { // Double check inside the loop
                if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
                return;
            }

            const secondsPerBeat = 60.0 / state.bpm;
            const loopDurationSeconds = 32 * secondsPerBeat; // 8 bars * 4 beats/bar
            const elapsedTime = state.audioContext.currentTime - startTimeRef.current;
            const position = (elapsedTime % loopDurationSeconds) / loopDurationSeconds; // 0-1
            const bar = Math.floor(position * 8);

            setClock({ position, bar });

            // --- Automation Playback Logic ---
            performanceFx.slots.forEach((slot, slotIndex) => {
                slot.xyPads.forEach((pad, padIndex) => {
                    const { automation } = pad;
                    if (!automation.recording && automation.data.length > 1) {
                        const data = automation.data; // Assumes sorted by position

                        let prevPointIndex = -1;
                        for (let i = data.length - 1; i >= 0; i--) {
                            if (data[i].position <= position) {
                                prevPointIndex = i;
                                break;
                            }
                        }

                        let prevPoint, nextPoint;
                        if (prevPointIndex === -1) {
                            // Position is before the first point, wrap around
                            prevPoint = data[data.length - 1];
                            nextPoint = data[0];
                        } else {
                            prevPoint = data[prevPointIndex];
                            // Wrap around to the first point if we are at the last point
                            nextPoint = data[(prevPointIndex + 1) % data.length];
                        }

                        // Interpolate
                        let segmentDuration = nextPoint.position - prevPoint.position;
                        if (segmentDuration < 0) { // Wrapped around
                            segmentDuration += 1;
                        }

                        let positionInSegment = 0;
                        if (segmentDuration > 1e-6) { // Avoid division by zero
                            let timeFromPrev = position - prevPoint.position;
                            if (timeFromPrev < 0) { // Wrapped around
                                timeFromPrev += 1;
                            }
                            positionInSegment = timeFromPrev / segmentDuration;
                        }

                        const x = prevPoint.x + (nextPoint.x - prevPoint.x) * positionInSegment;
                        const y = prevPoint.y + (nextPoint.y - prevPoint.y) * positionInSegment;
                        
                        // Only dispatch if the value is actually different to avoid flooding the reducer
                        if (Math.abs(pad.x - x) > 0.001 || Math.abs(pad.y - y) > 0.001) {
                           dispatch({
                                type: ActionType.UPDATE_FX_XY,
                                payload: { slotIndex, padIndex, x, y }
                            });
                        }
                    } else if (!automation.recording && automation.data.length === 1) {
                        // If only one point, hold it
                        const { x, y } = automation.data[0];
                        if (Math.abs(pad.x - x) > 0.001 || Math.abs(pad.y - y) > 0.001) {
                            dispatch({ type: ActionType.UPDATE_FX_XY, payload: { slotIndex, padIndex, x, y } });
                        }
                    }
                });
            });


            animationFrameRef.current = requestAnimationFrame(tick);
        };

        animationFrameRef.current = requestAnimationFrame(tick);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isPlaying, audioContext, bpm, performanceFx, dispatch, state.isPlaying, state.bpm, state.audioContext]);

    return clock;
};
