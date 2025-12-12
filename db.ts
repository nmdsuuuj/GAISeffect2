
import Dexie, { Table } from 'dexie';
import { AppState, Sample, Step, Pattern, SynthPreset } from './types';

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
    end: number; // NEW
    decay: number;
    loop: boolean; // NEW
    playbackMode: 'Forward' | 'Reverse' | 'PingPong'; // NEW
    lpFreq: number;
    hpFreq: number;
}

export interface Project {
  id?: number;
  name: string;
  createdAt: Date;
  state: Omit<AppState, 'audioContext' | 'isInitialized' | 'isPlaying' | 'isRecording' | 'currentSteps' | 'samples' | 'grooves' | 'isLoading'>;
  samples: StorableSample[];
}

export interface Session {
  id?: 0; // Always use ID 0 for the single session
  state: Omit<AppState, 'audioContext' | 'isInitialized' | 'isPlaying' | 'isRecording' | 'currentSteps' | 'samples' | 'grooves' | 'isLoading'>;
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
