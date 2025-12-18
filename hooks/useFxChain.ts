
import { useEffect, useRef, useContext, useMemo } from 'react';
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
        param.cancelScheduledValues(t);
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
                    setTarget(lfo.frequency, (currentBpm || 120) / (60 * (div.value * 4)), now, 0.02);
                    setTarget(lfoGain.gain, safe(params.lfoAmount, 0) * 2000, now, 0.02); 
                }
            };
        } 
        else if (type === 'glitch') {
            const processor = ctx.createScriptProcessor(512, 2, 2);
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
            const processor = ctx.createScriptProcessor(512, 2, 2);
            const rSize = ctx.sampleRate * 4, rL = new Float32Array(rSize), rR = new Float32Array(rSize);
            const bL = new Float32Array(rSize), bR = new Float32Array(rSize);
            let wIdx = 0, isStut = false, curP: StutterParams = { division: 12, speed: 1, feedback: 0, mix: 1 };
            let bpm = 120, len = 0, pIdx = 0, lastDiv = -1, active = false;

            processor.onaudioprocess = (e) => {
                const inL = e.inputBuffer.getChannelData(0), inR = e.inputBuffer.getChannelData(1);
                const outL = e.outputBuffer.getChannelData(0), outR = e.outputBuffer.getChannelData(1);
                if (!active) { outL.set(inL); outR.set(inR); return; }

                const freeze = safe(curP.feedback) > 0.05;
                if (freeze && (!isStut || curP.division !== lastDiv)) {
                    isStut = true; pIdx = 0; lastDiv = curP.division;
                    const div = EXTENDED_DIVISIONS[Math.floor(safe(curP.division) * (EXTENDED_DIVISIONS.length-1))] || EXTENDED_DIVISIONS[0];
                    len = Math.max(128, Math.floor(((ctx.sampleRate * 60)/bpm) * div.value));
                    let rp = (wIdx - len + rSize) % rSize;
                    for (let i = 0; i < len; i++) { bL[i] = rL[rp]; bR[i] = rR[rp]; rp = (rp + 1) % rSize; }
                } else if (!freeze) isStut = false;

                for (let i = 0; i < processor.bufferSize; i++) {
                    rL[wIdx] = inL[i]; rR[wIdx] = inR[i]; wIdx = (wIdx + 1) % rSize;
                    if (isStut && len > 0) {
                        const spd = (safe(curP.speed, 0.75) - 0.5) * 4;
                        const idx = Math.floor(pIdx);
                        let sL = bL[idx % len], sR = bR[idx % len];
                        const f = 200;
                        if (pIdx < f) { const sc = pIdx/f; sL *= sc; sR *= sc; }
                        else if (pIdx > len - f) { const sc = (len-pIdx)/f; sL *= sc; sR *= sc; }
                        outL[i] = sL; outR[i] = sR;
                        pIdx = (pIdx + spd + len) % len;
                    } else { outL[i] = inL[i]; outR[i] = inR[i]; }
                }
            };
            slotNodes.effectInput.connect(processor);
            processor.connect(slotNodes.effectOutput);
            nodes.push(processor);
            inputNode = processor;
            return { type, nodes, inputNode, updateParams: (p, _, b, isOn) => { curP = p; bpm = b; active = isOn; } };
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
            const processor = ctx.createScriptProcessor(512, 2, 2);
            const rSize = ctx.sampleRate * 4, rL = new Float32Array(rSize), rR = new Float32Array(rSize);
            const bL = new Float32Array(rSize), bR = new Float32Array(rSize);
            let wIdx = 0, loopLen = 0, pIdx = 0, isLoop = false, bpm = 120, lastDiv = -1, lastMult = -1, active = false;
            let curP: DJLooperParams = { loopDivision: 12, lengthMultiplier: 1, fadeTime: 0.01, mix: 1 };

            processor.onaudioprocess = (e) => {
                const inL = e.inputBuffer.getChannelData(0), inR = e.inputBuffer.getChannelData(1);
                const outL = e.outputBuffer.getChannelData(0), outR = e.outputBuffer.getChannelData(1);
                if (!active) { outL.set(inL); outR.set(inR); return; }

                const should = safe(curP.mix) > 0.1;
                if (should && (!isLoop || curP.loopDivision !== lastDiv || curP.lengthMultiplier !== lastMult)) {
                    isLoop = true; pIdx = 0; lastDiv = curP.loopDivision; lastMult = curP.lengthMultiplier;
                    const div = EXTENDED_DIVISIONS[Math.floor(safe(curP.loopDivision) * (EXTENDED_DIVISIONS.length-1))] || EXTENDED_DIVISIONS[0];
                    loopLen = Math.max(256, Math.floor(((ctx.sampleRate * 60)/bpm) * div.value * (1 + Math.floor(safe(curP.lengthMultiplier) * 7))));
                    let rp = (wIdx - loopLen + rSize) % rSize;
                    for (let i = 0; i < loopLen; i++) { bL[i] = rL[rp]; bR[i] = rR[rp]; rp = (rp + 1) % rSize; }
                } else if (!should) isLoop = false;

                for (let i = 0; i < processor.bufferSize; i++) {
                    rL[wIdx] = inL[i]; rR[wIdx] = inR[i]; wIdx = (wIdx + 1) % rSize;
                    if (isLoop && loopLen > 0) {
                        let sL = bL[pIdx], sR = bR[pIdx];
                        const f = 250;
                        if (pIdx < f) { const sc = pIdx/f; sL *= sc; sR *= sc; }
                        else if (pIdx > loopLen - f) { const sc = (loopLen-pIdx)/f; sL *= sc; sR *= sc; }
                        outL[i] = sL; outR[i] = sR;
                        pIdx = (pIdx + 1) % loopLen;
                    } else { outL[i] = inL[i]; outR[i] = inR[i]; }
                }
            };
            slotNodes.effectInput.connect(processor);
            processor.connect(slotNodes.effectOutput);
            nodes.push(processor);
            inputNode = processor;
            return { type, nodes, inputNode, updateParams: (p, _, b, isOn) => { curP = p; bpm = b; active = isOn; } };
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
        isReady: !!chainInputRef.current 
    };
};
