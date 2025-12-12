




import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../context/AppContext';
import { ActionType, MasterCompressorParams, FXType } from '../../types';
import Fader from '../Fader';
import { TOTAL_BANKS, EXTENDED_DIVISIONS, FX_TYPES } from '../../constants';
import CpuMeter from '../CpuMeter';
import Pad from '../Pad';
import XYPad from '../XYPad';
import { SubTab } from '../../App';

interface MixerViewProps {
    startMasterRecording: () => void;
    stopMasterRecording: () => void;
    setSubTabs: (tabs: SubTab[]) => void;
}

const MixerView: React.FC<MixerViewProps> = ({ startMasterRecording, stopMasterRecording, setSubTabs }) => {
    const { state, dispatch } = useContext(AppContext);
    const { 
        bankVolumes, bankPans, bankMutes, bankSolos, 
        masterVolume, isMasterRecording, isMasterRecArmed, 
        isInitialized, isPlaying,
        masterCompressorOn, masterCompressorParams,
        compressorSnapshots,
        performanceFx
    } = state;

    const [viewMode, setViewMode] = useState<'mixer' | 'master_fx' | 'perf_fx'>('mixer');
    const [activeSlotIndex, setActiveSlotIndex] = useState(0);
    // FX Sub-navigation
    const [fxSubTab, setFxSubTab] = useState<'MAIN' | 'ROUTE' | 'SNAP'>('MAIN');

    useEffect(() => {
        setSubTabs([
            { label: 'Mixer', onClick: () => setViewMode('mixer'), isActive: viewMode === 'mixer' },
            { label: 'PERF', onClick: () => setViewMode('perf_fx'), isActive: viewMode === 'perf_fx', isSpecial: true },
            { label: 'MST', onClick: () => setViewMode('master_fx'), isActive: viewMode === 'master_fx' }
        ]);
    }, [viewMode, setSubTabs]);


    // State for compressor snapshots
    const [snapshotMode, setSnapshotMode] = useState<'LOAD' | 'SAVE'>('LOAD');
    const [snapshotPage, setSnapshotPage] = useState(0);
    const [selectedSnapshotSlot, setSelectedSnapshotSlot] = useState<number | null>(null);
    const [snapshotNameInput, setSnapshotNameInput] = useState('');

    // State for FX Snapshots
    const [fxSnapMode, setFxSnapMode] = useState<'SLOT' | 'GLOBAL'>('SLOT');
    const [fxSnapAction, setFxSnapAction] = useState<'LOAD' | 'SAVE'>('LOAD');

     useEffect(() => {
        if (snapshotMode === 'LOAD') {
            setSelectedSnapshotSlot(null);
        }
    }, [snapshotMode]);

    useEffect(() => {
        if (snapshotMode === 'SAVE' && selectedSnapshotSlot !== null) {
            const existingSnapshot = compressorSnapshots[selectedSnapshotSlot];
            setSnapshotNameInput(existingSnapshot?.name || `Snap ${selectedSnapshotSlot + 1}`);
        } else {
            setSnapshotNameInput('');
        }
    }, [selectedSnapshotSlot, snapshotMode, compressorSnapshots]);

    const handleVolumeChange = (bankIndex: number, volume: number) => {
        dispatch({ type: ActionType.SET_BANK_VOLUME, payload: { bankIndex, volume } });
    };
    
    const handlePanChange = (bankIndex: number, pan: number) => {
        dispatch({ type: ActionType.SET_BANK_PAN, payload: { bankIndex, pan } });
    };

    const handleMuteToggle = (bankIndex: number) => {
        dispatch({ type: ActionType.TOGGLE_BANK_MUTE, payload: { bankIndex } });
    };

    const handleSoloToggle = (bankIndex: number) => {
        dispatch({ type: ActionType.TOGGLE_BANK_SOLO, payload: { bankIndex } });
    };

    const handleMasterVolumeChange = (volume: number) => {
        dispatch({ type: ActionType.SET_MASTER_VOLUME, payload: volume });
    };
    
    const handleRecordToggle = () => {
        if (isMasterRecording) {
            stopMasterRecording();
        } else if (!isPlaying) { // Can only arm/disarm when sequencer is stopped
            dispatch({ type: ActionType.TOGGLE_MASTER_REC_ARMED });
        }
    };
    
    const handleCompressorToggle = () => {
        dispatch({ type: ActionType.TOGGLE_MASTER_COMPRESSOR });
    };

    const handleCompressorParamChange = (param: keyof MasterCompressorParams, value: number) => {
        dispatch({ type: ActionType.UPDATE_MASTER_COMPRESSOR_PARAM, payload: { param, value } });
    };

    const handleSnapshotPadClick = (snapshotIndex: number) => {
        if (snapshotMode === 'LOAD') {
            const snapshot = compressorSnapshots[snapshotIndex];
            if (snapshot) {
                dispatch({ type: ActionType.LOAD_COMPRESSOR_SNAPSHOT, payload: snapshot });
            }
        } else { // SAVE mode
            setSelectedSnapshotSlot(prev => (prev === snapshotIndex ? null : snapshotIndex));
        }
    };
    
    const handleSaveSnapshot = () => {
        if (selectedSnapshotSlot === null || !snapshotNameInput.trim()) return;
        const name = snapshotNameInput.trim();
        dispatch({
            type: ActionType.SAVE_COMPRESSOR_SNAPSHOT,
            payload: { index: selectedSnapshotSlot, name, params: masterCompressorParams }
        });
        dispatch({ type: ActionType.SHOW_TOAST, payload: `Snapshot "${name}" saved.` });
        setSelectedSnapshotSlot(null);
    };

    const handleClearSnapshot = () => {
        if (selectedSnapshotSlot === null) return;
        const snapshotToClear = compressorSnapshots[selectedSnapshotSlot];
        if (snapshotToClear && window.confirm(`Are you sure you want to clear snapshot "${snapshotToClear.name}"?`)) {
            dispatch({ type: ActionType.CLEAR_COMPRESSOR_SNAPSHOT, payload: { index: selectedSnapshotSlot } });
        }
    };

    // --- FX Handlers ---
    const handleFxTypeChange = (type: string) => {
        dispatch({ type: ActionType.SET_FX_TYPE, payload: { slotIndex: activeSlotIndex, type: type as FXType } });
    };

    const handleFxBypassToggle = () => {
        dispatch({ type: ActionType.TOGGLE_FX_BYPASS, payload: activeSlotIndex });
    };

    const handleFxParamChange = (param: string, value: number) => {
        dispatch({ type: ActionType.UPDATE_FX_PARAM, payload: { slotIndex: activeSlotIndex, param, value } });
    };

    const handleXYUpdate = (padIndex: number, x: number, y: number) => {
        dispatch({ type: ActionType.UPDATE_FX_XY, payload: { slotIndex: activeSlotIndex, padIndex, x, y } });
    };

    const handleFxRoutingChange = (currentIndex: number, direction: -1 | 1) => {
        const newRouting = [...performanceFx.routing];
        const newIndex = currentIndex + direction;
        
        if (newIndex >= 0 && newIndex < newRouting.length) {
            // Swap
            [newRouting[currentIndex], newRouting[newIndex]] = [newRouting[newIndex], newRouting[currentIndex]];
            dispatch({ type: ActionType.SET_FX_ROUTING, payload: newRouting });
        }
    };

    const handleFxSnapshotClick = (index: number) => {
        if (fxSnapMode === 'SLOT') {
            if (fxSnapAction === 'SAVE') {
                dispatch({ type: ActionType.SAVE_FX_SNAPSHOT, payload: { slotIndex: activeSlotIndex, index } });
                dispatch({ type: ActionType.SHOW_TOAST, payload: `Saved Slot Snapshot ${index + 1}` });
            } else {
                dispatch({ type: ActionType.LOAD_FX_SNAPSHOT, payload: { slotIndex: activeSlotIndex, index } });
                dispatch({ type: ActionType.SHOW_TOAST, payload: `Loaded Slot Snapshot ${index + 1}` });
            }
        } else { // GLOBAL
            if (fxSnapAction === 'SAVE') {
                dispatch({ type: ActionType.SAVE_GLOBAL_FX_SNAPSHOT, payload: { index } });
                dispatch({ type: ActionType.SHOW_TOAST, payload: `Saved Global Snapshot ${index + 1}` });
            } else {
                dispatch({ type: ActionType.LOAD_GLOBAL_FX_SNAPSHOT, payload: { index } });
                dispatch({ type: ActionType.SHOW_TOAST, payload: `Loaded Global Snapshot ${index + 1}` });
            }
        }
    };


    const renderMixer = () => (
        <div className="flex flex-grow gap-4">
            {/* Bank Channels */}
            <div className="grid grid-cols-4 gap-4 flex-grow">
                {Array.from({ length: TOTAL_BANKS }).map((_, i) => (
                    <div key={i} className="flex flex-col items-center space-y-4">
                        <div className="w-full">
                            <Fader
                                label="Pan"
                                value={bankPans[i]}
                                onChange={(val) => handlePanChange(i, val)}
                                min={-1}
                                max={1}
                                step={0.01}
                                defaultValue={0}
                            />
                        </div>
                        <div className="flex w-full justify-around">
                            <button
                                onClick={() => handleMuteToggle(i)}
                                className={`w-8 h-8 rounded-md font-bold text-xs transition-colors ${bankMutes[i] ? 'bg-rose-500 text-white' : 'bg-slate-300 text-slate-600'}`}
                            >
                                M
                            </button>
                            <button
                                onClick={() => handleSoloToggle(i)}
                                className={`w-8 h-8 rounded-md font-bold text-xs transition-colors ${bankSolos[i] ? 'bg-yellow-400 text-slate-800' : 'bg-slate-300 text-slate-600'}`}
                            >
                                S
                            </button>
                        </div>
                        <div className="h-full w-full flex-grow">
                            <Fader
                                label={i === 3 ? 'SYNTH' : `Bank ${String.fromCharCode(65 + i)}`}
                                value={bankVolumes[i]}
                                onChange={(val) => handleVolumeChange(i, val)}
                                min={0}
                                max={1}
                                step={0.01}
                                defaultValue={1}
                                isVertical={true}
                            />
                        </div>
                    </div>
                ))}
            </div>
            {/* Master Channel */}
            <div className="w-1/4 flex flex-col items-center space-y-4 border-l-2 border-emerald-100 pl-4">
                <div className="flex flex-col items-center space-y-2">
                    <h3 className="font-bold text-slate-600">Master</h3>
                     <CpuMeter />
                    <button
                        onClick={handleRecordToggle}
                        disabled={!isInitialized || (isPlaying && !isMasterRecording)}
                        className={`w-12 h-12 rounded-full font-bold text-xs transition-colors flex items-center justify-center
                            ${isMasterRecording ? 'bg-rose-500 text-white animate-pulse' : isMasterRecArmed ? 'bg-yellow-400 text-slate-800' : 'bg-slate-300 text-slate-600'}
                            ${(!isInitialized || (isPlaying && !isMasterRecording)) && 'cursor-not-allowed bg-slate-200'}`}
                    >
                        {isMasterRecording ? 'STOP' : isMasterRecArmed ? 'ARMED' : 'REC'}
                    </button>
                </div>
                <div className="h-full w-full flex-grow">
                    <Fader
                        label="Vol"
                        value={masterVolume}
                        onChange={handleMasterVolumeChange}
                        min={0}
                        max={1.5} // Allow some boost
                        step={0.01}
                        defaultValue={1}
                        isVertical={true}
                    />
                </div>
            </div>
        </div>
    );
    
    const renderMasterFx = () => (
        <div className="w-full flex flex-col items-center space-y-3 p-2 overflow-y-auto">
            <div className="w-full text-center mb-2">
                <h2 className="text-xl font-bold text-slate-700">Master Compressor</h2>
            </div>
            <button
                onClick={handleCompressorToggle}
                className={`w-24 py-3 rounded font-bold text-white transition-colors ${masterCompressorOn ? 'bg-pink-500' : 'bg-slate-400'}`}
            >
                {masterCompressorOn ? 'ON' : 'OFF'}
            </button>
            <div className="w-full max-w-sm space-y-2">
                <Fader label="Thresh" value={masterCompressorParams.threshold} onChange={v => handleCompressorParamChange('threshold', v)} min={-100} max={0} step={1} defaultValue={-24} displayPrecision={0} />
                <Fader label="Ratio" value={masterCompressorParams.ratio} onChange={v => handleCompressorParamChange('ratio', v)} min={1} max={20} step={0.1} defaultValue={12} displayPrecision={1} />
                <Fader label="Knee" value={masterCompressorParams.knee} onChange={v => handleCompressorParamChange('knee', v)} min={0} max={40} step={1} defaultValue={30} displayPrecision={0} />
                <Fader label="Attack" value={masterCompressorParams.attack} onChange={v => handleCompressorParamChange('attack', v)} min={0} max={1} step={0.001} defaultValue={0.003} displayPrecision={3} />
                <Fader label="Release" value={masterCompressorParams.release} onChange={v => handleCompressorParamChange('release', v)} min={0.01} max={1} step={0.001} defaultValue={0.25} displayPrecision={3} />
            </div>

            <div className="w-full max-w-sm space-y-2 border-t-2 border-emerald-100 pt-3 mt-3">
                <h3 className="text-center font-bold text-slate-600">Compressor Snapshots</h3>
                <div className="flex justify-between items-center">
                    <div className="flex space-x-1 flex-wrap">
                        {[0,1,2,3].map(i => (
                            <button key={i} onClick={() => setSnapshotPage(i)} className={`px-2 py-0.5 text-[10px] font-bold rounded ${snapshotPage === i ? 'bg-pink-400 text-white' : 'bg-emerald-200'}`}>P{i+1}</button>
                        ))}
                    </div>
                    <div className="flex p-0.5 bg-emerald-200 rounded-lg">
                        <button onClick={() => setSnapshotMode('LOAD')} className={`px-2 py-1 text-xs font-bold rounded-md transition-colors ${snapshotMode === 'LOAD' ? 'bg-white text-slate-800 shadow' : 'bg-transparent text-slate-600'}`}>Load</button>
                        <button onClick={() => setSnapshotMode('SAVE')} className={`px-2 py-1 text-xs font-bold rounded-md transition-colors ${snapshotMode === 'SAVE' ? 'bg-white text-slate-800 shadow' : 'bg-transparent text-slate-600'}`}>Save</button>
                    </div>
                </div>

                 {snapshotMode === 'SAVE' && (
                    <div className="flex items-center space-x-1">
                        {selectedSnapshotSlot !== null ? (
                            <div className="flex-grow flex items-center space-x-1">
                                <input 
                                    type="text" 
                                    value={snapshotNameInput}
                                    onChange={(e) => setSnapshotNameInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveSnapshot()}
                                    className="w-full bg-emerald-100 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-400"
                                    placeholder="Snapshot Name"
                                />
                                <button onClick={handleSaveSnapshot} className="bg-sky-500 text-white font-bold px-2 py-1 rounded text-xs">Save</button>
                                <button onClick={handleClearSnapshot} disabled={!compressorSnapshots[selectedSnapshotSlot]} className="bg-rose-500 text-white font-bold px-2 py-1 rounded text-xs disabled:bg-slate-300">Clear</button>
                            </div>
                        ) : (
                             <p className="text-xs text-slate-500 text-center py-1 w-full">Select a slot to save or clear</p>
                        )}
                    </div>
                )}
                
                <div className="grid grid-cols-8 gap-1.5">
                    {Array.from({ length: 16 }).map((_, i) => {
                        const snapshotIndex = snapshotPage * 16 + i;
                        const snapshot = compressorSnapshots[snapshotIndex];
                        const isActive = snapshotMode === 'SAVE' && selectedSnapshotSlot === snapshotIndex;
                        return (
                            <Pad
                                key={i}
                                id={snapshotIndex}
                                label={snapshot?.name.substring(0, 4) || ``}
                                onClick={() => handleSnapshotPadClick(snapshotIndex)}
                                isActive={isActive}
                                hasContent={!!snapshot}
                                padType="pattern"
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );

    const renderFxMain = () => {
        const slot = performanceFx.slots[activeSlotIndex];
        const params = slot.params;

        return (
            <div className="flex-grow bg-emerald-50/50 rounded-lg p-2 flex flex-col space-y-2 overflow-y-auto">
                {/* Header: Type & Bypass */}
                <div className="flex items-center justify-between bg-white p-2 rounded-lg shadow-sm">
                    <select 
                        value={slot.type}
                        onChange={(e) => handleFxTypeChange(e.target.value)}
                        className="bg-emerald-100 text-slate-800 font-bold text-lg rounded px-2 py-1 focus:outline-none uppercase"
                    >
                        {FX_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button
                        onClick={handleFxBypassToggle}
                        className={`px-6 py-2 rounded font-bold text-white transition-colors uppercase tracking-wider
                            ${slot.isOn ? 'bg-rose-500 shadow-md transform scale-105' : 'bg-slate-400'}`}
                    >
                        {slot.isOn ? 'ACTIVE' : 'BYPASS'}
                    </button>
                </div>

                {/* XY Pads */}
                {slot.xyPads.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 h-48 flex-shrink-0">
                        {slot.xyPads.map((pad, idx) => (
                            <XYPad
                                key={idx}
                                x={pad.x}
                                y={pad.y}
                                xLabel={pad.xParam}
                                yLabel={pad.yParam}
                                onChange={(x, y) => handleXYUpdate(idx, x, y)}
                                color={activeSlotIndex % 2 === 0 ? 'bg-pink-400' : 'bg-sky-400'}
                            />
                        ))}
                    </div>
                )}

                {/* Detailed Parameters (Faders) */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 bg-white p-2 rounded-lg shadow-sm">
                    {Object.entries(params).map(([key, value]) => {
                        if (key === 'type') return null; // handled by dropdown
                        
                        // Determine visual range for fader based on param name
                        let min = 0, max = 1, step = 0.01;
                        let displayValue = value as number;
                        let displayString: string | undefined = undefined;

                        if (key === 'division' || key === 'lfoRate') {
                            max = EXTENDED_DIVISIONS.length - 1;
                            step = 1;
                            displayString = EXTENDED_DIVISIONS[value as number]?.label;
                        } else if (key === 'speed') {
                            min = -1; max = 1;
                        } else if (key === 'cutoff') {
                            // Log mapping for display
                            const minFreq = 20, maxFreq = 20000;
                            const hz = minFreq * Math.pow(maxFreq/minFreq, value as number);
                            displayValue = hz;
                            displayString = `${Math.round(hz)} Hz`;
                        } else if (key === 'resonance') {
                            displayValue = (value as number) * 30; // approx scaling
                        }

                        return (
                            <Fader
                                key={key}
                                label={key}
                                value={value as number}
                                onChange={(v) => handleFxParamChange(key, v)}
                                min={min}
                                max={max}
                                step={step}
                                defaultValue={0} // TODO: correct default
                                displayValue={displayValue}
                                displayString={displayString}
                                displayPrecision={2}
                            />
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderFxRoute = () => {
        const { routing, slots } = performanceFx;
        return (
            <div className="flex-grow bg-emerald-50/50 rounded-lg p-4 flex flex-col items-center justify-center space-y-4">
                <h3 className="font-bold text-slate-500 uppercase tracking-widest text-sm">Signal Flow</h3>
                
                <div className="flex flex-col space-y-2 w-full max-w-xs">
                    {routing.map((slotIndex, i) => {
                        const slot = slots[slotIndex];
                        return (
                            <div key={i} className="flex items-center space-x-2">
                                <span className="font-mono text-slate-400 font-bold w-4">{i+1}.</span>
                                <div className={`flex-grow p-3 rounded-lg flex justify-between items-center shadow-md border-l-4
                                    ${slot.isOn 
                                        ? 'bg-white border-pink-500' 
                                        : 'bg-slate-100 border-slate-300 opacity-70'}`}
                                >
                                    <span className="font-bold text-slate-700 uppercase">{slot.type}</span>
                                    <span className="text-xs bg-slate-200 px-2 py-1 rounded text-slate-600 font-mono">Slot {slotIndex + 1}</span>
                                </div>
                                <div className="flex flex-col space-y-1">
                                    <button 
                                        onClick={() => handleFxRoutingChange(i, -1)}
                                        disabled={i === 0}
                                        className="w-8 h-8 bg-emerald-200 hover:bg-emerald-300 rounded text-emerald-800 font-bold disabled:opacity-30"
                                    >
                                        ↑
                                    </button>
                                    <button 
                                        onClick={() => handleFxRoutingChange(i, 1)}
                                        disabled={i === routing.length - 1}
                                        className="w-8 h-8 bg-emerald-200 hover:bg-emerald-300 rounded text-emerald-800 font-bold disabled:opacity-30"
                                    >
                                        ↓
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="text-xs text-slate-400 mt-4">Top is Input • Bottom is Output</div>
            </div>
        );
    };

    const renderFxSnap = () => {
        const isSlotMode = fxSnapMode === 'SLOT';
        const isSaveMode = fxSnapAction === 'SAVE';
        const activeColor = isSlotMode ? 'bg-sky-500' : 'bg-pink-500';
        const activeText = isSlotMode ? 'text-sky-600' : 'text-pink-600';

        return (
            <div className="flex-grow bg-emerald-50/50 rounded-lg p-2 flex flex-col space-y-3">
                {/* Controls */}
                <div className="flex justify-between items-center bg-white p-2 rounded-lg shadow-sm">
                    <div className="flex space-x-1 bg-slate-100 p-1 rounded">
                        <button 
                            onClick={() => setFxSnapMode('SLOT')} 
                            className={`px-3 py-1 text-xs font-bold rounded transition-all ${isSlotMode ? 'bg-white shadow text-sky-600' : 'text-slate-500'}`}
                        >
                            SLOT {activeSlotIndex + 1}
                        </button>
                        <button 
                            onClick={() => setFxSnapMode('GLOBAL')} 
                            className={`px-3 py-1 text-xs font-bold rounded transition-all ${!isSlotMode ? 'bg-white shadow text-pink-600' : 'text-slate-500'}`}
                        >
                            GLOBAL
                        </button>
                    </div>
                    
                    <div className="flex space-x-1">
                        <button 
                            onClick={() => setFxSnapAction('LOAD')} 
                            className={`px-4 py-1 text-xs font-bold rounded transition-colors ${!isSaveMode ? 'bg-emerald-500 text-white' : 'bg-emerald-200 text-emerald-800'}`}
                        >
                            LOAD
                        </button>
                        <button 
                            onClick={() => setFxSnapAction('SAVE')} 
                            className={`px-4 py-1 text-xs font-bold rounded transition-colors ${isSaveMode ? 'bg-rose-500 text-white animate-pulse' : 'bg-rose-200 text-rose-800'}`}
                        >
                            SAVE
                        </button>
                    </div>
                </div>

                <div className="text-center text-xs font-bold text-slate-500">
                    {isSaveMode ? 'TAP TO SAVE' : 'TAP TO LOAD'} • {isSlotMode ? `Current Slot (${performanceFx.slots[activeSlotIndex].type})` : 'Entire Chain & Routing'}
                </div>

                {/* Grid */}
                <div className="grid grid-cols-4 gap-2 flex-grow">
                    {Array.from({ length: 16 }).map((_, i) => {
                        let hasContent = false;
                        if (isSlotMode) {
                            hasContent = performanceFx.slots[activeSlotIndex].snapshots[i].active;
                        } else {
                            hasContent = performanceFx.globalSnapshots[i].active;
                        }

                        return (
                            <Pad
                                key={i}
                                id={i}
                                label={`${i + 1}`}
                                onClick={() => handleFxSnapshotClick(i)}
                                hasContent={hasContent}
                                padType="snapshot" // Cyan color
                                isRecording={isSaveMode} // Visual cue for save mode
                            />
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderPerfFx = () => {
        return (
            <div className="w-full flex flex-col h-full overflow-hidden space-y-2">
                {/* 1. Slot Tabs */}
                <div className="flex justify-center space-x-2 pt-1 flex-shrink-0">
                    {[0, 1, 2, 3].map(i => (
                        <button
                            key={i}
                            onClick={() => setActiveSlotIndex(i)}
                            className={`w-16 py-1 rounded-t-lg font-bold text-sm transition-colors border-b-2 
                                ${activeSlotIndex === i 
                                    ? 'bg-white border-pink-500 text-pink-600' 
                                    : 'bg-emerald-100 border-transparent text-emerald-700 hover:bg-emerald-200'}`}
                        >
                            Slot {i + 1}
                        </button>
                    ))}
                </div>

                {/* 2. Sub Navigation (Main / Route / Snap) */}
                <div className="flex justify-center space-x-1 pb-1 border-b border-emerald-100">
                    {(['MAIN', 'ROUTE', 'SNAP'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setFxSubTab(tab)}
                            className={`px-4 py-0.5 text-[10px] font-bold rounded-full transition-colors ${fxSubTab === tab ? 'bg-slate-600 text-white' : 'bg-slate-200 text-slate-500'}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* 3. Dynamic Content */}
                {fxSubTab === 'MAIN' && renderFxMain()}
                {fxSubTab === 'ROUTE' && renderFxRoute()}
                {fxSubTab === 'SNAP' && renderFxSnap()}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full p-2">
            <div className="flex-grow flex bg-white shadow-md p-2 rounded-lg overflow-hidden">
                {viewMode === 'mixer' && renderMixer()}
                {viewMode === 'master_fx' && renderMasterFx()}
                {viewMode === 'perf_fx' && renderPerfFx()}
            </div>
        </div>
    );
};

export default MixerView;
