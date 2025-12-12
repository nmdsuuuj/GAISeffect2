
export interface Groove {
    id: number;
    name: string;
    offsets: number[];
}

export interface Sample {
    id: number;
    name: string;
    buffer: AudioBuffer | null;
    volume: number; // Base volume
    pitch: number;  // Base pitch in semitones
    start: number; // 0-1
    end: number; // 0-1, NEW
    decay: number; // 0-1
    loop: boolean; // NEW
    playbackMode: 'Forward' | 'Reverse' | 'PingPong'; // NEW
    lpFreq: number; // Low-pass filter frequency
    hpFreq: number; // High-pass filter frequency
}

export interface Step {
    active: boolean;
    detune: number | null; // Pitch detune from base note in cents
    velocity: number; // 0-1
}

// Parameters that can be locked per step for a given sample
export type LockableParam = 'detune' | 'velocity' | 'volume' | 'pitch' | 'start' | 'end' | 'decay' | 'lpFreq' | 'hpFreq' | 'modWheel';

export interface Pattern {
    id: number;
    steps: Step[][]; // [sampleId][step]
    paramLocks: Record<number, Partial<Record<LockableParam, (number | null)[]>>>; // { sampleId: { param: [stepValue, ...] } }
    stepResolutionA: number;
    stepLengthA: number;
    loopCountA: number;
    stepResolutionB: number;
    stepLengthB: number;
    loopCountB: number;
    playbackKey: number; // 0-11 for C-B, for non-destructive playback re-pitching
    playbackScale: string; // Name of the scale for non-destructive playback re-pitching
    // Each pattern now stores its own groove settings for all 4 banks
    grooveIds: number[]; 
    grooveDepths: number[];
}

export interface MasterCompressorParams {
    threshold: number; // dB, -100 to 0
    knee: number;      // dB, 0 to 40
    ratio: number;     // unitless, 1 to 20
    attack: number;    // seconds, 0 to 1
    release: number;   // seconds, 0 to 1
}

export interface MasterCompressorSnapshot {
    id: number;
    name: string;
    params: MasterCompressorParams;
}

export interface PlaybackParams {
    detune: number | null;
    velocity: number;
    volume: number;
    pitch: number;
    start: number;
    end: number;
    loop: boolean;
    playbackMode: 'Forward' | 'Reverse' | 'PingPong';
    decay: number;
    lpFreq: number;
    hpFreq: number;
}

export interface LaneClipboardData {
    steps: Step[];
    paramLocks: Pattern['paramLocks'][number];
}

export interface BankClipboardData {
    sequences: Step[][];
    paramLocks: Record<number, Pattern['paramLocks'][number]>; // paramLocks indexed 0-7
    grooveId: number;
    grooveDepth: number;
}

export interface BankPresetData {
  samples: Sample[]; // Array of 8 samples with AudioBuffers
  sequences: Step[][];
  paramLocks: Record<number, Pattern['paramLocks'][number]>;
  grooveId: number;
  grooveDepth: number;
}

// --- Synth ---
export interface SynthOscillator {
    type: string;
    octave: number; // -4 to 2
    detune: number; // in cents
    fmDepth: number;
    waveshapeAmount: number;
    waveshapeType: string; // Now a string
    wsLfoAmount?: number; // 0-1 for LFO1 -> Waveshape Amount
    sync?: boolean; // only for osc1
    pitchEnvAmount?: number; // Cents of modulation from filter env
}

// This is the native type for the Web Audio API node
export type BiquadFilterType =
  | 'lowpass'
  | 'highpass'
  | 'bandpass'
  | 'notch'
  | 'allpass'
  | 'lowshelf'
  | 'highshelf'
  | 'peaking'; // Add peaking for new filter type

export interface SynthFilter {
    type: string; // Can be a descriptive name like 'Lowpass 24dB'
    cutoff: number; // in Hz
    resonance: number;
    envAmount: number;
}

export interface SynthFilterEnvelope {
    attack: number; // in seconds
    decay: number;
    sustain: number; // 0-1
}

export interface SynthAmpEnvelope {
    decay: number;
}


export interface SynthLFO {
    type: string; // Now a string to accommodate more types
    rate: number; // in Hz or index for sync mode
    rateMode: 'hz' | 'sync';
    syncTrigger: string; // e.g., 'Free', 'Gate', '1 Bar'
}

export interface Synth {
    version?: number; // NEW: Version tracking for migration
    osc1: SynthOscillator;
    osc2: SynthOscillator;
    oscMix: number; // 0-1
    filter: SynthFilter;
    filterEnv: SynthFilterEnvelope;
    ampEnv: SynthAmpEnvelope;
    lfo1: SynthLFO;
    lfo2: SynthLFO;
    modWheel: number; // 0-1, Global Depth control for sequencer mod
    modWheelOffset: number; // 0-1, Constant offset added to modulation
    masterGain: number;
    masterOctave: number;
}

export interface ModMatrix {
    [source: string]: {
        [destination: string]: number;
    };
}

export interface SynthPreset {
    id: number;
    name: string;
    synth: Synth;
    modMatrix: ModMatrix;
}

export interface ModPatch {
    id: number;
    name: string;
    modMatrix: ModMatrix;
}

// --- Performance FX ---

export type FXType = 'stutter' | 'glitch' | 'filter' | 'reverb';

export interface FXAutomation {
    active: boolean; // Is automation playback enabled?
    recording: boolean; // Is currently recording?
    data: { x: number; y: number }[]; // Time-series data points (0-1)
    lengthSteps: number; // Length of loop in sequencer steps (e.g., 32, 64)
    speed: number; // Playback speed multiplier (0.25, 0.5, 1, 2)
    loopMode: 'loop' | 'oneShot';
    startPoint: number; // 0-1, start position of the automation loop
    endPoint: number; // 0-1, end position of the automation loop
}

export interface XYPad {
    id: number;
    x: number; // Current X value 0-1
    y: number; // Current Y value 0-1
    xParam: string; // Parameter name mapped to X
    yParam: string; // Parameter name mapped to Y
    automation: FXAutomation;
}

export interface FXSnapshot {
    id: number;
    active: boolean; // Is this snapshot slot filled?
    params: any; // Stores the parameter state
    xyPads: XYPad[]; // Stores the XY Pad states including automation
}

// Generic interface for an effect instance
export interface PerformanceEffect<T> {
    type: FXType;
    isOn: boolean; // Hard bypass switch
    bypassMode: 'hard' | 'soft'; // NEW: Hard = 0% CPU, Soft = Mute Input (Tails)
    params: T;
    xyPads: XYPad[]; // XY Pads for performance control
    snapshots: FXSnapshot[]; // Instant recall slots (16)
}

export interface StutterParams {
    division: number; // Index in the ODD_DIVISIONS array
    speed: number; // -1 (Reverse) to 1 (Forward), 0 is stop
    feedback: number; // 0-1
    mix: number; // 0-1
}

export interface GlitchParams {
    crush: number; // 0-1 (Bit reduction)
    rate: number; // 0-1 (Sample rate reduction)
    shuffle: number; // 0-1 (Random time displacement)
    mix: number; // 0-1
}

export interface FilterFXParams {
    type: 'lowpass' | 'highpass' | 'bandpass';
    cutoff: number; // 0-1 (Mapped log)
    resonance: number; // 0-1
    lfoAmount: number; // 0-1
    lfoRate: number; // Index in ODD_DIVISIONS
    mix: number; // 0-1
}

export interface ReverbParams {
    size: number; // 0-1 (Room size / decay)
    damping: number; // 0-1 (HF damping)
    mod: number; // 0-1 (Chorus mod on tails)
    mix: number; // 0-1
}

export interface PerformanceChain {
    slots: PerformanceEffect<any>[]; // Array of 4 independent slots
    routing: number[]; // Array of slot indices (e.g. [0, 1, 2, 3]) representing processing order
    globalSnapshots: GlobalFXSnapshot[]; // 16 Global Snapshots
}

export interface GlobalFXSnapshot {
    id: number;
    active: boolean;
    chainState: {
        slots: {
            type: FXType;
            params: any;
            isOn: boolean;
            bypassMode?: 'hard' | 'soft';
        }[];
        routing: number[];
    };
}


export interface AppState {
    audioContext: AudioContext | null;
    isInitialized: boolean;
    isPlaying: boolean;
    isRecording: boolean;
    isArmed: boolean;
    recordingThreshold: number;
    bpm: number;
    currentSteps: number[];
    activeSampleId: number;
    activeSampleBank: number;
    // "Live" groove settings, loaded from the active pattern for the active bank.
    activeGrooveIds: number[]; 
    grooveDepths: number[];
    activeKey: number; // 0-11 for C-B
    activeScale: string; // Name of the scale
    keyboardOctave: number; // For PC keyboard note input
    seqMode: 'PART' | 'PARAM' | 'REC'; // Sequencer view mode
    samples: Sample[];
    patterns: Pattern[];
    activePatternIds: number[]; // one per bank
    grooves: Groove[];
    bankVolumes: number[]; // one per bank
    bankPans: number[]; // one per bank, -1 (L) to 1 (R)
    bankMutes: boolean[]; // one per bank
    bankSolos: boolean[]; // one per bank
    masterVolume: number;
    isMasterRecording: boolean;
    isMasterRecArmed: boolean;
    sampleClipboard: Sample | null;
    patternClipboard: Pattern | null;
    laneClipboard: LaneClipboardData | null;
    bankClipboard: BankClipboardData | null;
    masterCompressorOn: boolean;
    masterCompressorParams: MasterCompressorParams;
    compressorSnapshots: (MasterCompressorSnapshot | null)[];
    playbackTrackStates: {
        currentPart: 'A' | 'B';
        partRepetition: number;
    }[];
    // Synth state
    synth: Synth;
    synthModMatrix: ModMatrix;
    isModMatrixMuted: boolean;
    isModWheelLockMuted?: boolean;
    synthPresets: (SynthPreset | null)[];
    synthModPatches: (ModPatch | null)[];
    // Performance FX State
    performanceFx: PerformanceChain;
    
    selectedSeqStep: number | null;
    projectLoadCount: number; // For seamless project loading
    isLoading: boolean; // For session restore feedback
    toastMessage: string | null;
}

export enum ActionType {
    INITIALIZE_AUDIO,
    TOGGLE_PLAY,
    SET_BPM,
    SET_CURRENT_STEP,
    SET_ACTIVE_SAMPLE,
    SET_ACTIVE_SAMPLE_BANK,
    SET_ACTIVE_GROOVE,
    SET_GROOVE_DEPTH,
    UPDATE_SAMPLE_PARAM,
    UPDATE_SAMPLE_NAME,
    SET_SAMPLES,
    TOGGLE_STEP,
    UPDATE_PARAM_LOCK,
    CLEAR_PARAM_LOCK_LANE,
    SET_ACTIVE_PATTERN_FOR_BANK,
    UPDATE_PATTERN_PARAMS,
    LOAD_PROJECT_STATE,
    SET_RECORDING_STATE,
    SET_ARMED_STATE,
    SET_RECORDING_THRESHOLD,
    SET_BANK_VOLUME,
    SET_BANK_PAN,
    TOGGLE_BANK_MUTE,
    TOGGLE_BANK_SOLO,
    SET_MASTER_VOLUME,
    TOGGLE_MASTER_RECORDING,
    TOGGLE_MASTER_REC_ARMED,
    COPY_SAMPLE,
    PASTE_SAMPLE,
    TOGGLE_MASTER_COMPRESSOR,
    UPDATE_MASTER_COMPRESSOR_PARAM,
    SAVE_COMPRESSOR_SNAPSHOT,
    LOAD_COMPRESSOR_SNAPSHOT,
    CLEAR_COMPRESSOR_SNAPSHOT,
    SET_PLAYBACK_TRACK_STATE,
    RECORD_STEP,
    SET_KEY,
    SET_SCALE,
    UPDATE_PATTERN_PLAYBACK_SCALE,
    RANDOMIZE_SEQUENCE,
    CLEAR_SEQUENCE,
    FILL_SEQUENCE,
    RANDOMIZE_PITCH,
    APPLY_SEQUENCE_TEMPLATE,
    APPLY_BANK_A_DRUM_TEMPLATE,
    COPY_PATTERN,
    PASTE_PATTERN,
    COPY_LANE,
    PASTE_LANE,
    COPY_BANK,
    PASTE_BANK,
    SET_KEYBOARD_OCTAVE,
    SET_SEQ_MODE,
    LOAD_BANK_PRESET,
    LOAD_BANK_KIT,
    // Synth Actions
    UPDATE_SYNTH_PARAM,
    RANDOMIZE_SYNTH_PARAMS,
    SET_SYNTH_MOD_MATRIX,
    TOGGLE_SYNTH_MOD_MATRIX_MUTE,
    CLEAR_SYNTH_MOD_MATRIX,
    RANDOMIZE_SYNTH_MOD_MATRIX,
    SAVE_SYNTH_MOD_PATCH,
    SAVE_SYNTH_PRESET_AT_INDEX,
    CLEAR_SYNTH_PRESET_AT_INDEX,
    LOAD_SYNTH_PRESET,
    SET_SYNTH_PRESET_LIST, // NEW
    IMPORT_SYNTH_PRESETS, // NEW: Import entire bank
    SET_SELECTED_SEQ_STEP,
    TOGGLE_MOD_WHEEL_LOCK_MUTE,
    RESET_TO_USER_DEFAULT, // NEW
    // Performance FX Actions
    SET_FX_TYPE, 
    UPDATE_FX_PARAM,
    UPDATE_FX_XY, // NEW
    SET_FX_ROUTING,
    TOGGLE_FX_BYPASS,
    SAVE_FX_SNAPSHOT,
    LOAD_FX_SNAPSHOT,
    SAVE_GLOBAL_FX_SNAPSHOT,
    LOAD_GLOBAL_FX_SNAPSHOT,
    // System
    SET_IS_LOADING, 
    SHOW_TOAST,
    HIDE_TOAST,
}

export type Action =
    | { type: ActionType.INITIALIZE_AUDIO; payload: AudioContext }
    | { type: ActionType.TOGGLE_PLAY }
    | { type: ActionType.SET_BPM; payload: number }
    | { type: ActionType.SET_CURRENT_STEP; payload: { bankIndex: number; step: number } }
    | { type: ActionType.SET_ACTIVE_SAMPLE; payload: number }
    | { type: ActionType.SET_ACTIVE_SAMPLE_BANK; payload: number }
    | { type: ActionType.SET_ACTIVE_GROOVE; payload: { bankIndex: number; grooveId: number } }
    | { type: ActionType.SET_GROOVE_DEPTH; payload: { bankIndex: number; value: number } }
    | { type: ActionType.UPDATE_SAMPLE_PARAM; payload: { sampleId: number; param: 'volume' | 'pitch' | 'start' | 'end' | 'decay' | 'loop' | 'playbackMode' | 'lpFreq' | 'hpFreq'; value: number | boolean | string } }
    | { type: ActionType.UPDATE_SAMPLE_NAME; payload: { sampleId: number; name: string } }
    | { type: ActionType.SET_SAMPLES; payload: Sample[] }
    | { type: ActionType.TOGGLE_STEP; payload: { patternId: number; sampleId: number; step: number } }
    | { type: ActionType.UPDATE_PARAM_LOCK; payload: { patternId: number; sampleId: number; param: LockableParam; step: number; value: number | null } }
    | { type: ActionType.CLEAR_PARAM_LOCK_LANE; payload: { patternId: number; sampleId: number; param: LockableParam } }
    | { type: ActionType.SET_ACTIVE_PATTERN_FOR_BANK; payload: { bankIndex: number; patternId: number } }
    | { type: ActionType.UPDATE_PATTERN_PARAMS; payload: { patternId: number; params: Partial<Omit<Pattern, 'id' | 'steps' | 'paramLocks'>> } }
    | { type: ActionType.LOAD_PROJECT_STATE; payload: Partial<AppState> }
    | { type: ActionType.SET_RECORDING_STATE; payload: boolean }
    | { type: ActionType.SET_ARMED_STATE; payload: boolean }
    | { type: ActionType.SET_RECORDING_THRESHOLD; payload: number }
    | { type: ActionType.SET_BANK_VOLUME; payload: { bankIndex: number; volume: number } }
    | { type: ActionType.SET_BANK_PAN; payload: { bankIndex: number; pan: number } }
    | { type: ActionType.TOGGLE_BANK_MUTE; payload: { bankIndex: number } }
    | { type: ActionType.TOGGLE_BANK_SOLO; payload: { bankIndex: number } }
    | { type: ActionType.SET_MASTER_VOLUME; payload: number }
    | { type: ActionType.TOGGLE_MASTER_RECORDING }
    | { type: ActionType.TOGGLE_MASTER_REC_ARMED }
    | { type: ActionType.COPY_SAMPLE }
    | { type: ActionType.PASTE_SAMPLE }
    | { type: ActionType.TOGGLE_MASTER_COMPRESSOR }
    | { type: ActionType.UPDATE_MASTER_COMPRESSOR_PARAM; payload: { param: keyof MasterCompressorParams; value: number } }
    | { type: ActionType.SAVE_COMPRESSOR_SNAPSHOT; payload: { index: number, name: string, params: MasterCompressorParams } }
    | { type: ActionType.LOAD_COMPRESSOR_SNAPSHOT; payload: MasterCompressorSnapshot }
    | { type: ActionType.CLEAR_COMPRESSOR_SNAPSHOT; payload: { index: number } }
    | { type: ActionType.SET_PLAYBACK_TRACK_STATE; payload: { bankIndex: number; state: { currentPart: 'A' | 'B'; partRepetition: number; } } }
    | { type: ActionType.RECORD_STEP; payload: { patternId: number; sampleId: number; step: number; detune: number } }
    | { type: ActionType.SET_KEY, payload: number }
    | { type: ActionType.SET_SCALE, payload: string }
    | { type: ActionType.UPDATE_PATTERN_PLAYBACK_SCALE, payload: { patternId: number; key?: number; scale?: string } }
    | { type: ActionType.RANDOMIZE_SEQUENCE, payload: { patternId: number; sampleId: number } }
    | { type: ActionType.CLEAR_SEQUENCE, payload: { patternId: number; sampleId: number } }
    | { type: ActionType.FILL_SEQUENCE, payload: { patternId: number; sampleId: number } }
    | { type: ActionType.RANDOMIZE_PITCH, payload: { patternId: number; sampleId: number; key: number; scale: string } }
    | { type: ActionType.APPLY_SEQUENCE_TEMPLATE, payload: { patternId: number; sampleId: number; steps: boolean[]; grooveId?: number; grooveDepth?: number; } }
    | { type: ActionType.APPLY_BANK_A_DRUM_TEMPLATE, payload: { patternId: number; sequences: { [key: number]: boolean[] }; grooveId?: number; grooveDepth?: number; } }
    | { type: ActionType.COPY_PATTERN, payload: { patternId: number } }
    | { type: ActionType.PASTE_PATTERN, payload: { patternId: number } }
    | { type: ActionType.COPY_LANE }
    | { type: ActionType.PASTE_LANE }
    | { type: ActionType.COPY_BANK }
    | { type: ActionType.PASTE_BANK }
    | { type: ActionType.SET_KEYBOARD_OCTAVE, payload: number }
    | { type: ActionType.SET_SEQ_MODE, payload: 'PART' | 'PARAM' | 'REC' }
    | { type: ActionType.LOAD_BANK_PRESET, payload: { bankIndex: number, presetData: BankPresetData } }
    | { type: ActionType.LOAD_BANK_KIT, payload: { bankIndex: number, samples: Sample[] } }
    // Synth Actions
    | { type: ActionType.UPDATE_SYNTH_PARAM; payload: { path: string; value: string | number | boolean } }
    | { type: ActionType.RANDOMIZE_SYNTH_PARAMS }
    | { type: ActionType.SET_SYNTH_MOD_MATRIX; payload: { source: string; dest: string; value: number } }
    | { type: ActionType.TOGGLE_SYNTH_MOD_MATRIX_MUTE }
    | { type: ActionType.CLEAR_SYNTH_MOD_MATRIX }
    | { type: ActionType.RANDOMIZE_SYNTH_MOD_MATRIX }
    | { type: ActionType.SAVE_SYNTH_MOD_PATCH; payload: { name: string, matrix: ModMatrix } }
    | { type: ActionType.SAVE_SYNTH_PRESET_AT_INDEX; payload: { index: number, name: string, synth: Synth, matrix: ModMatrix } }
    | { type: ActionType.CLEAR_SYNTH_PRESET_AT_INDEX; payload: { index: number } }
    | { type: ActionType.LOAD_SYNTH_PRESET; payload: SynthPreset }
    | { type: ActionType.SET_SYNTH_PRESET_LIST; payload: (SynthPreset | null)[] }
    | { type: ActionType.IMPORT_SYNTH_PRESETS; payload: (SynthPreset | null)[] } // NEW
    | { type: ActionType.SET_SELECTED_SEQ_STEP; payload: number | null }
    | { type: ActionType.TOGGLE_MOD_WHEEL_LOCK_MUTE }
    | { type: ActionType.RESET_TO_USER_DEFAULT } // NEW
    // Performance FX Actions
    | { type: ActionType.SET_FX_TYPE; payload: { slotIndex: number; type: FXType } } 
    | { type: ActionType.UPDATE_FX_PARAM; payload: { slotIndex: number; param: string; value: number | string } }
    | { type: ActionType.UPDATE_FX_XY; payload: { slotIndex: number; padIndex: number; x: number; y: number } } // NEW
    | { type: ActionType.SET_FX_ROUTING; payload: number[] }
    | { type: ActionType.TOGGLE_FX_BYPASS; payload: number }
    | { type: ActionType.SAVE_FX_SNAPSHOT; payload: { slotIndex: number; index: number } }
    | { type: ActionType.LOAD_FX_SNAPSHOT; payload: { slotIndex: number; index: number } }
    | { type: ActionType.SAVE_GLOBAL_FX_SNAPSHOT; payload: { index: number } }
    | { type: ActionType.LOAD_GLOBAL_FX_SNAPSHOT; payload: { index: number } }
    // System
    | { type: ActionType.SET_IS_LOADING; payload: boolean }
    | { type: ActionType.SHOW_TOAST; payload: string }
    | { type: ActionType.HIDE_TOAST };
