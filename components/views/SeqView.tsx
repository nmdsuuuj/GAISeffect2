
import React, { useContext, useState, useMemo, useEffect, useRef } from 'react';
import { AppContext } from '../../context/AppContext';
import { ActionType, Pattern, LockableParam, Sample, PlaybackParams } from '../../types';
import Pad from '../Pad';
import { PADS_PER_BANK, STEPS_PER_PART, LOOP_PRESETS, PATTERNS_PER_BANK, STEPS_PER_PATTERN } from '../../constants';
import Fader from '../Fader';
import SCALES from '../../scales';
import TEMPLATES, { Template } from '../../templates';
import { SubTab } from '../../App';


const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];


const SAMPLE_PARAMS: { value: LockableParam; label: string; min: number; max: number; step: number; isNote: boolean; }[] = [
    { value: 'pitch', label: 'Pitch', min: -24, max: 24, step: 0.01, isNote: false },
    { value: 'volume', label: 'Vol', min: 0, max: 1, step: 0.01, isNote: false },
    { value: 'decay', label: 'Decay', min: 0.01, max: 1, step: 0.001, isNote: false },
    { value: 'start', label: 'Start', min: 0, max: 1, step: 0.001, isNote: false },
    { value: 'lpFreq', label: 'LP F', min: 20, max: 20000, step: 1, isNote: false },
    { value: 'hpFreq', label: 'HP F', min: 20, max: 20000, step: 1, isNote: false },
    { value: 'velocity', label: 'Velo', min: 0, max: 1, step: 0.01, isNote: false },
    { value: 'detune', label: 'Detune', min: -1200, max: 1200, step: 1, isNote: true },
];

const SYNTH_PARAMS: { value: LockableParam; label: string; min: number; max: number; step: number; isNote: boolean; }[] = [
    { value: 'detune', label: 'Detune', min: -7200, max: 7200, step: 1, isNote: true },
    { value: 'velocity', label: 'Velo', min: 0, max: 1, step: 0.01, isNote: false },
    { value: 'modWheel', label: 'ModWhl', min: 0, max: 1, step: 0.01, isNote: false },
];

const FADER_PARAMS = SAMPLE_PARAMS.filter(p => !['pitch', 'volume', 'detune'].includes(p.value));


interface SeqViewProps {
    playSample: (id: number, time: number, params?: Partial<PlaybackParams>) => void;
    playSynthNote: (detune: number, time?: number) => void;
    setSubTabs: (tabs: SubTab[]) => void;
}

const ALL_RATE_VALUES = [32, 27, 24, 18, 16, 14, 12, 10, 9, 8, 7, 6, 5, 4, 3];
type CopyPasteScope = 'lane' | 'bank' | 'pattern';
type ParamGridMode = 'select' | 'selectAndGate';

const LoopMeter: React.FC<{ part: 'A' | 'B'; count: number; currentRep: number }> = ({ part, count, currentRep }) => (
    <div className="flex items-center space-x-1">
        <span className="text-xs font-bold text-slate-500 w-3">{part}</span>
        <div className="flex items-center space-x-0.5">
            {Array.from({ length: count > 15 ? 15 : count }).map((_, i) => (
                <div key={i} className={`w-1.5 h-4 rounded-sm transition-colors ${i < currentRep ? 'bg-pink-400' : 'bg-emerald-200'}`} />
            ))}
            { count > 15 && <span className="text-xs text-slate-400 -ml-0.5">...</span>}
        </div>
    </div>
);


const PartSettings: React.FC<{
    activePattern: Pattern;
    updatePatternParams: (params: Partial<Omit<Pattern, 'id' | 'steps' | 'paramLocks' | 'playbackKey' | 'playbackScale'>>) => void;
    updatePlaybackScale: (params: { key?: number; scale?: string }) => void;
    playbackState: { currentPart: 'A' | 'B'; partRepetition: number; };
}> = ({ activePattern, updatePatternParams, updatePlaybackScale, playbackState }) => {

    const handleLoopChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const preset = LOOP_PRESETS.find(p => p.label === e.target.value);
        if (preset) {
            updatePatternParams({ loopCountA: preset.a, loopCountB: preset.b });
        }
    };

    const currentLoopPreset = LOOP_PRESETS.find(p => p.a === activePattern.loopCountA && p.b === activePattern.loopCountB);

    return (
        <div className="flex-shrink-0 bg-white shadow-md p-1 rounded-lg space-y-1">
            {/* Playback Scale Controls */}
            <div className="bg-emerald-50/80 p-1 rounded-md flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 px-2">Playback Scale</span>
                <div className="flex items-center space-x-1">
                     <select 
                        value={activePattern.playbackKey} 
                        onChange={(e) => updatePlaybackScale({ key: parseInt(e.target.value)})}
                        className="bg-emerald-200 text-emerald-800 rounded p-1 text-xs focus:outline-none focus:ring-2 focus:ring-pink-400"
                    >
                        {NOTE_NAMES.map((name, index) => (
                            <option key={name} value={index}>{name}</option>
                        ))}
                    </select>
                     <select 
                        value={activePattern.playbackScale} 
                        onChange={(e) => updatePlaybackScale({ scale: e.target.value})}
                        className="bg-emerald-200 text-emerald-800 rounded p-1 text-xs focus:outline-none focus:ring-2 focus:ring-pink-400 max-w-[120px]"
                    >
                        {SCALES.map(scale => (
                            <option key={scale.name} value={scale.name}>{scale.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-x-1">
                {/* Part A */}
                <div className="bg-emerald-50/80 p-1 rounded-md space-y-1">
                     <div className="grid grid-cols-5 gap-1">
                        {ALL_RATE_VALUES.map(rate => (
                            <button
                                key={`a-${rate}`}
                                onClick={() => updatePatternParams({ stepResolutionA: rate })}
                                className={`py-1 text-[10px] font-bold rounded transition-colors ${activePattern.stepResolutionA === rate ? 'bg-pink-400 text-white' : 'bg-emerald-200 hover:bg-emerald-300'}`}>
                                {rate}
                            </button>
                        ))}
                    </div>
                    <div className="relative">
                        <Fader label="Len" value={activePattern.stepLengthA} onChange={val => updatePatternParams({ stepLengthA: val })} min={1} max={16} step={1} defaultValue={16} displayPrecision={0} />
                         <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-white text-3xl font-bold opacity-60 drop-shadow-md">A</span>
                        </div>
                    </div>
                </div>
                {/* Part B */}
                <div className="bg-emerald-50/80 p-1 rounded-md space-y-1">
                     <div className="grid grid-cols-5 gap-1">
                         {ALL_RATE_VALUES.map(rate => (
                            <button
                                key={`b-${rate}`}
                                onClick={() => updatePatternParams({ stepResolutionB: rate })}
                                className={`py-1 text-[10px] font-bold rounded transition-colors ${activePattern.stepResolutionB === rate ? 'bg-pink-400 text-white' : 'bg-emerald-200 hover:bg-emerald-300'}`}>
                                {rate}
                            </button>
                        ))}
                    </div>
                     <div className="relative">
                        <Fader label="Len" value={activePattern.stepLengthB} onChange={val => updatePatternParams({ stepLengthB: val })} min={1} max={16} step={1} defaultValue={16} displayPrecision={0} />
                         <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-white text-3xl font-bold opacity-60 drop-shadow-md">B</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Loop Controls */}
             <div className="flex items-center space-x-1">
                <select
                    onChange={handleLoopChange}
                    value={currentLoopPreset?.label || ''}
                    className="bg-emerald-200 text-emerald-800 rounded p-1 text-xs focus:outline-none focus:ring-2 focus:ring-pink-400 w-1/4"
                >
                    {LOOP_PRESETS.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
                </select>
                <div className="flex-grow bg-emerald-100/70 rounded p-1 flex items-center justify-around">
                    <LoopMeter part="A" count={activePattern.loopCountA} currentRep={playbackState.currentPart === 'A' ? playbackState.partRepetition + 1 : activePattern.loopCountA} />
                    <LoopMeter part="B" count={activePattern.loopCountB} currentRep={playbackState.currentPart === 'B' ? playbackState.partRepetition + 1 : 0} />
                </div>
            </div>
        </div>
    );
};


const TemplateModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSelect: (template: Template) => void;
}> = ({ isOpen, onClose, onSelect }) => {
    const categorizedTemplates = useMemo(() => {
        return TEMPLATES.reduce<Record<string, Template[]>>((acc, tpl) => {
            if (!acc[tpl.category]) {
                acc[tpl.category] = [];
            }
            acc[tpl.category].push(tpl);
            return acc;
        }, {});
    }, []);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl p-4 w-11/12 max-w-sm" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold text-lg text-center mb-3">Apply Template</h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                    {Object.entries(categorizedTemplates).map(([category, templates]) => (
                        <div key={category}>
                            <h4 className="font-semibold text-slate-600 border-b mb-1">{category}</h4>
                            <div className="grid grid-cols-2 gap-1">
                                {(templates as Template[]).map(tpl => (
                                    <button
                                        key={tpl.name}
                                        onClick={() => onSelect(tpl)}
                                        className="bg-emerald-200 text-emerald-800 rounded p-2 text-xs font-bold hover:bg-emerald-300 transition-colors text-left"
                                    >
                                        {tpl.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};


const SeqView: React.FC<SeqViewProps> = ({ playSample, playSynthNote, setSubTabs }) => {
    const { state, dispatch } = useContext(AppContext);
    const [patternViewBank, setPatternViewBank] = useState(0);
    const [paramGridMode, setParamGridMode] = useState<ParamGridMode>('select');
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [copyPasteScope, setCopyPasteScope] = useState<CopyPasteScope>('lane');

    const {
        patterns,
        activePatternIds,
        activeSampleId,
        activeSampleBank,
        currentSteps,
        samples,
        audioContext,
        playbackTrackStates,
        activeKey,
        activeScale,
        seqMode,
        synth,
        selectedSeqStep,
    } = state;

    useEffect(() => {
        setSubTabs([
            { label: 'PART', onClick: () => dispatch({ type: ActionType.SET_SEQ_MODE, payload: 'PART' }), isActive: seqMode === 'PART' },
            { label: 'P.L', onClick: () => dispatch({ type: ActionType.SET_SEQ_MODE, payload: 'PARAM' }), isActive: seqMode === 'PARAM' },
            { label: 'REC', onClick: () => dispatch({ type: ActionType.SET_SEQ_MODE, payload: 'REC' }), isActive: seqMode === 'REC', isSpecial: true }
        ]);
    }, [seqMode, dispatch, setSubTabs]);

    useEffect(() => {
        // Clear selection when view is not interactive for step input
        if (seqMode === 'REC') {
            dispatch({ type: ActionType.SET_SELECTED_SEQ_STEP, payload: null });
        }
        // Also clear on unmount
        return () => {
            dispatch({ type: ActionType.SET_SELECTED_SEQ_STEP, payload: null });
        };
    }, [seqMode, dispatch]);


    // --- Smart Scope Selector Logic ---
    const prevSampleIdRef = useRef(activeSampleId);
    const prevBankRef = useRef(activeSampleBank);

    useEffect(() => {
        const prevBank = prevBankRef.current;
        const prevSampleId = prevSampleIdRef.current;

        if (activeSampleBank !== prevBank) {
            setCopyPasteScope('bank');
        } else if (activeSampleId !== prevSampleId) {
            setCopyPasteScope('lane');
        }
        
        // Update refs for the next render
        prevBankRef.current = activeSampleBank;
        prevSampleIdRef.current = activeSampleId;
    }, [activeSampleId, activeSampleBank]);
    // --- End Logic ---
    
    const activePatternId = activePatternIds[activeSampleBank];
    const activePattern = patterns.find(p => p.id === activePatternId);
    const activeSample = samples[activeSampleId];
    const playbackState = playbackTrackStates[activeSampleBank];
    const currentStep = currentSteps[activeSampleBank];

    const handleStepToggle = (sampleId: number, step: number) => {
        if (!activePattern) return;
        dispatch({ type: ActionType.TOGGLE_STEP, payload: { patternId: activePattern.id, sampleId, step } });
    };

    const handleStepClick = (sampleId: number, stepIndex: number) => {
        if (seqMode === 'PART') {
            handleStepToggle(sampleId, stepIndex);
            dispatch({ type: ActionType.SET_SELECTED_SEQ_STEP, payload: stepIndex });
        } else if (seqMode === 'PARAM') {
            dispatch({ type: ActionType.SET_SELECTED_SEQ_STEP, payload: stepIndex });
            if (paramGridMode === 'selectAndGate') {
                handleStepToggle(sampleId, stepIndex);
            }
        }
    };

    const handleSamplePadClick = (id: number) => {
        dispatch({ type: ActionType.SET_ACTIVE_SAMPLE, payload: id });
        
        const isSynthBank = Math.floor(id / PADS_PER_BANK) === 3;
        
        if (isSynthBank) {
             if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                    playSynthNote(0, 0);
                });
            } else if (audioContext) {
                playSynthNote(0, 0);
            }
        }
        else if (samples[id] && samples[id].buffer) {
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                    playSample(id, 0);
                });
            } else if (audioContext) {
                playSample(id, 0);
            }
        }
    };
    
    const handlePatternPadClick = (id: number) => {
        dispatch({ type: ActionType.SET_ACTIVE_PATTERN_FOR_BANK, payload: { bankIndex: activeSampleBank, patternId: id } });
    };

    const updatePatternParams = (params: Partial<Omit<Pattern, 'id' | 'steps' | 'paramLocks' | 'playbackKey' | 'playbackScale'>>) => {
        if (!activePattern) return;
        dispatch({
            type: ActionType.UPDATE_PATTERN_PARAMS,
            payload: { patternId: activePattern.id, params },
        });
    };
    
    const updatePlaybackScale = (params: { key?: number; scale?: string }) => {
        if (!activePattern) return;
        dispatch({
            type: ActionType.UPDATE_PATTERN_PLAYBACK_SCALE,
            payload: { patternId: activePattern.id, ...params },
        });
    };

    const handleParamChange = (param: LockableParam, value: number) => {
        if (selectedSeqStep === null || !activePattern) return;
        dispatch({
            type: ActionType.UPDATE_PARAM_LOCK,
            payload: {
                patternId: activePattern.id,
                sampleId: activeSampleId,
                param: param,
                step: selectedSeqStep,
                value: value,
            },
        });
    };

    const handleApplyTemplate = (template: Template) => {
        if (!activePattern) return;
    
        if (template.sequences) { // This is a multi-track drum template
            dispatch({
                type: ActionType.APPLY_BANK_A_DRUM_TEMPLATE,
                payload: {
                    patternId: activePattern.id,
                    sequences: template.sequences,
                    grooveId: template.grooveId,
                    grooveDepth: template.grooveDepth,
                }
            });
        } else if (template.steps) { // This is a single-track template
            dispatch({
                type: ActionType.APPLY_SEQUENCE_TEMPLATE,
                payload: {
                    patternId: activePattern.id,
                    sampleId: activeSampleId,
                    steps: template.steps,
                    grooveId: template.grooveId,
                    grooveDepth: template.grooveDepth,
                }
            });
        }
        setIsTemplateModalOpen(false);
    };

    const handleUtilButtonClick = (type: 'clear' | 'fill' | 'rand_steps' | 'rand_pitch') => {
        if (!activePattern) return;
        switch (type) {
            case 'clear':
                dispatch({ type: ActionType.CLEAR_SEQUENCE, payload: { patternId: activePattern.id, sampleId: activeSampleId } });
                break;
            case 'fill':
                dispatch({ type: ActionType.FILL_SEQUENCE, payload: { patternId: activePattern.id, sampleId: activeSampleId } });
                break;
            case 'rand_steps':
                dispatch({ type: ActionType.RANDOMIZE_SEQUENCE, payload: { patternId: activePattern.id, sampleId: activeSampleId } });
                break;
            case 'rand_pitch':
                dispatch({ type: ActionType.RANDOMIZE_PITCH, payload: { patternId: activePattern.id, sampleId: activeSampleId, key: activeKey, scale: activeScale } });
                break;
        }
    };
    
    const handleCopy = () => {
        if (!activePattern) return;
        switch (copyPasteScope) {
            case 'lane':
                dispatch({ type: ActionType.COPY_LANE });
                break;
            case 'bank':
                dispatch({ type: ActionType.COPY_BANK });
                break;
            case 'pattern':
                dispatch({ type: ActionType.COPY_PATTERN, payload: { patternId: activePattern.id } });
                break;
        }
    };
    
    const handlePaste = () => {
        if (!activePattern) return;
        switch (copyPasteScope) {
            case 'lane':
                dispatch({ type: ActionType.PASTE_LANE });
                break;
            case 'bank':
                dispatch({ type: ActionType.PASTE_BANK });
                break;
            case 'pattern':
                dispatch({ type: ActionType.PASTE_PATTERN, payload: { patternId: activePattern.id } });
                break;
        }
    };

    const sampleBankOffset = activeSampleBank * PADS_PER_BANK;
    const patternBankOffsetForView = (activeSampleBank * PATTERNS_PER_BANK) + (patternViewBank * PADS_PER_BANK);
    
    const isSynthTrack = activeSampleBank === 3;


    if (!activePattern || !activeSample) {
        return <div className="text-center p-4">Loading Sequencer...</div>;
    }

    const sampleId = activeSampleId;
    const utilityButtonClass = "bg-emerald-200 text-emerald-800 rounded p-1.5 text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-pink-400 w-full hover:bg-emerald-300 transition-colors leading-tight";


    return (
        <div className="flex flex-col h-full p-1 space-y-1">
            <TemplateModal isOpen={isTemplateModalOpen} onClose={() => setIsTemplateModalOpen(false)} onSelect={handleApplyTemplate} />
            
            {seqMode === 'PART' && <PartSettings activePattern={activePattern} updatePatternParams={updatePatternParams} updatePlaybackScale={updatePlaybackScale} playbackState={playbackState} />}
            {seqMode === 'PARAM' && (
                 <div className="flex-shrink-0 bg-white shadow-md p-1 rounded-lg space-y-1">
                    {isSynthTrack ? (
                         <div className="grid grid-cols-3 gap-x-2 gap-y-1">
                            {SYNTH_PARAMS.map(p => {
                                const lockedValue = p.value === 'velocity' || p.value === 'detune'
                                    ? activePattern.steps[sampleId]?.[selectedSeqStep ?? 0]?.[p.value]
                                    : activePattern.paramLocks[sampleId]?.[p.value]?.[selectedSeqStep ?? 0];
                                
                                let displayValue: number;
                                let defaultValue: number;

                                if (lockedValue !== null && lockedValue !== undefined) {
                                    displayValue = lockedValue;
                                } else {
                                    if (p.value === 'velocity') displayValue = 1;
                                    else if (p.value === 'detune') displayValue = 0;
                                    else if (p.value === 'modWheel') displayValue = synth.modWheel;
                                    else displayValue = 0;
                                }

                                if (p.value === 'velocity') defaultValue = 1;
                                else if (p.value === 'detune') defaultValue = 0;
                                else if (p.value === 'modWheel') defaultValue = synth.modWheel;
                                else defaultValue = 0;

                                return (
                                     <Fader 
                                        key={p.value}
                                        label={p.label} 
                                        value={displayValue} 
                                        onChange={(val) => handleParamChange(p.value, val)} 
                                        min={p.min} 
                                        max={p.max} 
                                        step={p.step} 
                                        defaultValue={defaultValue}
                                        displayValue={displayValue}
                                        displayPrecision={p.value === 'detune' ? 0 : 2}
                                    />
                                );
                            })}
                        </div>
                    ) : (
                         <div className="grid grid-cols-3 gap-x-2 gap-y-1">
                            {FADER_PARAMS.map(p => {
                                const lockedValue = (p.value === 'velocity')
                                    ? activePattern.steps[sampleId]?.[selectedSeqStep ?? 0]?.[p.value]
                                    : activePattern.paramLocks[sampleId]?.[p.value]?.[selectedSeqStep ?? 0];
                                
                                let displayValue: number;
                                if (lockedValue !== null && lockedValue !== undefined) {
                                    displayValue = lockedValue;
                                } else {
                                    if (p.value === 'velocity') {
                                        displayValue = 1; // Default velocity
                                    } else {
                                        // Cast to number as FADER_PARAMS only includes numeric properties from Sample
                                        displayValue = activeSample[p.value as keyof Omit<Sample, 'id'|'name'|'buffer'>] as number;
                                    }
                                }
                                
                                return (
                                    <Fader 
                                        key={p.value}
                                        label={p.label} 
                                        value={displayValue} 
                                        onChange={(val) => handleParamChange(p.value, val)} 
                                        min={p.min} 
                                        max={p.max} 
                                        step={p.step} 
                                        defaultValue={p.value === 'velocity' ? 1 : activeSample[p.value as keyof Omit<Sample, 'id'|'name'|'buffer'>] as number}
                                        displayValue={displayValue}
                                        displayPrecision={p.value.includes('Freq') ? 0 : 2}
                                    />
                                );
                            })}
                            <div className="flex flex-col space-y-1 justify-center">
                                <button
                                    onClick={() => setParamGridMode(prev => prev === 'select' ? 'selectAndGate' : 'select')}
                                    className={`h-full w-full rounded text-xs font-bold transition-colors ${paramGridMode === 'selectAndGate' ? 'bg-pink-400 text-white' : 'bg-emerald-200 text-emerald-800'}`}
                                >
                                    {paramGridMode === 'select' ? 'SEL' : 'SEL/GATE'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}


            {/* Step Sequencer Grid / Param Editor */}
            <div className="bg-white shadow-md p-1 rounded-lg">
                <div className="grid grid-cols-8 gap-1">
                    {Array.from({ length: STEPS_PER_PATTERN }).map((_, stepIndex) => {
                        const stepInfo = activePattern.steps[sampleId]?.[stepIndex];
                        const isStepOn = stepInfo?.active;
                        const isCurrentStep = currentStep === stepIndex;
                        const isPartB = stepIndex >= STEPS_PER_PART;
                        const isSelected = selectedSeqStep === stepIndex;
                        
                        if (seqMode === 'PART' || seqMode === 'REC') {
                            let colorClasses;
                            if (isPartB) {
                                colorClasses = isStepOn ? 'bg-fuchsia-400' : 'bg-emerald-100';
                            } else {
                                colorClasses = isStepOn ? 'bg-pink-400' : 'bg-emerald-200';
                            }
                             if(isSynthTrack && isStepOn) {
                                colorClasses = isPartB ? 'bg-cyan-600' : 'bg-cyan-500';
                            }
                            
                            if (isCurrentStep) {
                                colorClasses = isStepOn ? 'bg-lime-300 brightness-125' : 'bg-lime-400/50';
                            }
                            const baseClasses = 'w-full h-7 rounded-sm transition-colors';
                            const selectedClass = isSelected ? 'ring-2 ring-sky-400 ring-offset-1' : '';

                            return (
                                <button
                                    key={stepIndex}
                                    onClick={() => handleStepClick(sampleId, stepIndex)}
                                    className={`${baseClasses} ${colorClasses} ${selectedClass}`}
                                    disabled={seqMode === 'REC'}
                                />
                            );
                        } else { // 'PARAM' mode - Step Selector
                            let bgClass = isPartB ? 'bg-emerald-100' : 'bg-emerald-200';
                            if (isCurrentStep) bgClass = 'bg-lime-400/50';
                            
                            const noteOnClass = isStepOn ? `border-2 ${isSynthTrack ? 'border-cyan-500' : 'border-pink-400'}` : 'border-2 border-transparent';
                            const selectedClass = isSelected ? 'ring-2 ring-sky-400 ring-offset-1' : '';

                            return (
                                <button
                                    key={stepIndex}
                                    onClick={() => handleStepClick(sampleId, stepIndex)}
                                    className={`w-full h-7 rounded-sm transition-colors ${bgClass} ${noteOnClass} ${selectedClass}`}
                                />
                            );
                        }
                    })}
                </div>
                 { (seqMode === 'PART' || seqMode === 'REC') && (
                    <div className="mt-1 grid grid-cols-5 grid-rows-1 gap-1">
                        <button onClick={() => setIsTemplateModalOpen(true)} className={`${utilityButtonClass} bg-pink-200 text-pink-800 hover:bg-pink-300 focus:ring-pink-400 flex items-center justify-center`}>Apply<br/>Tmplt</button>
                        <div className="grid grid-cols-2 col-span-2 gap-1">
                            <button onClick={() => handleUtilButtonClick('clear')} className={utilityButtonClass}>Clear</button>
                            <button onClick={() => handleUtilButtonClick('fill')} className={utilityButtonClass}>Fill</button>
                            <button onClick={() => handleUtilButtonClick('rand_steps')} className={`${utilityButtonClass} bg-sky-200 text-sky-800 hover:bg-sky-300 focus:ring-sky-400`}>Rand<br/>Steps</button>
                            <button onClick={() => handleUtilButtonClick('rand_pitch')} className={`${utilityButtonClass} bg-sky-200 text-sky-800 hover:bg-sky-300 focus:ring-sky-400`}>Rand<br/>Pitch</button>
                        </div>
                        <div className="flex flex-col col-span-2 space-y-1">
                            <div className="flex space-x-1 p-0.5 bg-emerald-200 rounded-md">
                                {(['lane', 'bank', 'pattern'] as CopyPasteScope[]).map(scope => (
                                    <button 
                                        key={scope}
                                        onClick={() => setCopyPasteScope(scope)}
                                        className={`flex-grow py-1 text-[10px] font-bold rounded-sm transition-colors capitalize ${copyPasteScope === scope ? 'bg-white text-slate-800 shadow-sm' : 'bg-transparent text-slate-600'}`}
                                    >
                                        {scope}
                                    </button>
                                ))}
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                                <button onClick={handleCopy} className={`${utilityButtonClass}`}>Copy</button>
                                <button onClick={handlePaste} className={`${utilityButtonClass}`}>Paste</button>
                            </div>
                        </div>
                    </div>
                 )}
            </div>
            
            {/* Bottom controls */}
            <div className="grid grid-cols-2 gap-1">
                <div className="bg-white shadow-md p-1 rounded-lg flex flex-col space-y-1">
                    <div className="grid grid-cols-4 gap-2 pt-8">
                        {Array.from({ length: PADS_PER_BANK }).map((_, i) => {
                             const bankLabel = activeSampleBank === 3 ? 'SYNTH' : String.fromCharCode(65 + activeSampleBank);
                             return <Pad key={i} id={sampleBankOffset + i} label={`${bankLabel}${i + 1}`} onClick={handleSamplePadClick} isActive={activeSampleId === sampleBankOffset + i} hasContent={!!samples[sampleBankOffset + i].buffer || (activeSampleBank === 3)} padType="sample" />
                        })}
                    </div>
                </div>
                 <div className="bg-white shadow-md p-1 rounded-lg flex flex-col space-y-1">
                    <div className="flex justify-center space-x-1">
                        {[0, 1, 2, 3].map(bankIndex => (
                            <button
                                key={bankIndex}
                                onClick={() => setPatternViewBank(bankIndex)}
                                className={`px-3 py-1 text-xs font-bold rounded transition-colors ${patternViewBank === bankIndex ? 'bg-pink-400 text-white' : 'bg-emerald-200 text-emerald-800'}`}
                            >
                                {bankIndex + 1}
                            </button>
                        ))}
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                         {Array.from({ length: PADS_PER_BANK }).map((_, i) => {
                            const globalPatternId = patternBankOffsetForView + i;
                            const localPatternNum = (patternViewBank * PADS_PER_BANK) + i + 1;
                            const isActive = state.activePatternIds[activeSampleBank] === globalPatternId;
                            // Check if any step in any sample lane is active for hasContent
                            const hasContent = patterns[globalPatternId]?.steps.some(sampleLane => sampleLane.some(step => step.active));
                            return <Pad key={i} id={globalPatternId} label={`P${localPatternNum}`} onClick={handlePatternPadClick} isActive={isActive} hasContent={hasContent} padType="pattern" />
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SeqView;
