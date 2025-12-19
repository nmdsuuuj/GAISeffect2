
import { useContext, useRef, useCallback, useEffect, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { ActionType, Sample, PlaybackParams, BiquadFilterType, Synth } from '../types';
import { PADS_PER_BANK, TOTAL_BANKS, TOTAL_SAMPLES, LFO_SYNC_RATES, MOD_SOURCES, MOD_DESTINATIONS, LFO_SYNC_TRIGGERS, OSC_WAVEFORMS } from '../constants';
import { useFxChain } from './useFxChain';
import { makeDistortionCurve } from '../utils/audio';

// --- Safety Helpers ---
const safe = (val: any, fallback: number = 0): number => {
    const n = Number(val);
    return (Number.isFinite(n) && !Number.isNaN(n)) ? n : fallback;
};

// FIX: Enhanced setTarget to Hard-Cut to 0 when value is negligible.
// Threshold lowered to 1e-4 (-80dB) for stricter silence.
const setTarget = (param: AudioParam, value: number, time: number, timeConstant: number) => {
    if (!param) return;
    const v = safe(value, 0);
    const t = safe(time, 0);
    const tc = Math.max(0.001, safe(timeConstant, 0.01)); 
    try {
        if (Number.isFinite(v) && Number.isFinite(t) && Number.isFinite(tc)) {
            // Stricter threshold for silence
            if (Math.abs(v) < 0.0001) {
                param.cancelScheduledValues(t);
                param.setValueAtTime(0, t);
            } else {
                param.setTargetAtTime(v, t, tc);
            }
        }
    } catch (e) {}
};

// Helper for immediate silence
const killParam = (param: AudioParam, time: number) => {
    if (!param) return;
    try {
        param.cancelScheduledValues(time);
        param.setValueAtTime(0, time);
    } catch(e) {}
};

const setValue = (param: AudioParam, value: number, time: number) => {
    if (!param) return;
    try {
        param.setValueAtTime(safe(value, 0), safe(time, 0));
    } catch(e) {}
};

// Helper to calculate LFO Hz from BPM if synced
const getLfoFrequency = (lfo: Synth['lfo1'], bpm: number): number => {
    if (lfo.rateMode === 'hz') return safe(lfo.rate, 1);
    const syncRate = LFO_SYNC_RATES[Math.floor(safe(lfo.rate))] || LFO_SYNC_RATES[9]; 
    const beats = syncRate.beats;
    return safe(bpm, 120) / (60 * beats);
};

// Helper to map UI filter names to WebAudio Biquad types
const mapFilterType = (uiType: string): BiquadFilterType => {
    const lower = uiType.toLowerCase();
    if (lower.includes('lowpass')) return 'lowpass';
    if (lower.includes('highpass')) return 'highpass';
    if (lower.includes('bandpass')) return 'bandpass';
    if (lower.includes('notch')) return 'notch';
    if (lower.includes('peak')) return 'peaking';
    if (lower.includes('lowshelf')) return 'lowshelf';
    if (lower.includes('highshelf')) return 'highshelf';
    if (lower.includes('allpass')) return 'allpass';
    return 'lowpass';
};

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
    fm1Gain: GainNode;
    fm2Gain: GainNode;
    preFilterGain: GainNode;
    filterNode1: BiquadFilterNode;
    filterNode2: BiquadFilterNode;
    combDelay: DelayNode;
    combFeedbackGain: GainNode;
    combInGain: GainNode;
    combOutGain: GainNode;
    formantInGain: GainNode;
    formantFilters: BiquadFilterNode[];
    formantOutGain: GainNode;
    vca: GainNode;
    masterSynthGain: GainNode;
    lfo1: OscillatorNode;
    lfo2: OscillatorNode;
    lfo1Output: GainNode;
    lfo2Output: GainNode;
    lfo1MatrixScaler: GainNode;
    lfo2MatrixScaler: GainNode;
    envMatrixScaler: GainNode;
    modGains: { [key: string]: GainNode };
    lfo1_ws1_modGain: GainNode;
    lfo1_ws2_modGain: GainNode;
    filterEnvSource: ConstantSourceNode;
    filterEnvGain: GainNode;
    filterDedicatedEnvGain: GainNode;
    modWheelSource: ConstantSourceNode;
    lfo1Analyser: AnalyserNode;
    lfo2Analyser: AnalyserNode;
};

const noiseBufferCache = new Map<string, AudioBuffer>();

const createOscillatorSource = (type: string, audioContext: AudioContext): OscillatorNode | AudioBufferSourceNode => {
    if (type === 'Noise' || type === 'Glitch') {
         if (noiseBufferCache.has(type)) {
            const source = audioContext.createBufferSource();
            source.buffer = noiseBufferCache.get(type)!;
            source.loop = true;
            source.start(0);
            return source;
        }
        const bufferSize = audioContext.sampleRate * 2; 
        const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const output = buffer.getChannelData(0);
        if (type === 'Noise') {
             for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
        } else {
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
        source.start(0);
        return source;
    }
    const osc = audioContext.createOscillator();
    const standardTypes: { [key: string]: OscillatorType } = {
        'Sine': 'sine', 'Square': 'square', 'Saw Down': 'sawtooth', 'Triangle': 'triangle', 'Saw Up': 'sawtooth'
    };
    osc.type = standardTypes[type] || 'sawtooth';
    return osc;
};

export const useAudioEngine = () => {
    const { state, dispatch } = useContext(AppContext);
    const { audioContext, samples, bankVolumes, bankPans, bankMutes, bankSolos, recordingThreshold, activeSampleId, masterVolume, masterCompressorOn, masterCompressorParams, synth, synthModMatrix, isModMatrixMuted } = state;
    const fxChain = useFxChain();

    const [audioGraphReady, setAudioGraphReady] = useState(false);

    const masterGainRef = useRef<GainNode | null>(null);
    const masterCompressorRef = useRef<DynamicsCompressorNode | null>(null);
    const masterClipperRef = useRef<WaveShaperNode | null>(null);
    const bankGainsRef = useRef<GainNode[]>([]);
    const bankPannersRef = useRef<StereoPannerNode[]>([]);
    const sampleGainsRef = useRef<GainNode[]>([]);
    const lpFilterNodesRef = useRef<BiquadFilterNode[]>([]);
    const hpFilterNodesRef = useRef<BiquadFilterNode[]>([]);
    const activeSourcesRef = useRef<Map<number, Set<AudioBufferSourceNode>>>(new Map());
    
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const masterRecorderRef = useRef<MediaRecorder | null>(null);
    const masterChunksRef = useRef<Blob[]>([]);
    const masterDestNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);
    const currentMicStreamRef = useRef<MediaStream | null>(null);

    const synthGraphRef = useRef<{ nodes: SynthGraphNodes; osc1Type: string; osc2Type: string; } | null>(null);
    const lfoAnalysersRef = useRef<{ lfo1: AnalyserNode | null; lfo2: AnalyserNode | null }>({ lfo1: null, lfo2: null });
    
    const lastModWheelValueRef = useRef<number>(0); 

    const stateRef = useRef(state);
    useEffect(() => { stateRef.current = state; }, [state]);
    
    // Core Infrastructure Initialization
    useEffect(() => {
        if (audioContext && !masterGainRef.current && fxChain.isReady && fxChain.inputNode && fxChain.outputNode) {
            const compressor = audioContext.createDynamicsCompressor();
            masterCompressorRef.current = compressor;

            const clipper = audioContext.createWaveShaper();
            const robustCurve = new Float32Array(4096);
            for (let i = 0; i < 4096; i++) { robustCurve[i] = Math.tanh((i - 2048) / 2048); }
            clipper.curve = robustCurve;
            masterClipperRef.current = clipper;

            const masterGain = audioContext.createGain();
            masterGain.connect(audioContext.destination);
            masterGainRef.current = masterGain;

            fxChain.outputNode.connect(compressor);
            compressor.connect(clipper);
            clipper.connect(masterGain);

            const bankGains: GainNode[] = [];
            const bankPanners: StereoPannerNode[] = [];
            for (let i = 0; i < TOTAL_BANKS; i++) {
                const gain = audioContext.createGain();
                const pan = audioContext.createStereoPanner();
                gain.connect(pan);
                pan.connect(fxChain.inputNode); 
                bankGains.push(gain);
                bankPanners.push(pan);
            }
            bankGainsRef.current = bankGains;
            bankPannersRef.current = bankPanners;
            
            const lpFs: BiquadFilterNode[] = [];
            const hpFs: BiquadFilterNode[] = [];
            const sGs: GainNode[] = [];
            for (let i = 0; i < TOTAL_SAMPLES; i++) {
                const lp = audioContext.createBiquadFilter();
                lp.type = 'lowpass'; lp.frequency.value = 20000;
                const hp = audioContext.createBiquadFilter();
                hp.type = 'highpass'; hp.frequency.value = 20;
                const sg = audioContext.createGain();
                const bankIdx = Math.floor(i / PADS_PER_BANK);
                lp.connect(hp); hp.connect(sg); sg.connect(bankGains[bankIdx]);
                lpFs.push(lp); hpFs.push(hp); sGs.push(sg);
            }
            lpFilterNodesRef.current = lpFs; hpFilterNodesRef.current = hpFs; sampleGainsRef.current = sGs;
            
            setAudioGraphReady(true);
        }
    }, [audioContext, fxChain.isReady, fxChain.inputNode, fxChain.outputNode]);

    // Mixer Updates
    useEffect(() => {
        if (!audioContext || bankGainsRef.current.length === 0) return;
        const now = audioContext.currentTime, RAMP = 0.02;
        if (masterGainRef.current) setTarget(masterGainRef.current.gain, safe(masterVolume, 1), now, RAMP);
        const anySolo = bankSolos.some(s => s);
        for (let i = 0; i < TOTAL_BANKS; i++) {
            const g = bankGainsRef.current[i], p = bankPannersRef.current[i];
            if (g && p) {
                setTarget(p.pan, safe(bankPans[i], 0), now, RAMP);
                let tg = safe(bankVolumes[i], 1);
                if (anySolo) { if (!bankSolos[i]) tg = 0; } else if (bankMutes[i]) tg = 0;
                
                if (tg < 0.0001) killParam(g.gain, now);
                else setTarget(g.gain, tg, now, RAMP);
            }
        }
    }, [audioContext, bankVolumes, bankPans, bankMutes, bankSolos, masterVolume, audioGraphReady]);

    // Compressor Updates
    useEffect(() => {
        if (!audioContext || !masterCompressorRef.current) return;
        const c = masterCompressorRef.current, now = audioContext.currentTime, RAMP = 0.02;
        if (masterCompressorOn) {
            setTarget(c.threshold, safe(masterCompressorParams.threshold, -24), now, RAMP);
            setTarget(c.knee, safe(masterCompressorParams.knee, 30), now, RAMP);
            setTarget(c.ratio, safe(masterCompressorParams.ratio, 12), now, RAMP);
            setTarget(c.attack, safe(masterCompressorParams.attack, 0.003), now, 0.01);
            setTarget(c.release, safe(masterCompressorParams.release, 0.25), now, 0.01);
        } else {
            setTarget(c.threshold, 0, now, RAMP); setTarget(c.knee, 0, now, RAMP); setTarget(c.ratio, 1, now, RAMP);
        }
    }, [audioContext, masterCompressorOn, masterCompressorParams, audioGraphReady]);

    // Synth Graph Construction
    useEffect(() => {
        if (audioContext && audioGraphReady) {
            const ctx = audioContext;
            const s = state.synth; 
            
            // Clean up old graph
            if (synthGraphRef.current) {
                try {
                    synthGraphRef.current.nodes.masterSynthGain.disconnect();
                    const n = synthGraphRef.current.nodes;
                    if (n.oscSource1 instanceof OscillatorNode) n.oscSource1.stop();
                    if (n.oscSource2 instanceof OscillatorNode) n.oscSource2.stop();
                    n.lfo1.stop(); n.lfo2.stop();
                    n.filterEnvSource.stop(); n.modWheelSource.stop();
                } catch(e) {}
            }

            const osc1 = createOscillatorSource(s.osc1.type, ctx);
            const osc2 = createOscillatorSource(s.osc2.type, ctx);
            
            const o1g = ctx.createGain(), o2g = ctx.createGain();
            const s1 = ctx.createWaveShaper(), s1i = ctx.createGain();
            const s2 = ctx.createWaveShaper(), s2i = ctx.createGain();
            const mix = ctx.createGain(), fm1 = ctx.createGain(), fm2 = ctx.createGain();
            
            o1g.gain.value = 1 - safe(s.oscMix);
            o2g.gain.value = safe(s.oscMix);
            s1i.gain.value = 1 + safe(s.osc1.waveshapeAmount)*5;
            s2i.gain.value = 1 + safe(s.osc2.waveshapeAmount)*5;
            fm1.gain.value = safe(s.osc2.fmDepth);
            fm2.gain.value = safe(s.osc1.fmDepth);
            
            const pfg = ctx.createGain(); pfg.gain.value = 1.0; 
            const f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter();
            
            const cIn = ctx.createGain(); cIn.gain.value = 0;
            const cD = ctx.createDelay(1.0), cFb = ctx.createGain(); cFb.gain.value = 0;
            const cOut = ctx.createGain(); cOut.gain.value = 1;
            
            const fIn = ctx.createGain(); fIn.gain.value = 0;
            const fFs = [ctx.createBiquadFilter(), ctx.createBiquadFilter(), ctx.createBiquadFilter()];
            const fOut = ctx.createGain(); fOut.gain.value = 1;

            const vca = ctx.createGain(), msg = ctx.createGain();
            
            const l1 = ctx.createOscillator(), l2 = ctx.createOscillator();
            const l1o = ctx.createGain(), l2o = ctx.createGain();
            l1.connect(l1o); l2.connect(l2o);
            
            const lfoForms: any = { 'Sine': 'sine', 'Triangle': 'triangle', 'Square': 'square', 'Saw Down': 'sawtooth', 'Saw Up': 'sawtooth' }; 
            l1.type = lfoForms[s.lfo1.type] || 'sine';
            l2.type = lfoForms[s.lfo2.type] || 'sine';
            l1.frequency.value = getLfoFrequency(s.lfo1, state.bpm);
            l2.frequency.value = getLfoFrequency(s.lfo2, state.bpm);
            
            const l1ws1 = ctx.createGain(), l1ws2 = ctx.createGain();
            l1ws1.gain.value = safe(s.osc1.wsLfoAmount) * 10;
            l1ws2.gain.value = safe(s.osc2.wsLfoAmount) * 10;

            const l1a = ctx.createAnalyser(), l2a = ctx.createAnalyser();
            
            const fEs = ctx.createConstantSource(); fEs.offset.value = 1;
            const fEg = ctx.createGain(); fEg.gain.value = 0; fEs.connect(fEg); fEs.start();
            
            const fDeg = ctx.createGain(); 
            fEg.connect(fDeg); 
            fDeg.connect(f1.detune); fDeg.connect(f2.detune); 
            
            const cEnv = ctx.createGain(); cEnv.gain.value = 0.001; 
            fEg.connect(cEnv); cEnv.connect(cD.delayTime);
            
            fDeg.gain.value = safe(s.filter.envAmount);
            
            const mWs = ctx.createConstantSource(); 
            mWs.offset.value = 0; 
            mWs.start();
            
            // --- MODULATION ROUTING REWORK ---
            const l1s = ctx.createGain(), l2s = ctx.createGain(), eMs = ctx.createGain();
            // The master scalers' gain is now driven by the mod wheel source.
            // Their intrinsic value is 0, so the mod wheel's value becomes their gain.
            l1s.gain.value = 0; l2s.gain.value = 0; eMs.gain.value = 0;
            mWs.connect(l1s.gain);
            mWs.connect(l2s.gain);
            mWs.connect(eMs.gain);

            l1o.connect(l1s); l2o.connect(l2s); fEg.connect(eMs);
            // --- END REWORK ---

            osc1.connect(s1i); s1i.connect(s1); s1.connect(o1g); o1g.connect(mix);
            osc2.connect(s2i); s2i.connect(s2); s2.connect(o2g); o2g.connect(mix);
            
            mix.connect(pfg); mix.connect(cIn); mix.connect(fIn);
            
            pfg.connect(f1); f1.connect(f2); f2.connect(vca);
            
            cIn.connect(cD); cD.connect(cFb); cFb.connect(cD); cD.connect(cOut); cOut.connect(vca);
            
            fFs.forEach(f => { 
                f.type = 'bandpass'; 
                fIn.connect(f); 
                f.connect(fOut); 
            }); 
            fOut.connect(vca);
            
            vca.connect(msg); 
            if (bankGainsRef.current[3]) msg.connect(bankGainsRef.current[3]);
            
            vca.gain.value = 0;
            
            const mGs: any = {};
            osc1.connect(fm2); osc2.connect(fm1);
            
            const hasDetune = (node: any) => node && typeof node.detune === 'object';
            
            if (hasDetune(osc1)) fm1.connect((osc1 as any).frequency || (osc1 as any).detune);
            if (hasDetune(osc2)) fm2.connect((osc2 as any).frequency || (osc2 as any).detune);
            
            const connectMatrixNode = (srcName: string, srcNode: AudioNode) => {
                MOD_DESTINATIONS.forEach(dst => {
                    const g = ctx.createGain(); 
                    const matVal = state.synthModMatrix[srcName]?.[dst] || 0;
                    let scaledVal = matVal;
                    if (dst.includes('Pitch')) scaledVal = matVal * 1200; 
                    else if (dst.includes('Cutoff')) scaledVal = matVal * 2400; 
                    else if (dst.includes('FM')) scaledVal = matVal * 1000;
                    else if (dst.includes('Q')) scaledVal = matVal * 10;
                    
                    g.gain.value = scaledVal;
                    mGs[`${srcName}_${dst}`] = g; 
                    srcNode.connect(g);
                    
                    if (dst==='osc1Pitch' && hasDetune(osc1)) g.connect(osc1.detune);
                    if (dst==='osc2Pitch' && hasDetune(osc2)) g.connect(osc2.detune);
                    if (dst==='osc1FM') g.connect(fm1.gain); 
                    if (dst==='osc2FM') g.connect(fm2.gain);
                    if (dst==='osc1Wave') g.connect(s1i.gain); 
                    if (dst==='osc2Wave') g.connect(s2i.gain);
                    if (dst==='filterCutoff') { 
                        g.connect(f1.detune); g.connect(f2.detune); 
                        const cMod = ctx.createGain(); cMod.gain.value = -0.005; 
                        g.connect(cMod); cMod.connect(cD.delayTime);
                    }
                    if (dst==='filterQ') { 
                        g.connect(f1.Q); g.connect(f2.Q); 
                        const cFbMod = ctx.createGain(); cFbMod.gain.value = 0.9;
                        g.connect(cFbMod); cFbMod.connect(cFb.gain);
                    }
                });
            };

            // The mod wheel is no longer a direct source, but a master controller for the others.
            MOD_SOURCES.forEach(src => {
                let node: AudioNode;
                if (src === 'lfo1') node = l1s;
                else if (src === 'lfo2') node = l2s;
                else node = eMs; // filterEnv
                connectMatrixNode(src, node);
            });
            
            l1o.connect(l1ws1); l1o.connect(l1ws2); l1ws1.connect(s1i.gain); l1ws2.connect(s2i.gain);
            l1o.connect(l1a); l2o.connect(l2a); 
            
            l1.start(); l2.start();
            if (osc1 instanceof OscillatorNode) osc1.start();
            if (osc2 instanceof OscillatorNode) osc2.start();

            synthGraphRef.current = { 
                nodes: { 
                    oscSource1:osc1, oscSource2:osc2, osc1Gain:o1g, osc2Gain:o2g, 
                    shaper1:s1, shaper1InputGain:s1i, shaper2:s2, shaper2InputGain:s2i, 
                    mixer:mix, fm1Gain:fm1, fm2Gain:fm2, 
                    preFilterGain:pfg, filterNode1:f1, filterNode2:f2, 
                    combDelay:cD, combFeedbackGain:cFb, combInGain:cIn, combOutGain:cOut,
                    formantInGain:fIn, formantFilters:fFs, formantOutGain:fOut,
                    vca, masterSynthGain:msg, 
                    lfo1:l1, lfo2:l2, lfo1Output:l1o, lfo2Output:l2o, 
                    modGains:mGs, lfo1_ws1_modGain:l1ws1, lfo1_ws2_modGain:l1ws2, 
                    filterEnvSource:fEs, filterEnvGain:fEg, filterDedicatedEnvGain:fDeg, 
                    modWheelSource:mWs, 
                    lfo1MatrixScaler:l1s, lfo2MatrixScaler:l2s, envMatrixScaler:eMs, 
                    lfo1Analyser:l1a, lfo2Analyser:l2a 
                }, 
                osc1Type: state.synth.osc1.type, 
                osc2Type: state.synth.osc2.type 
            };
            lfoAnalysersRef.current = { lfo1: l1a, lfo2: l2a };
        }
        
        return () => {
            if (synthGraphRef.current) {
                try {
                    synthGraphRef.current.nodes.masterSynthGain.disconnect();
                    const n = synthGraphRef.current.nodes;
                    if (n.oscSource1 instanceof OscillatorNode) n.oscSource1.stop();
                    if (n.oscSource2 instanceof OscillatorNode) n.oscSource2.stop();
                    n.lfo1.stop(); n.lfo2.stop();
                    n.filterEnvSource.stop(); n.modWheelSource.stop();
                } catch(e) {}
            }
        };
    }, [audioContext, audioGraphReady, state.synth.osc1.type, state.synth.osc2.type]); 

    // Dynamic Parameter Updates
    useEffect(() => {
        if (!synthGraphRef.current || !audioContext) return;
        const n = synthGraphRef.current.nodes;
        const s = state.synth;
        const now = audioContext.currentTime;
        const RAMP = 0.02;

        const oscMix = safe(s.oscMix);
        if (oscMix <= 0.001) {
            killParam(n.osc2Gain.gain, now);
            setTarget(n.osc1Gain.gain, 1, now, RAMP);
        } else if (oscMix >= 0.999) {
            killParam(n.osc1Gain.gain, now);
            setTarget(n.osc2Gain.gain, 1, now, RAMP);
        } else {
            setTarget(n.osc1Gain.gain, 1 - oscMix, now, RAMP);
            setTarget(n.osc2Gain.gain, oscMix, now, RAMP);
        }

        const fType = s.filter.type;
        const isComb = fType.includes('Comb');
        const isFormant = fType.includes('Formant');
        const isStandard = !isComb && !isFormant;

        if (isStandard) {
            setTarget(n.preFilterGain.gain, 1, now, 0.01);
            killParam(n.combInGain.gain, now);
            killParam(n.formantInGain.gain, now);
        } else if (isComb) {
            killParam(n.preFilterGain.gain, now);
            setTarget(n.combInGain.gain, 1, now, 0.01);
            killParam(n.formantInGain.gain, now);
        } else if (isFormant) {
            killParam(n.preFilterGain.gain, now);
            killParam(n.combInGain.gain, now);
            setTarget(n.formantInGain.gain, 1, now, 0.01);
        }

        const cutoff = safe(s.filter.cutoff, 20000);
        const res = safe(s.filter.resonance);

        if (isStandard) {
            const mappedType = mapFilterType(fType);
            n.filterNode1.type = mappedType;
            n.filterNode2.type = mappedType;
            setTarget(n.filterNode1.frequency, cutoff, now, RAMP);
            setTarget(n.filterNode2.frequency, cutoff, now, RAMP);
            setTarget(n.filterNode1.Q, res, now, RAMP);
            setTarget(n.filterNode2.Q, res, now, RAMP);
        } else if (isComb) {
            const delayTime = Math.max(0.0001, 1 / Math.max(20, cutoff)); 
            setTarget(n.combDelay.delayTime, delayTime, now, RAMP);
            
            const fb = fType.includes('-') ? -1 : 1;
            const resNorm = Math.min(0.99, res / 20);
            setTarget(n.combFeedbackGain.gain, fb * resNorm, now, RAMP);
        } else if (isFormant) {
            const base = cutoff / 1000;
            setTarget(n.formantFilters[0].frequency, 600 * base, now, RAMP);
            setTarget(n.formantFilters[1].frequency, 1000 * base, now, RAMP);
            setTarget(n.formantFilters[2].frequency, 2500 * base, now, RAMP);
            
            const q = 5 + res;
            n.formantFilters.forEach(f => setTarget(f.Q, q, now, RAMP));
        }

        setTarget(n.filterDedicatedEnvGain.gain, safe(s.filter.envAmount), now, RAMP);

        const lfoForms: any = { 'Sine': 'sine', 'Triangle': 'triangle', 'Square': 'square', 'Saw Down': 'sawtooth', 'Saw Up': 'sawtooth' }; 
        n.lfo1.type = lfoForms[s.lfo1.type] || 'sine';
        n.lfo2.type = lfoForms[s.lfo2.type] || 'sine';
        
        setTarget(n.lfo1.frequency, getLfoFrequency(s.lfo1, state.bpm), now, RAMP);
        setTarget(n.lfo2.frequency, getLfoFrequency(s.lfo2, state.bpm), now, RAMP);

        setTarget(n.shaper1InputGain.gain, 1 + safe(s.osc1.waveshapeAmount)*5, now, RAMP);
        setTarget(n.shaper2InputGain.gain, 1 + safe(s.osc2.waveshapeAmount)*5, now, RAMP);
        
        setTarget(n.lfo1_ws1_modGain.gain, safe(s.osc1.wsLfoAmount) * 10, now, RAMP);
        setTarget(n.lfo1_ws2_modGain.gain, safe(s.osc2.wsLfoAmount) * 10, now, RAMP);
        
        setTarget(n.fm1Gain.gain, safe(s.osc2.fmDepth), now, RAMP);
        setTarget(n.fm2Gain.gain, safe(s.osc1.fmDepth), now, RAMP);
        
        const lastInput = lastModWheelValueRef.current;
        const rawMVal = (lastInput * safe(s.modWheel, 0)) + safe(s.modWheelOffset, 0);
        const clampedMVal = Math.min(1, Math.max(0, rawMVal));
        
        if (clampedMVal < 0.0001) {
            killParam(n.modWheelSource.offset, now);
        } else {
            setTarget(n.modWheelSource.offset, clampedMVal, now, RAMP);
        }

        // Helper to update matrix gains
        const updateMatrixGains = (srcName: string) => {
            MOD_DESTINATIONS.forEach(dst => {
                const rawVal = state.synthModMatrix[srcName]?.[dst] || 0;
                const val = isModMatrixMuted ? 0 : rawVal; 
                
                let scaledVal = val;
                if (dst.includes('Pitch')) scaledVal = val * 1200; 
                else if (dst.includes('Cutoff')) scaledVal = val * 2400; 
                else if (dst.includes('FM')) scaledVal = val * 1000;
                else if (dst.includes('Q')) scaledVal = val * 10;
                
                const node = n.modGains[`${srcName}_${dst}`];
                if (node) {
                    if (Math.abs(scaledVal) < 0.0001) killParam(node.gain, now);
                    else setTarget(node.gain, scaledVal, now, RAMP);
                }
            });
        };

        // Update gains for the actual sources based on matrix knob values.
        // The mod wheel's effect is now handled in the audio graph.
        MOD_SOURCES.forEach(src => updateMatrixGains(src));

    }, [state.synth, state.synthModMatrix, state.bpm, audioContext, state.isModMatrixMuted]);

    const playSample = useCallback((id: number, time: number, params: Partial<PlaybackParams> = {}) => {
        if (!audioContext || !samples[id]?.buffer) return;
        const s = samples[id], b = s.buffer, src = audioContext.createBufferSource();
        src.buffer = b;
        const { detune=0, pitch=s.pitch, velocity=1, volume=s.volume, start=s.start, end=s.end, decay=s.decay, loop=s.loop, lpFreq=s.lpFreq, hpFreq=s.hpFreq } = params;
        src.detune.value = (safe(pitch)*100)+safe(detune); src.loop = !!loop;
        let sO = safe(start)*b.duration, eO = safe(end)*b.duration; if (sO>=eO) eO=b.duration;
        if (loop) { src.loopStart=sO; src.loopEnd=eO; }
        const vg = audioContext.createGain(); vg.gain.value = 0;
        const l = lpFilterNodesRef.current[id], h = hpFilterNodesRef.current[id], g = sampleGainsRef.current[id];
        if (l) { src.connect(vg); vg.connect(l); } else return;
        const now = safe(time, audioContext.currentTime);
        setTarget(l.frequency, lpFreq!, now, 0.01); setTarget(h.frequency, hpFreq!, now, 0.01); setTarget(g.gain, volume, now, 0.01);
        setValue(vg.gain, velocity, now);
        if (decay!<1) vg.gain.exponentialRampToValueAtTime(0.001, now + safe(decay)*5);
        src.start(now, sO, !loop ? (eO-sO) : undefined);
        src.onended = () => { try { vg.disconnect(); } catch(e){} };
    }, [audioContext, samples]);

    const playSynthNote = useCallback((detune: number, time: number, params: { modWheel?: number; velocity?: number } = {}) => {
        if (!synthGraphRef.current || !audioContext) return;
        const n = synthGraphRef.current.nodes, s = stateRef.current.synth;
        const now = Math.max(audioContext.currentTime, safe(time, audioContext.currentTime));
        const startTime = now + 0.005; 
        
        const inputModWheel = safe(params.modWheel!==undefined?params.modWheel:0, 0);
        lastModWheelValueRef.current = inputModWheel; 
        
        const rawMVal = (inputModWheel * safe(s.modWheel, 0)) + safe(s.modWheelOffset, 0);
        const clampedMVal = Math.min(1, Math.max(0, rawMVal));
        
        if (clampedMVal < 0.0001) {
            killParam(n.modWheelSource.offset, startTime);
        } else {
            setTarget(n.modWheelSource.offset, clampedMVal, startTime, 0.005);
        }
        
        const mO = safe(s.masterOctave)*1200;
        const totalDetune1 = (safe(s.osc1.octave)*1200)+safe(s.osc1.detune)+mO+safe(detune);
        const totalDetune2 = (safe(s.osc2.octave)*1200)+safe(s.osc2.detune)+mO+safe(detune);

        // FIX: Check for 'detune' parameter existence instead of strict instanceof OscillatorNode check.
        const setPitch = (node: any, val: number) => {
            if (node && typeof node.detune === 'object') {
                setTarget(node.detune, val, startTime, 0.005);
            }
        };
        setPitch(n.oscSource1, totalDetune1);
        setPitch(n.oscSource2, totalDetune2);
        
        // --- VCA Envelope (Standard ADSR) ---
        const vcaGain = n.vca.gain;
        vcaGain.cancelScheduledValues(now);
        vcaGain.setValueAtTime(0, startTime);
        
        const velocity = safe(params.velocity, 1);
        const ampAttack = 0.001; 
        vcaGain.linearRampToValueAtTime(safe(s.masterGain, 1) * velocity, startTime + ampAttack);
        
        const ampDecay = Math.max(0.001, safe(s.ampEnv.decay, 0.5));
        vcaGain.exponentialRampToValueAtTime(0.001, startTime + ampAttack + ampDecay); 
        
        vcaGain.linearRampToValueAtTime(0, startTime + ampAttack + ampDecay + 0.01);
        
        
        // --- Filter Envelope (Standard ADSR) ---
        const { attack, decay, sustain } = s.filterEnv;
        const filterEnvGain = n.filterEnvGain.gain;
        filterEnvGain.cancelScheduledValues(now);
        filterEnvGain.setValueAtTime(0, startTime);
        
        const fltAttack = Math.max(0.001, safe(attack));
        const fltDecay = Math.max(0.001, safe(decay));
        const fltSustain = Math.max(0.001, Math.min(1, safe(sustain)));

        // 1. Attack -> 1.0 (Linear)
        filterEnvGain.linearRampToValueAtTime(1, startTime + fltAttack);
        
        // 2. Decay -> Sustain Level (Exponential)
        filterEnvGain.exponentialRampToValueAtTime(fltSustain, startTime + fltAttack + fltDecay);
        
        // 3. FIX: If Sustain is effectively 0, we MUST ramp to absolute 0 to prevent DC leak.
        if (fltSustain <= 0.001) {
            filterEnvGain.linearRampToValueAtTime(0, startTime + fltAttack + fltDecay + 0.01);
        }
        
    }, [audioContext]);

    const scheduleLfoRetrigger = useCallback((lfoIndex: number, time: number) => {
    }, [audioContext]);

    const loadSampleFromBlob = useCallback(async (blob: Blob, sampleId: number, name?: string) => {
        if (!audioContext) return;
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            dispatch({ type: ActionType.UPDATE_SAMPLE_PARAM, payload: { sampleId, param: 'buffer', value: audioBuffer } });
            if (name) {
                dispatch({ type: ActionType.UPDATE_SAMPLE_PARAM, payload: { sampleId, param: 'name', value: name } });
            }
            dispatch({ type: ActionType.SHOW_TOAST, payload: 'Sample Loaded' });
        } catch (e) {
            console.error(e);
            dispatch({ type: ActionType.SHOW_TOAST, payload: 'Error loading sample' });
        }
    }, [audioContext, dispatch]);

    const startRecording = useCallback(async () => {
        if (!audioContext) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            currentMicStreamRef.current = stream;
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                audioChunksRef.current.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); 
                loadSampleFromBlob(blob, stateRef.current.activeSampleId, "New Recording");
                stream.getTracks().forEach(t => t.stop());
            };

            recorder.start();
            dispatch({ type: ActionType.SET_RECORDING_STATE, payload: true });
        } catch (e) {
            console.error("Mic access denied", e);
            dispatch({ type: ActionType.SHOW_TOAST, payload: "Mic access denied" });
        }
    }, [audioContext, dispatch, loadSampleFromBlob]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            dispatch({ type: ActionType.SET_RECORDING_STATE, payload: false });
            dispatch({ type: ActionType.SET_ARMED_STATE, payload: false });
        }
    }, [dispatch]);

    const startMasterRecording = useCallback(() => {
        if (!audioContext || !masterGainRef.current) return;
        
        if (!masterDestNodeRef.current) {
            masterDestNodeRef.current = audioContext.createMediaStreamDestination();
            masterGainRef.current.connect(masterDestNodeRef.current);
        }

        const recorder = new MediaRecorder(masterDestNodeRef.current.stream);
        masterRecorderRef.current = recorder;
        masterChunksRef.current = [];

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) masterChunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
            const blob = new Blob(masterChunksRef.current, { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            a.download = `GrooveSampler_Master_${timestamp}.wav`;
            a.click();
            window.URL.revokeObjectURL(url);
        };

        recorder.start();
        dispatch({ type: ActionType.TOGGLE_MASTER_RECORDING });
    }, [audioContext, dispatch]);

    const stopMasterRecording = useCallback(() => {
        if (masterRecorderRef.current && masterRecorderRef.current.state !== 'inactive') {
            masterRecorderRef.current.stop();
            dispatch({ type: ActionType.TOGGLE_MASTER_RECORDING });
        }
    }, [dispatch]);

    const flushAllSources = useCallback(() => {
        activeSourcesRef.current.forEach((sources) => {
            sources.forEach(src => {
                try { src.stop(); } catch(e){}
            });
            sources.clear();
        });
    }, []);
    
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
