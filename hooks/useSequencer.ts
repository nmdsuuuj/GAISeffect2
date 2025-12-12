
import { useContext, useEffect, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { ActionType, PlaybackParams, Sample, Step, Synth } from '../types';
import { STEPS_PER_PART, GROOVE_PATTERNS, TOTAL_BANKS, PADS_PER_BANK } from '../constants';
import SCALES from '../scales';

interface TrackState {
    nextStepTime: number;
    partStep: number;
    currentPart: 'A' | 'B';
    partRepetition: number;
    totalStepsElapsed: number; // For bar-based LFO retriggering
}

// --- Helper function for scale remapping ---
const remapDetuneToScale = (originalDetune: number, targetScaleName: string, targetKey: number): number => {
    const scale = SCALES.find(s => s.name === targetScaleName);
    if (!scale || scale.intervals.length === 0) return originalDetune;

    // 1. Calculate the absolute cent values for the target scale notes
    const targetScaleCents: number[] = [];
    let cumulativeCents = targetKey * 100;
    for (const interval of scale.intervals) {
        targetScaleCents.push(cumulativeCents);
        cumulativeCents += interval;
    }
    // Add notes across a few octaves for better matching
    const octaveCents = 1200;
    const extendedTargetCents = [
        ...targetScaleCents.map(c => c - octaveCents),
        ...targetScaleCents,
        ...targetScaleCents.map(c => c + octaveCents),
        ...targetScaleCents.map(c => c + (2 * octaveCents)),
    ];

    // 2. Find the closest note in the target scale
    let closestNote = extendedTargetCents[0];
    let smallestDifference = Infinity;

    for (const targetNote of extendedTargetCents) {
        const difference = Math.abs(originalDetune - targetNote);
        if (difference < smallestDifference) {
            smallestDifference = difference;
            closestNote = targetNote;
        }
    }

    return closestNote;
};
// --- End Helper ---


export const useSequencer = (
    playSample: (sampleId: number, time: number, params: Partial<PlaybackParams>) => void,
    playSynthNote: (detune: number, time: number, params?: Partial<Pick<Synth, 'modWheel'>>) => void,
    scheduleLfoRetrigger: (lfoIndex: number, time: number) => void
) => {
    const { state, dispatch } = useContext(AppContext);
    const { isPlaying, audioContext, projectLoadCount } = state;

    const sequencerStateRef = useRef({ ...state });
    useEffect(() => {
        sequencerStateRef.current = state;
    }, [state]);

    const trackStates = useRef<TrackState[]>([]);
    
    const timerRef = useRef<number | null>(null);
    const lookahead = 25.0; // ms
    const scheduleAheadTime = 0.1; // sec

    const resetSequence = () => {
        trackStates.current = Array.from({ length: TOTAL_BANKS }, (_, i) => ({
            nextStepTime: 0,
            partStep: 0,
            currentPart: 'A',
            partRepetition: 0,
            totalStepsElapsed: 0,
        }));
        // The reducer handles resetting currentSteps now when isPlaying becomes false
    };
    
    // Initialize track states
    useEffect(() => {
        resetSequence();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    useEffect(() => {
        if (!isPlaying || !audioContext) {
            if (timerRef.current) {
                window.clearInterval(timerRef.current);
                timerRef.current = null;
            }
            resetSequence();
            return;
        }

        const now = audioContext.currentTime;
        trackStates.current.forEach((track, i) => {
            track.nextStepTime = now;
            track.partStep = 0;
            track.currentPart = 'A';
            track.partRepetition = 0;
            track.totalStepsElapsed = 0;
        });

        const scheduler = () => {
            // Use the ref to get the most up-to-date state inside the interval.
            const { patterns, activePatternIds, grooveDepths, activeGrooveIds, bpm, activeSampleBank, samples, synth, isModWheelLockMuted } = sequencerStateRef.current;
            if(!audioContext) return;

            while (true) {
                let earliestTime = Infinity;
                let nextTrackIndex = -1;

                for (let i = 0; i < TOTAL_BANKS; i++) {
                    if (trackStates.current[i].nextStepTime < earliestTime) {
                        earliestTime = trackStates.current[i].nextStepTime;
                        nextTrackIndex = i;
                    }
                }
                
                if (earliestTime > audioContext.currentTime + scheduleAheadTime) {
                    break;
                }
                
                const trackState = trackStates.current[nextTrackIndex];
                const patternId = activePatternIds[nextTrackIndex];
                const pattern = patterns[patternId];
                if (!pattern) continue;

                const isPartA = trackState.currentPart === 'A';
                const displayStep = isPartA ? trackState.partStep : trackState.partStep + STEPS_PER_PART;

                const firstSampleInBank = nextTrackIndex * PADS_PER_BANK;
                const lastSampleInBank = firstSampleInBank + PADS_PER_BANK;

                const stepResolution = isPartA ? pattern.stepResolutionA : pattern.stepResolutionB;
                const stepDurationForGroove = 60.0 / bpm / (stepResolution / 4);
                
                // Use the "live" global groove state, which is loaded from the pattern by the reducer.
                const grooveId = activeGrooveIds[nextTrackIndex];
                const grooveDepth = grooveDepths[nextTrackIndex];

                const groovePattern = GROOVE_PATTERNS[grooveId];
                const grooveOffsetIndex = displayStep % STEPS_PER_PART;
                const offsetFraction = groovePattern.offsets[grooveOffsetIndex] || 0;
                const timeShift = stepDurationForGroove * offsetFraction * grooveDepth;
                const scheduledTime = trackState.nextStepTime + timeShift;
                const isSynthBank = nextTrackIndex === 3;

                if (isSynthBank) {
                     // LFO Retriggering Logic
                    const stepsPerBar = stepResolution; // e.g., if res is 16, 16 steps = 1 bar.
                    if (stepsPerBar > 0 && trackState.totalStepsElapsed % stepsPerBar === 0) {
                        const currentBar = Math.floor(trackState.totalStepsElapsed / stepsPerBar);
                        [synth.lfo1, synth.lfo2].forEach((lfo, lfoIndex) => {
                            const trigger = lfo.syncTrigger; // e.g. "2 Bars"
                            if (trigger.endsWith('Bar') || trigger.endsWith('Bars')) {
                                const barCount = parseInt(trigger.split(' ')[0], 10);
                                if (!isNaN(barCount) && currentBar % barCount === 0) {
                                    scheduleLfoRetrigger(lfoIndex, scheduledTime);
                                }
                            }
                        });
                    }
                    
                    // Determine effective Mod Wheel Value
                    // Check if there is a P-Lock on this specific step.
                    // If no P-Lock, default to 1. This means the sequencer sends a "full" signal,
                    // which is then scaled by the Panel Depth Knob.
                    let effectiveModWheel = 1; 
                    let pLockFound = false;

                    for (let sampleId = firstSampleInBank; sampleId < lastSampleInBank; sampleId++) {
                        const modWheelLock = pattern.paramLocks[sampleId]?.modWheel?.[displayStep];
                        if (modWheelLock !== undefined && modWheelLock !== null) {
                            effectiveModWheel = modWheelLock;
                            pLockFound = true;
                            break; // Use the first found lock
                        }
                    }

                    // If P.L Mute is active, force Value to 1 (Panel Knob control only)
                    if (isModWheelLockMuted) {
                        effectiveModWheel = 1;
                    }

                    const activeNotes: { sampleId: number; stepInfo: Step }[] = [];
                    for (let sampleId = firstSampleInBank; sampleId < lastSampleInBank; sampleId++) {
                        const stepInfo = pattern.steps[sampleId]?.[displayStep];
                        if (stepInfo?.active) {
                            activeNotes.push({ sampleId, stepInfo });
                        }
                    }
                    
                    // Enforce strict monophony: only play the note on the lowest active pad number.
                    if (activeNotes.length > 0) {
                        // LFO Gate Retriggering
                        [synth.lfo1, synth.lfo2].forEach((lfo, lfoIndex) => {
                            if (lfo.syncTrigger === 'Gate') {
                                scheduleLfoRetrigger(lfoIndex, scheduledTime);
                            }
                        });

                        const noteToPlay = activeNotes.sort((a, b) => a.sampleId - b.sampleId)[0];
                        let finalDetune = noteToPlay.stepInfo.detune ?? 0;

                        // --- Non-destructive Playback Scale Logic ---
                        if (pattern.playbackScale && pattern.playbackScale !== 'Thru') {
                            finalDetune = remapDetuneToScale(finalDetune, pattern.playbackScale, pattern.playbackKey);
                        }
                        
                        const synthParams: Partial<Pick<Synth, 'modWheel'>> = {
                            modWheel: effectiveModWheel,
                        };

                        playSynthNote(finalDetune, scheduledTime, synthParams);
                    }
                } else {
                    for (let sampleId = firstSampleInBank; sampleId < lastSampleInBank; sampleId++) {
                        const stepInfo = pattern.steps[sampleId]?.[displayStep];
                        if (stepInfo?.active) {
                            const sample = samples[sampleId];
                            const paramLocks = pattern.paramLocks[sampleId];
                            
                            let finalDetune = stepInfo.detune ?? 0;

                            // --- Non-destructive Playback Scale Logic ---
                            if (pattern.playbackScale && pattern.playbackScale !== 'Thru') {
                                finalDetune = remapDetuneToScale(finalDetune, pattern.playbackScale, pattern.playbackKey);
                            }
                            // --- End Logic ---

                            const playbackParams: Partial<PlaybackParams> = {
                                detune: finalDetune,
                                velocity: stepInfo.velocity,
                                volume: paramLocks?.volume?.[displayStep] ?? sample.volume,
                                pitch: paramLocks?.pitch?.[displayStep] ?? sample.pitch,
                                start: paramLocks?.start?.[displayStep] ?? sample.start,
                                decay: paramLocks?.decay?.[displayStep] ?? sample.decay,
                                lpFreq: paramLocks?.lpFreq?.[displayStep] ?? sample.lpFreq,
                                hpFreq: paramLocks?.hpFreq?.[displayStep] ?? sample.hpFreq,
                            };
                            
                            playSample(sampleId, scheduledTime, playbackParams);
                        }
                    }
                }
                
                // Dispatch current step for every bank to enable multi-bank recording
                dispatch({ type: ActionType.SET_CURRENT_STEP, payload: { bankIndex: nextTrackIndex, step: displayStep } });

                if (nextTrackIndex === activeSampleBank) {
                    // This part is for the loop meter UI, which only needs the active bank's state.
                    dispatch({ 
                        type: ActionType.SET_PLAYBACK_TRACK_STATE, 
                        payload: { 
                            bankIndex: nextTrackIndex, 
                            state: { 
                                currentPart: trackState.currentPart, 
                                partRepetition: trackState.partRepetition 
                            } 
                        } 
                    });
                }

                const stepDuration = 60.0 / bpm / (stepResolution / 4);
                trackState.nextStepTime += stepDuration;
                trackState.partStep++;
                trackState.totalStepsElapsed++;

                const stepLength = isPartA ? pattern.stepLengthA : pattern.stepLengthB;
                if (trackState.partStep >= stepLength) {
                    trackState.partStep = 0;
                    trackState.partRepetition++;
                    
                    const loopCount = isPartA ? pattern.loopCountA : pattern.loopCountB;
                    if (trackState.partRepetition >= loopCount) {
                        trackState.currentPart = isPartA ? 'B' : 'A';
                        trackState.partRepetition = 0;
                    }
                }
            }
        };

        timerRef.current = window.setInterval(scheduler, lookahead);

        return () => {
            if (timerRef.current) {
                window.clearInterval(timerRef.current);
            }
        };

    }, [isPlaying, audioContext, dispatch, playSample, playSynthNote, scheduleLfoRetrigger, projectLoadCount]);
};
