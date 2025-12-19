
export enum ActionType {
    INITIALIZE_AUDIO = 'INITIALIZE_AUDIO',
    SET_SELECTED_SEQ_STEP = 'SET_SELECTED_SEQ_STEP',
    HIDE_TOAST = 'HIDE_TOAST',
    SHOW_TOAST = 'SHOW_TOAST',
    RECORD_STEP = 'RECORD_STEP',
    COPY_SAMPLE = 'COPY_SAMPLE',
    PASTE_SAMPLE = 'PASTE_SAMPLE',
    SET_KEYBOARD_OCTAVE = 'SET_KEYBOARD_OCTAVE',
    SET_KEY = 'SET_KEY',
    UPDATE_PATTERN_PLAYBACK_SCALE = 'UPDATE_PATTERN_PLAYBACK_SCALE',
    SET_SCALE = 'SET_SCALE',
    SET_ACTIVE_SAMPLE_BANK = 'SET_ACTIVE_SAMPLE_BANK',
    SET_ACTIVE_SAMPLE = 'SET_ACTIVE_SAMPLE',
    SET_SEQ_MODE = 'SET_SEQ_MODE',
    TOGGLE_STEP = 'TOGGLE_STEP',
    SET_ACTIVE_PATTERN_FOR_BANK = 'SET_ACTIVE_PATTERN_FOR_BANK',
    UPDATE_PATTERN_PARAMS = 'UPDATE_PATTERN_PARAMS',
    UPDATE_PARAM_LOCK = 'UPDATE_PARAM_LOCK',
    APPLY_BANK_A_DRUM_TEMPLATE = 'APPLY_BANK_A_DRUM_TEMPLATE',
    APPLY_SEQUENCE_TEMPLATE = 'APPLY_SEQUENCE_TEMPLATE',
    CLEAR_SEQUENCE = 'CLEAR_SEQUENCE',
    FILL_SEQUENCE = 'FILL_SEQUENCE',
    RANDOMIZE_SEQUENCE = 'RANDOMIZE_SEQUENCE',
    RANDOMIZE_PITCH = 'RANDOMIZE_PITCH',
    COPY_LANE = 'COPY_LANE',
    COPY_BANK = 'COPY_BANK',
    COPY_PATTERN = 'COPY_PATTERN',
    PASTE_LANE = 'PASTE_LANE',
    PASTE_BANK = 'PASTE_BANK',
    PASTE_PATTERN = 'PASTE_PATTERN',
    LOAD_BANK_KIT = 'LOAD_BANK_KIT',
    UPDATE_SAMPLE_PARAM = 'UPDATE_SAMPLE_PARAM',
    SET_RECORDING_THRESHOLD = 'SET_RECORDING_THRESHOLD',
    SET_GROOVE_DEPTH = 'SET_GROOVE_DEPTH',
    SET_ACTIVE_GROOVE = 'SET_ACTIVE_GROOVE',
    SET_BANK_VOLUME = 'SET_BANK_VOLUME',
    SET_BANK_PAN = 'SET_BANK_PAN',
    TOGGLE_BANK_MUTE = 'TOGGLE_BANK_MUTE',
    TOGGLE_BANK_SOLO = 'TOGGLE_BANK_SOLO',
    SET_MASTER_VOLUME = 'SET_MASTER_VOLUME',
    TOGGLE_MASTER_REC_ARMED = 'TOGGLE_MASTER_REC_ARMED',
    TOGGLE_MASTER_RECORDING = 'TOGGLE_MASTER_RECORDING',
    TOGGLE_MASTER_COMPRESSOR = 'TOGGLE_MASTER_COMPRESSOR',
    UPDATE_MASTER_COMPRESSOR_PARAM = 'UPDATE_MASTER_COMPRESSOR_PARAM',
    LOAD_COMPRESSOR_SNAPSHOT = 'LOAD_COMPRESSOR_SNAPSHOT',
    SAVE_COMPRESSOR_SNAPSHOT = 'SAVE_COMPRESSOR_SNAPSHOT',
    CLEAR_COMPRESSOR_SNAPSHOT = 'CLEAR_COMPRESSOR_SNAPSHOT',
    SET_FX_TYPE = 'SET_FX_TYPE',
    TOGGLE_FX_BYPASS = 'TOGGLE_FX_BYPASS',
    UPDATE_FX_PARAM = 'UPDATE_FX_PARAM',
    UPDATE_FX_XY = 'UPDATE_FX_XY',
    SET_FX_ROUTING = 'SET_FX_ROUTING',
    SAVE_FX_SNAPSHOT = 'SAVE_FX_SNAPSHOT',
    LOAD_FX_SNAPSHOT = 'LOAD_FX_SNAPSHOT',
    SAVE_GLOBAL_FX_SNAPSHOT = 'SAVE_GLOBAL_FX_SNAPSHOT',
    LOAD_GLOBAL_FX_SNAPSHOT = 'LOAD_GLOBAL_FX_SNAPSHOT',
    JUMP_FX_AUTOMATION = 'JUMP_FX_AUTOMATION',
    SET_FX_AUTOMATION_LOOP = 'SET_FX_AUTOMATION_LOOP',
    CLEAR_FX_AUTOMATION = 'CLEAR_FX_AUTOMATION',
    SET_FX_AUTOMATION_RECORD_MODE = 'SET_FX_AUTOMATION_RECORD_MODE',
    SET_FX_AUTOMATION_RECORDING = 'SET_FX_AUTOMATION_RECORDING',
    RECORD_FX_AUTOMATION_POINT = 'RECORD_FX_AUTOMATION_POINT',
    CLEAR_FX_AUTOMATION_JUMP = 'CLEAR_FX_AUTOMATION_JUMP',
    UPDATE_SYNTH_PARAM = 'UPDATE_SYNTH_PARAM',
    SET_SYNTH_MOD_MATRIX = 'SET_SYNTH_MOD_MATRIX',
    RANDOMIZE_SYNTH_PARAMS = 'RANDOMIZE_SYNTH_PARAMS',
    RANDOMIZE_SYNTH_MOD_MATRIX = 'RANDOMIZE_SYNTH_MOD_MATRIX',
    SAVE_SYNTH_PRESET_AT_INDEX = 'SAVE_SYNTH_PRESET_AT_INDEX',
    CLEAR_SYNTH_PRESET_AT_INDEX = 'CLEAR_SYNTH_PRESET_AT_INDEX',
    LOAD_SYNTH_PRESET = 'LOAD_SYNTH_PRESET',
    TOGGLE_SYNTH_MOD_MATRIX_MUTE = 'TOGGLE_SYNTH_MOD_MATRIX_MUTE',
    CLEAR_SYNTH_MOD_MATRIX = 'CLEAR_SYNTH_MOD_MATRIX',
    TOGGLE_MOD_WHEEL_LOCK_MUTE = 'TOGGLE_MOD_WHEEL_LOCK_MUTE',
    IMPORT_SYNTH_PRESETS = 'IMPORT_SYNTH_PRESETS',
    LOAD_PROJECT_STATE = 'LOAD_PROJECT_STATE',
    LOAD_BANK_PRESET = 'LOAD_BANK_PRESET',
    RESET_TO_USER_DEFAULT = 'RESET_TO_USER_DEFAULT',
    SET_SAMPLES = 'SET_SAMPLES',
    SET_ARMED_STATE = 'SET_ARMED_STATE',
    SET_RECORDING_STATE = 'SET_RECORDING_STATE',
    SET_BPM = 'SET_BPM',
    TOGGLE_PLAY = 'TOGGLE_PLAY',
    SET_CURRENT_STEP = 'SET_CURRENT_STEP',
    SET_PLAYBACK_TRACK_STATE = 'SET_PLAYBACK_TRACK_STATE'
}

export interface Action {
    type: ActionType;
    payload?: any;
}

export type BiquadFilterType = "lowpass" | "highpass" | "bandpass" | "lowshelf" | "highshelf" | "peaking" | "notch" | "allpass";

export interface Sample {
    id: number;
    name: string;
    buffer: AudioBuffer | null;
    volume: number;
    pitch: number;
    start: number;
    end: number;
    decay: number;
    loop: boolean;
    playbackMode: 'Forward' | 'Reverse' | 'PingPong';
    lpFreq: number;
    hpFreq: number;
}

export interface Step {
    active: boolean;
    velocity: number;
    detune?: number; 
}

export type LockableParam = 'pitch' | 'volume' | 'decay' | 'start' | 'lpFreq' | 'hpFreq' | 'velocity' | 'detune' | 'modWheel' | 'end';

export interface Pattern {
    id: number;
    steps: Step[][]; // [sampleId][stepIndex]
    totalSteps: number;
    stepResolutionA: number;
    stepResolutionB: number;
    stepLengthA: number;
    stepLengthB: number;
    loopCountA: number;
    loopCountB: number;
    paramLocks: {
        [sampleId: number]: {
            [param in LockableParam]?: { [step: number]: number };
        };
    };
    playbackKey: number;
    playbackScale: string;
    grooveIds: number[]; 
    grooveDepths: number[]; 
}

export interface Groove {
    id: number;
    name: string;
    offsets: number[];
}

export interface Synth {
    osc1: {
        type: string;
        octave: number;
        detune: number;
        waveshapeType: string;
        waveshapeAmount: number;
        wsLfoAmount?: number;
        sync?: boolean;
        fmDepth: number;
    };
    osc2: {
        type: string;
        octave: number;
        detune: number;
        waveshapeType: string;
        waveshapeAmount: number;
        wsLfoAmount?: number;
        fmDepth: number;
        pitchEnvAmount?: number;
    };
    oscMix: number;
    filter: {
        type: string;
        cutoff: number;
        resonance: number;
        envAmount: number;
    };
    filterEnv: {
        attack: number;
        decay: number;
        sustain: number;
        release?: number;
    };
    ampEnv: {
        attack?: number;
        decay: number;
        sustain?: number;
        release?: number;
    };
    lfo1: {
        type: string;
        rate: number;
        rateMode: 'hz' | 'sync';
        syncTrigger: string;
    };
    lfo2: {
        type: string;
        rate: number;
        rateMode: 'hz' | 'sync';
        syncTrigger: string;
    };
    masterGain: number;
    masterOctave: number;
    modWheel: number;
    modWheelOffset: number;
}

export type ModMatrix = {
    [source: string]: {
        [dest: string]: number;
    };
};

export interface SynthPreset {
    id: number;
    name: string;
    synth: Synth;
    modMatrix: ModMatrix;
}

export type FXType = 'filter' | 'stutter' | 'glitch' | 'reverb' | 'djLooper';

export interface FXAutomationPoint {
    position: number;
    x: number;
    y: number;
    createdAt?: number;
}

export interface FXAutomation {
    active: boolean;
    recording: boolean;
    recordMode: 'from-bar-start' | 'punch-in';
    data: FXAutomationPoint[];
    lengthSteps: number;
    loopBar: number | null;
}

export interface XYPad {
    id: number;
    x: number;
    y: number;
    xParam: string;
    yParam: string;
    automation: FXAutomation;
}

export interface Snapshot {
    active: boolean;
    params: any; 
    xyPads: XYPad[];
}

export interface GlobalSnapshot {
    active: boolean;
    chainState: any; 
}

export interface PerformanceEffect<T = any> {
    type: FXType;
    isOn: boolean;
    bypassMode: 'hard' | 'soft';
    params: T;
    xyPads: XYPad[];
    snapshots: Snapshot[];
}

export interface PerformanceChain {
    slots: PerformanceEffect[];
    routing: number[];
    globalSnapshots: GlobalSnapshot[];
    jumpToBar: { barIndex: number; triggerId: number } | null;
}

export interface FilterFXParams {
    type: BiquadFilterType;
    cutoff: number;
    resonance: number;
    lfoAmount: number;
    lfoRate: number;
    mix: number;
}

export interface GlitchParams {
    crush: number;
    rate: number;
    shuffle: number;
    mix: number;
}

export interface StutterParams {
    division: number;
    speed: number;
    feedback: number;
    mix: number;
}

export interface ReverbParams {
    size: number;
    damping: number;
    mod: number;
    mix: number;
}

export interface DJLooperParams {
    loopDivision: number;
    lengthMultiplier: number;
    fadeTime: number;
    mix: number;
}

export interface MasterCompressorParams {
    threshold: number;
    ratio: number;
    knee: number;
    attack: number;
    release: number;
}

export interface CompressorSnapshot {
    name: string;
    params: MasterCompressorParams;
}

export interface AppState {
    toastMessage: string | null;
    isInitialized: boolean;
    isLoading: boolean;
    activeView: string; 
    seqMode: 'PART' | 'PARAM' | 'REC';
    isPlaying: boolean;
    isRecording: boolean;
    isArmed: boolean;
    recordingThreshold: number;
    bpm: number;
    
    // Selection
    activeSampleBank: number;
    activeSampleId: number;
    selectedSeqStep: number | null;
    
    // Data
    samples: Sample[];
    sampleClipboard: Sample | null;
    laneClipboard: { steps: Step[]; paramLocks: Pattern['paramLocks'][number] } | null;
    bankClipboard: { sequences: Step[][]; paramLocks: Pattern['paramLocks']; grooveId: number; grooveDepth: number; } | null;
    patternClipboard: Pattern | null;
    patterns: Pattern[];
    activePatternIds: number[]; 
    
    // Global Musical Settings
    activeKey: number;
    activeScale: string;
    keyboardOctave: number;
    
    // Playback State
    currentSteps: number[]; 
    activeSequencerStep: number; 
    playbackTrackStates: { currentPart: 'A' | 'B'; partRepetition: number }[];
    
    // Grooves
    grooveDepths: number[]; 
    activeGrooveIds: number[]; 
    
    // Synth
    synth: Synth;
    synthModMatrix: ModMatrix;
    synthPresets: (SynthPreset | null)[];
    isModMatrixMuted: boolean;
    isModWheelLockMuted: boolean;
    
    // Mixer
    bankVolumes: number[];
    bankPans: number[];
    bankMutes: boolean[];
    bankSolos: boolean[];
    masterVolume: number;
    
    // Master FX
    masterCompressorOn: boolean;
    masterCompressorParams: MasterCompressorParams;
    compressorSnapshots: (CompressorSnapshot | null)[];
    isMasterRecording: boolean;
    isMasterRecArmed: boolean;
    
    // Performance FX
    performanceFx: PerformanceChain;
    
    // System
    audioContext: AudioContext | null;
    projectLoadCount: number;
}

export interface PlaybackParams {
    detune?: number;
    velocity?: number;
    volume?: number;
    pitch?: number;
    start?: number;
    end?: number;
    decay?: number;
    lpFreq?: number;
    hpFreq?: number;
    loop?: boolean;
    playbackMode?: 'Forward' | 'Reverse' | 'PingPong';
}

export interface SubTab {
    label: string;
    onClick: () => void;
    isActive: boolean;
    isSpecial?: boolean;
}

export interface BankPresetData {
    samples: Sample[];
    sequences: Step[][];
    paramLocks: Record<number, Pattern['paramLocks'][number]>;
    grooveId: number;
    grooveDepth: number;
}

export interface AutomationClock {
    position: number;
    bar: number;
}
