
// FIX: Import React to provide the React namespace for types like React.Dispatch.
import React, { useEffect, useRef, useState } from 'react';
import { AppState, Action, ActionType, AutomationClock } from '../types';

export const useAutomationEngine = (state: AppState, dispatch: React.Dispatch<Action>): AutomationClock => {
    const { isPlaying, bpm, audioContext, performanceFx } = state;
    const [clock, setClock] = useState<AutomationClock>({ position: 0, bar: 0 });
    
    const stateRef = useRef(state);
    useEffect(() => { stateRef.current = state; }, [state]);
    
    const startTimeRef = useRef<number>(0);
    const requestRef = useRef<number | null>(null);

    // Reset start time when play starts
    useEffect(() => {
        if (isPlaying && audioContext) {
            startTimeRef.current = audioContext.currentTime;
        }
    }, [isPlaying, audioContext]);
    
    // Jump Logic
    useEffect(() => {
        const { performanceFx, isPlaying, audioContext, bpm } = stateRef.current;
        const jumpToBarInfo = performanceFx.jumpToBar;

        if (jumpToBarInfo !== null && isPlaying && audioContext) {
                const secondsPerBeat = 60.0 / bpm;
                const loopDurationSeconds = 32 * secondsPerBeat; // 8 bars * 4 beats/bar
                const jumpPosition = jumpToBarInfo.barIndex / 8.0; 
                
                const newStartTime = audioContext.currentTime - (jumpPosition * loopDurationSeconds);
                startTimeRef.current = newStartTime;
                
                dispatch({ type: ActionType.CLEAR_FX_AUTOMATION_JUMP });
        }
            
    }, [state.performanceFx.jumpToBar, dispatch]);


    useEffect(() => {
        if (!isPlaying || !audioContext) {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            return;
        }

        const animate = () => {
            const { bpm, performanceFx } = stateRef.current;
            const now = audioContext.currentTime;
            const secondsPerBeat = 60.0 / bpm;
            const loopDuration = 32 * secondsPerBeat; 

            let elapsed = now - startTimeRef.current;
            
            // Looping
            if (elapsed >= loopDuration) {
                const loops = Math.floor(elapsed / loopDuration);
                startTimeRef.current += loops * loopDuration;
                elapsed = elapsed % loopDuration;
            }
            
            const position = elapsed / loopDuration; // 0 to 1
            const currentBar = Math.floor(position * 8);

            setClock({ position, bar: currentBar });
            
            // Automation Playback
            performanceFx.slots.forEach((slot, slotIndex) => {
                slot.xyPads.forEach((pad, padIndex) => {
                    const automation = pad.automation;
                    
                    // Recording
                    if (automation.recording) {
                        const point = { position, x: pad.x, y: pad.y };
                        dispatch({ 
                            type: ActionType.RECORD_FX_AUTOMATION_POINT, 
                            payload: { slotIndex, padIndex, point } 
                        });
                    } 
                    // Playback
                    else if (automation.data.length > 0) {
                        let playbackPos = position;
                        
                        // Bar Loop Override
                        if (automation.loopBar !== null) {
                            const barDuration = 1/8;
                            const barStart = automation.loopBar * barDuration;
                            const offset = position % barDuration;
                            playbackPos = barStart + offset;
                        }

                        // Find closest previous point (Sample and Hold)
                        let val = automation.data[0];
                        for (let i = 0; i < automation.data.length; i++) {
                            if (automation.data[i].position <= playbackPos) {
                                val = automation.data[i];
                            } else {
                                break;
                            }
                        }
                        // Wrap around fallback
                        if (val.position > playbackPos) {
                            val = automation.data[automation.data.length - 1];
                        }
                        
                        if (val) {
                            // Only dispatch if changed significantly
                            if (Math.abs(val.x - pad.x) > 0.001 || Math.abs(val.y - pad.y) > 0.001) {
                                dispatch({
                                    type: ActionType.UPDATE_FX_XY,
                                    payload: { slotIndex, padIndex, x: val.x, y: val.y }
                                });
                            }
                        }
                    }
                });
            });

            requestRef.current = requestAnimationFrame(animate);
        };

        requestRef.current = requestAnimationFrame(animate);

        return () => {
                if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isPlaying, audioContext, dispatch]);

    return clock;
};
