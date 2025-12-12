
import { useEffect, useRef, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { FXType, FilterFXParams, GlitchParams, StutterParams, ReverbParams } from '../types';
import { EXTENDED_DIVISIONS } from '../constants';
import { makeDistortionCurve } from '../utils/audio';

// Robust safety helper
const safe = (val: any, fallback: number = 0): number => {
    const n = Number(val);
    return (Number.isFinite(n) && !Number.isNaN(n)) ? n : fallback;
};

// Safe AudioParam setter
const setTarget = (param: AudioParam, value: number, time: number, timeConstant: number) => {
    if (!param) return;
    const v = safe(value, 0);
    const t = safe(time, 0);
    const tc = Math.max(0.001, safe(timeConstant, 0.01)); 
    
    if (Number.isFinite(v) && Number.isFinite(t) && Number.isFinite(tc)) {
        try {
            param.setTargetAtTime(v, t, tc);
        } catch (e) {
            // ignore
        }
    }
};

interface SlotNodes {
    inputNode: GainNode;
    outputNode: GainNode;
    wetGain: GainNode; 
    dryGain: GainNode; 
    effectInput: GainNode; 
    effectOutput: GainNode; 
}

interface EffectInstance {
    type: FXType;
    nodes: AudioNode[]; 
    updateParams: (params: any, ctx: AudioContext, bpm: number) => void;
}

export const useFxChain = () => {
    const { state } = useContext(AppContext);
    const { audioContext, performanceFx, bpm } = state;

    const chainInputRef = useRef<GainNode | null>(null);
    const chainOutputRef = useRef<GainNode | null>(null);
    const slotNodesRef = useRef<SlotNodes[]>([]);
    const activeEffectsRef = useRef<(EffectInstance | null)[]>([null, null, null, null]);

    // Initialize Graph Infrastructure (Slots)
    useEffect(() => {
        if (!audioContext || chainInputRef.current) return;

        const chainInput = audioContext.createGain();
        const chainOutput = audioContext.createGain();
        chainInputRef.current = chainInput;
        chainOutputRef.current = chainOutput;

        const slots: SlotNodes[] = [];
        for (let i = 0; i < 4; i++) {
            const inputNode = audioContext.createGain();
            const outputNode = audioContext.createGain();
            const wetGain = audioContext.createGain();
            const dryGain = audioContext.createGain();
            const effectInput = audioContext.createGain();
            const effectOutput = audioContext.createGain();

            inputNode.connect(dryGain);
            dryGain.connect(outputNode);

            inputNode.connect(wetGain);
            wetGain.connect(effectInput);
            
            // Initial pass-through connection (will be managed by effect instances)
            effectInput.connect(effectOutput); 
            effectOutput.connect(outputNode);

            slots.push({
                inputNode,
                outputNode,
                wetGain,
                dryGain,
                effectInput,
                effectOutput
            });
        }
        slotNodesRef.current = slots;

    }, [audioContext]);

    // --- Effect Instance Factory ---
    const createEffectInstance = (type: FXType, slotIndex: number, ctx: AudioContext): EffectInstance | null => {
        const slotNodes = slotNodesRef.current[slotIndex];
        if (!slotNodes) return null;

        // Disconnect pass-through
        try { slotNodes.effectInput.disconnect(slotNodes.effectOutput); } catch(e) {}

        const nodes: AudioNode[] = [];

        if (type === 'filter') {
            const filter = ctx.createBiquadFilter();
            const lfo = ctx.createOscillator();
            const lfoGain = ctx.createGain();
            
            slotNodes.effectInput.connect(filter);
            filter.connect(slotNodes.effectOutput);
            
            lfo.connect(lfoGain);
            lfoGain.connect(filter.frequency);
            lfo.start();

            nodes.push(filter, lfo, lfoGain);

            return {
                type,
                nodes,
                updateParams: (params: FilterFXParams, context, currentBpm) => {
                    const now = context.currentTime;
                    filter.type = params.type || 'lowpass';
                    
                    const pCutoff = safe(params.cutoff, 1);
                    const cutoffHz = 20 * Math.pow(20000 / 20, pCutoff);
                    setTarget(filter.frequency, cutoffHz, now, 0.02);
                    
                    setTarget(filter.Q, safe(params.resonance, 0) * 30, now, 0.02);
                    
                    const div = EXTENDED_DIVISIONS[Math.floor(safe(params.lfoRate, 0))] || EXTENDED_DIVISIONS[0];
                    const safeBpm = currentBpm > 0 ? currentBpm : 120;
                    const lfoHz = safeBpm / (60 * (div.value * 4)); 
                    
                    setTarget(lfo.frequency, lfoHz, now, 0.02);
                    setTarget(lfoGain.gain, safe(params.lfoAmount, 0) * 2000, now, 0.02); 
                }
            };
        } 
        else if (type === 'glitch') {
            const bufferSize = 4096;
            const processor = ctx.createScriptProcessor(bufferSize, 2, 2);
            
            let currentParams: GlitchParams = { crush: 0, rate: 0, shuffle: 0, mix: 1 };
            
            let holdL = 0;
            let holdR = 0;
            let sampleCounter = 0;

            processor.onaudioprocess = (e) => {
                const inputL = e.inputBuffer.getChannelData(0);
                const inputR = e.inputBuffer.getChannelData(1);
                const outputL = e.outputBuffer.getChannelData(0);
                const outputR = e.outputBuffer.getChannelData(1);
                
                const rate = safe(currentParams.rate, 0);
                const crush = safe(currentParams.crush, 0);
                const shuffle = safe(currentParams.shuffle, 0);

                const holdSteps = 1 + Math.floor(Math.pow(rate, 2) * 100);
                
                const bitDepth = 16 - (crush * 15);
                const levels = Math.pow(2, Math.max(1, bitDepth));

                for (let i = 0; i < bufferSize; i++) {
                    if (sampleCounter % holdSteps === 0) {
                        holdL = inputL[i];
                        holdR = inputR[i];
                        if (shuffle > 0 && Math.random() < shuffle * 0.1) {
                            sampleCounter -= Math.floor(Math.random() * holdSteps);
                        }
                    }
                    sampleCounter++;

                    let valL = Math.floor(holdL * levels) / levels;
                    let valR = Math.floor(holdR * levels) / levels;

                    outputL[i] = safe(valL, 0);
                    outputR[i] = safe(valR, 0);
                }
            };

            slotNodes.effectInput.connect(processor);
            processor.connect(slotNodes.effectOutput);
            nodes.push(processor);
            
            return {
                type,
                nodes,
                updateParams: (params: GlitchParams) => {
                    currentParams = params;
                }
            };
        }
        else if (type === 'stutter') {
            const bufferSize = 4096;
            const processor = ctx.createScriptProcessor(bufferSize, 2, 2);
            
            const maxDuration = 4; 
            const sampleRate = ctx.sampleRate;
            const totalSamples = maxDuration * sampleRate;
            const leftBuffer = new Float32Array(totalSamples);
            const rightBuffer = new Float32Array(totalSamples);
            
            const freezeMaxSamples = sampleRate * 2; 
            const freezeLeft = new Float32Array(freezeMaxSamples);
            const freezeRight = new Float32Array(freezeMaxSamples);
            
            let writeHead = 0;
            let freezeLength = 0;
            let freezePlayHead = 0;
            let isFrozen = false;
            
            let currentParams: StutterParams = { division: 12, speed: 1, feedback: 0, mix: 1 };
            let currentBpm = 120;

            processor.onaudioprocess = (e) => {
                const inputL = e.inputBuffer.getChannelData(0);
                const inputR = e.inputBuffer.getChannelData(1);
                const outputL = e.outputBuffer.getChannelData(0);
                const outputR = e.outputBuffer.getChannelData(1);
                
                const safeBpm = currentBpm > 0 ? currentBpm : 120;
                const samplesPerBeat = (sampleRate * 60) / safeBpm;
                const divConfig = EXTENDED_DIVISIONS[Math.floor(safe(currentParams.division, 0))] || EXTENDED_DIVISIONS[0];
                const targetLoopLength = Math.max(128, Math.floor(samplesPerBeat * divConfig.value));

                const shouldFreeze = safe(currentParams.feedback, 0) > 0.5;

                if (shouldFreeze && !isFrozen) {
                    isFrozen = true;
                    freezeLength = targetLoopLength;
                    if (freezeLength > freezeMaxSamples) freezeLength = freezeMaxSamples;
                    
                    let readPtr = writeHead - freezeLength;
                    if (readPtr < 0) readPtr += totalSamples;
                    
                    for(let j=0; j<freezeLength; j++) {
                        freezeLeft[j] = leftBuffer[readPtr];
                        freezeRight[j] = rightBuffer[readPtr];
                        readPtr++;
                        if (readPtr >= totalSamples) readPtr = 0;
                    }
                    freezePlayHead = 0;
                } 
                else if (!shouldFreeze) {
                    isFrozen = false;
                }

                const speed = safe(currentParams.speed, 1);

                for (let i = 0; i < bufferSize; i++) {
                    leftBuffer[writeHead] = inputL[i];
                    rightBuffer[writeHead] = inputR[i];
                    writeHead++;
                    if (writeHead >= totalSamples) writeHead = 0;

                    if (isFrozen) {
                        let idx = Math.floor(freezePlayHead);
                        while(idx >= freezeLength) idx -= freezeLength;
                        while(idx < 0) idx += freezeLength;
                        
                        outputL[i] = safe(freezeLeft[idx], 0);
                        outputR[i] = safe(freezeRight[idx], 0);
                        
                        freezePlayHead += speed;
                        if (freezePlayHead >= freezeLength) freezePlayHead -= freezeLength;
                        if (freezePlayHead < 0) freezePlayHead += freezeLength;

                    } else {
                        outputL[i] = inputL[i];
                        outputR[i] = inputR[i];
                    }
                }
            };

            slotNodes.effectInput.connect(processor);
            processor.connect(slotNodes.effectOutput);
            nodes.push(processor);

            return {
                type,
                nodes,
                updateParams: (params: StutterParams, context, bpm) => {
                    currentParams = params;
                    currentBpm = bpm;
                }
            };
        }
        else if (type === 'reverb') {
            const input = ctx.createGain();
            const output = ctx.createGain();
            const reverbNodes: AudioNode[] = [input, output];

            const preDelay = ctx.createDelay(0.1);
            input.connect(preDelay);
            reverbNodes.push(preDelay);

            const combDelays = [0.0297, 0.0371, 0.0411, 0.0437, 0.0487, 0.0571]; 
            const combOutput = ctx.createGain();
            combOutput.gain.value = 0.2; 
            reverbNodes.push(combOutput);

            const combs: { delay: DelayNode, gain: GainNode, filter: BiquadFilterNode }[] = [];

            combDelays.forEach(delayTime => {
                const cd = ctx.createDelay(0.1);
                const cg = ctx.createGain();
                const cf = ctx.createBiquadFilter(); 
                
                cd.delayTime.value = delayTime;
                cf.type = 'lowpass';
                cf.Q.value = 0; 
                
                preDelay.connect(cf);
                cf.connect(cd);
                cd.connect(combOutput);
                
                cd.connect(cg);
                cg.connect(cf);

                reverbNodes.push(cd, cg, cf);
                combs.push({ delay: cd, gain: cg, filter: cf });
            });

            const ap1 = ctx.createBiquadFilter();
            ap1.type = 'allpass';
            ap1.frequency.value = 1050;
            ap1.Q.value = 0.7;
            
            const ap2 = ctx.createBiquadFilter();
            ap2.type = 'allpass';
            ap2.frequency.value = 340;
            ap2.Q.value = 0.7;

            combOutput.connect(ap1);
            ap1.connect(ap2);
            ap2.connect(output);
            
            reverbNodes.push(ap1, ap2);

            slotNodes.effectInput.connect(input);
            output.connect(slotNodes.effectOutput);

            return {
                type,
                nodes: reverbNodes,
                updateParams: (params: ReverbParams, context, bpm) => {
                    const now = context.currentTime;
                    const feedback = 0.5 + (safe(params.size, 0) * 0.4); 
                    combs.forEach(c => setTarget(c.gain.gain, feedback, now, 0.02));

                    const dampFreq = 100 + Math.pow(safe(params.damping, 0), 2) * 8000;
                    combs.forEach(c => setTarget(c.filter.frequency, dampFreq, now, 0.02));

                    const delayMod = 0.01 + (safe(params.mod, 0) * 0.005);
                    setTarget(preDelay.delayTime, delayMod, now, 0.1); 
                }
            };
        }

        return null;
    };

    // --- Dynamic Instance Management & Parameter Updates ---
    useEffect(() => {
        if (!audioContext || slotNodesRef.current.length === 0) return;

        performanceFx.slots.forEach((slotData, index) => {
            let instance = activeEffectsRef.current[index];

            if (!instance || instance.type !== slotData.type) {
                if (instance) {
                    instance.nodes.forEach(n => {
                        try { n.disconnect(); } catch(e){}
                        if (n instanceof OscillatorNode) {
                            try { n.stop(); } catch(e){}
                        }
                    });
                }
                instance = createEffectInstance(slotData.type, index, audioContext);
                activeEffectsRef.current[index] = instance;
            }

            if (instance) {
                instance.updateParams(slotData.params, audioContext, bpm);
            }
        });

    }, [audioContext, performanceFx.slots, bpm]);


    // Handle Dynamic Routing
    useEffect(() => {
        if (!audioContext || !chainInputRef.current || slotNodesRef.current.length === 0) return;

        const slots = slotNodesRef.current;
        const { routing } = performanceFx;

        chainInputRef.current.disconnect();
        slots.forEach(slot => {
            slot.outputNode.disconnect();
        });

        let currentSource: AudioNode = chainInputRef.current;

        routing.forEach(slotIndex => {
            const slot = slots[slotIndex];
            if (slot) {
                currentSource.connect(slot.inputNode);
                currentSource = slot.outputNode;
            }
        });

        currentSource.connect(chainOutputRef.current!);

    }, [audioContext, performanceFx.routing]);

    // Handle Bypass Logic & MIX Implementation
    useEffect(() => {
        if (!audioContext || slotNodesRef.current.length === 0) return;
        
        const now = audioContext.currentTime;
        const RAMP = 0.02;

        performanceFx.slots.forEach((slotData, i) => {
            const nodes = slotNodesRef.current[i];
            if (!nodes) return;
            
            if (slotData.isOn) {
                // Get Mix value (default to 1 if undefined)
                const mix = safe(slotData.params.mix, 1);
                
                // Crossfade Logic:
                // Dry = 1 - mix
                // Wet (Output of Effect) = mix
                // Input to Effect = 1 (Always feed effect for tails, etc.)
                
                setTarget(nodes.dryGain.gain, 1 - mix, now, RAMP);
                setTarget(nodes.effectOutput.gain, mix, now, RAMP);
                setTarget(nodes.wetGain.gain, 1, now, RAMP); 
            } else {
                // BYPASSED
                setTarget(nodes.dryGain.gain, 1, now, RAMP);
                setTarget(nodes.wetGain.gain, 0, now, RAMP); // Cut input to effect

                if (slotData.bypassMode === 'hard') {
                    setTarget(nodes.effectOutput.gain, 0, now, RAMP); // Cut output (no tails)
                } else {
                    // Soft bypass: Allow effect output to ring out (tails)
                    // But we want the *current* state of the effect output to fade naturally or stay connected?
                    // Typically soft bypass means stop feeding input, but let output play.
                    // We set wetGain to 0 (stop feeding input).
                    // We keep effectOutputGain at 1? Or 0?
                    // If we set it to 1, we might hear the tail at full volume.
                    // Let's assume soft bypass keeps the output open.
                    setTarget(nodes.effectOutput.gain, 1, now, RAMP);
                }
            }
        });

    }, [audioContext, performanceFx.slots]);

    return {
        inputNode: chainInputRef.current,
        outputNode: chainOutputRef.current,
        slotNodes: slotNodesRef.current
    };
};
