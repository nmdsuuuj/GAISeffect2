
import Dexie, { Table } from 'dexie';
import { AppState, Sample, Step, Pattern, SynthPreset, Synth } from './types';

// We need to serialize AudioBuffer since it's not cloneable for IndexedDB.
// We'll store the raw channel data and sample rate.
export interface StorableSample {
    id: number;
    name: string;
    bufferData: {
        channelData: Float32Array[];
        sampleRate: number;
        length: number;
        numberOfChannels: number;
    } | null;
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

export interface Project {
  id?: number;
  name: string;
  createdAt: Date;
  state: Omit<AppState, 'audioContext' | 'isInitialized' | 'isPlaying' | 'isRecording' | 'currentSteps' | 'samples' | 'isLoading'>;
  samples: StorableSample[];
}

export interface Session {
  id?: 0; // Always use ID 0 for the single session
  state: Omit<AppState, 'audioContext' | 'isInitialized' | 'isPlaying' | 'isRecording' | 'currentSteps' | 'samples' | 'isLoading'>;
  samples: StorableSample[];
}


export interface SampleKit {
  id?: number;
  name: string;
  createdAt: Date;
  samples: StorableSample[];
}

export interface BankPreset {
  id?: number;
  name: string;
  createdAt: Date;
  samples: StorableSample[]; // Array of 8 samples
  sequences: Step[][]; // 8 lanes of steps from a pattern
  paramLocks: Record<number, Pattern['paramLocks'][number]>; // paramLocks for those 8 lanes, keys are 0-7
  grooveId: number;
  grooveDepth: number;
}

export interface BankKit {
  id?: number;
  name: string;
  createdAt: Date;
  samples: StorableSample[]; // Array of 8 samples
}

// FIX: Refactored to use a direct Dexie instance to avoid TypeScript errors with 'this.version' in the class constructor.
const dbInstance = new Dexie('GrooveSamplerDB') as Dexie & {
  projects: Table<Project>;
  sampleKits: Table<SampleKit>;
  bankPresets: Table<BankPreset>;
  bankKits: Table<BankKit>;
  session: Table<Session>; // New table for session state
  globalSynthPresets: Table<SynthPreset>; // New table for global synth presets
};

// Version 1 definition (for existing users)
dbInstance.version(1).stores({
  projects: '++id, name, createdAt',
  sampleKits: '++id, name, createdAt',
});

// Version 2 definition (adds the new table for bank presets)
dbInstance.version(2).stores({
  projects: '++id, name, createdAt',
  sampleKits: '++id, name, createdAt',
  bankPresets: '++id, name, createdAt',
});

// Version 3 definition (adds the new table for bank kits)
dbInstance.version(3).stores({
  projects: '++id, name, createdAt',
  sampleKits: '++id, name, createdAt',
  bankPresets: '++id, name, createdAt',
  bankKits: '++id, name, createdAt',
});

// Version 4 definition (adds updates for new sample properties, no schema change needed as they are just JSON fields in samples array, but bumping version is good practice)
dbInstance.version(4).stores({
  projects: '++id, name, createdAt',
  sampleKits: '++id, name, createdAt',
  bankPresets: '++id, name, createdAt',
  bankKits: '++id, name, createdAt',
});

// Version 5: Add session table for automatic persistence
dbInstance.version(5).stores({
  projects: '++id, name, createdAt',
  sampleKits: '++id, name, createdAt',
  bankPresets: '++id, name, createdAt',
  bankKits: '++id, name, createdAt',
  session: 'id', // Primary key is 'id', we will only use id: 0
});

// Version 6: Add global synth presets table
dbInstance.version(6).stores({
  projects: '++id, name, createdAt',
  sampleKits: '++id, name, createdAt',
  bankPresets: '++id, name, createdAt',
  bankKits: '++id, name, createdAt',
  session: 'id',
  globalSynthPresets: 'id', // Use slot index (0-127) as primary key
});

// --- Factory Presets ---
const FACTORY_PRESETS: SynthPreset[] = [
    { 
        id: 0, 
        name: 'Fat Saw Bass', 
        synth: { 
            osc1: { type: 'Saw Down', octave: -2, detune: -12, waveshapeType: 'Soft Clip', waveshapeAmount: 0.3, fmDepth: 0 }, 
            osc2: { type: 'Saw Down', octave: -2, detune: 12, waveshapeType: 'Soft Clip', waveshapeAmount: 0.3, fmDepth: 0 }, 
            oscMix: 0.5, 
            filter: { type: 'Lowpass 24dB', cutoff: 80, resonance: 4, envAmount: 7000 }, 
            filterEnv: { attack: 0.001, decay: 0.35, sustain: 0.01 }, 
            ampEnv: { decay: 0.4 }, 
            lfo1: { type: 'Sine', rate: 1, rateMode: 'hz', syncTrigger: 'Free' }, 
            lfo2: { type: 'Sine', rate: 1, rateMode: 'hz', syncTrigger: 'Free' }, 
            masterGain: 1, masterOctave: 0, modWheel: 0, modWheelOffset: 1 
        }, 
        modMatrix: {} 
    },
    { 
        id: 1, 
        name: 'FM Pluck Bass', 
        synth: { 
            osc1: { type: 'Sine', octave: -1, detune: 0, waveshapeType: 'Soft Clip', waveshapeAmount: 0, fmDepth: 3500 }, 
            osc2: { type: 'Sine', octave: 0, detune: 0, waveshapeType: 'Soft Clip', waveshapeAmount: 0, fmDepth: 0 }, 
            oscMix: 0.3, 
            filter: { type: 'Lowpass 12dB', cutoff: 20000, resonance: 0, envAmount: 0 }, 
            filterEnv: { attack: 0.001, decay: 0.3, sustain: 0 }, 
            ampEnv: { decay: 0.35 }, 
            lfo1: { type: 'Sine', rate: 1, rateMode: 'hz', syncTrigger: 'Free' }, 
            lfo2: { type: 'Sine', rate: 1, rateMode: 'hz', syncTrigger: 'Free' }, 
            masterGain: 1, masterOctave: 0, modWheel: 0, modWheelOffset: 1 
        }, 
        modMatrix: { filterEnv: { osc1FM: 0.9 } } 
    },
    { 
        id: 2, 
        name: 'Deep Sub', 
        synth: { 
            osc1: { type: 'Sine', octave: -2, detune: 0, waveshapeType: 'Soft Clip', waveshapeAmount: 0.5, fmDepth: 0 }, 
            osc2: { type: 'Square', octave: -2, detune: 5, waveshapeType: 'Soft Clip', waveshapeAmount: 0.2, fmDepth: 0 }, 
            oscMix: 0.4, 
            filter: { type: 'Lowpass 12dB', cutoff: 350, resonance: 0, envAmount: 1000 }, 
            filterEnv: { attack: 0.05, decay: 0.6, sustain: 0.0 }, 
            ampEnv: { decay: 0.8 }, 
            lfo1: { type: 'Sine', rate: 1, rateMode: 'hz', syncTrigger: 'Free' }, 
            lfo2: { type: 'Sine', rate: 1, rateMode: 'hz', syncTrigger: 'Free' }, 
            masterGain: 1.2, masterOctave: 0, modWheel: 0, modWheelOffset: 1 
        }, 
        modMatrix: {} 
    },
    { 
        id: 3, 
        name: 'Acid 303', 
        synth: { 
            osc1: { type: 'Saw Down', octave: -1, detune: 0, waveshapeType: 'Hard Clip', waveshapeAmount: 0.6, fmDepth: 0 }, 
            osc2: { type: 'Square', octave: -2, detune: 0, waveshapeType: 'Hard Clip', waveshapeAmount: 0.4, fmDepth: 0 }, 
            oscMix: 0.2, 
            filter: { type: 'Lowpass 24dB', cutoff: 200, resonance: 22, envAmount: 5500 }, 
            filterEnv: { attack: 0.001, decay: 0.3, sustain: 0.01 }, 
            ampEnv: { decay: 0.3 }, 
            lfo1: { type: 'Sine', rate: 1, rateMode: 'hz', syncTrigger: 'Free' }, 
            lfo2: { type: 'Sine', rate: 1, rateMode: 'hz', syncTrigger: 'Free' }, 
            masterGain: 1, masterOctave: 0, modWheel: 0, modWheelOffset: 1 
        }, 
        modMatrix: {} 
    },
    { 
        id: 4, 
        name: 'Reese Bass', 
        synth: { 
            osc1: { type: 'Saw Down', octave: -2, detune: -25, waveshapeType: 'Diode', waveshapeAmount: 0.4, fmDepth: 0 }, 
            osc2: { type: 'Saw Down', octave: -2, detune: 25, waveshapeType: 'Diode', waveshapeAmount: 0.4, fmDepth: 0 }, 
            oscMix: 0.5, 
            filter: { type: 'Lowpass 24dB', cutoff: 400, resonance: 2, envAmount: 0 }, 
            filterEnv: { attack: 0.05, decay: 0.8, sustain: 1 }, 
            ampEnv: { decay: 1.5 }, 
            lfo1: { type: 'Sine', rate: 6, rateMode: 'hz', syncTrigger: 'Free' }, 
            lfo2: { type: 'Sine', rate: 0.2, rateMode: 'hz', syncTrigger: 'Free' }, 
            masterGain: 1, masterOctave: 0, modWheel: 0, modWheelOffset: 1 
        }, 
        modMatrix: { lfo2: { filterCutoff: 0.3 } } 
    },
    { 
        id: 5, 
        name: 'Square Lead', 
        synth: { 
            osc1: { type: 'Square', octave: 0, detune: 0, waveshapeType: 'Soft Clip', waveshapeAmount: 0, fmDepth: 0 }, 
            osc2: { type: 'Square', octave: 1, detune: 5, waveshapeType: 'Soft Clip', waveshapeAmount: 0, fmDepth: 0 }, 
            oscMix: 0.4, 
            filter: { type: 'Lowpass 12dB', cutoff: 3000, resonance: 4, envAmount: 2000 }, 
            filterEnv: { attack: 0.001, decay: 0.15, sustain: 0.5 }, 
            ampEnv: { decay: 0.4 }, 
            lfo1: { type: 'Square', rate: 12, rateMode: 'sync', syncTrigger: 'Gate' }, 
            lfo2: { type: 'Sine', rate: 1, rateMode: 'hz', syncTrigger: 'Free' }, 
            masterGain: 1, masterOctave: 1, modWheel: 0, modWheelOffset: 1 
        }, 
        modMatrix: { lfo1: { filterCutoff: 0.15 } } 
    },
    { 
        id: 6, 
        name: 'Sync Hero', 
        synth: { 
            osc1: { type: 'Saw Down', octave: 0, detune: 0, waveshapeType: 'Soft Clip', waveshapeAmount: 0, fmDepth: 0, sync: true }, 
            osc2: { type: 'Saw Down', octave: 0, detune: 0, waveshapeType: 'Soft Clip', waveshapeAmount: 0, fmDepth: 0, pitchEnvAmount: 4800 }, 
            oscMix: 0.0, 
            filter: { type: 'Highpass 12dB', cutoff: 150, resonance: 0, envAmount: 0 }, 
            filterEnv: { attack: 0.001, decay: 0.6, sustain: 0 }, 
            ampEnv: { decay: 0.8 }, 
            lfo1: { type: 'Sine', rate: 1, rateMode: 'hz', syncTrigger: 'Free' }, 
            lfo2: { type: 'Sine', rate: 1, rateMode: 'hz', syncTrigger: 'Free' }, 
            masterGain: 1, masterOctave: 0, modWheel: 0, modWheelOffset: 1 
        }, 
        modMatrix: { filterEnv: { osc2Pitch: 0.7 } } 
    },
    { 
        id: 7, 
        name: 'Soft Pad', 
        synth: { 
            osc1: { type: 'Triangle', octave: 0, detune: -8, waveshapeType: 'Soft Clip', waveshapeAmount: 0, fmDepth: 0 }, 
            osc2: { type: 'Sine', octave: 0, detune: 8, waveshapeType: 'Soft Clip', waveshapeAmount: 0, fmDepth: 0 }, 
            oscMix: 0.5, 
            filter: { type: 'Lowpass 12dB', cutoff: 600, resonance: 0, envAmount: 400 }, 
            filterEnv: { attack: 0.8, decay: 1.5, sustain: 0.6 }, 
            ampEnv: { decay: 2.0 }, 
            lfo1: { type: 'Sine', rate: 0.5, rateMode: 'hz', syncTrigger: 'Free' }, 
            lfo2: { type: 'Sine', rate: 1, rateMode: 'hz', syncTrigger: 'Free' }, 
            masterGain: 1, masterOctave: 0, modWheel: 0, modWheelOffset: 1 
        }, 
        modMatrix: { lfo1: { filterCutoff: 0.2 } } 
    },
    { 
        id: 8, 
        name: 'Dark Bass', 
        synth: { 
            osc1: { type: 'Saw Down', octave: -2, detune: -5, waveshapeType: 'Soft Clip', waveshapeAmount: 0.2, fmDepth: 0 }, 
            osc2: { type: 'Triangle', octave: -1, detune: 5, waveshapeType: 'Soft Clip', waveshapeAmount: 0, fmDepth: 0 }, 
            oscMix: 0.6, 
            filter: { type: 'Lowpass 24dB', cutoff: 250, resonance: 2, envAmount: 1200 }, 
            filterEnv: { attack: 0.05, decay: 0.4, sustain: 0.0 }, 
            ampEnv: { decay: 0.5 }, 
            lfo1: { type: 'Sine', rate: 0.1, rateMode: 'hz', syncTrigger: 'Free' }, 
            lfo2: { type: 'Sine', rate: 1, rateMode: 'hz', syncTrigger: 'Free' }, 
            masterGain: 1, masterOctave: 0, modWheel: 0, modWheelOffset: 1 
        }, 
        modMatrix: {} 
    },
    { 
        id: 9, 
        name: 'Vowel Bass', 
        synth: { 
            osc1: { type: 'Saw Down', octave: -1, detune: 0, waveshapeType: 'Bitcrush', waveshapeAmount: 0.2, fmDepth: 0 }, 
            osc2: { type: 'Square', octave: -1, detune: 10, waveshapeType: 'Soft Clip', waveshapeAmount: 0, fmDepth: 0 }, 
            oscMix: 0.5, 
            filter: { type: 'Formant Vowel', cutoff: 400, resonance: 5, envAmount: 2500 }, 
            filterEnv: { attack: 0.1, decay: 0.5, sustain: 0.2 }, 
            ampEnv: { decay: 0.6 }, 
            lfo1: { type: 'Sine', rate: 3, rateMode: 'hz', syncTrigger: 'Free' }, 
            lfo2: { type: 'Sine', rate: 1, rateMode: 'hz', syncTrigger: 'Free' }, 
            masterGain: 1, masterOctave: 0, modWheel: 0, modWheelOffset: 1 
        }, 
        modMatrix: { lfo1: { filterCutoff: 0.25 } } 
    },
    { 
        id: 10, 
        name: 'Zap FX', 
        synth: { 
            osc1: { type: 'Sine', octave: 2, detune: 0, waveshapeType: 'Soft Clip', waveshapeAmount: 0, fmDepth: 0 }, 
            osc2: { type: 'Sine', octave: 2, detune: 0, waveshapeType: 'Soft Clip', waveshapeAmount: 0, fmDepth: 0 }, 
            oscMix: 0.0, 
            filter: { type: 'Lowpass 24dB', cutoff: 20000, resonance: 0, envAmount: 0 }, 
            filterEnv: { attack: 0.001, decay: 0.15, sustain: 0 }, 
            ampEnv: { decay: 0.15 }, 
            lfo1: { type: 'Sine', rate: 1, rateMode: 'hz', syncTrigger: 'Free' }, 
            lfo2: { type: 'Sine', rate: 1, rateMode: 'hz', syncTrigger: 'Free' }, 
            masterGain: 1, masterOctave: 0, modWheel: 0, modWheelOffset: 1 
        }, 
        modMatrix: { filterEnv: { osc1Pitch: 0.9 } } 
    },
    { 
        id: 11, 
        name: 'Noise Sweep', 
        synth: { 
            osc1: { type: 'Noise', octave: 0, detune: 0, waveshapeType: 'Soft Clip', waveshapeAmount: 0, fmDepth: 0 }, 
            osc2: { type: 'Noise', octave: 0, detune: 0, waveshapeType: 'Soft Clip', waveshapeAmount: 0, fmDepth: 0 }, 
            oscMix: 0.0, 
            filter: { type: 'Bandpass 12dB', cutoff: 100, resonance: 15, envAmount: 8000 }, 
            filterEnv: { attack: 1.0, decay: 2.0, sustain: 0 }, 
            ampEnv: { decay: 3.0 }, 
            lfo1: { type: 'Sine', rate: 1, rateMode: 'hz', syncTrigger: 'Free' }, 
            lfo2: { type: 'Sine', rate: 1, rateMode: 'hz', syncTrigger: 'Free' }, 
            masterGain: 1, masterOctave: 0, modWheel: 0, modWheelOffset: 1 
        }, 
        modMatrix: {} 
    },
    { 
        id: 12, 
        name: 'Riser FX', 
        synth: { 
            osc1: { type: 'Saw Up', octave: -1, detune: 0, waveshapeType: 'Soft Clip', waveshapeAmount: 0, fmDepth: 0 }, 
            osc2: { type: 'Saw Up', octave: -1, detune: 15, waveshapeType: 'Soft Clip', waveshapeAmount: 0, fmDepth: 0 }, 
            oscMix: 0.5, 
            filter: { type: 'Highpass 12dB', cutoff: 50, resonance: 0, envAmount: 0 }, 
            filterEnv: { attack: 0.01, decay: 0.1, sustain: 1 }, 
            ampEnv: { decay: 4.0 }, 
            lfo1: { type: 'Ramp Up', rate: 4, rateMode: 'sync', syncTrigger: 'Gate' }, 
            lfo2: { type: 'Sine', rate: 1, rateMode: 'hz', syncTrigger: 'Free' }, 
            masterGain: 1, masterOctave: 0, modWheel: 0, modWheelOffset: 1 
        }, 
        modMatrix: { lfo1: { osc1Pitch: 0.7, osc2Pitch: 0.7, filterCutoff: 0.5 } } 
    },
    { 
        id: 13, 
        name: 'Wobble Bass', 
        synth: { 
            osc1: { type: 'Square', octave: -2, detune: 0, waveshapeType: 'Tube', waveshapeAmount: 0.5, fmDepth: 0 }, 
            osc2: { type: 'Sine', octave: -1, detune: 0, waveshapeType: 'Tube', waveshapeAmount: 0.5, fmDepth: 500 }, 
            oscMix: 0.6, 
            filter: { type: 'Lowpass 24dB', cutoff: 150, resonance: 10, envAmount: 0 }, 
            filterEnv: { attack: 0.01, decay: 0.2, sustain: 1 }, 
            ampEnv: { decay: 0.8 }, 
            lfo1: { type: 'Sine', rate: 1, rateMode: 'sync', syncTrigger: 'Free' }, 
            lfo2: { type: 'Sine', rate: 1, rateMode: 'hz', syncTrigger: 'Free' }, 
            masterGain: 1, masterOctave: 0, modWheel: 0, modWheelOffset: 1 
        }, 
        modMatrix: { lfo1: { filterCutoff: 0.8 } } 
    },
    { 
        id: 14, 
        name: 'Lo-Fi Keys', 
        synth: { 
            osc1: { type: 'Triangle', octave: 0, detune: 0, waveshapeType: 'Bitcrush', waveshapeAmount: 0.3, fmDepth: 0 }, 
            osc2: { type: 'Sine', octave: 1, detune: 5, waveshapeType: 'Soft Clip', waveshapeAmount: 0, fmDepth: 0 }, 
            oscMix: 0.6, 
            filter: { type: 'Lowpass 12dB', cutoff: 1500, resonance: 0, envAmount: -500 }, 
            filterEnv: { attack: 0.05, decay: 0.5, sustain: 0 }, 
            ampEnv: { decay: 1.2 }, 
            lfo1: { type: 'Sine', rate: 0.5, rateMode: 'hz', syncTrigger: 'Free' }, 
            lfo2: { type: 'Sine', rate: 1, rateMode: 'hz', syncTrigger: 'Free' }, 
            masterGain: 1, masterOctave: 0, modWheel: 0, modWheelOffset: 1 
        }, 
        modMatrix: { lfo1: { osc1Pitch: 0.02 } } 
    },
    { 
        id: 15, 
        name: 'Tech Bass', 
        synth: { 
            osc1: { type: 'Sine', octave: -1, detune: 0, waveshapeType: 'Hard Clip', waveshapeAmount: 0.2, fmDepth: 4000 }, 
            osc2: { type: 'Square', octave: -2, detune: 0, waveshapeType: 'Soft Clip', waveshapeAmount: 0.2, fmDepth: 0 }, 
            oscMix: 0.4, 
            filter: { type: 'Lowpass 24dB', cutoff: 100, resonance: 5, envAmount: 4000 }, 
            filterEnv: { attack: 0.001, decay: 0.2, sustain: 0 }, 
            ampEnv: { decay: 0.25 }, 
            lfo1: { type: 'Sine', rate: 12, rateMode: 'sync', syncTrigger: 'Free' }, 
            lfo2: { type: 'Sine', rate: 1, rateMode: 'hz', syncTrigger: 'Free' }, 
            masterGain: 1, masterOctave: 0, modWheel: 0, modWheelOffset: 1 
        }, 
        modMatrix: { filterEnv: { osc1FM: 0.5 } } 
    },
];

// Seed the database if empty
dbInstance.on('ready', async () => {
    const count = await dbInstance.globalSynthPresets.count();
    if (count === 0) {
        await dbInstance.globalSynthPresets.bulkAdd(FACTORY_PRESETS);
        console.log("Seeded Factory Synth Presets");
    }
});


export const db = dbInstance;

// --- Centralized Helper Functions ---

export const audioBufferToStorable = (buffer: AudioBuffer | null): StorableSample['bufferData'] => {
    if (!buffer) return null;
    const channelData: Float32Array[] = [];
    for (let i = 0; i < buffer.numberOfChannels; i++) {
        channelData.push(buffer.getChannelData(i));
    }
    return {
        channelData,
        sampleRate: buffer.sampleRate,
        length: buffer.length,
        numberOfChannels: buffer.numberOfChannels,
    };
};

export const storableToAudioBuffer = (storable: StorableSample['bufferData'] | null, audioContext: AudioContext): AudioBuffer | null => {
    if (!storable) return null;
    try {
        const buffer = audioContext.createBuffer(
            storable.numberOfChannels,
            storable.length,
            storable.sampleRate
        );
        for (let i = 0; i < storable.numberOfChannels; i++) {
            buffer.copyToChannel(storable.channelData[i], i);
        }
        return buffer;
    } catch (e) {
        console.error("Error creating AudioBuffer from stored data:", e);
        return null;
    }
};
