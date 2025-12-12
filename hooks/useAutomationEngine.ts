import { useState, useEffect, useRef } from 'react';
import { AppState, Action, ActionType } from '../types';

export const useAutomationEngine = (state: AppState, dispatch: React.Dispatch<Action>) => {
    // State values for the clock output
    const [clock, setClock] = useState({ position: 0, bar: 0 });
    
    // Refs to hold necessary data for the animation loop without causing re-renders/re-runs
    const stateRef = useRef(state);
    const startTimeRef = useRef(0);
    const animationFrameRef = useRef<number | null>(null);

    // Keep the state ref up-to-date on every render
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    // This effect handles the jump logic.
    // It only runs when the specific `jumpToBar` value changes.
    useEffect(() => {
        const { performanceFx, isPlaying, audioContext, bpm } = stateRef.current;
        const jumpToBar = performanceFx.jumpToBar;

        if (jumpToBar !== null && isPlaying && audioContext) {
            const secondsPerBeat = 60.0 / bpm;
            const loopDurationSeconds = 32 * secondsPerBeat; // 8 bars * 4 beats/bar
            const jumpPosition = jumpToBar / 8.0;
            
            // This is the core of the jump: reset the start time relative to the jump position
            const newStartTime = audioContext.currentTime - (jumpPosition * loopDurationSeconds);
            startTimeRef.current = newStartTime;

            // Immediately reset the jump trigger in the state
            dispatch({ type: ActionType.CLEAR_FX_AUTOMATION_JUMP });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.performanceFx.jumpToBar, dispatch]); // Only depend on the trigger value and the stable dispatch


    // This is the main animation loop effect.
    // It should only restart when play is toggled or the audio context is created.
    useEffect(() => {
        const { isPlaying, audioContext } = state; // Destructure from the direct state prop for the dependency array

        if (!isPlaying || !audioContext) {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            setClock({ position: 0, bar: 0 }); // Reset clock UI when stopped
            return;
        }

        // Initialize start time when playback begins
        startTimeRef.current = audioContext.currentTime;

        const tick = () => {
            // Use the stateRef to get the LATEST state inside the animation frame loop
            const currentState = stateRef.current;
            
            // Double check playback status inside the loop
            if (!currentState.isPlaying || !currentState.audioContext) {
                if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
                return;
            }

            const secondsPerBeat = 60.0 / currentState.bpm;
            const loopDurationSeconds = 32 * secondsPerBeat; // 8 bars * 4 beats/bar
            const elapsedTime = currentState.audioContext.currentTime - startTimeRef.current;
            
            const position = (elapsedTime % loopDurationSeconds) / loopDurationSeconds; // 0-1
            const bar = Math.floor(position * 8);

            // Update the clock state for the UI
            setClock({ position, bar });

            // --- Automation Playback Logic ---
            currentState.performanceFx.slots.forEach((slot, slotIndex) => {
                slot.xyPads.forEach((pad, padIndex) => {
                    const { automation } = pad;
                    
                    let playbackPosition = position; // Use global clock by default

                    // Handle single-bar looping
                    if (automation.loopBar !== null) {
                        const barDurationSeconds = loopDurationSeconds / 8;
                        // Use a separate elapsed time for the loop to avoid interfering with the main clock
                        const loopElapsedTime = currentState.audioContext.currentTime - startTimeRef.current;
                        const elapsedTimeInLoop = loopElapsedTime % barDurationSeconds;
                        const positionInBar = elapsedTimeInLoop / barDurationSeconds; // 0-1 within the bar
                        playbackPosition = (automation.loopBar / 8.0) + (positionInBar / 8.0);
                    }

                    // Only run playback logic if not recording and data exists
                    if (!automation.recording && automation.data.length > 0) {
                        const data = automation.data;
                        
                        let x: number, y: number;

                        if (data.length === 1) {
                            x = data[0].x;
                            y = data[0].y;
                        } else {
                            // Find surrounding points for interpolation
                            let prevPointIndex = -1;
                            for (let i = data.length - 1; i >= 0; i--) {
                                if (data[i].position <= playbackPosition) {
                                    prevPointIndex = i;
                                    break;
                                }
                            }

                            let prevPoint, nextPoint;
                            if (prevPointIndex === -1) {
                                // Wrap around from the end to the start
                                prevPoint = data[data.length - 1];
                                nextPoint = data[0];
                            } else {
                                prevPoint = data[prevPointIndex];
                                nextPoint = data[(prevPointIndex + 1) % data.length];
                            }

                            let segmentDuration = nextPoint.position - prevPoint.position;
                            if (segmentDuration < 0) segmentDuration += 1; // Handle wrap-around

                            let positionInSegment = 0;
                            if (segmentDuration > 1e-6) {
                                let timeFromPrev = playbackPosition - prevPoint.position;
                                if (timeFromPrev < 0) timeFromPrev += 1; // Handle wrap-around
                                positionInSegment = timeFromPrev / segmentDuration;
                            }

                            // Linear interpolation
                            x = prevPoint.x + (nextPoint.x - prevPoint.x) * positionInSegment;
                            y = prevPoint.y + (nextPoint.y - prevPoint.y) * positionInSegment;
                        }

                        // Dispatch update only if there's a change to avoid unnecessary re-renders
                        if (Math.abs(pad.x - x) > 0.001 || Math.abs(pad.y - y) > 0.001) {
                           dispatch({
                                type: ActionType.UPDATE_FX_XY,
                                payload: { slotIndex, padIndex, x, y }
                            });
                        }
                    }
                });
            });

            // Schedule the next frame
            animationFrameRef.current = requestAnimationFrame(tick);
        };

        // Start the loop
        animationFrameRef.current = requestAnimationFrame(tick);

        // Cleanup function
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };
    // The main loop should ONLY restart if play is toggled or the audio context is lost/created.
    // All other dynamic values (bpm, performanceFx) are accessed via the stateRef inside the loop.
    // FIX: Corrected dependency array to reference properties from the `state` object, resolving reference errors.
    }, [state.isPlaying, state.audioContext, dispatch]);

    return clock;
};
