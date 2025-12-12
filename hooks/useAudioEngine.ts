import { useContext, useRef, useCallback, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { ActionType, Sample, PlaybackParams, BiquadFilterType, Synth } from '../types';
import { PADS_PER_BANK, TOTAL_BANKS, TOTAL_SAMPLES, LFO_SYNC_RATES, MOD_SOURCES, MOD_DESTINATIONS, LFO_SYNC_TRIGGERS, OSC_WAVEFORMS } from '../constants';
import { useFxChain } from './useFxChain';
import { makeDistortionCurve } from '../utils/audio';

// --- Safety Helpers ---
// Ensures a value is a finite number. Fallback ensures audio engine never receives NaN.
const safe = (val: any, fallback: number = 0): number => {
    const n = Number(val);
    return (Number.isFinite(n) && !Number.isNaN(n)) ? n : fallback;
};

// Safe wrapper for setTargetAtTime to prevent crashes and ensure zero values are reached
const setTarget = (param: AudioParam, value: number, time: number, timeConstant: number) => {
    if (!param) return;
    const v = safe(value, 0);
    const t = safe(time, 0);
    const tc = Math.max(0.001, safe(timeConstant, 0.01)); // Prevent division by zero or negative time constants
    
    try {
        if (Number.isFinite(v) && Number.isFinite(t) && Number.isFinite(tc)) {
            // Standard exponential approach
            param.setTargetAtTime(v, t, tc);
            
            // FIX: setTargetAtTime is asymptotic and never reaches strictly 0. 
            // This causes "bleed" where modulation or volume never fully cuts off.
            // If the target is effectively 0, we schedule a hard set to 0 after the transition 
            // has mostly settled (approx 6 time constants covers >99.7% of the change).
            if (Math.abs(v) < 1e-5) {
                param.setValueAtTime(0, t + (tc * 6));
            }
        }
    } catch (e) {
        // Suppress audio param errors to keep app running
    }
};

const setValue = (param: AudioParam, value: number, time: number) => {
    if (!param) return;
    try {
        param.setValueAtTime(safe(value, 0), safe(time, 0));
    } catch(e) {}
};

// Type for the persistent synth graph nodes
type SynthGraphNodes = {
    oscSource1: OscillatorNode | AudioBufferSourceNode;
    oscSource2: OscillatorNode | AudioBufferSourceNode;
    osc1Gain: GainNode;
    osc2Gain: GainNode;
    shaper1: WaveShaperNode;
    shaper1InputGain: GainNode;
    shaper2: WaveShaperNode;
    shaper2InputGain: GainNode;
    mixer: GainNode;
    fm1Gain: GainNode; // Modulates osc1 freq (Amount is controlled by osc2.fmDepth)
    fm2Gain: GainNode; // Modulates osc2 freq (Amount is controlled by osc1.fmDepth)
    preFilterGain: GainNode; // Gain before standard filters
    filterNode1: BiquadFilterNode;
    filterNode2: BiquadFilterNode;
    // For new filters
    combDelay: DelayNode;
    combFeedbackGain: GainNode;
    combInGain: GainNode;
    combOutGain: GainNode;
    formantInGain: GainNode;
    formantFilters: BiquadFilterNode[];
    formantOutGain: GainNode;
    vca: GainNode;
    masterSynthGain: GainNode;
    
    // LFOs
    lfo1: OscillatorNode;
    lfo2: OscillatorNode;
    lfo1Output: GainNode; // Master output for LFO1 (allows easy swapping/retriggering)
    lfo2Output: GainNode; // Master output for LFO2
    
    // Matrix Scalers (Controlled by Mod Wheel)
    lfo1MatrixScaler: GainNode;
    lfo2MatrixScaler: GainNode;
    envMatrixScaler: GainNode;

    modGains: { [key: string]: GainNode }; // For LFO -> destination modulation
    lfo1_ws1_modGain: GainNode;
    lfo1_ws2_modGain: GainNode;
    // Envelope Source for Mod Matrix
    filterEnvSource: ConstantSourceNode;
    filterEnvGain: GainNode;
    filterDedicatedEnvGain: GainNode; // For the "Env Amount" knob
    // Mod Wheel Source
    modWheelSource: ConstantSourceNode; // Switched back to ConstantSourceNode for stability
    modWheelGain: GainNode; // Controls the intensity of the wheel
    // Analysers for Visualization
    lfo1Analyser: AnalyserNode;
    lfo2Analyser: AnalyserNode;
};

const noiseBufferCache = new Map<string, AudioBuffer>();

const createOscillatorSource = (type: string, audioContext: AudioContext): OscillatorNode | AudioBufferSourceNode => {
    // Noise / Glitch Handling
    if (type === 'Noise' || type === 'Glitch') {
         if (noiseBufferCache.has(type)) {
            const source = audioContext.createBufferSource();
            source.buffer = noiseBufferCache.get(type)!;
            source.loop = true;
            source.start(0); // Ensure start is called for AudioBufferSourceNode
            return source;
        }
        const bufferSize = audioContext.sampleRate * 2;
        const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const output = buffer.getChannelData(0);
        if (type === 'Noise') {
             for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
        } else { // Glitch
            let last = 0;
            for (let i = 0; i < bufferSize; i++) {
                if (Math.random() < 0.005) last = Math.random() * 2 - 1;
                output[i] = last;
            }
        }
        noiseBufferCache.set(type, buffer);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.start(0); // Ensure start is called for AudioBufferSourceNode
        return source;
    }

    const osc = audioContext.createOscillator();
    const standardTypes: { [key: string]: OscillatorType } = {
        'Sine': 'sine', 'Square': 'square', 'Saw Down': 'sawtooth', 'Triangle': 'triangle',
        'Saw Up': 'sawtooth' // saw up logic handled by detune/inversion if needed, or just standard saw
    };
    if (standardTypes[type]) {
        osc.type = standardTypes[type];
    } else {
        // Fallback for types not natively supported (Pulse etc) mapped to nearest or Saw
        osc.type = 'sawtooth';
    }
    return osc;
};


// --- Main Hook ---
export const useAudioEngine = () => {
    const { state, dispatch } = useContext(AppContext);
    const { audioContext, samples, bankVolumes, bankPans, bankMutes, bankSolos, isRecording, isArmed, recordingThreshold, activeSampleId, masterVolume, masterCompressorOn, masterCompressorParams, synth, synthModMatrix } = state;
    
    // --- FX CHAIN INTEGRATION ---
    const fxChain = useFxChain();

    const masterGainRef = useRef<GainNode | null>(null);
    const masterCompressorRef = useRef<DynamicsCompressorNode | null>(null);
    const masterClipperRef = useRef<WaveShaperNode | null>(null);
    const bankGainsRef = useRef<GainNode[]>([]);
    const bankPannersRef = useRef<StereoPannerNode[]>([]);
    const sampleGainsRef = useRef<GainNode[]>([]);
    const lpFilterNodesRef = useRef<BiquadFilterNode[]>([]);
    const hpFilterNodesRef = useRef<BiquadFilterNode[]>([]);
    const activeSourcesRef = useRef<Map<number, Set<AudioBufferSourceNode>>>(new Map());
    
    // --- RECORDING REFS ---
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const monitoringNodeRef = useRef<ScriptProcessorNode | null>(null); // Keep for potential future use or debugging
    const masterRecorderRef = useRef<MediaRecorder | null>(null);
    const masterChunksRef = useRef<Blob[]>([]);
    const masterDestNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);
    const currentMicStreamRef = useRef<MediaStream | null>(null); // Reference to the active mic stream
    const currentMicSourceRef = useRef<MediaStreamAudioSourceNode | null>(null); // Reference to the active mic source
    const currentScriptProcessorRef = useRef<ScriptProcessorNode | null>(null); // Reference to the active script processor for arming

    // --- MONO SYNTH REFS ---
    const synthGraphRef = useRef<{
        nodes: SynthGraphNodes;
        osc1Type: string;
        osc2Type: string;
    } | null>(null);

    const lfoAnalysersRef = useRef<{ lfo1: AnalyserNode | null; lfo2: AnalyserNode | null }>({ lfo1: null, lfo2: null });

    const stateRef = useRef(state);
    useEffect(() => {
        stateRef.current = state;
    }, [state]);
    
    // --- 1. Initialize Core Audio Graph (Master & Banks) ---
    useEffect(() => {
        if (audioContext && masterGainRef.current === null && fxChain.inputNode && fxChain.outputNode) {
            // Master Compressor
            const compressor = audioContext.createDynamicsCompressor();
            masterCompressorRef.current = compressor;

            // Master Safety Clipper
            const clipper = audioContext.createWaveShaper();
            const robustCurve = new Float32Array(4096);
            for (let i = 0; i < 4096; i++) {
                const x = (i - 2048) / 2048;
                robustCurve[i] = Math.tanh(x);
            }
            clipper.curve = robustCurve;
            masterClipperRef.current = clipper;

             // Master Gain
            const masterGain = audioContext.createGain();
            masterGain.connect(audioContext.destination);
            masterGainRef.current = masterGain;

            // Connect Chain: FX Chain -> Compressor -> Clipper -> Master Gain
            fxChain.outputNode.connect(compressor);
            compressor.connect(clipper);
            clipper.connect(masterGain);

            // Create Bank Channels
            const bankGains: GainNode[] = [];
            const bankPanners: StereoPannerNode[] = [];

            for (let i = 0; i < TOTAL_BANKS; i++) {
                const gainNode = audioContext.createGain();
                const pannerNode = audioContext.createStereoPanner();
                
                gainNode.connect(pannerNode);
                pannerNode.connect(fxChain.inputNode); 

                bankGains.push(gainNode);
                bankPanners.push(pannerNode);
            }
            bankGainsRef.current = bankGains;
            bankPannersRef.current = bankPanners;
            
            // Sample Channels (Filters & Gains)
            const lpFilters: BiquadFilterNode[] = [];
            const hpFilters: BiquadFilterNode[] = [];
            const sampleGains: GainNode[] = [];
            for (let i = 0; i < TOTAL_SAMPLES; i++) {
                const lpFilter = audioContext.createBiquadFilter();
                lpFilter.type = 'lowpass';
                lpFilter.frequency.value = safe(state.samples[i].lpFreq, 20000);
                lpFilter.Q.value = 1;

                const hpFilter = audioContext.createBiquadFilter();
                hpFilter.type = 'highpass';
                hpFilter.frequency.value = safe(state.samples[i].hpFreq, 20);
                hpFilter.Q.value = 1;

                const sampleGainNode = audioContext.createGain();
                sampleGainNode.gain.value = safe(state.samples[i].volume, 1);
                
                const bankIndex = Math.floor(i / PADS_PER_BANK);
                if (bankGains[bankIndex]) {
                    lpFilter.connect(hpFilter);
                    hpFilter.connect(sampleGainNode);
                    sampleGainNode.connect(bankGains[bankIndex]);
                }

                lpFilters.push(lpFilter);
                hpFilters.push(hpFilter);
                sampleGains.push(sampleGainNode);
            }
            lpFilterNodesRef.current = lpFilters;
            hpFilterNodesRef.current = hpFilters;
            sampleGainsRef.current = sampleGains;
        }
    }, [audioContext, fxChain.inputNode]);

    // --- 1.5 Update Bank Volumes (Reactive) ---
    useEffect(() => {
        if (!audioContext || bankGainsRef.current.length === 0) return;
        const now = audioContext.currentTime;
        const RAMP = 0.02;

        if (masterGainRef.current) {
            setTarget(masterGainRef.current.gain, safe(masterVolume, 1), now, RAMP);
        }

        const anySolo = bankSolos.some(s => s);

        for (let i = 0; i < TOTAL_BANKS; i++) {
            const gainNode = bankGainsRef.current[i];
            const pannerNode = bankPannersRef.current[i];
            
            if (gainNode && pannerNode) {
                setTarget(pannerNode.pan, safe(bankPans[i], 0), now, RAMP);
                let targetGain = safe(bankVolumes[i], 1);
                const isMuted = bankMutes[i];
                const isSoloed = bankSolos[i];

                if (anySolo) {
                    if (!isSoloed) targetGain = 0;
                } else {
                    if (isMuted) targetGain = 0;
                }
                setTarget(gainNode.gain, targetGain, now, RAMP);
            }
        }
    }, [audioContext, bankVolumes, bankPans, bankMutes, bankSolos, masterVolume]);

    // --- EFFECT: Handle Master Compressor ---
    useEffect(() => {
        if (!audioContext || !masterCompressorRef.current) return;

        const compressor = masterCompressorRef.current;
        const now = audioContext.currentTime;
        const RAMP = 0.02; // Short ramp time for smooth changes

        if (masterCompressorOn) {
            setTarget(compressor.threshold, safe(masterCompressorParams.threshold, -24), now, RAMP);
            setTarget(compressor.knee, safe(masterCompressorParams.knee, 30), now, RAMP);
            setTarget(compressor.ratio, safe(masterCompressorParams.ratio, 12), now, RAMP);
            setTarget(compressor.attack, safe(masterCompressorParams.attack, 0.003), now, 0.01);
            setTarget(compressor.release, safe(masterCompressorParams.release, 0.25), now, 0.01);
        } else {
            // Bypass by setting to neutral values
            setTarget(compressor.threshold, 0, now, RAMP);
            setTarget(compressor.knee, 0, now, RAMP);
            setTarget(compressor.ratio, 1, now, RAMP);
            setTarget(compressor.attack, 0, now, 0.01);
            setTarget(compressor.release, 0.05, now, 0.01); 
        }

    }, [audioContext, masterCompressorOn, masterCompressorParams]);


    // --- 2. Initialize Persistent Synth Graph (Separate Effect) ---
    useEffect(() => {
        // Rebuild graph if context exists, banks are ready, or source count changes.
        if (audioContext && bankGainsRef.current.length > 3) {
            
            // Clean up existing graph if it exists to allow rebuilding
            if (synthGraphRef.current) {
                 const { nodes } = synthGraphRef.current;
                 try { nodes.masterSynthGain.disconnect(); } catch(e){}
            }

            const ctx = audioContext;
            const oscSource1 = createOscillatorSource(state.synth.osc1.type, ctx);
            const oscSource2 = createOscillatorSource(state.synth.osc2.type, ctx);
            const osc1Gain = ctx.createGain();
            const osc2Gain = ctx.createGain();
            const shaper1 = ctx.createWaveShaper();
            const shaper1InputGain = ctx.createGain();
            const shaper2 = ctx.createWaveShaper();
            const shaper2InputGain = ctx.createGain();
            const mixer = ctx.createGain();
            const fm1Gain = ctx.createGain();
            const fm2Gain = ctx.createGain();
            
            // FIX: Initialize routing gains to 0 explicitly to prevent initial signal bleed or feedback loops
            const preFilterGain = ctx.createGain();
            preFilterGain.gain.value = 0; 

            const filterNode1 = ctx.createBiquadFilter();
            const filterNode2 = ctx.createBiquadFilter();
            const vca = ctx.createGain();
            const masterSynthGain = ctx.createGain();
            
            // LFOs with output buffers
            const lfo1 = ctx.createOscillator();
            const lfo2 = ctx.createOscillator();
            const lfo1Output = ctx.createGain();
            const lfo2Output = ctx.createGain();
            lfo1.connect(lfo1Output);
            lfo2.connect(lfo2Output);

            const lfo1_ws1_modGain = ctx.createGain();
            const lfo1_ws2_modGain = ctx.createGain();
            const lfo1Analyser = ctx.createAnalyser();
            const lfo2Analyser = ctx.createAnalyser();
            
            // Filters
            const combDelay = ctx.createDelay(1.0);
            
            // FIX: IMPORTANT! Initialize Comb Feedback to 0 immediately.
            // Default gain is 1. If connected in a loop, this creates infinite feedback instantly upon creation.
            const combFeedbackGain = ctx.createGain();
            combFeedbackGain.gain.value = 0; 
            
            // FIX: Initialize routing gains to 0
            const combInGain = ctx.createGain();
            combInGain.gain.value = 0;
            const combOutGain = ctx.createGain();
            combOutGain.gain.value = 0;
            const formantInGain = ctx.createGain();
            formantInGain.gain.value = 0;
            const formantOutGain = ctx.createGain();
            formantOutGain.gain.value = 0;

            const formantFilters = [ctx.createBiquadFilter(), ctx.createBiquadFilter(), ctx.createBiquadFilter()];
            

            // Filter Env dedicated path
            const filterEnvSource = ctx.createConstantSource();
            filterEnvSource.offset.value = 1;
            const filterEnvGain = ctx.createGain();
            filterEnvGain.gain.value = 0;
            filterEnvSource.connect(filterEnvGain);
            filterEnvSource.start();
            
            // Dedicated "Env Amount" Gain (Direct path, not matrix scaled)
            const filterDedicatedEnvGain = ctx.createGain();
            filterEnvGain.connect(filterDedicatedEnvGain);
            filterDedicatedEnvGain.connect(filterNode1.detune);
            filterDedicatedEnvGain.connect(filterNode2.detune);

            // Mod Wheel Source - Use ConstantSourceNode for robustness
            const modWheelSource = ctx.createConstantSource();
            modWheelSource.offset.value = 1;
            modWheelSource.start();
            
            const modWheelGain = ctx.createGain(); 
            modWheelGain.gain.value = 0; // Will be set reactively
            modWheelSource.connect(modWheelGain);

            // --- Matrix Scalers ---
            // These allow the Mod Wheel to globally scale the output of mod sources feeding the matrix
            const lfo1MatrixScaler = ctx.createGain();
            lfo1MatrixScaler.gain.value = 0; // Value starts at 0, ModWheel signal adds 0-1 to it.
            const lfo2MatrixScaler = ctx.createGain();
            lfo2MatrixScaler.gain.value = 0;
            const envMatrixScaler = ctx.createGain();
            envMatrixScaler.gain.value = 0;

            // Connect Sources to Scalers
            lfo1Output.connect(lfo1MatrixScaler);
            lfo2Output.connect(lfo2MatrixScaler);
            filterEnvGain.connect(envMatrixScaler);

            // Connect Mod Wheel Gain to Scalers (Control Voltage)
            // Since scalers base gain is 0, adding ModWheel signal (0-1) effectively multiplies source by wheel.
            modWheelGain.connect(lfo1MatrixScaler.gain);
            modWheelGain.connect(lfo2MatrixScaler.gain);
            modWheelGain.connect(envMatrixScaler.gain);

            // Connections
            oscSource1.connect(shaper1InputGain);
            shaper1InputGain.connect(shaper1);
            shaper1.connect(osc1Gain);
            osc1Gain.connect(mixer);

            oscSource2.connect(shaper2InputGain);
            shaper2InputGain.connect(shaper2);
            shaper2.connect(osc2Gain);
            osc2Gain.connect(mixer);
            
            mixer.connect(preFilterGain);
            mixer.connect(combInGain);
            mixer.connect(formantInGain);

            preFilterGain.connect(filterNode1);
            filterNode1.connect(filterNode2);
            filterNode2.connect(vca);

            combInGain.connect(combDelay);
            combDelay.connect(combFeedbackGain);
            combFeedbackGain.connect(combDelay);
            combDelay.connect(combOutGain);
            combOutGain.connect(vca);
            
            formantFilters.forEach(f => {
                formantInGain.connect(f);
                f.connect(formantOutGain);
            });
            formantOutGain.connect(vca);

            vca.connect(masterSynthGain);
            if (bankGainsRef.current[3]) {
                masterSynthGain.connect(bankGainsRef.current[3]);
            }

            // Ensure VCA starts silent
            vca.gain.value = 0;

            const modGains: { [key: string]: GainNode } = {};
            // Initial FM Connections
            if (oscSource1 instanceof OscillatorNode) fm1Gain.connect(oscSource1.frequency);
            if (oscSource2 instanceof OscillatorNode) fm2Gain.connect(oscSource2.frequency);
            // Cross mod logic: Osc 1 -> FM2 (modulates Osc 2), Osc 2 -> FM1 (modulates Osc 1)
            oscSource1.connect(fm2Gain);
            oscSource2.connect(fm1Gain);

            MOD_SOURCES.forEach(source => {
                // Determine source node - use the SCALED version
                let modSourceNode: AudioNode;
                if (source === 'lfo1') modSourceNode = lfo1MatrixScaler; 
                else if (source === 'lfo2') modSourceNode = lfo2MatrixScaler; 
                else if (source === 'filterEnv') modSourceNode = envMatrixScaler;
                else modSourceNode = lfo1MatrixScaler; // Fallback

                MOD_DESTINATIONS.forEach(dest => {
                    const gainNode = ctx.createGain();
                    gainNode.gain.value = 0;
                    modGains[`${source}_${dest}`] = gainNode;
                    modSourceNode.connect(gainNode);

                    if (dest === 'osc1Pitch' && oscSource1 instanceof OscillatorNode) gainNode.connect(oscSource1.detune);
                    if (dest === 'osc2Pitch' && oscSource2 instanceof OscillatorNode) gainNode.connect(oscSource2.detune);
                    if (dest === 'osc1FM') gainNode.connect(fm1Gain.gain);
                    if (dest === 'osc2FM') gainNode.connect(fm2Gain.gain);
                    if (dest === 'osc1Wave') gainNode.connect(shaper1InputGain.gain);
                    if (dest === 'osc2Wave') gainNode.connect(shaper2InputGain.gain);
                    if (dest === 'filterCutoff') {
                        gainNode.connect(filterNode1.detune);
                        gainNode.connect(filterNode2.detune);
                    }
                    if (dest === 'filterQ') {
                         gainNode.connect(filterNode1.Q);
                         gainNode.connect(filterNode2.Q);
                    }
                });
            });
            
            lfo1_ws1_modGain.gain.value = 0;
            lfo1_ws2_modGain.gain.value = 0;
            lfo1Output.connect(lfo1_ws1_modGain);
            lfo1Output.connect(lfo1_ws2_modGain);
            lfo1_ws1_modGain.connect(shaper1InputGain.gain);
            lfo1_ws2_modGain.connect(shaper2InputGain.gain);
            
            lfo1Output.connect(lfo1Analyser);
            lfo2Output.connect(lfo2Analyser);

            // Start Oscillators
            lfo1.start();
            lfo2.start();
            try {
                if (oscSource1 instanceof OscillatorNode) oscSource1.start();
                if (oscSource2 instanceof OscillatorNode) oscSource2.start();
            } catch(e) {}

            // FIX: IMMEDIATE STATE APPLICATION
            // Apply current synth state parameters to the graph immediately after creation.
            // This prevents the "silent start" issue where nodes wait for the next render cycle to get values.
            const now = ctx.currentTime;
            
            // 1. Filter Settings (Crucial for silence issue)
            const cutoff = safe(state.synth.filter.cutoff, 20000);
            const q = Math.min(20, safe(state.synth.filter.resonance, 1));
            filterNode1.frequency.value = cutoff;
            filterNode2.frequency.value = cutoff;
            filterNode1.Q.value = q;
            filterNode2.Q.value = q;
            
            // 2. Routing based on Filter Type
            const fType = state.synth.filter.type;
            if (fType.startsWith('Comb')) {
                preFilterGain.gain.value = 0;
                combInGain.gain.value = 1;
                combOutGain.gain.value = 1;
                const resFactor = Math.min(0.99, safe(state.synth.filter.resonance) / 30 * 0.99);
                combFeedbackGain.gain.value = fType === 'Comb-' ? -resFactor : resFactor;
                const delayTime = 1 / Math.max(20, safe(state.synth.filter.cutoff, 440));
                combDelay.delayTime.value = delayTime;
            } else if (fType === 'Formant Vowel') {
                preFilterGain.gain.value = 0;
                formantInGain.gain.value = 1;
                formantOutGain.gain.value = 1;
                // Basic formant mapping
                const c = safe(state.synth.filter.cutoff, 1000);
                formantFilters[0].frequency.value = c;
                formantFilters[1].frequency.value = c * 2.5;
                formantFilters[2].frequency.value = c * 3.5;
            } else {
                // Standard Filters
                preFilterGain.gain.value = 1;
                combInGain.gain.value = 0;
                formantInGain.gain.value = 0;
                
                const typeMap: Record<string, BiquadFilterType> = {
                    'Lowpass 12dB': 'lowpass', 'Lowpass 24dB': 'lowpass',
                    'Highpass 12dB': 'highpass', 'Highpass 24dB': 'highpass',
                    'Bandpass 12dB': 'bandpass', 'Bandpass 24dB': 'bandpass',
                    'Notch': 'notch', 'Allpass': 'allpass', 'Peak': 'peaking'
                };
                const nativeType = typeMap[fType] || 'lowpass';
                filterNode1.type = nativeType;
                filterNode2.type = nativeType;
            }

            // 3. Mix
            const mix = safe(state.synth.oscMix, 0.5);
            osc1Gain.gain.value = (1 - mix);
            osc2Gain.gain.value = mix;

            synthGraphRef.current = {
                nodes: {
                    oscSource1, oscSource2, osc1Gain, osc2Gain, shaper1, shaper1InputGain, shaper2, shaper2InputGain,
                    mixer, fm1Gain, fm2Gain, preFilterGain, filterNode1, filterNode2, vca, masterSynthGain, lfo1, lfo2, lfo1Output, lfo2Output, modGains,
                    lfo1_ws1_modGain, lfo1_ws2_modGain,
                    combDelay, combFeedbackGain, combInGain, combOutGain,
                    formantInGain, formantFilters, formantOutGain,
                    filterEnvSource, filterEnvGain, filterDedicatedEnvGain,
                    modWheelSource, modWheelGain,
                    lfo1MatrixScaler, lfo2MatrixScaler, envMatrixScaler, // New Scalers
                    lfo1Analyser, lfo2Analyser
                },
                osc1Type: state.synth.osc1.type,
                osc2Type: state.synth.osc2.type,
            };
            
            lfoAnalysersRef.current = { lfo1: lfo1Analyser, lfo2: lfo2Analyser };
        }

        // Cleanup function to destroy graph when dependencies change (e.g. MOD_SOURCES update)
        return () => {
            if (synthGraphRef.current) {
                const { nodes } = synthGraphRef.current;
                try { nodes.masterSynthGain.disconnect(); } catch(e){}
                try { nodes.lfo1.stop(); } catch(e){}
                try { nodes.lfo2.stop(); } catch(e){}
                try { nodes.modWheelSource.stop(); } catch(e){} 
                try { nodes.filterEnvSource.stop(); } catch(e){}
                
                // Ensure AudioBufferSourceNode also gets stopped if it was used
                if (nodes.oscSource1 instanceof OscillatorNode) try { nodes.oscSource1.stop(); } catch(e){}
                else if (nodes.oscSource1 instanceof AudioBufferSourceNode) try { nodes.oscSource1.stop(); } catch(e){}

                if (nodes.oscSource2 instanceof OscillatorNode) try { nodes.oscSource2.stop(); } catch(e){}
                else if (nodes.oscSource2 instanceof AudioBufferSourceNode) try { nodes.oscSource2.stop(); } catch(e){}
                
                synthGraphRef.current = null;
            }
        };
    }, [audioContext, bankGainsRef.current.length, MOD_SOURCES.length]); // Added MOD_SOURCES.length to force re-evaluation if sources change


    // --- Helper to swap oscillator nodes dynamically ---
    const updateOscillator = (oscIndex: 1 | 2, newType: string) => {
        if (!synthGraphRef.current || !audioContext) return;
        const { nodes } = synthGraphRef.current;
        
        const oldSource = oscIndex === 1 ? nodes.oscSource1 : nodes.oscSource2;
        const targetGain = oscIndex === 1 ? nodes.shaper1InputGain : nodes.shaper2InputGain;
        const fmSourceGain = oscIndex === 1 ? nodes.fm2Gain : nodes.fm1Gain; // Osc 1 feeds FM2
        const fmDestGain = oscIndex === 1 ? nodes.fm1Gain : nodes.fm2Gain;   // Osc 1 receives from FM1
        
        // Disconnect and stop old source
        try { oldSource.disconnect(); } catch(e){}
        if (oldSource instanceof OscillatorNode || oldSource instanceof AudioBufferSourceNode) {
            try { oldSource.stop(); } catch(e){}
        }

        const newSource = createOscillatorSource(newType, audioContext);
        
        if (newSource instanceof OscillatorNode) {
            fmDestGain.connect(newSource.frequency);
        }
        
        const modGains = nodes.modGains;
        const pitchDest = oscIndex === 1 ? 'osc1Pitch' : 'osc2Pitch';
        Object.keys(modGains).forEach(key => {
            if (key.endsWith(pitchDest)) {
                modGains[key].connect(newSource.detune);
            }
        });

        newSource.connect(targetGain);
        // Connect outgoing FM
        newSource.connect(fmSourceGain);

        // Start new source (createOscillatorSource already calls start for AudioBufferSourceNode)
        if (newSource instanceof OscillatorNode) {
            try { newSource.start(); } catch(e){}
        }

        if (oscIndex === 1) {
            nodes.oscSource1 = newSource;
            synthGraphRef.current.osc1Type = newType;
        } else {
            nodes.oscSource2 = newSource;
            synthGraphRef.current.osc2Type = newType;
        }
    };


    // --- EFFECT: Handle Reactive Synth Parameters ---
    useEffect(() => {
        if (!synthGraphRef.current || !state.audioContext) return;
        const { nodes } = synthGraphRef.current;
        const { synth, synthModMatrix, bpm, isModMatrixMuted } = state;
        const now = state.audioContext.currentTime;

        // 1. Oscillator Type Changes
        if (synthGraphRef.current.osc1Type !== synth.osc1.type) updateOscillator(1, synth.osc1.type);
        if (synthGraphRef.current.osc2Type !== synth.osc2.type) updateOscillator(2, synth.osc2.type);

        // 2. WaveShaper Curves & Drive Logic (Aggressive)
        nodes.shaper1.curve = makeDistortionCurve(synth.osc1.waveshapeType, safe(synth.osc1.waveshapeAmount));
        nodes.shaper2.curve = makeDistortionCurve(synth.osc2.waveshapeType, safe(synth.osc2.waveshapeAmount));

        // Function to calculate Drive (Input Gain) and Compensation (Output Gain Reduction)
        // High input gain forces signal into nonlinear regions of Shaper.
        const computeShaperParams = (amount: number, lfoAmount: number) => {
            const safeAmount = safe(amount, 0);
            // Drive: Scale linearly from 1x to 40x. Intense input gain.
            const drive = 1 + (safeAmount * 39);
            // Compensation: Reduce output to prevent volume explosion.
            // Using a reciprocal curve to keep energy roughly constant.
            // 1 / (1 + amount * 3) creates a gentle but effective clamping.
            const compensation = 1 / (1 + (safeAmount * 2.5));
            // LFO Gain: Needs to be amplified significantly to affect the Drive
            // Using a cubic curve to provide fine control at low values while keeping max intensity.
            const lfoGain = Math.pow(safe(lfoAmount, 0), 3) * 39; 

            return { drive, compensation, lfoGain };
        };

        const ws1 = computeShaperParams(synth.osc1.waveshapeAmount, synth.osc1.wsLfoAmount || 0);
        const ws2 = computeShaperParams(synth.osc2.waveshapeAmount, synth.osc2.wsLfoAmount || 0);

        setTarget(nodes.shaper1InputGain.gain, ws1.drive, now, 0.02);
        setTarget(nodes.shaper2InputGain.gain, ws2.drive, now, 0.02);
        
        setTarget(nodes.lfo1_ws1_modGain.gain, ws1.lfoGain, now, 0.02);
        setTarget(nodes.lfo1_ws2_modGain.gain, ws2.lfoGain, now, 0.02);

        // 3. Osc Mix (With Compensation applied)
        const mix = safe(synth.oscMix, 0.5);
        setTarget(nodes.osc1Gain.gain, (1 - mix) * ws1.compensation, now, 0.02);
        setTarget(nodes.osc2Gain.gain, mix * ws2.compensation, now, 0.02);

        // 4. FM Gains
        setTarget(nodes.fm1Gain.gain, safe(synth.osc2.fmDepth), now, 0.02); // Controlled by "FM 2>1" knob (osc2 param)
        setTarget(nodes.fm2Gain.gain, safe(synth.osc1.fmDepth), now, 0.02); // Controlled by "FM 1>2" knob (osc1 param)

        // 5. LFO Parameters
        const getOscType = (t: string): OscillatorType => {
            const map: Record<string, OscillatorType> = { 'Sine': 'sine', 'Square': 'square', 'Triangle': 'triangle', 'Saw Down': 'sawtooth' };
            return map[t] || 'sine';
        };
        const getLfoFreq = (lfo: Synth['lfo1']) => {
            if (lfo.rateMode === 'hz') return safe(lfo.rate, 1);
            const entry = LFO_SYNC_RATES[Math.floor(safe(lfo.rate, 0))] || LFO_SYNC_RATES[15]; 
            const beats = entry.beats;
            const safeBpm = bpm > 0 ? bpm : 120;
            return safeBpm / (60 * beats);
        };

        if (nodes.lfo1.type !== getOscType(synth.lfo1.type)) nodes.lfo1.type = getOscType(synth.lfo1.type);
        setTarget(nodes.lfo1.frequency, getLfoFreq(synth.lfo1), now, 0.02);

        if (nodes.lfo2.type !== getOscType(synth.lfo2.type)) nodes.lfo2.type = getOscType(synth.lfo2.type);
        setTarget(nodes.lfo2.frequency, getLfoFreq(synth.lfo2), now, 0.02);

        // 6. Env Amount & Mod Wheel
        setTarget(nodes.filterDedicatedEnvGain.gain, safe(synth.filter.envAmount, 0), now, 0.02);
        
        // MOD WHEEL LOGIC:
        // Combined Value = (SequenceSignal * DepthKnob) + OffsetKnob
        // In this reactive effect (no sequence playing), SequenceSignal is defaulted to 1 (full scale).
        const depth = safe(synth.modWheel, 0); // Panel Knob
        const offset = safe(synth.modWheelOffset, 0); // Offset Knob
        const combinedModValue = Math.min(1, Math.max(0, (1 * depth) + offset));

        setTarget(nodes.modWheelGain.gain, combinedModValue, now, 0.02);
        if (combinedModValue === 0) {
            nodes.modWheelGain.gain.setValueAtTime(0, now + 0.1);
        }

        // 7. Mod Matrix Updates
        // Note: modWheel is no longer iterated as a source. It now scales the other sources via audio graph.
        MOD_SOURCES.forEach(src => {
            MOD_DESTINATIONS.forEach(dest => {
                // If the key doesn't exist (e.g. after CLEAR), default to 0
                const rawAmount = synthModMatrix[src]?.[dest] ?? 0;
                // Mute button logic: Sets specific destination gain to 0. 
                // Unmuted logic: Sets gain to Amount. Mod Wheel scales this signal upstream.
                const amount = isModMatrixMuted ? 0 : rawAmount;

                let scale = 1;
                if (dest.includes('Pitch')) scale = 2400; 
                if (dest.includes('Cutoff')) scale = 4800; 
                if (dest.includes('FM')) scale = 2000;
                if (dest === 'osc1Wave' || dest === 'osc2Wave') scale = 1;
                if (dest === 'filterQ') scale = 20;

                const gainNode = nodes.modGains[`${src}_${dest}`];
                if (gainNode) {
                    const finalVal = amount * scale;
                    
                    // Force immediate update if 0 to kill modulation bleed
                    if (Math.abs(finalVal) < 0.001) {
                        try {
                            gainNode.gain.cancelScheduledValues(now);
                            gainNode.gain.setValueAtTime(0, now);
                        } catch(e) {}
                    } else {
                        setTarget(gainNode.gain, finalVal, now, 0.02);
                    }
                }
            });
        });

    }, [state.synth, state.synthModMatrix, state.bpm, state.audioContext, state.isModMatrixMuted]);


    // --- EFFECT: Handle Filter Type Change Routing ---
    useEffect(() => {
        if (!synthGraphRef.current || !state.audioContext) return;
        const { nodes } = synthGraphRef.current;
        const { filter } = state.synth;
        const now = state.audioContext.currentTime;

        // Force silence inactive paths immediately using cancelScheduledValues to prevent "tails" of feedback
        const silence = (gainNode: GainNode) => {
            try {
                gainNode.gain.cancelScheduledValues(now);
                gainNode.gain.setValueAtTime(0, now);
            } catch(e) {}
        };

        silence(nodes.preFilterGain);
        silence(nodes.combInGain);
        silence(nodes.formantInGain);
        
        if (!filter.type.startsWith('Comb')) {
            silence(nodes.combFeedbackGain);
        }

        if (filter.type.startsWith('Comb')) {
            setValue(nodes.combInGain.gain, 1, now);
            setValue(nodes.combOutGain.gain, 1, now);
            silence(nodes.formantOutGain);

            const resFactor = Math.min(0.99, safe(state.synth.filter.resonance) / 30 * 0.99);
            setValue(nodes.combFeedbackGain.gain, filter.type === 'Comb-' ? -resFactor : resFactor, now);
            
            const delayTime = 1 / Math.max(20, safe(state.synth.filter.cutoff, 440));
            setTarget(nodes.combDelay.delayTime, delayTime, now, 0.02);

        } else if (filter.type === 'Formant Vowel') {
            setValue(nodes.formantInGain.gain, 1, now);
            setValue(nodes.formantOutGain.gain, 1, now);
            silence(nodes.combOutGain);

            const c = safe(state.synth.filter.cutoff, 1000);
            const res = safe(state.synth.filter.resonance, 1);
            setTarget(nodes.formantFilters[0].frequency, c, now, 0.02);
            setTarget(nodes.formantFilters[0].Q, res, now, 0.02);
            setTarget(nodes.formantFilters[1].frequency, c * 2.5, now, 0.02);
            setTarget(nodes.formantFilters[1].Q, res, now, 0.02);
            setTarget(nodes.formantFilters[2].frequency, c * 3.5, now, 0.02);
            setTarget(nodes.formantFilters[2].Q, res, now, 0.02);

        } else {
            setValue(nodes.preFilterGain.gain, 1, now);
            silence(nodes.combOutGain);
            silence(nodes.formantOutGain);

            const typeMap: Record<string, BiquadFilterType> = {
                'Lowpass 12dB': 'lowpass', 'Lowpass 24dB': 'lowpass',
                'Highpass 12dB': 'highpass', 'Highpass 24dB': 'highpass',
                'Bandpass 12dB': 'bandpass', 'Bandpass 24dB': 'bandpass',
                'Notch': 'notch', 'Allpass': 'allpass', 'Peak': 'peaking'
            };
            const nativeType = typeMap[filter.type] || 'lowpass';
            nodes.filterNode1.type = nativeType;
            nodes.filterNode2.type = nativeType;

            const cutoff = safe(filter.cutoff, 20000);
            const q = Math.min(20, safe(filter.resonance, 1));

            setTarget(nodes.filterNode1.frequency, cutoff, now, 0.02);
            setTarget(nodes.filterNode2.frequency, cutoff, now, 0.02);
            setTarget(nodes.filterNode1.Q, q, now, 0.02);
            setTarget(nodes.filterNode2.Q, q, now, 0.02);

            if (filter.type.includes('12dB')) {
                 nodes.filterNode2.type = 'allpass';
                 nodes.filterNode2.frequency.value = 1000; 
                 nodes.filterNode2.Q.value = 0; 
            }
        }

    }, [state.synth.filter.type, state.synth.filter.cutoff, state.synth.filter.resonance, state.audioContext]);

    // Implementation of playSample (Existing logic)
    const playSample = useCallback((sampleId: number, time: number, params: Partial<PlaybackParams> = {}) => {
        if (!audioContext || !samples[sampleId]?.buffer) return;
        const sample = samples[sampleId];
        const buffer = sample.buffer;
        let playbackBuffer = buffer;
        const mode = params.playbackMode ?? sample.playbackMode;
        if (mode === 'Reverse') {
             const revBuffer = audioContext.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
             for(let c=0; c<buffer.numberOfChannels; c++) {
                 const data = buffer.getChannelData(c);
                 const revData = revBuffer.getChannelData(c);
                 for(let i=0; i<buffer.length; i++) {
                     revData[i] = data[buffer.length - 1 - i];
                 }
             }
             playbackBuffer = revBuffer;
        }
        const source = audioContext.createBufferSource();
        source.buffer = playbackBuffer;
        const { detune = 0, pitch = sample.pitch, velocity = 1, volume = sample.volume, start = sample.start, end = sample.end, decay = sample.decay, loop = sample.loop, lpFreq = sample.lpFreq, hpFreq = sample.hpFreq } = params;
        source.detune.value = (safe(pitch) * 100) + safe(detune);
        source.loop = safe(loop as any) ? true : false;
        let startOffset = safe(start) * buffer.duration;
        let endOffset = safe(end) * buffer.duration;
        if (startOffset >= endOffset) endOffset = buffer.duration;
        if (loop) { source.loopStart = startOffset; source.loopEnd = endOffset; }
        const voiceGain = audioContext.createGain();
        voiceGain.gain.value = 0; 
        const stripInput = lpFilterNodesRef.current[sampleId];
        if (stripInput) { source.connect(voiceGain); voiceGain.connect(stripInput); } else { return; }
        const lpNode = lpFilterNodesRef.current[sampleId];
        const hpNode = hpFilterNodesRef.current[sampleId];
        const sampleGainNode = sampleGainsRef.current[sampleId];
        const now = safe(time, audioContext.currentTime) || audioContext.currentTime;
        if (lpNode) setTarget(lpNode.frequency, lpFreq!, now, 0.01);
        if (hpNode) setTarget(hpNode.frequency, hpFreq!, now, 0.01);
        if (sampleGainNode) setTarget(sampleGainNode.gain, volume, now, 0.01);
        setValue(voiceGain.gain, velocity, now);
        if (decay! < 1) {
             const decayDuration = safe(decay) * 5.0; 
             voiceGain.gain.exponentialRampToValueAtTime(0.001, now + decayDuration);
             // Removed source.stop() to prevent InvalidStateError. The exponential ramp is sufficient for silencing.
        }
        source.start(now, startOffset, !loop ? (endOffset - startOffset) : undefined);
        if (!activeSourcesRef.current.has(sampleId)) { activeSourcesRef.current.set(sampleId, new Set()); }
        activeSourcesRef.current.get(sampleId)!.add(source);
        source.onended = () => { try { voiceGain.disconnect(); } catch(e){} activeSourcesRef.current.get(sampleId)?.delete(source); };
    }, [audioContext, samples]);

    // --- RECORDING LOGIC (RESTORED & FIXED) ---
    const startMediaRecorder = (stream: MediaStream) => {
        // Use a timeslice to ensure dataavailable fires periodically if needed, 
        // though for simple clip recording it's not strictly necessary. 
        // Important: we need to handle the blob creation on stop.
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        audioChunksRef.current = [];

        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunksRef.current.push(event.data);
            }
        };

        recorder.onstop = async () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            await loadSampleFromBlob(audioBlob, stateRef.current.activeSampleId);
            
            // Cleanup: Stop all tracks to release microphone
            if (currentMicStreamRef.current) {
                currentMicStreamRef.current.getTracks().forEach(track => {
                    if (track.readyState === 'live') { // Only stop if track is active
                        track.stop();
                    }
                });
                currentMicStreamRef.current = null;
            }
            currentMicSourceRef.current = null;
            currentScriptProcessorRef.current = null;
            mediaRecorderRef.current = null;
        };

        recorder.start();
        dispatch({ type: ActionType.SET_ARMED_STATE, payload: false });
        dispatch({ type: ActionType.SET_RECORDING_STATE, payload: true });
    };

    const startRecording = useCallback(async () => {
        if (!stateRef.current.audioContext) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            currentMicStreamRef.current = stream; // Store stream reference
            
            // Check for threshold
            if (stateRef.current.recordingThreshold > 0) {
                dispatch({ type: ActionType.SET_ARMED_STATE, payload: true });
                const ctx = stateRef.current.audioContext;
                const source = ctx.createMediaStreamSource(stream);
                currentMicSourceRef.current = source; // Store source reference
                
                // Use ScriptProcessorNode for sample-accurate peak detection (most sensitive)
                const detector = ctx.createScriptProcessor(1024, 1, 1);
                currentScriptProcessorRef.current = detector; // Store detector reference
                
                // Create a silent gain node to route detector to destination
                // This is often required for the script processor to run in some browsers/contexts
                const mute = ctx.createGain();
                mute.gain.value = 0;
                
                source.connect(detector);
                detector.connect(mute);
                mute.connect(ctx.destination);
                
                detector.onaudioprocess = (e) => {
                    // Check if armed state was cancelled externally (e.g., STOP button)
                    if (!stateRef.current.isArmed) {
                        source.disconnect();
                        detector.disconnect();
                        mute.disconnect();
                        if (currentMicStreamRef.current) { // Ensure stream exists before stopping
                            currentMicStreamRef.current.getTracks().forEach(t => {
                                if (t.readyState === 'live') t.stop(); // Only stop if active
                            });
                            currentMicStreamRef.current = null;
                        }
                        currentMicSourceRef.current = null;
                        currentScriptProcessorRef.current = null;
                        return;
                    }

                    const input = e.inputBuffer.getChannelData(0);
                    let maxAmp = 0;
                    
                    // Iterate through every sample in the buffer
                    for (let i = 0; i < input.length; i++) {
                        const abs = Math.abs(input[i]);
                        if (abs > maxAmp) maxAmp = abs;
                    }

                    if (maxAmp > stateRef.current.recordingThreshold) {
                        // Trigger recording
                        source.disconnect();
                        detector.disconnect();
                        mute.disconnect();
                        startMediaRecorder(stream);
                    }
                };
            } else {
                // Immediate start if threshold is 0
                startMediaRecorder(stream);
            }
        } catch (err) {
            console.error("Error accessing microphone:", err);
            dispatch({ type: ActionType.SHOW_TOAST, payload: "Microphone access denied." });
        }
    }, []);

    const stopRecording = useCallback(() => {
        // If currently armed (waiting for threshold), cancel it.
        if (stateRef.current.isArmed) {
            dispatch({ type: ActionType.SET_ARMED_STATE, payload: false });
            // The ScriptProcessor loop (currentScriptProcessorRef) will detect this flag change and clean up the stream.
            // No need to explicitly stop tracks here as it's handled by the detector's onaudioprocess.
        }
        // If currently recording, stop the media recorder.
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            dispatch({ type: ActionType.SET_RECORDING_STATE, payload: false });
            // Cleanup of currentMicStreamRef.current etc. happens in recorder.onstop
        }
    }, []);

    const loadSampleFromBlob = useCallback(async (blob: Blob, sampleId: number, name?: string) => {
        if (!stateRef.current.audioContext) return;
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const audioBuffer = await stateRef.current.audioContext.decodeAudioData(arrayBuffer);
            
            // Normalize
            const maxAmp = audioBuffer.getChannelData(0).reduce((acc, val) => Math.max(acc, Math.abs(val)), 0);
            if (maxAmp > 0 && maxAmp < 0.9) {
                const gain = 0.95 / maxAmp;
                for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
                    const data = audioBuffer.getChannelData(i);
                    for (let j = 0; j < data.length; j++) {
                        data[j] *= gain;
                    }
                }
            }

            const newSamples = [...stateRef.current.samples];
            newSamples[sampleId] = {
                ...newSamples[sampleId],
                buffer: audioBuffer,
                name: name || newSamples[sampleId].name
            };
            dispatch({ type: ActionType.SET_SAMPLES, payload: newSamples });
            dispatch({ type: ActionType.SHOW_TOAST, payload: "Sample loaded successfully." });

        } catch (error) {
            console.error("Error loading sample:", error);
            dispatch({ type: ActionType.SHOW_TOAST, payload: "Failed to load audio file." });
        }
    }, []);

    const startMasterRecording = useCallback(() => {
        if (!audioContext || !masterClipperRef.current) return;
        
        const dest = audioContext.createMediaStreamDestination();
        masterDestNodeRef.current = dest;
        // Connect after Clipper (final stage before speakers)
        masterClipperRef.current.connect(dest);
        
        const recorder = new MediaRecorder(dest.stream);
        masterRecorderRef.current = recorder;
        masterChunksRef.current = [];
        
        recorder.ondataavailable = (e) => masterChunksRef.current.push(e.data);
        
        recorder.onstop = () => {
            const blob = new Blob(masterChunksRef.current, { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            a.download = `GrooveSampler_Master_${timestamp}.wav`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            
            // Cleanup
            if (masterClipperRef.current && masterDestNodeRef.current) {
                 // Don't disconnect clipper from destination (speakers), just the recorder stream
                 masterClipperRef.current.disconnect(masterDestNodeRef.current);
            }
        };
        
        recorder.start();
        dispatch({ type: ActionType.TOGGLE_MASTER_RECORDING });
        
    }, [audioContext]);

    const stopMasterRecording = useCallback(() => {
        if (masterRecorderRef.current && masterRecorderRef.current.state === 'recording') {
            masterRecorderRef.current.stop();
            dispatch({ type: ActionType.TOGGLE_MASTER_RECORDING });
        }
    }, []);


    const flushAllSources = useCallback(() => {
        // 1. Stop all samples
        activeSourcesRef.current.forEach(set => { set.forEach(source => { try { source.stop(); } catch(e) {} }); set.clear(); });
        
        // 2. Hard Reset Synth Graph
        if (synthGraphRef.current) {
             const now = audioContext?.currentTime || 0;
             const { nodes } = synthGraphRef.current;
             try {
                // Kill Volume
                nodes.vca.gain.cancelScheduledValues(now);
                nodes.vca.gain.setValueAtTime(0, now);
                
                // Kill Feedback & Resonance immediately (Panic)
                nodes.combFeedbackGain.gain.cancelScheduledValues(now);
                nodes.combFeedbackGain.gain.setValueAtTime(0, now);
                
                nodes.filterNode1.Q.cancelScheduledValues(now);
                nodes.filterNode1.Q.setValueAtTime(0, now);
                nodes.filterNode2.Q.cancelScheduledValues(now);
                nodes.filterNode2.Q.setValueAtTime(0, now);
                
                // Reset routing gains
                nodes.combInGain.gain.cancelScheduledValues(now);
                nodes.combInGain.gain.setValueAtTime(0, now);
                nodes.combOutGain.gain.cancelScheduledValues(now);
                nodes.combOutGain.gain.setValueAtTime(0, now);
             } catch(e){}
        }
    }, [audioContext]);
    
    // Implementation of playSynthNote (Updates: Master Octave)
    const playSynthNote = useCallback((detune: number, time: number, params: Partial<Pick<Synth, 'modWheel'>> = {}) => {
        if (!synthGraphRef.current || !audioContext) return;
        const { nodes } = synthGraphRef.current;
        const { synth } = state;
        const now = safe(time, audioContext.currentTime) || audioContext.currentTime;

        // MOD WHEEL LOGIC:
        // params.modWheel is the Sequencer Signal (or 1 if manual trigger/no lock)
        // synth.modWheel is the Depth Knob
        // synth.modWheelOffset is the Offset Knob
        
        const seqSignal = safe(params.modWheel !== undefined ? params.modWheel : 1, 1);
        const depth = safe(synth.modWheel, 0);
        const offset = safe(synth.modWheelOffset, 0);
        
        const combinedModValue = Math.min(1, Math.max(0, (seqSignal * depth) + offset));

        setTarget(nodes.modWheelGain.gain, combinedModValue, now, 0.005);
        // Fix: Ensure hard zero if modWheel param is 0 during sequence playback
        if (combinedModValue === 0) {
            nodes.modWheelGain.gain.setValueAtTime(0, now + 0.05);
        }

        // Include Master Octave in frequency calculation
        const masterOffset = safe(synth.masterOctave) * 1200;
        
        const osc1Base = (safe(synth.osc1.octave) * 1200) + safe(synth.osc1.detune) + masterOffset;
        if (nodes.oscSource1 instanceof OscillatorNode || nodes.oscSource1 instanceof AudioBufferSourceNode) {
            setTarget(nodes.oscSource1.detune, osc1Base + safe(detune), now, 0.005);
        }
        
        const osc2Base = (safe(synth.osc2.octave) * 1200) + safe(synth.osc2.detune) + masterOffset;
         if (nodes.oscSource2 instanceof OscillatorNode || nodes.oscSource2 instanceof AudioBufferSourceNode) {
            setTarget(nodes.oscSource2.detune, osc2Base + safe(detune), now, 0.005);
        }

        const masterVol = safe(synth.masterGain, 1);
        try {
            nodes.vca.gain.cancelScheduledValues(now);
            nodes.vca.gain.setValueAtTime(0, now);
            nodes.vca.gain.linearRampToValueAtTime(masterVol, now + 0.005); 
            const decayTime = safe(synth.ampEnv.decay, 0.5);
            const effectiveDecay = Math.max(0.1, decayTime * 2); 
            nodes.vca.gain.exponentialRampToValueAtTime(0.001, now + 0.005 + effectiveDecay);
            nodes.vca.gain.linearRampToValueAtTime(0, now + 0.005 + effectiveDecay + 0.05);
        } catch(e) {}

        const { attack, decay, sustain } = synth.filterEnv;
        const sAttack = safe(attack, 0.01);
        const sDecay = safe(decay, 0.2);
        const sSustain = safe(sustain, 0.5);
        try {
            const envGain = nodes.filterEnvGain.gain;
            envGain.cancelScheduledValues(now);
            envGain.setValueAtTime(0, now);
            envGain.linearRampToValueAtTime(1, now + sAttack);
            envGain.exponentialRampToValueAtTime(Math.max(0.001, sSustain), now + sAttack + sDecay);
            envGain.setTargetAtTime(0, now + sAttack + sDecay + 0.1, 0.2); 
        } catch(e) {}

    }, [audioContext, state.synth, state.synthModMatrix]);

    // Implementation of LFO Retrigger via Node Swapping
    const scheduleLfoRetrigger = useCallback((lfoIndex: number, time: number) => {
        if (!synthGraphRef.current || !audioContext) return;
        const { nodes } = synthGraphRef.current;
        const oldLfo = lfoIndex === 0 ? nodes.lfo1 : nodes.lfo2;
        const outputNode = lfoIndex === 0 ? nodes.lfo1Output : nodes.lfo2Output;
        const analyser = lfoIndex === 0 ? nodes.lfo1Analyser : nodes.lfo2Analyser;
        
        // 1. Create fresh Oscillator
        const newLfo = audioContext.createOscillator();
        newLfo.type = oldLfo.type;
        newLfo.frequency.value = oldLfo.frequency.value;
        
        // 2. Schedule Start
        newLfo.start(time);
        
        // 3. Connect to Output
        newLfo.connect(outputNode);
        newLfo.connect(analyser); // Reconnect visualization
        
        // 4. Disconnect Old at same time
        try { 
            oldLfo.stop(time); 
            // We can't strictly disconnect at a scheduled time, but stopping it effectively kills its output
            // Garbage collection will handle the node once disconnected in logic below.
        } catch(e) {}

        // 5. Update Reference immediately (for future updates)
        if (lfoIndex === 0) nodes.lfo1 = newLfo;
        else nodes.lfo2 = newLfo;

    }, [audioContext, state.synth]);

    return {
        playSample,
        playSynthNote,
        scheduleLfoRetrigger,
        loadSampleFromBlob,
        startRecording,
        stopRecording,
        startMasterRecording,
        stopMasterRecording,
        flushAllSources,
        lfoAnalysers: lfoAnalysersRef
    };
};