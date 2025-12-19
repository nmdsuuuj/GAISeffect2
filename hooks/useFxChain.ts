
import { useEffect, useRef, useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { FXType, FilterFXParams, GlitchParams, StutterParams, ReverbParams, DJLooperParams } from '../types';
import { EXTENDED_DIVISIONS } from '../constants';

const safe = (val: any, fallback: number = 0): number => {
    const n = Number(val);
    return (Number.isFinite(n) && !Number.isNaN(n)) ? n : fallback;
};

const setTarget = (param: AudioParam, value: number, time: number, timeConstant: number) => {
    if (!param) return;
    const v = safe(value, 0);
    const t = safe(time, 0);
    const tc = Math.max(0.001, safe(timeConstant, 0.01)); 
    try {
        // REMOVED: param.cancelScheduledValues(t); -> Fixes zipper noise
        param.setTargetAtTime(v, t, tc);
    } catch (e) {}
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
    inputNode: AudioNode; 
    updateParams: (params: any, ctx: AudioContext, bpm: number, isOn: boolean) => void;
}

export const useFxChain = () => {
    const { state } = useContext(AppContext);
    const { audioContext, performanceFx, bpm } = state;

    const [isReady, setIsReady] = useState(false);
    const chainInputRef = useRef<GainNode | null>(null);
    const chainOutputRef = useRef<GainNode | null>(null);
    const slotNodesRef = useRef<SlotNodes[]>([]);
    const activeEffectsRef = useRef<(EffectInstance | null)[]>([null, null, null, null]);

    // Infrastructure setup (once per audio context)
    useEffect(() => {
        if (!audioContext || chainInputRef.current) return;

        chainInputRef.current = audioContext.createGain();
        chainOutputRef.current = audioContext.createGain();

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
            effectOutput.connect(outputNode);

            slots.push({ inputNode, outputNode, wetGain, dryGain, effectInput, effectOutput });
        }
        slotNodesRef.current = slots;
        setIsReady(true);
    }, [audioContext]);

    const createEffectInstance = (type: FXType, slotIndex: number, ctx: AudioContext): EffectInstance | null => {
        const slotNodes = slotNodesRef.current[slotIndex];
        if (!slotNodes) return null;

        const nodes: AudioNode[] = [];
        let inputNode: AudioNode;

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
            inputNode = filter;

            return {
                type, nodes, inputNode,
                updateParams: (params: FilterFXParams, context, currentBpm) => {
                    const now = context.currentTime;
                    filter.type = params.type || 'lowpass';
                    setTarget(filter.frequency, 20 * Math.pow(20000 / 20, safe(params.cutoff, 1)), now, 0.02);
                    setTarget(filter.Q, safe(params.resonance, 0) * 30, now, 0.02);
                    const div = EXTENDED_DIVISIONS[Math.floor(safe(params.lfoRate, 0))] || EXTENDED_DIVISIONS[0];
                    const safeBpm = Math.max(20, currentBpm || 120);
                    setTarget(lfo.frequency, safeBpm / (60 * (div.value * 4)), now, 0.02);
                    setTarget(lfoGain.gain, safe(params.lfoAmount, 0) * 2000, now, 0.02); 
                }
            };
        } 
        else if (type === 'glitch') {
            const processor = ctx.createScriptProcessor(1024, 2, 2);
            let currentParams: GlitchParams = { crush: 0, rate: 0, shuffle: 0, mix: 1 };
            let active = false;
            let holdL = 0, holdR = 0, sampleCounter = 0;

            processor.onaudioprocess = (e) => {
                const inL = e.inputBuffer.getChannelData(0), inR = e.inputBuffer.getChannelData(1);
                const outL = e.outputBuffer.getChannelData(0), outR = e.outputBuffer.getChannelData(1);
                if (!active) { outL.set(inL); outR.set(inR); return; }
                
                const holdSteps = 1 + Math.floor(Math.pow(safe(currentParams.rate), 2) * 200);
                const levels = Math.pow(2, 16 - (safe(currentParams.crush) * 15));
                const shuffle = safe(currentParams.shuffle);

                for (let i = 0; i < processor.bufferSize; i++) {
                    if (sampleCounter % holdSteps === 0) {
                        holdL = inL[i]; holdR = inR[i];
                        if (shuffle > 0 && Math.random() < shuffle * 0.1) sampleCounter -= Math.floor(Math.random() * holdSteps);
                    }
                    sampleCounter++;
                    outL[i] = Math.floor(holdL * levels) / levels;
                    outR[i] = Math.floor(holdR * levels) / levels;
                }
            };
            slotNodes.effectInput.connect(processor);
            processor.connect(slotNodes.effectOutput);
            nodes.push(processor);
            inputNode = processor;
            return { type, nodes, inputNode, updateParams: (params, _, __, isOn) => { currentParams = params; active = isOn; } };
        }
        else if (type === 'stutter') {
            const processor = ctx.createScriptProcessor(1024, 2, 2);
            const rSize = ctx.sampleRate * 20; 
            const rL = new Float32Array(rSize), rR = new Float32Array(rSize);
            const bL = new Float32Array(rSize), bR = new Float32Array(rSize);
            let wIdx = 0, isStut = false;
            let activeParams: StutterParams = { division: 12, speed: 1, feedback: 0, mix: 1 };
            let targetParams: StutterParams = { ...activeParams };
            let bpm = 120, len = 0, pIdx = 0, active = false;
            let sampleCounterSinceLast16th = 0, recapture_request = false;

            processor.onaudioprocess = (e) => {
                const inL = e.inputBuffer.getChannelData(0), inR = e.inputBuffer.getChannelData(1);
                const outL = e.outputBuffer.getChannelData(0), outR = e.outputBuffer.getChannelData(1);
                if (!active) { outL.set(inL); outR.set(inR); return; }
                
                const samplesPer16th = (ctx.sampleRate * 60 / bpm) / 4;
                sampleCounterSinceLast16th += processor.bufferSize;
                if (sampleCounterSinceLast16th >= samplesPer16th) {
                    sampleCounterSinceLast16th = 0;
                    if (targetParams.division !== activeParams.division) {
                        activeParams.division = targetParams.division;
                        recapture_request = true;
                    }
                }
                activeParams.speed = targetParams.speed;
                activeParams.feedback = targetParams.feedback;
                activeParams.mix = targetParams.mix;

                const freeze = safe(activeParams.feedback) > 0.05;
                if (freeze && (recapture_request || !isStut)) {
                    isStut = true; pIdx = 0; recapture_request = false;
                    const div = EXTENDED_DIVISIONS[Math.floor(safe(activeParams.division) * (EXTENDED_DIVISIONS.length-1))] || EXTENDED_DIVISIONS[0];
                    const safeBpm = Math.max(20, bpm || 120);
                    
                    const calculatedLen = Math.floor(((ctx.sampleRate * 60)/safeBpm) * div.value);
                    len = Math.min(rSize, Math.max(128, calculatedLen));

                    let rp = (wIdx - len + rSize) % rSize;
                    for (let i = 0; i < len; i++) { 
                        bL[i] = rL[rp]; bR[i] = rR[rp]; 
                        rp = (rp + 1) % rSize; 
                    }
                } else if (!freeze) isStut = false;

                for (let i = 0; i < processor.bufferSize; i++) {
                    rL[wIdx] = inL[i]; rR[wIdx] = inR[i]; wIdx = (wIdx + 1) % rSize;
                    if (isStut && len > 0) {
                        const spd = (safe(activeParams.speed, 0.75) - 0.5) * 4;
                        const idx = Math.floor(pIdx);
                        const safeIdx = ((idx % len) + len) % len;
                        
                        let sL = bL[safeIdx], sR = bR[safeIdx];
                        const f = Math.min(256, len >> 2);
                        if (safeIdx < f) { const sc = safeIdx/f; sL *= sc; sR *= sc; }
                        else if (safeIdx > len - f) { const sc = (len-safeIdx)/f; sL *= sc; sR *= sc; }
                        
                        outL[i] = sL; outR[i] = sR;
                        pIdx = (pIdx + spd + len) % len;
                    } else { outL[i] = inL[i]; outR[i] = inR[i]; }
                }
            };
            slotNodes.effectInput.connect(processor);
            processor.connect(slotNodes.effectOutput);
            nodes.push(processor);
            inputNode = processor;
            return { type, nodes, inputNode, updateParams: (p, _, b, isOn) => { targetParams = p; bpm = b; active = isOn; } };
        }
        else if (type === 'reverb') {
            const input = ctx.createGain(), output = ctx.createGain();
            const preDelay = ctx.createDelay(0.1); input.connect(preDelay);
            const combDelays = [0.0297, 0.0371, 0.0411, 0.0437, 0.0487, 0.0571];
            const combOut = ctx.createGain(); combOut.gain.value = 0.2;
            const combs: any[] = [];
            combDelays.forEach(dt => {
                const cd = ctx.createDelay(0.1), cg = ctx.createGain(), cf = ctx.createBiquadFilter();
                cd.delayTime.value = dt; cf.type = 'lowpass';
                preDelay.connect(cf); cf.connect(cd); cd.connect(combOut); cd.connect(cg); cg.connect(cf);
                nodes.push(cd, cg, cf); combs.push({ cg, cf });
            });
            const ap1 = ctx.createBiquadFilter(), ap2 = ctx.createBiquadFilter();
            ap1.type = 'allpass'; ap1.frequency.value = 1050; ap2.type = 'allpass'; ap2.frequency.value = 340;
            combOut.connect(ap1); ap1.connect(ap2); ap2.connect(output);
            nodes.push(input, output, preDelay, combOut, ap1, ap2);
            slotNodes.effectInput.connect(input);
            output.connect(slotNodes.effectOutput);
            inputNode = input;
            return { type, nodes, inputNode, updateParams: (p, context) => {
                const now = context.currentTime;
                combs.forEach(c => {
                    setTarget(c.cg.gain, 0.5 + (safe(p.size) * 0.4), now, 0.05);
                    setTarget(c.cf.frequency, 100 + Math.pow(safe(p.damping), 2) * 8000, now, 0.05);
                });
                setTarget(preDelay.delayTime, 0.01 + (safe(p.mod) * 0.005), now, 0.1);
            }};
        }
        else if (type === 'djLooper') {
            const processor = ctx.createScriptProcessor(1024, 2, 2);
            const rSize = ctx.sampleRate * 20;
            const rL = new Float32Array(rSize), rR = new Float32Array(rSize);
            const bL = new Float32Array(rSize), bR = new Float32Array(rSize);
            let wIdx = 0, loopLen = 0, pIdx = 0, isLoop = false, bpm = 120, active = false;
            let activeParams: DJLooperParams = { loopDivision: 12, lengthMultiplier: 1, fadeTime: 0.01, mix: 1 };
            let targetParams: DJLooperParams = { ...activeParams };
            let sampleCounterSinceLast16th = 0;
            let recapture_request = false;
            let loop_fade_gain = 1.0;
            let currentCrossfade = 0; 

            processor.onaudioprocess = (e) => {
                const inL = e.inputBuffer.getChannelData(0), inR = e.inputBuffer.getChannelData(1);
                const outL = e.outputBuffer.getChannelData(0), outR = e.outputBuffer.getChannelData(1);
                if (!active) { outL.set(inL); outR.set(inR); return; }

                const samplesPer16th = (ctx.sampleRate * 60 / bpm) / 4;
                sampleCounterSinceLast16th += processor.bufferSize;
                if(sampleCounterSinceLast16th >= samplesPer16th) {
                    sampleCounterSinceLast16th = 0;
                    if (targetParams.loopDivision !== activeParams.loopDivision || targetParams.lengthMultiplier !== activeParams.lengthMultiplier) {
                        activeParams.loopDivision = targetParams.loopDivision;
                        activeParams.lengthMultiplier = targetParams.lengthMultiplier;
                        recapture_request = true;
                    }
                }
                activeParams.fadeTime = targetParams.fadeTime;
                activeParams.mix = targetParams.mix;

                const perSampleFadeIncrement = (1 / ctx.sampleRate) / Math.max(0.001, safe(activeParams.fadeTime, 0.01));
                const shouldLoop = safe(activeParams.mix) > 0.01; 

                if (!shouldLoop) {
                    isLoop = false;
                }

                if (shouldLoop && (recapture_request || !isLoop)) {
                    isLoop = true;
                    recapture_request = false;
                    pIdx = 0;
                    loop_fade_gain = 0.0; // Trigger fade-in for the new loop
                    
                    const div = EXTENDED_DIVISIONS[Math.floor(safe(activeParams.loopDivision) * (EXTENDED_DIVISIONS.length - 1))] || EXTENDED_DIVISIONS[0];
                    const safeBpm = Math.max(20, bpm || 120);
                    const calculatedLen = Math.floor(((ctx.sampleRate * 60) / safeBpm) * div.value * (1 + Math.floor(safe(activeParams.lengthMultiplier) * 7)));
                    loopLen = Math.min(rSize, Math.max(256, calculatedLen));

                    let rp = (wIdx - loopLen + rSize) % rSize;
                    for (let i = 0; i < loopLen; i++) {
                        bL[i] = rL[rp]; bR[i] = rR[rp];
                        rp = (rp + 1) % rSize;
                    }
                }

                for (let i = 0; i < processor.bufferSize; i++) {
                    rL[wIdx] = inL[i]; rR[wIdx] = inR[i]; wIdx = (wIdx + 1) % rSize;

                    const target = shouldLoop ? 1.0 : 0.0;
                    if (currentCrossfade < target) {
                        currentCrossfade = Math.min(target, currentCrossfade + perSampleFadeIncrement);
                    } else if (currentCrossfade > target) {
                        currentCrossfade = Math.max(target, currentCrossfade - perSampleFadeIncrement);
                    }

                    let sL = 0, sR = 0;
                    if (isLoop && loopLen > 0) {
                        const safeIdx = ((pIdx % loopLen) + loopLen) % loopLen;
                        sL = bL[safeIdx];
                        sR = bR[safeIdx];
                        pIdx = (pIdx + 1) % loopLen;

                        if (loop_fade_gain < 1.0) {
                            loop_fade_gain += 0.004; // Fades in over ~250 samples (5-6ms)
                            if (loop_fade_gain > 1.0) loop_fade_gain = 1.0;
                        }
                        sL *= loop_fade_gain;
                        sR *= loop_fade_gain;

                        const fadeLen = Math.min(256, loopLen >> 2);
                        if (safeIdx < fadeLen) {
                            const gain = safeIdx / fadeLen;
                            sL *= gain; sR *= gain;
                        } else if (safeIdx > loopLen - fadeLen) {
                            const gain = (loopLen - safeIdx) / fadeLen;
                            sL *= gain; sR *= gain;
                        }
                    } else {
                        loop_fade_gain = 1.0;
                    }

                    outL[i] = (inL[i] * (1 - currentCrossfade)) + (sL * currentCrossfade);
                    outR[i] = (inR[i] * (1 - currentCrossfade)) + (sR * currentCrossfade);
                }
            };
            slotNodes.effectInput.connect(processor);
            processor.connect(slotNodes.effectOutput);
            nodes.push(processor);
            inputNode = processor;
            return {
                type, nodes, inputNode,
                updateParams: (p, _, b, isOn) => {
                    targetParams = p; bpm = b; active = isOn;
                }
            };
        }
        return null;
    };

    useEffect(() => {
        if (!audioContext || slotNodesRef.current.length === 0) return;
        performanceFx.slots.forEach((slotData, index) => {
            const slotNodes = slotNodesRef.current[index];
            let instance = activeEffectsRef.current[index];
            if (!instance || instance.type !== slotData.type) {
                if (instance) {
                    try { slotNodes.effectInput.disconnect(); } catch(e){}
                    instance.nodes.forEach(n => { try { n.disconnect(); } catch(e){} });
                }
                instance = createEffectInstance(slotData.type, index, audioContext);
                activeEffectsRef.current[index] = instance;
            }
            if (instance) instance.updateParams(slotData.params, audioContext, bpm, slotData.isOn);
        });
    }, [audioContext, performanceFx.slots, bpm]);

    useEffect(() => {
        if (!audioContext || !chainInputRef.current || slotNodesRef.current.length === 0) return;
        const slots = slotNodesRef.current;
        chainInputRef.current.disconnect();
        slots.forEach(s => s.outputNode.disconnect());
        let src: AudioNode = chainInputRef.current;
        performanceFx.routing.forEach(idx => {
            const s = slots[idx];
            if (s) { src.connect(s.inputNode); src = s.outputNode; }
        });
        src.connect(chainOutputRef.current!);
    }, [audioContext, performanceFx.routing]);

    useEffect(() => {
        if (!audioContext || slotNodesRef.current.length === 0) return;
        const now = audioContext.currentTime, RAMP = 0.02;
        performanceFx.slots.forEach((slotData, i) => {
            const nodes = slotNodesRef.current[i];
            if (!nodes) return;
            if (slotData.isOn) {
                const mix = safe(slotData.params.mix, 1);
                setTarget(nodes.dryGain.gain, 1 - mix, now, RAMP);
                setTarget(nodes.effectOutput.gain, mix, now, RAMP);
                setTarget(nodes.wetGain.gain, 1, now, RAMP); 
            } else {
                setTarget(nodes.dryGain.gain, 1, now, RAMP);
                setTarget(nodes.wetGain.gain, 0, now, RAMP);
                setTarget(nodes.effectOutput.gain, 0, now, RAMP); 
            }
        });
    }, [audioContext, performanceFx.slots]);

    return { 
        inputNode: chainInputRef.current, 
        outputNode: chainOutputRef.current,
        isReady: isReady // Return state
    };
};
