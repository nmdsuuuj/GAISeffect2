
import React, { useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { ActionType } from '../types';
import SCALES from '../scales';

interface GlobalKeyboardProps {
    onNotePlay: (detune: number) => void;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const PHYSICAL_KEYBOARD_LAYOUT = [
    { chromaticIndex: 0, type: 'white', pcKey: 'Z' },
    { chromaticIndex: 2, type: 'white', pcKey: 'X' },
    { chromaticIndex: 4, type: 'white', pcKey: 'C' },
    { chromaticIndex: 5, type: 'white', pcKey: 'V' },
    { chromaticIndex: 7, type: 'white', pcKey: 'B' },
    { chromaticIndex: 9, type: 'white', pcKey: 'N' },
    { chromaticIndex: 11, type: 'white', pcKey: 'M' },
    { chromaticIndex: 12, type: 'white', pcKey: ',' },
    { chromaticIndex: 1, type: 'black', pcKey: 'S', position: 'left-[7.8125%]' },
    { chromaticIndex: 3, type: 'black', pcKey: 'D', position: 'left-[20.3125%]' },
    { chromaticIndex: 6, type: 'black', pcKey: 'G', position: 'left-[45.3125%]' },
    { chromaticIndex: 8, type: 'black', pcKey: 'H', position: 'left-[57.8125%]' },
    { chromaticIndex: 10, type: 'black', pcKey: 'J', position: 'left-[70.3125%]' },
];

const GlobalKeyboard: React.FC<GlobalKeyboardProps> = ({ onNotePlay }) => {
    const { state, dispatch } = useContext(AppContext);
    const { activeKey, activeScale, keyboardOctave, activeSampleBank } = state;

    const keyboardNotesInCents = useMemo(() => {
        const scale = SCALES.find(s => s.name === activeScale);
        if (!scale || scale.name === 'Chromatic' || scale.name === 'Thru' || scale.intervals.length === 0) {
            return Array.from({ length: 13 }, (_, i) => i * 100);
        }

        const scaleOctaveNotes = [0];
        let currentCents = 0;
        for (const interval of scale.intervals) {
            currentCents += interval;
            scaleOctaveNotes.push(currentCents);
        }
        const octaveSpan = scaleOctaveNotes.pop() || 1200;
        const numNotesInScale = scaleOctaveNotes.length;

        const finalKeyboardNotes = [];
        for (let i = 0; i < 13; i++) {
            const octave = Math.floor(i / numNotesInScale);
            const noteIndexInScale = i % numNotesInScale;
            const note = scaleOctaveNotes[noteIndexInScale] + (octave * octaveSpan);
            finalKeyboardNotes.push(note);
        }
        return finalKeyboardNotes;
    }, [activeScale]);

    const formatNoteName = (cents: number): { name: string, offset: number } => {
        const totalCentsFromC = (activeKey * 100) + cents;
        const midiNote = Math.round(totalCentsFromC / 100);
        const nearestCents = midiNote * 100;
        const offset = Math.round(totalCentsFromC - nearestCents);
        const noteName = NOTE_NAMES[(midiNote % 12 + 12) % 12];
        return { name: noteName, offset };
    };


    return (
        <div className="bg-emerald-100/80 p-1 flex flex-col items-center space-y-1">
            <div className="flex w-full justify-between items-center px-1">
                <div className="flex items-center space-x-2">
                    <button 
                        onClick={() => dispatch({ type: ActionType.SET_KEYBOARD_OCTAVE, payload: Math.max(0, keyboardOctave - 1) })}
                        className="px-3 py-0.5 bg-emerald-200 text-emerald-800 font-bold rounded-md"
                    >
                        &lt;
                    </button>
                    <span className="font-bold text-lg text-slate-700 w-4 text-center">{keyboardOctave}</span>
                    <button 
                        onClick={() => dispatch({ type: ActionType.SET_KEYBOARD_OCTAVE, payload: Math.min(8, keyboardOctave + 1) })}
                        className="px-3 py-0.5 bg-emerald-200 text-emerald-800 font-bold rounded-md"
                    >
                        &gt;
                    </button>
                </div>

                <div className="flex w-1/2 justify-center p-0.5 bg-emerald-200 rounded-lg">
                    {[0, 1, 2, 3].map(bankIndex => (
                        <button
                            key={bankIndex}
                            onClick={() => dispatch({ type: ActionType.SET_ACTIVE_SAMPLE_BANK, payload: bankIndex })}
                            className={`flex-grow py-0.5 text-xs font-bold rounded-md transition-colors ${activeSampleBank === bankIndex ? 'bg-white text-slate-800 shadow' : 'bg-transparent text-slate-600'}`}
                        >
                            {bankIndex === 3 ? 'SYNTH' : String.fromCharCode(65 + bankIndex)}
                        </button>
                    ))}
                </div>

                <div className="flex items-center space-x-1">
                     <select 
                        value={activeKey} 
                        onChange={(e) => dispatch({ type: ActionType.SET_KEY, payload: parseInt(e.target.value)})}
                        className="bg-emerald-200 text-emerald-800 rounded p-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-pink-400"
                    >
                        {NOTE_NAMES.map((name, index) => (
                            <option key={name} value={index}>{name}</option>
                        ))}
                    </select>
                     <select 
                        value={activeScale} 
                        onChange={(e) => dispatch({ type: ActionType.SET_SCALE, payload: e.target.value})}
                        className="bg-emerald-200 text-emerald-800 rounded p-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-pink-400 max-w-[90px]"
                    >
                        {SCALES.map(scale => (
                            <option key={scale.name} value={scale.name}>{scale.name}</option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="relative w-full h-24">
                <div className="absolute inset-0 flex">
                {PHYSICAL_KEYBOARD_LAYOUT.filter(k => k.type === 'white').map((keyInfo) => {
                    const cents = keyboardNotesInCents[keyInfo.chromaticIndex];
                    const { name, offset } = formatNoteName(cents);
                    return (
                        <button
                            key={keyInfo.chromaticIndex}
                            onMouseDown={() => onNotePlay(cents)}
                            className="w-[12.5%] h-full border-2 rounded-md flex flex-col items-center justify-end p-1 transition-colors bg-white border-slate-200 active:bg-pink-200"
                        >
                            <span className="font-bold text-base">{name}</span>
                            {offset !== 0 && <span className="text-[10px] text-slate-500">{offset > 0 ? '+' : ''}{offset}c</span>}
                            <span className="text-[10px] text-slate-400">{keyInfo.pcKey}</span>
                        </button>
                    );
                })}
                </div>
                {PHYSICAL_KEYBOARD_LAYOUT.filter(k => k.type === 'black').map((keyInfo) => {
                    const cents = keyboardNotesInCents[keyInfo.chromaticIndex];
                    const { name, offset } = formatNoteName(cents);
                    return (
                         <button
                            key={keyInfo.chromaticIndex}
                            onMouseDown={() => onNotePlay(cents)}
                            className={`absolute w-[8.5%] h-14 border-2 rounded-md flex flex-col items-center justify-end p-1 transition-colors bg-slate-800 text-white border-slate-600 active:bg-pink-500 ${keyInfo.position}`}
                        >
                            <span className="font-bold text-base">{name}</span>
                            {offset !== 0 && <span className="text-[10px] text-slate-300">{offset > 0 ? '+' : ''}{offset}c</span>}
                            <span className="text-[10px] text-slate-400">{keyInfo.pcKey}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default GlobalKeyboard;
