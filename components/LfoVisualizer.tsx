
import React, { useRef, useEffect } from 'react';

interface LfoVisualizerProps {
    analyser: AnalyserNode | null;
    color?: string;
}

const LfoVisualizer: React.FC<LfoVisualizerProps> = ({ analyser, color = '#34d399' }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | null>(null);

    useEffect(() => {
        if (!canvasRef.current || !analyser) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Analyser setup
        analyser.fftSize = 2048;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            animationRef.current = requestAnimationFrame(draw);

            analyser.getByteTimeDomainData(dataArray);

            ctx.fillStyle = 'rgb(240, 253, 250)'; // bg-emerald-50
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.lineWidth = 2;
            ctx.strokeStyle = color;

            ctx.beginPath();

            const sliceWidth = canvas.width * 1.0 / bufferLength;
            let x = 0;

            // We only draw a portion of the buffer to catch the slow LFO movement better,
            // or we can draw the whole buffer. For LFOs (low freq), the waveform in the buffer
            // might look like a flat line if the buffer is too short relative to the period.
            // However, seeing it move up and down (DC offset change) is often what we want for LFOs.
            
            // Standard oscilloscope view
            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = v * canvas.height / 2;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }

                x += sliceWidth;
            }

            ctx.lineTo(canvas.width, canvas.height / 2);
            ctx.stroke();
            
            // Draw center line
            ctx.beginPath();
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 1;
            ctx.moveTo(0, canvas.height / 2);
            ctx.lineTo(canvas.width, canvas.height / 2);
            ctx.stroke();
        };

        draw();

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [analyser, color]);

    return (
        <canvas 
            ref={canvasRef} 
            width={100} 
            height={40} 
            className="w-full h-full rounded border border-emerald-200"
        />
    );
};

export default LfoVisualizer;
