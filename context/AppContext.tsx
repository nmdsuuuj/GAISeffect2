
import React, { createContext, useReducer } from 'react';
import { AppState, Action, ActionType, Pattern, Step, Sample, Synth, ModMatrix, PerformanceChain, MasterCompressorParams, CompressorSnapshot, LockableParam } from '../types';
import { TOTAL_BANKS, PADS_PER_BANK, STEPS_PER_PATTERN, TOTAL_PATTERNS, TOTAL_SAMPLES, DEFAULT_PERFORMANCE_FX, OSC_WAVEFORMS, MOD_SOURCES, MOD_DESTINATIONS, PATTERNS_PER_BANK } from '../constants';
import SCALES from '../scales';

// --- Initial State Helpers ---

const createEmptySteps = (): Step[] => Array.from({ length: STEPS_PER_PATTERN }, () => ({ active: false, velocity: 1 }));

const createEmptyPattern = (id: number): Pattern => ({
    id,
    steps: Array.from({ length: TOTAL_SAMPLES }, () => createEmptySteps()),
    stepResolutionA: 16, stepResolutionB: 16,
    stepLengthA: 16, stepLengthB: 16,
    loopCountA: 1, loopCountB: 1,
    paramLocks: {},
    playbackKey: 0,
    playbackScale: 'Thru',
    grooveIds: Array(TOTAL_BANKS).fill(0),
    grooveDepths: Array(TOTAL_BANKS).fill(0),
});

const createDefaultSample = (id: number): Sample => ({
    id,
    name: `Sample ${id + 1}`,
    buffer: null,
    volume: 1, pitch: 0, start: 0, end: 1, decay: 1, loop: false, playbackMode: 'Forward',
    lpFreq: 20000, hpFreq: 20,
});

const DEFAULT_SYNTH: Synth = {
    osc1: { type: 'Saw Down', octave: 0, detune: 0, waveshapeType: 'Soft Clip', waveshapeAmount: 0, fmDepth: 0 },
    osc2: { type: 'Square', octave: -1, detune: 7, waveshapeType: 'Soft Clip', waveshapeAmount: 0, fmDepth: 0 },
    oscMix: 0.5,
    filter: { type: 'Lowpass 24dB', cutoff: 20000, resonance: 1, envAmount: 0 },
    filterEnv: { attack: 0.01, decay: 0.2, sustain: 0.5 },
    ampEnv: { decay: 0.5 },
    lfo1: { type: 'Sine', rate: 5, rateMode: 'hz', syncTrigger: 'Free' },
    lfo2: { type: 'Sine', rate: 0.5, rateMode: 'hz', syncTrigger: 'Free' },
    masterGain: 1,
    masterOctave: 0,
    modWheel: 0,
    modWheelOffset: 1,
};

const DEFAULT_COMPRESSOR: MasterCompressorParams = {
    threshold: -24, ratio: 12, knee: 30, attack: 0.003, release: 0.25
};

const INITIAL_STATE: AppState = {
    toastMessage: null,
    isInitialized: false,
    isLoading: false,
    activeView: 'OTO',
    seqMode: 'PART',
    isPlaying: false,
    isRecording: false,
    isArmed: false,
    recordingThreshold: 0.02,
    bpm: 120,
    activeSampleBank: 0,
    activeSampleId: 0,
    selectedSeqStep: null,
    samples: Array.from({ length: TOTAL_SAMPLES }, (_, i) => createDefaultSample(i)),
    sampleClipboard: null,
    laneClipboard: null,
    bankClipboard: null,
    patternClipboard: null,
    patterns: Array.from({ length: TOTAL_PATTERNS }, (_, i) => createEmptyPattern(i)),
    activePatternIds: Array.from({ length: TOTAL_BANKS }, (_, i) => i * 32),
    activeKey: 0,
    activeScale: 'Chromatic',
    keyboardOctave: 4,
    currentSteps: Array(TOTAL_BANKS).fill(-1),
    activeSequencerStep: 0,
    playbackTrackStates: Array(TOTAL_BANKS).fill({ currentPart: 'A', partRepetition: 0 }),
    grooveDepths: Array(TOTAL_BANKS).fill(0),
    activeGrooveIds: Array(TOTAL_BANKS).fill(0),
    synth: DEFAULT_SYNTH,
    synthModMatrix: {},
    synthPresets: Array(128).fill(null),
    isModMatrixMuted: false,
    isModWheelLockMuted: false,
    bankVolumes: Array(TOTAL_BANKS).fill(1),
    bankPans: Array(TOTAL_BANKS).fill(0),
    bankMutes: Array(TOTAL_BANKS).fill(false),
    bankSolos: Array(TOTAL_BANKS).fill(false),
    masterVolume: 1,
    masterCompressorOn: true,
    masterCompressorParams: DEFAULT_COMPRESSOR,
    compressorSnapshots: Array(16).fill(null),
    isMasterRecording: false,
    isMasterRecArmed: false,
    performanceFx: DEFAULT_PERFORMANCE_FX,
    audioContext: null,
    projectLoadCount: 0,
};

// --- Immutable update helper for patterns ---
const updatePatternImmutably = (
    patterns: Pattern[],
    patternId: number,
    updateFn: (pattern: Pattern) => Pattern
): Pattern[] => {
    return patterns.map((p, i) => (i === patternId ? updateFn(p) : p));
};


const reducer = (state: AppState, action: Action): AppState => {
    switch (action.type) {
        case ActionType.INITIALIZE_AUDIO:
            return { ...state, isInitialized: true, audioContext: action.payload };
        
        case ActionType.SET_SELECTED_SEQ_STEP:
            return { ...state, selectedSeqStep: action.payload };
            
        case ActionType.HIDE_TOAST:
            return { ...state, toastMessage: null };
            
        case ActionType.SHOW_TOAST:
            return { ...state, toastMessage: action.payload };

        case ActionType.RECORD_STEP: {
            const { patternId, sampleId, step, detune } = action.payload;
            return {
                ...state,
                patterns: updatePatternImmutably(state.patterns, patternId, p => ({
                    ...p,
                    steps: p.steps.map((lane, i) => {
                        if (i === sampleId) {
                            const newLane = [...lane];
                            newLane[step] = { active: true, velocity: 1, detune };
                            return newLane;
                        }
                        return lane;
                    })
                }))
            };
        }
        
        case ActionType.COPY_SAMPLE:
            return { ...state, sampleClipboard: state.samples[state.activeSampleId] };

        case ActionType.PASTE_SAMPLE: {
            if (!state.sampleClipboard) return state;
            const newSamples = [...state.samples];
            newSamples[state.activeSampleId] = {
                ...state.sampleClipboard,
                id: state.activeSampleId, // Keep original ID
                name: state.sampleClipboard.name,
            };
            return { ...state, samples: newSamples, toastMessage: 'Sample pasted' };
        }

        case ActionType.SET_KEYBOARD_OCTAVE:
            return { ...state, keyboardOctave: action.payload };
        
        case ActionType.SET_KEY:
            return { ...state, activeKey: action.payload };

        case ActionType.SET_SCALE:
            return { ...state, activeScale: action.payload };

        case ActionType.SET_ACTIVE_SAMPLE_BANK:
            return { ...state, activeSampleBank: action.payload, activeSampleId: action.payload * PADS_PER_BANK };

        case ActionType.SET_ACTIVE_SAMPLE:
            return { ...state, activeSampleId: action.payload };
        
        case ActionType.SET_SEQ_MODE:
            return { ...state, seqMode: action.payload };

        case ActionType.TOGGLE_STEP: {
            const { patternId, sampleId, step } = action.payload;
            return {
                ...state,
                patterns: updatePatternImmutably(state.patterns, patternId, p => ({
                    ...p,
                    steps: p.steps.map((lane, i) => {
                        if (i === sampleId) {
                            const newLane = [...lane];
                            newLane[step] = { ...newLane[step], active: !newLane[step].active };
                            return newLane;
                        }
                        return lane;
                    })
                }))
            };
        }

        case ActionType.SET_ACTIVE_PATTERN_FOR_BANK: {
            const { bankIndex, patternId } = action.payload;
            const newIds = [...state.activePatternIds];
            newIds[bankIndex] = patternId;
            return { ...state, activePatternIds: newIds };
        }

        case ActionType.UPDATE_PATTERN_PARAMS: {
            const { patternId, params } = action.payload;
            return {
                ...state,
                patterns: updatePatternImmutably(state.patterns, patternId, p => ({ ...p, ...params }))
            };
        }
        
        case ActionType.UPDATE_PARAM_LOCK: {
            const { patternId, sampleId, param, step, value } = action.payload;
            return {
                ...state,
                patterns: updatePatternImmutably(state.patterns, patternId, p => ({
                    ...p,
                    paramLocks: {
                        ...p.paramLocks,
                        [sampleId]: {
                            ...p.paramLocks[sampleId],
                            [param]: {
                                ...(p.paramLocks[sampleId]?.[param as LockableParam]),
                                [step]: value
                            }
                        }
                    }
                }))
            };
        }
        
        case ActionType.SET_BPM:
            return { ...state, bpm: action.payload };

        case ActionType.TOGGLE_PLAY:
            return { ...state, isPlaying: !state.isPlaying };
            
        case ActionType.SET_CURRENT_STEP: {
             const { bankIndex, step } = action.payload;
             const newSteps = [...state.currentSteps];
             newSteps[bankIndex] = step;
             const activeSeqStep = bankIndex === state.activeSampleBank ? step : state.activeSequencerStep;
             return { ...state, currentSteps: newSteps, activeSequencerStep: activeSeqStep };
        }
        
        case ActionType.SET_PLAYBACK_TRACK_STATE: {
            const { bankIndex, state: trackState } = action.payload;
            const newStates = [...state.playbackTrackStates];
            newStates[bankIndex] = trackState;
            return { ...state, playbackTrackStates: newStates };
        }

        case ActionType.UPDATE_SAMPLE_PARAM: {
            const { sampleId, param, value } = action.payload;
            const newSamples = [...state.samples];
            newSamples[sampleId] = { ...newSamples[sampleId], [param]: value };
            return { ...state, samples: newSamples };
        }
        
        case ActionType.SET_RECORDING_THRESHOLD:
            return { ...state, recordingThreshold: action.payload };

        case ActionType.SET_GROOVE_DEPTH: {
            const { bankIndex, value } = action.payload;
            const newDepths = [...state.grooveDepths];
            newDepths[bankIndex] = value;
            const patternId = state.activePatternIds[bankIndex];
            const newPatterns = updatePatternImmutably(state.patterns, patternId, p => {
                const newGrooveDepths = [...p.grooveDepths];
                newGrooveDepths[bankIndex] = value;
                return { ...p, grooveDepths: newGrooveDepths };
            });
            return { ...state, grooveDepths: newDepths, patterns: newPatterns };
        }

        case ActionType.SET_ACTIVE_GROOVE: {
             const { bankIndex, grooveId } = action.payload;
             const newIds = [...state.activeGrooveIds];
             newIds[bankIndex] = grooveId;
             const patternId = state.activePatternIds[bankIndex];
             const newPatterns = updatePatternImmutably(state.patterns, patternId, p => {
                const newGrooveIds = [...p.grooveIds];
                newGrooveIds[bankIndex] = grooveId;
                return { ...p, grooveIds: newGrooveIds };
             });
             return { ...state, activeGrooveIds: newIds, patterns: newPatterns };
        }

        case ActionType.SET_BANK_VOLUME: {
            const newVols = [...state.bankVolumes];
            newVols[action.payload.bankIndex] = action.payload.volume;
            return { ...state, bankVolumes: newVols };
        }
        
        case ActionType.SET_BANK_PAN: {
            const newPans = [...state.bankPans];
            newPans[action.payload.bankIndex] = action.payload.pan;
            return { ...state, bankPans: newPans };
        }

        case ActionType.TOGGLE_BANK_MUTE: {
            const newMutes = [...state.bankMutes];
            newMutes[action.payload.bankIndex] = !newMutes[action.payload.bankIndex];
            return { ...state, bankMutes: newMutes };
        }
        
        case ActionType.TOGGLE_BANK_SOLO: {
            const newSolos = [...state.bankSolos];
            newSolos[action.payload.bankIndex] = !newSolos[action.payload.bankIndex];
            return { ...state, bankSolos: newSolos };
        }

        case ActionType.SET_MASTER_VOLUME:
            return { ...state, masterVolume: action.payload };
        
        case ActionType.TOGGLE_MASTER_REC_ARMED:
            return { ...state, isMasterRecArmed: !state.isMasterRecArmed };

        case ActionType.TOGGLE_MASTER_RECORDING:
            return { ...state, isMasterRecording: !state.isMasterRecording, isMasterRecArmed: false };

        case ActionType.TOGGLE_MASTER_COMPRESSOR:
            return { ...state, masterCompressorOn: !state.masterCompressorOn };

        case ActionType.UPDATE_MASTER_COMPRESSOR_PARAM:
            return { ...state, masterCompressorParams: { ...state.masterCompressorParams, [action.payload.param]: action.payload.value } };

        case ActionType.SET_FX_TYPE: {
             const { slotIndex, type } = action.payload;
             // Immutably update the slot array
             const newSlots = state.performanceFx.slots.map((slot, i) => 
                 i === slotIndex ? { ...slot, type, isOn: true } : slot
             );
             return { ...state, performanceFx: { ...state.performanceFx, slots: newSlots } };
        }
        
        case ActionType.TOGGLE_FX_BYPASS: {
             const slotIndex = action.payload;
             // Immutably update the slot array
             const newSlots = state.performanceFx.slots.map((slot, i) => 
                 i === slotIndex ? { ...slot, isOn: !slot.isOn } : slot
             );
             return { ...state, performanceFx: { ...state.performanceFx, slots: newSlots } };
        }

        case ActionType.UPDATE_FX_PARAM: {
            const { slotIndex, param, value } = action.payload;
            // Immutably update slot params
            const newSlots = state.performanceFx.slots.map((slot, i) => 
                i === slotIndex ? { ...slot, params: { ...slot.params, [param]: value } } : slot
            );
            return { ...state, performanceFx: { ...state.performanceFx, slots: newSlots } };
        }

        case ActionType.UPDATE_FX_XY: {
            const { slotIndex, padIndex, x, y } = action.payload;
             const newSlots = state.performanceFx.slots.map((slot, sIdx) => {
                if (sIdx !== slotIndex) return slot;
                
                const newPads = slot.xyPads.map((pad, pIdx) => {
                    if (pIdx !== padIndex) return pad;
                    return { ...pad, x, y };
                });
                
                // Map the new X/Y values to the effect parameters
                const newParams = { 
                    ...slot.params, 
                    [newPads[padIndex].xParam]: x, 
                    [newPads[padIndex].yParam]: y 
                };
                
                return { ...slot, xyPads: newPads, params: newParams };
            });
            return { ...state, performanceFx: { ...state.performanceFx, slots: newSlots } };
        }

        case ActionType.RECORD_FX_AUTOMATION_POINT: {
            const { slotIndex, padIndex, point } = action.payload;
            return {
                ...state,
                performanceFx: {
                    ...state.performanceFx,
                    slots: state.performanceFx.slots.map((slot, sIdx) => {
                        if (sIdx !== slotIndex) return slot;
                        return {
                            ...slot,
                            xyPads: slot.xyPads.map((pad, pIdx) => {
                                if (pIdx !== padIndex) return pad;
                                const threshold = 0.003; 
                                const now = Date.now();
                                const PROTECTED_TIME = 1000;
                                const filteredData = pad.automation.data.filter(p => {
                                    const dist = Math.abs(p.position - point.position);
                                    if (dist > threshold) return true;
                                    if (p.createdAt && (now - p.createdAt < PROTECTED_TIME)) return true; 
                                    return false;
                                });
                                const newPoint = { ...point, createdAt: now };
                                const newData = [...filteredData, newPoint].sort((a, b) => a.position - b.position);
                                return { ...pad, automation: { ...pad.automation, data: newData } };
                            })
                        };
                    })
                }
            };
        }

        case ActionType.SET_FX_AUTOMATION_RECORD_MODE: {
            const { slotIndex, padIndex, mode } = action.payload;
            const newSlots = state.performanceFx.slots.map((slot, sIdx) => sIdx === slotIndex ? {
                ...slot,
                xyPads: slot.xyPads.map((pad, pIdx) => pIdx === padIndex ? { ...pad, automation: { ...pad.automation, recordMode: mode } } : pad)
            } : slot);
            return { ...state, performanceFx: { ...state.performanceFx, slots: newSlots } };
        }
        
        case ActionType.SET_FX_AUTOMATION_RECORDING: {
            const { slotIndex, padIndex, isRecording } = action.payload;
            const newSlots = state.performanceFx.slots.map((slot, sIdx) => sIdx === slotIndex ? {
                ...slot,
                xyPads: slot.xyPads.map((pad, pIdx) => pIdx === padIndex ? { ...pad, automation: { ...pad.automation, recording: isRecording } } : pad)
            } : slot);
            return { ...state, performanceFx: { ...state.performanceFx, slots: newSlots } };
        }

        case ActionType.JUMP_FX_AUTOMATION:
            return { ...state, performanceFx: { ...state.performanceFx, jumpToBar: { barIndex: action.payload.bar, triggerId: Date.now() } } };
        
        case ActionType.CLEAR_FX_AUTOMATION_JUMP:
            return { ...state, performanceFx: { ...state.performanceFx, jumpToBar: null } };

        case ActionType.SET_FX_AUTOMATION_LOOP: {
            const { slotIndex, bar } = action.payload;
            const newSlots = state.performanceFx.slots.map((slot, sIdx) => sIdx === slotIndex ? {
                ...slot,
                xyPads: slot.xyPads.map(pad => ({ ...pad, automation: { ...pad.automation, loopBar: bar } }))
            } : slot);
            return { ...state, performanceFx: { ...state.performanceFx, slots: newSlots } };
        }

        case ActionType.CLEAR_FX_AUTOMATION: {
             const { slotIndex } = action.payload;
             const newSlots = state.performanceFx.slots.map((slot, index) => {
                 if (index === slotIndex) {
                     return {
                         ...slot,
                         xyPads: slot.xyPads.map(pad => ({
                             ...pad,
                             automation: { ...pad.automation, data: [], loopBar: null }
                         }))
                     };
                 }
                 return slot;
             });
             return { ...state, performanceFx: { ...state.performanceFx, slots: newSlots } };
        }

        case ActionType.SET_FX_ROUTING:
             return { ...state, performanceFx: { ...state.performanceFx, routing: action.payload } };

        case ActionType.UPDATE_SYNTH_PARAM: {
            const { path, value } = action.payload;
            const parts = (path as string).split('.');
            if (parts.length === 2) {
                const [key1, key2] = parts as [keyof Synth, string];
                const nestedObj = state.synth[key1];
                if (typeof nestedObj === 'object' && nestedObj !== null) {
                    return { ...state, synth: { ...state.synth, [key1]: { ...(nestedObj as object), [key2]: value } } };
                }
            } else if (parts.length === 1) {
                return { ...state, synth: { ...state.synth, [parts[0]]: value } };
            }
            return state;
        }

        case ActionType.SET_SYNTH_MOD_MATRIX: {
            const { source, dest, value } = action.payload;
            const newMatrix = {
                ...state.synthModMatrix,
                [source]: { ...state.synthModMatrix[source], [dest]: value }
            };
            return { ...state, synthModMatrix: newMatrix };
        }
        
        case ActionType.TOGGLE_SYNTH_MOD_MATRIX_MUTE:
            return { ...state, isModMatrixMuted: !state.isModMatrixMuted };
            
        case ActionType.CLEAR_SYNTH_MOD_MATRIX:
            return { ...state, synthModMatrix: {} };
            
        case ActionType.TOGGLE_MOD_WHEEL_LOCK_MUTE:
            return { ...state, isModWheelLockMuted: !state.isModWheelLockMuted };
            
        case ActionType.RANDOMIZE_SYNTH_PARAMS: {
            const newSynth: Synth = {
                ...state.synth,
                osc1: { ...state.synth.osc1, type: OSC_WAVEFORMS[Math.floor(Math.random() * OSC_WAVEFORMS.length)], detune: Math.random() * 20 - 10, waveshapeAmount: Math.random() },
                osc2: { ...state.synth.osc2, type: OSC_WAVEFORMS[Math.floor(Math.random() * OSC_WAVEFORMS.length)], detune: Math.random() * 100 - 50, waveshapeAmount: Math.random() },
                oscMix: Math.random(),
                filter: { ...state.synth.filter, cutoff: 20 + Math.random() * 19980, resonance: Math.random() * 20, envAmount: (Math.random() * 2 - 1) * 7000 },
                filterEnv: { ...state.synth.filterEnv, attack: Math.random() * 2, decay: Math.random() * 2, sustain: Math.random() },
                ampEnv: { ...state.synth.ampEnv, decay: Math.random() * 4 },
            };
            return { ...state, synth: newSynth, toastMessage: "Synth randomized!" };
        }

        case ActionType.RANDOMIZE_SYNTH_MOD_MATRIX: {
            const newMatrix: ModMatrix = {};
            MOD_SOURCES.forEach(source => {
                if (Math.random() > 0.4) {
                    newMatrix[source] = {};
                    MOD_DESTINATIONS.forEach(dest => {
                        if (Math.random() > 0.6) {
                            newMatrix[source][dest] = Math.random() * 2 - 1;
                        }
                    });
                }
            });
            return { ...state, synthModMatrix: newMatrix, toastMessage: "Mod Matrix randomized!" };
        }
        
        case ActionType.LOAD_SYNTH_PRESET:
             return { ...state, synth: action.payload.synth, synthModMatrix: action.payload.modMatrix, toastMessage: `Loaded ${action.payload.name}` };

        case ActionType.SAVE_SYNTH_PRESET_AT_INDEX: {
            const { index, name, synth, matrix } = action.payload;
            const newPresets = [...state.synthPresets];
            newPresets[index] = { id: index, name, synth, modMatrix: matrix };
            return { ...state, synthPresets: newPresets };
        }
        
        case ActionType.CLEAR_SYNTH_PRESET_AT_INDEX: {
             const newPresets = [...state.synthPresets];
             newPresets[action.payload.index] = null;
             return { ...state, synthPresets: newPresets };
        }
        
        case ActionType.IMPORT_SYNTH_PRESETS:
             return { ...state, synthPresets: action.payload };

        case ActionType.RESET_TO_USER_DEFAULT:
             return { ...INITIAL_STATE, audioContext: state.audioContext, isInitialized: true };

        case ActionType.LOAD_PROJECT_STATE:
             return { ...INITIAL_STATE, ...action.payload, isInitialized: true, audioContext: state.audioContext, isPlaying: state.isPlaying, projectLoadCount: state.projectLoadCount + 1 };
             
        case ActionType.SET_SAMPLES:
             return { ...state, samples: action.payload };
             
        case ActionType.SET_ARMED_STATE:
             return { ...state, isArmed: action.payload };
             
        case ActionType.SET_RECORDING_STATE:
             return { ...state, isRecording: action.payload };
             
        case ActionType.LOAD_BANK_KIT: {
            const { bankIndex, samples } = action.payload;
            const newSamples = [...state.samples];
            const start = bankIndex * PADS_PER_BANK;
            for(let i=0; i<PADS_PER_BANK; i++) {
                if (samples[i]) newSamples[start + i] = samples[i];
            }
            return { ...state, samples: newSamples };
        }

        case ActionType.SAVE_COMPRESSOR_SNAPSHOT: {
            const { index, name, params } = action.payload;
            const newSnaps = [...state.compressorSnapshots];
            newSnaps[index] = { name, params };
            return { ...state, compressorSnapshots: newSnaps };
        }
        
        case ActionType.LOAD_COMPRESSOR_SNAPSHOT:
            return { ...state, masterCompressorParams: action.payload.params, toastMessage: `Loaded ${action.payload.name}` };
            
        case ActionType.CLEAR_COMPRESSOR_SNAPSHOT: {
            const newSnaps = [...state.compressorSnapshots];
            newSnaps[action.payload.index] = null;
            return { ...state, compressorSnapshots: newSnaps };
        }
        
        // --- Template Actions ---
        case ActionType.APPLY_BANK_A_DRUM_TEMPLATE: {
             const { patternId, sequences, grooveId, grooveDepth } = action.payload;
             return { ...state, patterns: updatePatternImmutably(state.patterns, patternId, p => {
                const newSteps = [...p.steps];
                Object.entries(sequences).forEach(([sampleIndexStr, stepData]) => {
                    const sampleIndex = parseInt(sampleIndexStr, 10);
                    if (sampleIndex >= 0 && sampleIndex < TOTAL_SAMPLES) {
                        newSteps[sampleIndex] = (stepData as boolean[]).map(active => ({ active, velocity: 1 }));
                    }
                });
                const newGrooveIds = [...p.grooveIds];
                const newGrooveDepths = [...p.grooveDepths];
                newGrooveIds[0] = grooveId;
                newGrooveDepths[0] = grooveDepth;
                return { ...p, steps: newSteps, grooveIds: newGrooveIds, grooveDepths: newGrooveDepths };
             })};
        }
        case ActionType.APPLY_SEQUENCE_TEMPLATE: {
            const { patternId, sampleId, steps, grooveId, grooveDepth } = action.payload;
            const newStepsData = (steps as boolean[]).map(active => ({ active, velocity: 1 }));
             return { ...state, patterns: updatePatternImmutably(state.patterns, patternId, p => ({
                ...p,
                steps: p.steps.map((lane, i) => i === sampleId ? newStepsData : lane),
                grooveIds: p.grooveIds.map((id, i) => i === state.activeSampleBank ? grooveId : id),
                grooveDepths: p.grooveDepths.map((depth, i) => i === state.activeSampleBank ? grooveDepth : depth),
             }))};
        }
             
        // --- Utility Actions ---
        case ActionType.CLEAR_SEQUENCE: {
            const { patternId, sampleId } = action.payload;
            return { ...state, patterns: updatePatternImmutably(state.patterns, patternId, p => ({ ...p, steps: p.steps.map((lane, i) => i === sampleId ? createEmptySteps() : lane) })) };
        }

        case ActionType.FILL_SEQUENCE: {
            const { patternId, sampleId } = action.payload;
            const newSteps = createEmptySteps().map((s, i) => i % 4 === 0 ? { active: true, velocity: 1 } : s);
            return { ...state, patterns: updatePatternImmutably(state.patterns, patternId, p => ({ ...p, steps: p.steps.map((lane, i) => i === sampleId ? newSteps : lane) })) };
        }

        case ActionType.RANDOMIZE_SEQUENCE: {
            const { patternId, sampleId } = action.payload;
            const newSteps = createEmptySteps().map(() => ({ active: Math.random() > 0.5, velocity: 1 }));
            return { ...state, patterns: updatePatternImmutably(state.patterns, patternId, p => ({ ...p, steps: p.steps.map((lane, i) => i === sampleId ? newSteps : lane) })) };
        }

        case ActionType.RANDOMIZE_PITCH: {
            const { patternId, sampleId, key, scale: scaleName } = action.payload;
            const scale = SCALES.find(s => s.name === scaleName);
            if (!scale || scale.intervals.length === 0) return state; // Can't randomize on chromatic/thru
            const scaleNotesInCents: number[] = [0];
            let currentCents = 0;
            for (const interval of scale.intervals) { currentCents += interval; scaleNotesInCents.push(currentCents); }
            scaleNotesInCents.pop();
            const octaveSpan = scale.intervals.reduce((a, b) => a + b, 0);
            const notesToChooseFrom = [ ...scaleNotesInCents.map(n => n - octaveSpan), ...scaleNotesInCents, ...scaleNotesInCents.map(n => n + octaveSpan) ];
            return { ...state, patterns: updatePatternImmutably(state.patterns, patternId, p => ({ ...p, steps: p.steps.map((lane, i) => i === sampleId ? lane.map(step => step.active ? { ...step, detune: notesToChooseFrom[Math.floor(Math.random() * notesToChooseFrom.length)] } : step) : lane) })) };
        }
        
        // --- Copy/Paste ---
        case ActionType.COPY_LANE: {
            const pattern = state.patterns[state.activePatternIds[state.activeSampleBank]];
            if (!pattern) return state;
            return { ...state, laneClipboard: { steps: pattern.steps[state.activeSampleId], paramLocks: pattern.paramLocks[state.activeSampleId] }, toastMessage: 'Lane copied' };
        }
        case ActionType.PASTE_LANE: {
            if (!state.laneClipboard) return state;
            const { patternId, sampleId } = { patternId: state.activePatternIds[state.activeSampleBank], sampleId: state.activeSampleId };
            return { ...state, patterns: updatePatternImmutably(state.patterns, patternId, p => ({ ...p, steps: p.steps.map((lane, i) => i === sampleId ? state.laneClipboard!.steps : lane), paramLocks: { ...p.paramLocks, [sampleId]: state.laneClipboard!.paramLocks } })), toastMessage: 'Lane pasted' };
        }
        case ActionType.COPY_BANK: {
            const pattern = state.patterns[state.activePatternIds[state.activeSampleBank]];
            if (!pattern) return state;
            const start = state.activeSampleBank * PADS_PER_BANK;
            const end = start + PADS_PER_BANK;
            const bankSequences = pattern.steps.slice(start, end);
            const bankParamLocks: Pattern['paramLocks'] = {};
            for(let i=start; i<end; i++) { if(pattern.paramLocks[i]) bankParamLocks[i] = pattern.paramLocks[i]; }
            return { ...state, bankClipboard: { sequences: bankSequences, paramLocks: bankParamLocks, grooveId: pattern.grooveIds[state.activeSampleBank], grooveDepth: pattern.grooveDepths[state.activeSampleBank] }, toastMessage: 'Bank copied' };
        }
        case ActionType.PASTE_BANK: {
            if (!state.bankClipboard) return state;
            const { patternId, bankIndex } = { patternId: state.activePatternIds[state.activeSampleBank], bankIndex: state.activeSampleBank };
            const start = bankIndex * PADS_PER_BANK;
            return { ...state, patterns: updatePatternImmutably(state.patterns, patternId, p => {
                const newSteps = [...p.steps];
                const newLocks = {...p.paramLocks};
                for(let i=0; i<PADS_PER_BANK; i++) {
                    newSteps[start+i] = state.bankClipboard!.sequences[i];
                    const oldLockKey = Object.keys(state.bankClipboard!.paramLocks)[i];
                    if(oldLockKey) newLocks[start+i] = state.bankClipboard!.paramLocks[parseInt(oldLockKey, 10)];
                }
                const newGrooveIds = [...p.grooveIds];
                newGrooveIds[bankIndex] = state.bankClipboard!.grooveId;
                const newGrooveDepths = [...p.grooveDepths];
                newGrooveDepths[bankIndex] = state.bankClipboard!.grooveDepth;
                return { ...p, steps: newSteps, paramLocks: newLocks, grooveIds: newGrooveIds, grooveDepths: newGrooveDepths };
            }), toastMessage: 'Bank pasted' };
        }
        case ActionType.COPY_PATTERN: {
            const { patternId } = action.payload;
            const patternToCopy = state.patterns.find(p => p.id === patternId);
            if (!patternToCopy) return state;
            return { ...state, patternClipboard: JSON.parse(JSON.stringify(patternToCopy)), toastMessage: `Pattern P${(patternId % PATTERNS_PER_BANK) + 1} copied` };
        }
        case ActionType.PASTE_PATTERN: {
            const { patternId } = action.payload;
            if (!state.patternClipboard) return state;
            return { ...state, patterns: state.patterns.map(p => p.id === patternId ? { ...state.patternClipboard!, id: patternId } : p), toastMessage: 'Pattern pasted' };
        }

        default:
            return state;
    }
};

export const AppContext = createContext<{ state: AppState; dispatch: React.Dispatch<Action> }>({
    state: INITIAL_STATE,
    dispatch: () => null,
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

    return (
        <AppContext.Provider value={{ state, dispatch }}>
            {children}
        </AppContext.Provider>
    );
};