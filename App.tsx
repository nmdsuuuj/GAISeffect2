
import React, { useState, useContext, useEffect, useCallback, useRef } from 'react';
import { AppContext } from './context/AppContext';
import { Action, ActionType, PlaybackParams } from './types';

import Transport from './components/Transport';
import TabButton from './components/TabButton';
import SampleView from './components/views/SampleView';
import SeqView from './components/views/SeqView';
import GrooveView from './components/views/GrooveView';
import MixerView from './components/views/MixerView';
import ProjectView from './components/views/ProjectView';
import SynthView from './components/views/SynthView';
import GlobalKeyboard from './components/GlobalKeyboard';

import { useAudioEngine } from './hooks/useAudioEngine';
import { useSequencer } from './hooks/useSequencer';
import { PADS_PER_BANK } from './constants';
import SCALES from './scales';

type View = 'OTO' | 'SEQ' | 'GROOVE' | 'MIXER' | 'PROJECT';

export interface SubTab {
  label: string;
  onClick: () => void;
  isActive: boolean;
  isSpecial?: boolean; // For styling, e.g., REC button
}


const App: React.FC = () => {
  const { state, dispatch } = useContext(AppContext);
  const { toastMessage } = state;
  const [activeView, setActiveView] = useState<View>('OTO');
  const [subTabs, setSubTabs] = useState<SubTab[]>([]);
  
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const activeViewRef = useRef(activeView);
  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);


  useEffect(() => {
    const initAudio = () => {
      if (!state.isInitialized) {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContext.resume().then(() => {
          dispatch({ type: ActionType.INITIALIZE_AUDIO, payload: audioContext });
        });
      }
      window.removeEventListener('click', initAudio);
      window.removeEventListener('keydown', initAudio);
    };

    window.addEventListener('click', initAudio);
    window.addEventListener('keydown', initAudio);

    return () => {
      window.removeEventListener('click', initAudio);
      window.removeEventListener('keydown', initAudio);
    };
  }, [state.isInitialized, dispatch]);
  
  // Clear step selection when changing main view
  useEffect(() => {
    dispatch({ type: ActionType.SET_SELECTED_SEQ_STEP, payload: null });
  }, [activeView, dispatch]);

  // Toast auto-dismiss logic
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        dispatch({ type: ActionType.HIDE_TOAST });
      }, 3000); // Hide after 3 seconds
      return () => clearTimeout(timer);
    }
  }, [toastMessage, dispatch]);

  const { 
    playSample, 
    playSynthNote,
    scheduleLfoRetrigger,
    loadSampleFromBlob, 
    startRecording, 
    stopRecording,
    startMasterRecording,
    stopMasterRecording,
    flushAllSources,
    lfoAnalysers // Get analysers
  } = useAudioEngine();
  useSequencer(playSample, playSynthNote, scheduleLfoRetrigger);

  const handleNotePlay = useCallback((detune: number) => {
    const { 
        activeView: currentActiveView, 
        state: appState, 
        dispatch: appDispatch 
    } = { activeView: activeViewRef.current, state: stateRef.current, dispatch };

    const { 
        seqMode, isPlaying, selectedSeqStep, activeSampleBank, activeSampleId, 
        activePatternIds, activeKey, keyboardOctave
    } = appState;
    
    const finalRelativeDetune = detune + (activeKey * 100) + ((keyboardOctave - 4) * 1200);

    // 1. Check for Step Input mode
    if (currentActiveView === 'SEQ' && (seqMode === 'PART' || seqMode === 'PARAM') && selectedSeqStep !== null) {
        
        const targetPatternId = activePatternIds[activeSampleBank];
        
        // This is a step input. We record the note on the selected step for the active sample lane.
        appDispatch({
            type: ActionType.RECORD_STEP,
            payload: { 
                patternId: targetPatternId, 
                sampleId: activeSampleId, 
                step: selectedSeqStep, 
                detune: finalRelativeDetune 
            }
        });
        
        // Also play the note live for feedback
        if (activeSampleBank === 3) {
            playSynthNote(finalRelativeDetune, 0);
        } else {
            playSample(activeSampleId, 0, { detune: finalRelativeDetune });
        }
        return; // Done
    }

    // 2. If not step input, proceed with live play / real-time recording
    if(activeSampleBank === 3) {
      playSynthNote(finalRelativeDetune, 0);
    } else {
      playSample(activeSampleId, 0, { detune: finalRelativeDetune });
    }
    
    // 3. Handle real-time recording
    if (seqMode === 'REC' && isPlaying) {
        const { currentSteps } = appState;
        const isSynth = activeSampleBank === 3;
        if (isSynth) {
            const currentStep = currentSteps[3];
            const activePatternId = activePatternIds[3];
            if (currentStep >= 0) {
                appDispatch({
                    type: ActionType.RECORD_STEP,
                    payload: { patternId: activePatternId, sampleId: activeSampleId, step: currentStep, detune: finalRelativeDetune }
                });
            }
        } else { // 'A', 'B', or 'C'
             const currentStep = currentSteps[activeSampleBank];
             const activePatternId = activePatternIds[activeSampleBank];
             if (currentStep >= 0) {
                appDispatch({
                    type: ActionType.RECORD_STEP,
                    payload: { patternId: activePatternId, sampleId: activeSampleId, step: currentStep, detune: finalRelativeDetune }
                });
            }
        }
    }
  }, [dispatch, playSample, playSynthNote]);


  const handlePCKeyboardInput = useCallback((event: KeyboardEvent) => {
      if (event.repeat) return;
  
      const { state: appState, dispatch: appDispatch } = { state: stateRef.current, dispatch };
      const currentActiveView = activeViewRef.current;

      const { 
          activeSampleBank, activeKey, activeScale, keyboardOctave,
          isRecording, isArmed
      } = appState;
  
      const targetElement = event.target as HTMLElement;
      if (targetElement.tagName === 'INPUT') {
        const inputEl = targetElement as HTMLInputElement;
        if (inputEl.type === 'text' || inputEl.type === 'number') return;
      }
      if (targetElement.tagName === 'TEXTAREA' || targetElement.tagName === 'SELECT') return;

      const key = event.key;
  
      if (currentActiveView === 'OTO' && activeSampleBank < 3) {
          switch (key.toLowerCase()) {
              case 'q':
                  if (isRecording || isArmed) stopRecording(); else startRecording();
                  return;
              case 'w':
                  appDispatch({ type: ActionType.COPY_SAMPLE });
                  return;
              case 'e':
                  appDispatch({ type: ActionType.PASTE_SAMPLE });
                  return;
          }
      }

      switch (key.toLowerCase()) {
          case 'a':
              appDispatch({ type: ActionType.SET_KEYBOARD_OCTAVE, payload: Math.max(0, keyboardOctave - 1) });
              return;
          case 'f':
              appDispatch({ type: ActionType.SET_KEYBOARD_OCTAVE, payload: Math.min(8, keyboardOctave + 1) });
              return;
          case 'k': {
              const newKey = (activeKey - 1 + 12) % 12;
              appDispatch({ type: ActionType.SET_KEY, payload: newKey });
              // Also update active pattern playback key
              const activePatternId = appState.activePatternIds[activeSampleBank];
              if (activePatternId !== undefined) {
                  appDispatch({ type: ActionType.UPDATE_PATTERN_PLAYBACK_SCALE, payload: { patternId: activePatternId, key: newKey } });
              }
              return;
          }
          case 'l': {
              const newKey = (activeKey + 1) % 12;
              appDispatch({ type: ActionType.SET_KEY, payload: newKey });
              // Also update active pattern playback key
              const activePatternId = appState.activePatternIds[activeSampleBank];
              if (activePatternId !== undefined) {
                  appDispatch({ type: ActionType.UPDATE_PATTERN_PLAYBACK_SCALE, payload: { patternId: activePatternId, key: newKey } });
              }
              return;
          }
      }
      
      switch (key) {
        case ';': { // Scale Previous (Down)
            const currentIndexDown = SCALES.findIndex(s => s.name === activeScale);
            const prevIndex = (currentIndexDown - 1 + SCALES.length) % SCALES.length;
            const newScale = SCALES[prevIndex].name;
            appDispatch({ type: ActionType.SET_SCALE, payload: newScale });
            // Also update active pattern playback scale
            const activePatternId = appState.activePatternIds[activeSampleBank];
            if (activePatternId !== undefined) {
                appDispatch({ type: ActionType.UPDATE_PATTERN_PLAYBACK_SCALE, payload: { patternId: activePatternId, scale: newScale } });
            }
            return;
        }
        case ':': { // Scale Next (Up)
            const currentIndexUp = SCALES.findIndex(s => s.name === activeScale);
            const nextIndex = (currentIndexUp + 1) % SCALES.length;
            const newScale = SCALES[nextIndex].name;
            appDispatch({ type: ActionType.SET_SCALE, payload: newScale });
            // Also update active pattern playback scale
            const activePatternId = appState.activePatternIds[activeSampleBank];
            if (activePatternId !== undefined) {
                appDispatch({ type: ActionType.UPDATE_PATTERN_PLAYBACK_SCALE, payload: { patternId: activePatternId, scale: newScale } });
            }
            return;
        }
      }
  
      const bankMap: { [key: string]: number } = { '9': 0, '0': 1, '-': 2, '^': 3 };
      if (bankMap[key] !== undefined) {
          appDispatch({ type: ActionType.SET_ACTIVE_SAMPLE_BANK, payload: bankMap[key] });
          return;
      }
  
      const padNumber = parseInt(key, 10);
      if (!isNaN(padNumber) && padNumber >= 1 && padNumber <= PADS_PER_BANK) {
          const sampleIdToTrigger = activeSampleBank * PADS_PER_BANK + (padNumber - 1);
          appDispatch({ type: ActionType.SET_ACTIVE_SAMPLE, payload: sampleIdToTrigger });

          if (activeSampleBank === 3) {
            playSynthNote(0, 0); 
          } else {
            if (appState.samples[sampleIdToTrigger]?.buffer) {
                 playSample(sampleIdToTrigger, 0);
            }
          }
          return;
      }
  
      const keyMap: { [key: string]: number } = {
        'z': 0, 's': 1, 'x': 2, 'd': 3, 'c': 4, 'v': 5, 'g': 6,
        'b': 7, 'h': 8, 'n': 9, 'j': 10, 'm': 11, ',': 12,
      };

      const chromaticIndex = keyMap[key.toLowerCase()];
      if (chromaticIndex !== undefined) {
        const scale = SCALES.find(s => s.name === activeScale);
        let noteInCents: number;

        if (!scale || scale.name === 'Chromatic' || scale.name === 'Thru' || scale.intervals.length === 0) {
            noteInCents = chromaticIndex * 100;
        } else {
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
            noteInCents = finalKeyboardNotes[chromaticIndex];
        }

        if (noteInCents !== undefined) {
            handleNotePlay(noteInCents); // Base detune before key/octave
        }
      }
  }, [dispatch, startRecording, stopRecording, handleNotePlay, playSample, playSynthNote]);
  
  useEffect(() => {
      window.addEventListener('keydown', handlePCKeyboardInput);
      return () => {
          window.removeEventListener('keydown', handlePCKeyboardInput);
      };
  }, [handlePCKeyboardInput]);

  const renderView = () => {
    if (state.isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-slate-500 text-lg animate-pulse">Loading last session...</p>
        </div>
      );
    }
    if (!state.isInitialized) {
      return (
        <div className="flex items-center justify-center h-full">
         <p className="text-slate-500 text-lg">Click anywhere to start the audio engine...</p>
       </div>
     );
    }

    switch (activeView) {
      case 'OTO':
        if (state.activeSampleBank === 3) { // SYNTH bank
          return <SynthView setSubTabs={setSubTabs} playSynthNote={playSynthNote} lfoAnalysers={lfoAnalysers} />;
        }
        // Sample banks A, B, C
        return <SampleView 
            setSubTabs={setSubTabs}
            activeSampleId={state.activeSampleId}
            samples={state.samples}
            activeSampleBank={state.activeSampleBank}
            isRecording={state.isRecording}
            audioContext={state.audioContext}
            isArmed={state.isArmed}
            recordingThreshold={state.recordingThreshold}
            sampleClipboard={state.sampleClipboard}
            playSample={playSample} 
            startRecording={startRecording} 
            stopRecording={stopRecording} 
            loadSampleFromBlob={loadSampleFromBlob}
            dispatch={dispatch}
        />;
      case 'SEQ':
        return <SeqView setSubTabs={setSubTabs} playSample={playSample} playSynthNote={playSynthNote} />;
      case 'GROOVE':
        return <GrooveView />;
      case 'MIXER':
          return <MixerView setSubTabs={setSubTabs} startMasterRecording={startMasterRecording} stopMasterRecording={stopMasterRecording} />;
      case 'PROJECT':
        return <ProjectView flushAllSources={flushAllSources} />;
      default:
        // Fallback to OTO logic
        if (state.activeSampleBank === 3) {
          return <SynthView setSubTabs={setSubTabs} playSynthNote={playSynthNote} lfoAnalysers={lfoAnalysers} />;
        }
        return <SampleView 
            setSubTabs={setSubTabs}
            activeSampleId={state.activeSampleId}
            samples={state.samples}
            activeSampleBank={state.activeSampleBank}
            isRecording={state.isRecording}
            audioContext={state.audioContext}
            isArmed={state.isArmed}
            recordingThreshold={state.recordingThreshold}
            sampleClipboard={state.sampleClipboard}
            playSample={playSample} 
            startRecording={startRecording} 
            stopRecording={stopRecording} 
            loadSampleFromBlob={loadSampleFromBlob}
            dispatch={dispatch}
        />;
    }
  };
  
  return (
    <div className="bg-emerald-50 text-slate-800 flex flex-col h-screen font-sans w-full max-w-md mx-auto relative">
      <header className="flex-shrink-0 p-1 bg-emerald-100/50">
        <Transport 
          startMasterRecording={startMasterRecording} 
          stopMasterRecording={stopMasterRecording}
        />
      </header>
      
      <main className="flex-grow min-h-0 overflow-y-auto">
        {renderView()}
      </main>

      <footer className="flex-shrink-0 space-y-1 pt-1">
        {/* Sub-tabs */}
        <div className="flex-shrink-0">
            {subTabs.length > 0 && (
              <div className="px-1">
                  <div className="flex justify-around items-center space-x-1 p-1 bg-emerald-200 rounded-lg">
                  {subTabs.map(tab => (
                      <button
                      key={tab.label}
                      onClick={tab.onClick}
                      className={`flex-grow py-1 text-sm font-bold rounded-md transition-colors 
                          ${tab.isActive
                          ? (tab.isSpecial ? 'bg-rose-500 text-white shadow' : 'bg-white text-slate-800 shadow')
                          : 'bg-transparent text-slate-600'
                          }`}
                      >
                      {tab.label}
                      </button>
                  ))}
                  </div>
              </div>
            )}
        </div>
        
        {/* Main tabs */}
        <div className="p-0.5 bg-emerald-100/50">
          <div className="grid grid-cols-5 gap-1">
            <TabButton label="OTO" isActive={activeView === 'OTO'} onClick={() => setActiveView('OTO')} />
            <TabButton label="SEQ" isActive={activeView === 'SEQ'} onClick={() => setActiveView('SEQ')} />
            <TabButton label="GROOVE" isActive={activeView === 'GROOVE'} onClick={() => setActiveView('GROOVE')} />
            <TabButton label="MIXER" isActive={activeView === 'MIXER'} onClick={() => setActiveView('MIXER')} />
            <TabButton label="PROJECT" isActive={activeView === 'PROJECT'} onClick={() => setActiveView('PROJECT')} />
          </div>
        </div>
        <GlobalKeyboard onNotePlay={handleNotePlay} />
      </footer>
       {toastMessage && (
        <div className="toast-notification absolute bottom-36 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50 whitespace-nowrap">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default App;