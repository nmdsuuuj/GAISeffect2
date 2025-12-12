
import { useState, useEffect, useContext, useRef } from 'react';
import { AppContext } from '../context/AppContext';

export const useCpuLoad = () => {
    // Fix: Correctly destructure `audioContext` from the `state` object provided by the context.
    const { state } = useContext(AppContext);
    const { audioContext } = state;
    const [cpuLoad, setCpuLoad] = useState(0);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    useEffect(() => {
        if (!audioContext || processorRef.current) return;

        // ScriptProcessorNode is deprecated but is the simplest way to get a recurring callback
        // in the audio thread for this kind of monitoring without a full AudioWorklet.
        const bufferSize = 4096;
        const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
        
        let lastPlaybackTime = audioContext.currentTime;
        let smoothedLoad = 0;

        processor.onaudioprocess = (e) => {
            const now = e.playbackTime;
            const elapsedTime = now - lastPlaybackTime;
            const expectedTime = e.inputBuffer.duration;
            
            // Calculate jitter: the difference between expected time and actual elapsed time.
            // A positive jitter means the audio thread is lagging.
            const jitter = elapsedTime - expectedTime;
            // Normalize: jitter / expectedTime gives a ratio. 
            // If jitter is 0, load is 0%. If jitter is equal to duration (took 2x time), load is 100%.
            const load = Math.max(0, (jitter / expectedTime) * 100);

            // Smooth the value to make it more readable
            smoothedLoad = smoothedLoad * 0.9 + load * 0.1;
            lastPlaybackTime = now;
        };

        // Connect to the graph to start processing. It doesn't need to process any audio signal, just exist.
        processor.connect(audioContext.destination);
        processorRef.current = processor;

        const updateDisplay = () => {
            setCpuLoad(smoothedLoad);
            animationFrameRef.current = requestAnimationFrame(updateDisplay);
        };
        animationFrameRef.current = requestAnimationFrame(updateDisplay);

        return () => {
            if (processorRef.current) {
                processorRef.current.disconnect();
                processorRef.current = null;
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };

    }, [audioContext]);

    return cpuLoad;
};
