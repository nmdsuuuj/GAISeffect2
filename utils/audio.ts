
// Shared Audio Utilities

export const makeDistortionCurve = (type: string, amount: number): Float32Array => {
    // Ensure amount is finite
    const k = Number.isFinite(amount) ? amount : 0;
    const n_samples = 4096;
    const curve = new Float32Array(n_samples);
    const pi = Math.PI;
    
    for (let i = 0; i < n_samples; ++i) {
        const x = i * 2 / n_samples - 1;
        let y = x; // Default to linear

        try {
            switch(type) {
                case 'Hard Clip': y = Math.max(-1, Math.min(1, x * (1 + k * 10))); break;
                case 'Soft Clip': y = Math.tanh(x * (1 + k * 4)); break;
                case 'Bitcrush': 
                    const bits = Math.round(16 * (1 - k)); 
                    const steps = Math.pow(2, Math.max(1, bits)); 
                    y = Math.round(x * steps) / steps; 
                    break;
                case 'Foldback': y = Math.sin(x * (1 + k * 10)); break;
                case 'Arctan': y = Math.atan(x * (1 + k * 10)) / (pi / 2); break;
                case 'Tanh': y = Math.tanh(x * (1 + k * 10)); break;
                case 'Sine Warp': y = Math.sin(pi * x * (1 + k)); break;
                case 'Half Rectify': y = Math.max(0, x); break;
                case 'Full Rectify': y = Math.abs(x); break;
                case 'Gloubi': 
                    const a = 1 + k * 100; 
                    y = (x > 0 ? 1 : -1) * (1 - Math.exp(-a * Math.abs(x))); 
                    break;
                case 'Expo Clip': 
                    y = (x > 0 ? 1 : -1) * (1 - Math.exp(-Math.abs(x) * (1 + k * 5))); 
                    break;
                case 'Hard Limit': y = Math.max(-1 + k, Math.min(1 - k, x)); break;
                case 'Germanium': 
                    y = x < 0.2 ? x : 0.2 + (x - 0.2) * (0.1 + 0.9 * (1 - k)); 
                    break;
                case 'Silicon': 
                    y = x < 0.7 ? x : 0.7 + (x - 0.7) * (0.01 + 0.99 * (1 - k)); 
                    break;
                case 'Tube': 
                    const q = x / (1 - k * 0.99); // Prevent div by zero if k=1
                    y = q / (1 + Math.abs(q)) / (1 / (1 + Math.abs(1))); 
                    break;
                case 'Fuzz': 
                    const blend = x * (k * 10 + 1); 
                    y = (blend > 0 ? 1 : -1) * (1 - Math.exp(-Math.abs(blend))); 
                    break;
                case 'Diode': 
                    // Fixed Diode approximation that doesn't use log on negative numbers
                    // Asymmetric soft clipping
                    if (x > 0) {
                        y = (1 - Math.exp(-x * (1 + k * 5)));
                    } else {
                        y = x * 0.5; // Leak backward
                    }
                    break;
                case 'Chebyshev': 
                    const cheby_n = 2 + Math.floor(k * 8); 
                    let cheby_x = x; 
                    let T0 = 1, T1 = x, Tn = 0; 
                    for(let j=2; j<=cheby_n; j++) { 
                        Tn = 2*x*T1 - T0; 
                        T0 = T1; 
                        T1 = Tn; 
                    } 
                    y = T1; 
                    break;
                case 'Resampler': 
                    const rate = Math.pow(2, Math.floor(k * 6)); 
                    y = Math.floor(x * rate) / rate; 
                    break;
                case 'Asymmetric': 
                    y = x > 0 ? Math.tanh(x * (1 + k * 5)) : Math.tanh(x * (1 + (k/2) * 5)); 
                    break;
                case 'Phase Shift': y = Math.sin(x*pi + k*pi); break;
                case 'Quantize': 
                    const levels = 2 + Math.floor(k * 30); 
                    y = Math.round(x * levels) / levels; 
                    break;
                case 'S-Curve': y = (3 * x - Math.pow(x, 3)) / 2; break;
                case 'Crossover': 
                    const cross_thresh = k; 
                    y = Math.abs(x) < cross_thresh ? 0 : x; 
                    break;
                case 'Saturator': 
                    y = x / (1 - k + k * Math.abs(x)); 
                    break;
                case 'Digital OD': 
                    const digi_k = 1-k; 
                    y = x > digi_k ? digi_k : (x < -digi_k ? -digi_k : x); 
                    break;
                case 'Tape': y = Math.tanh(x + k * Math.pow(x, 3)); break;
                case 'Transistor': 
                    const vbe = 0.7; 
                    y = x < vbe ? 0 : x - vbe * (1-k); 
                    break;
                case 'Diode Rectify': y = x > 0 ? x * (1 - k) : 0; break;
                case 'Sine Fold': y = Math.sin(x*pi*(1 + k*5)); break;
                case 'Crush Fold': 
                    const crush_bits = Math.round(16 * (1 - k)); 
                    const crush_steps = Math.pow(2, Math.max(1, crush_bits)); 
                    const crushed = Math.round(x * crush_steps) / crush_steps; 
                    y = Math.sin(crushed * pi * 5); 
                    break;
                case 'Parabolic Shaper': y = x * (1 + k) - k * x * Math.abs(x); break;
                default: y = x; break;
            }
        } catch (e) {
            y = x; // Fallback to linear on error
        }

        // Final Safety Check: Ensure no NaN or Infinity gets through
        if (!Number.isFinite(y)) {
            y = 0;
        }
        
        // Optional: Clamp to reasonable range to prevent loud pops (though float audio can handle >1)
        // Hard clamping can cause aliasing, but is safer for speakers.
        // y = Math.max(-10, Math.min(10, y));

        curve[i] = y;
    }
    return curve;
};
