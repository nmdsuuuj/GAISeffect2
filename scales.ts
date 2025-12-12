

// All intervals are in cents (1/100th of a semitone)
interface Scale {
    name: string;
    intervals: number[];
}

const SCALES: Scale[] = [
    // --- Special ---
    { name: 'Thru', intervals: [] }, // Special scale to bypass remapping

    // --- Standard Western (12-TET) ---
    { name: 'Chromatic', intervals: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100] },
    { name: 'Major', intervals: [200, 200, 100, 200, 200, 200, 100] },
    { name: 'Natural Minor', intervals: [200, 100, 200, 200, 100, 200, 200] },
    { name: 'Harmonic Minor', intervals: [200, 100, 200, 200, 100, 300, 100] },
    { name: 'Melodic Minor', intervals: [200, 100, 200, 200, 200, 200, 100] },

    // --- Modes (12-TET) ---
    { name: 'Dorian', intervals: [200, 100, 200, 200, 200, 100, 200] },
    { name: 'Phrygian', intervals: [100, 200, 200, 200, 100, 200, 200] },
    { name: 'Lydian', intervals: [200, 200, 200, 100, 200, 200, 100] },
    { name: 'Mixolydian', intervals: [200, 200, 100, 200, 200, 100, 200] },
    { name: 'Locrian', intervals: [100, 200, 200, 100, 200, 200, 200] },

    // --- Pentatonic & Blues (12-TET) ---
    { name: 'Major Pentatonic', intervals: [200, 200, 300, 200, 300] },
    { name: 'Minor Pentatonic', intervals: [300, 200, 200, 300, 200] },
    { name: 'Blues', intervals: [300, 200, 100, 100, 300, 200] },
    
    // --- Japanese (Approximations in 12-TET) ---
    { name: 'Insen', intervals: [100, 400, 200, 500] }, // 5-note
    { name: 'Hirajoshi', intervals: [200, 100, 400, 100, 400] },
    { name: 'Kumoi', intervals: [200, 100, 400, 200, 300] },
    { name: 'Yo', intervals: [200, 300, 200, 200, 300] },
    { name: 'Ritsu', intervals: [200, 200, 300, 200, 300] },

    // --- Symmetrical (12-TET) ---
    { name: 'Whole Tone', intervals: [200, 200, 200, 200, 200, 200] },
    { name: 'Diminished (H-W)', intervals: [100, 200, 100, 200, 100, 200, 100, 200] },
    { name: 'Diminished (W-H)', intervals: [200, 100, 200, 100, 200, 100, 200, 100] },

    // --- Microtonal - Middle Eastern / Arabic (Maqamat) ---
    // Note: These are just one common version of many possibilities.
    { name: 'Maqam Rast', intervals: [200, 150, 150, 200, 200, 150, 150] }, // E is half-flat
    { name: 'Maqam Bayati', intervals: [150, 150, 200, 200, 150, 150, 200] }, // D is half-flat
    { name: 'Maqam Saba', intervals: [150, 150, 100, 250, 150, 150, 150] },
    // FIX: Added missing opening quote to the scale name.
    { name: 'Maqam Hijaz', intervals: [100, 300, 100, 200, 100, 200, 200] }, // 12-TET Phrygian Dominant
    { name: 'Maqam Hijazkar', intervals: [100, 300, 100, 200, 150, 150, 200] },
    { name: 'Maqam Nahawand', intervals: [200, 100, 200, 200, 100, 200, 200] }, // same as Nat. Minor
    
    // --- Microtonal - Turkish (Makamlar) ---
    { name: 'Makam Kurdi', intervals: [100, 200, 200, 200, 100, 200, 200] }, // same as Phrygian
    { name: 'Makam Huzzam', intervals: [150, 150, 200, 200, 200, 150, 150] },
    { name: 'Makam Ussak', intervals: [180, 120, 200, 200, 180, 120, 200] }, // Uses Pythagorean tuning
    
    // --- Microtonal - Persian (Dastgah) ---
    { name: 'Dastgah Shur', intervals: [200, 140, 160, 200, 100, 200, 200] },
    { name: 'Dastgah Homayun', intervals: [100, 300, 100, 200, 140, 160, 200] },

    // --- Microtonal - Indonesian Gamelan ---
    { name: 'Pelog', intervals: [120, 270, 140, 110, 260, 130, 170] }, // Highly variable non-7-equal scale
    { name: 'Slendro', intervals: [240, 240, 240, 240, 240] }, // 5-tone equal temperament

    // --- Microtonal - Indian Classical (Ragas) ---
    // These use Just Intonation ratios, converted to cents.
    { name: 'Raga Bhairav', intervals: [112, 294, 90, 204, 112, 294, 90] }, // C Db E F G Ab B C
    { name: 'Raga Kalyan', intervals: [204, 182, 112, 204, 182, 204, 112] }, // C D E F# G A B C
    { name: 'Raga Todi', intervals: [112, 182, 204, 112, 182, 294, 112] }, // C Db D# F# G Ab B C
    { name: 'Raga Bhimpalasi', intervals: [294, 112, 204, 182, 316] }, // C Eb F G Bb C' (pentatonic)

    // --- Microtonal - African ---
    { name: 'Malian Pentatonic', intervals: [200, 150, 350, 200, 300] },
    { name: 'Ethiopian Tizita', intervals: [200, 200, 300, 200, 300] }, // Similar to Maj Pent.
    
    // --- Ancient Greek ---
    { name: 'Pythagorean Major', intervals: [204, 204, 90, 204, 204, 204, 90] },

    // --- Other Microtonal ---
    { name: '7-Tone Equal', intervals: [171.4, 171.4, 171.4, 171.4, 171.4, 171.4, 171.4] },
    { name: '19-Tone Equal', intervals: [189.5, 126.3, 189.5, 126.3, 189.5, 189.5, 126.3] }, // Approx diatonic
];

export default SCALES;