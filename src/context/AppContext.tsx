
import React, { createContext, useReducer } from 'react';
import { AppState, Action, ActionType, Pattern, Step, Sample, Synth, ModMatrix, PerformanceChain, MasterCompressorParams, CompressorSnapshot } from '../types';
import { TOTAL_BANKS, PADS_PER_BANK, STEPS_PER_PATTERN, TOTAL_PATTERNS, TOTAL_SAMPLES, DEFAULT_PERFORMANCE_FX } from '../constants';

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
            const newPatterns = [...state.patterns];
            const pattern = { ...newPatterns[patternId] };
            const sampleSteps = [...pattern.steps[sampleId]];
            
            // Toggle logic or overwrite? Usually record implies set active.
            // If already active with same detune, maybe clear? But typically record simply writes.
            sampleSteps[step] = { active: true, velocity: 1, detune };
            
            pattern.steps[sampleId] = sampleSteps;
            newPatterns[patternId] = pattern;
            return { ...state, patterns: newPatterns };
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
            const newPatterns = [...state.patterns];
            const pattern = { ...newPatterns[patternId] };
            const newStep = { ...pattern.steps[sampleId][step] };
            newStep.active = !newStep.active;
            pattern.steps[sampleId][step] = newStep;
            newPatterns[patternId] = pattern;
            return { ...state, patterns: newPatterns };
        }

        case ActionType.SET_ACTIVE_PATTERN_FOR_BANK: {
            const { bankIndex, patternId } = action.payload;
            const newIds = [...state.activePatternIds];
            newIds[bankIndex] = patternId;
            return { ...state, activePatternIds: newIds };
        }

        case ActionType.UPDATE_PATTERN_PARAMS: {
            const { patternId, params } = action.payload;
            const newPatterns = [...state.patterns];
            newPatterns[patternId] = { ...newPatterns[patternId], ...params };
            return { ...state, patterns: newPatterns };
        }
        
        case ActionType.UPDATE_PARAM_LOCK: {
            const { patternId, sampleId, param, step, value } = action.payload;
            const newPatterns = [...state.patterns];
            const pattern = { ...newPatterns[patternId] };
            const locks = { ...pattern.paramLocks };
            if (!locks[sampleId]) locks[sampleId] = {};
            if (!locks[sampleId][param]) locks[sampleId][param] = {};
            
            // Cast to allow indexing
            (locks[sampleId][param] as any)[step] = value;
            
            pattern.paramLocks = locks;
            newPatterns[patternId] = pattern;
            return { ...state, patterns: newPatterns };
        }
        
        case ActionType.SET_BPM:
            return { ...state, bpm: action.payload };

        case ActionType.TOGGLE_PLAY:
            return { ...state, isPlaying: !state.isPlaying };
            
        case ActionType.SET_CURRENT_STEP: {
             const { bankIndex, step } = action.payload;
             const newSteps = [...state.currentSteps];
             newSteps[bankIndex] = step;
             // Also update global visual step if it's the active bank
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
            
            // Also update the active pattern's groove depth for persistence
            const patternId = state.activePatternIds[bankIndex];
            const newPatterns = [...state.patterns];
            if (newPatterns[patternId]) {
                 newPatterns[patternId].grooveDepths[bankIndex] = value;
            }
            
            return { ...state, grooveDepths: newDepths, patterns: newPatterns };
        }

        case ActionType.SET_ACTIVE_GROOVE: {
             const { bankIndex, grooveId } = action.payload;
             const newIds = [...state.activeGrooveIds];
             newIds[bankIndex] = grooveId;
             
             // Update pattern persistence
             const patternId = state.activePatternIds[bankIndex];
             const newPatterns = [...state.patterns];
             if (newPatterns[patternId]) {
                 newPatterns[patternId].grooveIds[bankIndex] = grooveId;
             }
             
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
             const newSlots = [...state.performanceFx.slots];
             newSlots[slotIndex] = { ...newSlots[slotIndex], type, isOn: true }; // Activate on change
             return { ...state, performanceFx: { ...state.performanceFx, slots: newSlots } };
        }
        
        case ActionType.TOGGLE_FX_BYPASS: {
             const slotIndex = action.payload;
             const newSlots = [...state.performanceFx.slots];
             newSlots[slotIndex].isOn = !newSlots[slotIndex].isOn;
             return { ...state, performanceFx: { ...state.performanceFx, slots: newSlots } };
        }

        case ActionType.UPDATE_FX_PARAM: {
            const { slotIndex, param, value } = action.payload;
            const newSlots = [...state.performanceFx.slots];
            newSlots[slotIndex].params[param] = value;
            return { ...state, performanceFx: { ...state.performanceFx, slots: newSlots } };
        }

        case ActionType.UPDATE_FX_XY: {
            const { slotIndex, padIndex, x, y } = action.payload;
            const newSlots = [...state.performanceFx.slots];
            const slot = newSlots[slotIndex];
            // Don't mutate, copy arrays
            const newPads = [...slot.xyPads];
            const pad = { ...newPads[padIndex], x, y };
            
            // Map X/Y to params
            slot.params[pad.xParam] = x;
            slot.params[pad.yParam] = y;

            newPads[padIndex] = pad;
            slot.xyPads = newPads;
            newSlots[slotIndex] = slot;
            
            return { ...state, performanceFx: { ...state.performanceFx, slots: newSlots } };
        }

        case ActionType.RECORD_FX_AUTOMATION_POINT: {
            const { slotIndex, padIndex, point } = action.payload;
            const newSlots = [...state.performanceFx.slots];
            const slot = { ...newSlots[slotIndex] };
            const newPads = [...slot.xyPads];
            const pad = { ...newPads[padIndex] };
            const automation = { ...pad.automation };
            
            // FIX: Smart Overwrite Logic (Punch-in)
            const threshold = 0.003; 
            const now = Date.now();
            const PROTECTED_TIME = 1000; 

            const filteredData = automation.data.filter(p => {
                const dist = Math.abs(p.position - point.position);
                if (dist > threshold) return true;
                if (p.createdAt && (now - p.createdAt < PROTECTED_TIME)) return true; 
                return false;
            });
            
            const newPoint = { ...point, createdAt: now };
            const newData = [...filteredData, newPoint];
            newData.sort((a, b) => a.position - b.position);
            
            automation.data = newData;
            pad.automation = automation;
            newPads[padIndex] = pad;
            slot.xyPads = newPads;
            newSlots[slotIndex] = slot;
            return { ...state, performanceFx: { ...state.performanceFx, slots: newSlots } };
        }

        case ActionType.SET_FX_AUTOMATION_RECORD_MODE: {
             const { slotIndex, padIndex, mode } = action.payload;
             const newSlots = [...state.performanceFx.slots];
             newSlots[slotIndex].xyPads[padIndex].automation.recordMode = mode;
             return { ...state, performanceFx: { ...state.performanceFx, slots: newSlots } };
        }

        case ActionType.SET_FX_AUTOMATION_RECORDING: {
             const { slotIndex, padIndex, isRecording } = action.payload;
             const newSlots = [...state.performanceFx.slots];
             newSlots[slotIndex].xyPads[padIndex].automation.recording = isRecording;
             return { ...state, performanceFx: { ...state.performanceFx, slots: newSlots } };
        }

        case ActionType.JUMP_FX_AUTOMATION:
            return { ...state, performanceFx: { ...state.performanceFx, jumpToBar: action.payload.bar } };
        
        case ActionType.CLEAR_FX_AUTOMATION_JUMP:
            return { ...state, performanceFx: { ...state.performanceFx, jumpToBar: null } };

        case ActionType.SET_FX_AUTOMATION_LOOP: {
            const { slotIndex, bar } = action.payload;
            const newSlots = [...state.performanceFx.slots];
            // Loop is applied to all pads in the slot for synchronization usually, or just visually
            // Updating all pads in slot for consistency
            newSlots[slotIndex].xyPads.forEach(p => p.automation.loopBar = bar);
            return { ...state, performanceFx: { ...state.performanceFx, slots: newSlots } };
        }

        case ActionType.CLEAR_FX_AUTOMATION: {
             const { slotIndex } = action.payload;
             const newSlots = [...state.performanceFx.slots];
             newSlots[slotIndex].xyPads.forEach(p => p.automation.data = []);
             return { ...state, performanceFx: { ...state.performanceFx, slots: newSlots } };
        }

        case ActionType.SET_FX_ROUTING:
             return { ...state, performanceFx: { ...state.performanceFx, routing: action.payload } };

        case ActionType.UPDATE_SYNTH_PARAM: {
            const { path, value } = action.payload;
            const newSynth = { ...state.synth };
            // Simple deep set for path like "osc1.type"
            const parts = (path as string).split('.');
            let current: any = newSynth;
            for (let i = 0; i < parts.length - 1; i++) {
                current = current[parts[i]];
            }
            current[parts[parts.length - 1]] = value;
            return { ...state, synth: newSynth };
        }

        case ActionType.SET_SYNTH_MOD_MATRIX: {
            const { source, dest, value } = action.payload;
            const newMatrix = { ...state.synthModMatrix };
            if (!newMatrix[source]) newMatrix[source] = {};
            newMatrix[source][dest] = value;
            return { ...state, synthModMatrix: newMatrix };
        }
        
        case ActionType.TOGGLE_SYNTH_MOD_MATRIX_MUTE:
            return { ...state, isModMatrixMuted: !state.isModMatrixMuted };
            
        case ActionType.CLEAR_SYNTH_MOD_MATRIX:
            return { ...state, synthModMatrix: {} };
            
        case ActionType.TOGGLE_MOD_WHEEL_LOCK_MUTE:
            return { ...state, isModWheelLockMuted: !state.isModWheelLockMuted };
            
        case ActionType.RANDOMIZE_SYNTH_PARAMS: {
             // Basic randomizer logic (omitted for brevity, would be complex)
             // For now just slightly detuning oscillators as a placeholder
             const newSynth = { ...state.synth, osc1: { ...state.synth.osc1, detune: Math.floor(Math.random() * 20 - 10) } };
             return { ...state, synth: newSynth };
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
             return { ...action.payload, isInitialized: true, audioContext: state.audioContext, isPlaying: false };
             
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

        // Add other handlers for snapshot save/load, etc.
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
             // Logic to clear Bank A patterns and apply sequences
             return state; // Placeholder implementation
        }
        case ActionType.APPLY_SEQUENCE_TEMPLATE:
             return state; // Placeholder implementation
             
        // --- Utility Actions ---
        case ActionType.CLEAR_SEQUENCE: {
             const { patternId, sampleId } = action.payload;
             const newPatterns = [...state.patterns];
             newPatterns[patternId].steps[sampleId] = createEmptySteps();
             return { ...state, patterns: newPatterns };
        }
        
        // Implement COPY/PASTE logic for Lanes/Banks/Patterns if needed...
        case ActionType.COPY_LANE:
             // ... logic
             return { ...state, toastMessage: 'Lane copied' };
        case ActionType.PASTE_LANE:
             // ... logic
             return { ...state, toastMessage: 'Lane pasted' };

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
