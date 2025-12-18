import React, { useState, useContext, useEffect, useCallback } from 'react';
import { AppContext } from '../../context/AppContext';
import { db, Project, StorableSample, SampleKit, BankPreset, audioBufferToStorable, storableToAudioBuffer, Session } from '../../db';
import { ActionType, AppState, Sample, BankPresetData } from '../../types';
import { PADS_PER_BANK } from '../../constants';

// FIX: Helper to convert an array of Samples to StorableSamples for DB persistence.
const samplesToStorableArray = (samplesToConvert: Sample[]): StorableSample[] => {
    return samplesToConvert.map(s => ({
        id: s.id,
        name: s.name,
        volume: s.volume,
        pitch: s.pitch,
        start: s.start,
        end: s.end,
        decay: s.decay,
        loop: s.loop,
        playbackMode: s.playbackMode,
        lpFreq: s.lpFreq,
        hpFreq: s.hpFreq,
        bufferData: audioBufferToStorable(s.buffer)
    }));
};

// FIX: Helper to convert an array of StorableSamples from DB back to Samples with AudioBuffers.
const storableToSamplesArray = (storableSamples: StorableSample[], ctx: AudioContext): Sample[] => {
    return storableSamples.map(s => ({
        id: s.id,
        name: s.name,
        volume: s.volume,
        pitch: s.pitch,
        start: s.start,
        end: s.end,
        decay: s.decay,
        loop: s.loop,
        playbackMode: s.playbackMode,
        lpFreq: s.lpFreq,
        hpFreq: s.hpFreq,
        buffer: storableToAudioBuffer(s.bufferData, ctx),
    }));
};


const ManualModal = ({ onClose }: { onClose: () => void }) => {
    const manualContent = `
Groove Sampler 日本語マニュアル

このドキュメントでは、アプリの基本的な操作とPCキーボードでのショートカットについて説明します。

------------------------------------------------------------------

## PCキーボードショートカット

### グローバルコントロール
(これらのショートカットは、どの画面でも機能します)

| キー | 機能 | 説明 |
| :--- | :--- | :--- |
| \`A\` | オクターブDOWN | 演奏用キーボードのオクターブを1つ下げます。 |
| \`F\` | オクターブUP | 演奏用キーボードのオクターブを1つ上げます。 |
| \`K\` | ルート音DOWN | 入力および再生中のパターンのルート音を半音下げます。 |
| \`L\` | ルート音UP | 入力および再生中のパターンのルート音を半音上げます。 |
| \`;\` | スケール切り替え (DOWN) | 入力および再生中のパターンのスケール（音階）を前の設定に変更します。 |
| \`:\` | スケール切り替え (UP) | 入力および再生中のパターンのスケール（音階）を次の設定に変更します。 |

### パッド & バンク操作

| キー | 機能 | 説明 |
| :--- | :--- | :--- |
| \`1\` - \`8\` | パッドのトリガー & 選択 | 現在選択されているバンクの対応するサンプルパッドの音を鳴らし、そのパッドを選択状態にします。 |
| \`9\`, \`0\`, \`-\`, \`^\` | バンク切り替え | それぞれバンクA, B, C, Dに切り替えます。 |

### ノート演奏 & リアルタイムレコーディング

PCキーボードの下2段は、SEQ画面で選択されたサンプルを演奏するための鍵盤として機能します。

| キー | 鍵盤 |
| :--- | :--- |
| \`z\`, \`x\`, \`c\`, \`v\`, \`b\`, \`n\`, \`m\`, \`,\` | 白鍵 |
| \`s\`, \`d\`, \`g\`, \`h\`, \`j\` | 黒鍵 |

- **スケール連動:** このキーボードは、SEQ画面で設定されたキーとスケール（音階）に自動的にマッピングされます。これにより、スケールに沿った音楽的な演奏が直感的に行えます。
- **リアルタイムREC:** SEQ画面で\`REC\`モードが有効な時にシーケンサーを再生すると、演奏したノートが現在のパターンに直接記録されます。

### SAMPLE画面 ショートカット

これらのショートカットは、SAMPLE画面がアクティブな時のみ機能します。

| キー | 機能 | 説明 |
| :--- | :--- | :--- |
| \`Q\` | 録音 ARM / STOP | サンプルの録音を開始（ARM）、または停止します。 |
| \`W\` | サンプルコピー | 現在選択されているサンプルをクリップボードにコピーします。 |
| \`E\` | サンプルペースト | クリップボードのサンプルを現在選択されているパッドに貼り付けます。 |

------------------------------------------------------------------

## トラブルシューティング

### 音が鳴らない・異音がする場合
アップデートや予期せぬエラーにより、設定データが不整合を起こしている可能性があります。以下の手順を順番にお試しください。

1. **設定を初期化 (Reset to Factory):**
   Project画面にある「設定を初期化」ボタンを押してください。これにより、シンセサイザーの設定が安全な初期状態に戻ります。

2. **セッション削除 & Reload:**
   上記でも解決しない場合、またはアプリの挙動がおかしい場合は、「セッション削除 & Reload」ボタンを押してください。これにより、ブラウザに保存されている自動保存データを完全に消去し、アプリをクリーンな状態で再起動します。
`;

    const formattedContent = manualContent
        .replace(/\| :--- \| :--- \| :--- \|/g, '')
        .replace(/\|/g, ' | ')
        .replace(/`/g, '')
        .split('\n')
        .map((line, index) => {
            if (line.startsWith('## ')) return <h2 key={index} className="text-lg font-bold mt-4 mb-2">{line.substring(3)}</h2>;
            if (line.startsWith('### ')) return <h3 key={index} className="text-md font-semibold mt-3 mb-1">{line.substring(4)}</h3>;
            if (line.startsWith('---')) return <hr key={index} className="my-4 border-emerald-200" />;
            if (line.trim().startsWith('|')) { // Table row
                return (
                    <tr key={index} className="border-b border-emerald-100">
                        {line.split(' | ').slice(1, -1).map((cell, cellIndex) => (
                            <td key={cellIndex} className="p-2 text-sm">{cell.trim()}</td>
                        ))}
                    </tr>
                );
            }
            if (line.trim().startsWith('- **') || line.trim().match(/^\d+\./)) {
                return <li key={index} className="ml-5 mb-1 list-disc text-sm">{line.replace('- **', '').replace('**:', ':**')}</li>
            }
            return <p key={index} className="mb-2 text-sm">{line}</p>;
        });

    // Group table rows
    const finalContent = [];
    let tableRows = [];
    for (const item of formattedContent) {
        if (item.type === 'tr') {
            tableRows.push(item);
        } else {
            if (tableRows.length > 0) {
                finalContent.push(<table key={`table-${finalContent.length}`} className="w-full text-left table-auto my-2"><tbody className="bg-emerald-50/50">{tableRows}</tbody></table>);
                tableRows = [];
            }
            finalContent.push(item);
        }
    }
    if (tableRows.length > 0) {
         finalContent.push(<table key={`table-${finalContent.length}`} className="w-full text-left table-auto my-2"><tbody className="bg-emerald-50/50">{tableRows}</tbody></table>);
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl p-4 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                {finalContent}
            </div>
        </div>
    );
};

interface ProjectViewProps {
    flushAllSources: () => void;
}

const ProjectView: React.FC<ProjectViewProps> = ({ flushAllSources }) => {
    const { state, dispatch } = useContext(AppContext);
    const { audioContext, samples, activeSampleBank, activePatternIds, patterns, isPlaying } = state;

    const [projects, setProjects] = useState<Project[]>([]);
    const [projectName, setProjectName] = useState('New Project');
    const [sampleKits, setSampleKits] = useState<SampleKit[]>([]);
    const [sampleKitName, setSampleKitName] = useState('New Sample Kit');
    const [bankPresets, setBankPresets] = useState<BankPreset[]>([]);
    const [bankPresetName, setBankPresetName] = useState('New Bank Preset');
    const [isManualOpen, setIsManualOpen] = useState(false);
    
    // Startup Preference
    const [startWithDefault, setStartWithDefault] = useState(false);

    useEffect(() => {
        const pref = localStorage.getItem('groove_sampler_startup_mode');
        setStartWithDefault(pref === 'user_default');
    }, []);

    const toggleStartupMode = () => {
        const newValue = !startWithDefault;
        setStartWithDefault(newValue);
        if (newValue) {
            localStorage.setItem('groove_sampler_startup_mode', 'user_default');
        } else {
            localStorage.removeItem('groove_sampler_startup_mode');
        }
    };

    const refreshProjects = useCallback(async () => {
        const projs = await db.projects.orderBy('createdAt').reverse().toArray();
        setProjects(projs);
    }, []);

    const refreshSampleKits = useCallback(async () => {
        const sKits = await db.sampleKits.orderBy('createdAt').reverse().toArray();
        setSampleKits(sKits);
    }, []);

    const refreshBankPresets = useCallback(async () => {
        const bPresets = await db.bankPresets.orderBy('createdAt').reverse().toArray();
        setBankPresets(bPresets);
    }, []);

    useEffect(() => {
        refreshProjects();
        refreshSampleKits();
        refreshBankPresets();
    }, [refreshProjects, refreshSampleKits, refreshBankPresets]);

    const handleSaveProject = async () => {
        if (!projectName.trim()) {
            dispatch({ type: ActionType.SHOW_TOAST, payload: 'プロジェクト名を入力してください。' });
            return;
        }
        const stateToSave = { ...state };
        // Exclude non-serializable or transient properties
        const propertiesToDelete: (keyof AppState)[] = [
            'audioContext', 'isInitialized', 'isPlaying', 'isRecording', 
            'isArmed', 'currentSteps', 'samples', 'isLoading',
            'isMasterRecording', 'isMasterRecArmed', 'toastMessage'
        ];
        propertiesToDelete.forEach(prop => delete (stateToSave as Partial<AppState>)[prop]);
        
        const project: Project = {
            name: projectName.trim(),
            createdAt: new Date(),
            state: stateToSave,
            samples: samplesToStorableArray(state.samples),
        };
        await db.projects.add(project);
        dispatch({ type: ActionType.SHOW_TOAST, payload: `プロジェクト「${project.name}」を保存しました。` });
        refreshProjects();
    };

    const handleLoadProject = useCallback(async (projectId: number) => {
        const project = await db.projects.get(projectId);
        if (project && audioContext) {
            if (isPlaying) {
                flushAllSources();
            }
            const loadedSamples = storableToSamplesArray(project.samples, audioContext);
            const loadedState = { ...project.state, samples: loadedSamples };
            dispatch({ type: ActionType.LOAD_PROJECT_STATE, payload: loadedState });
            dispatch({ type: ActionType.SHOW_TOAST, payload: `プロジェクト「${project.name}」を読み込みました。` });
        }
    }, [audioContext, dispatch, isPlaying, flushAllSources]);

    const handleDeleteProject = async (projectId: number) => {
        if (window.confirm('このプロジェクトを削除しますか？この操作は元に戻せません。')) {
            await db.projects.delete(projectId);
            refreshProjects();
        }
    };
    
    const handleSaveSampleKit = async () => {
        if (!sampleKitName.trim()) {
            dispatch({ type: ActionType.SHOW_TOAST, payload: 'サンプルキット名を入力してください。' });
            return;
        }
        const kit: SampleKit = {
            name: sampleKitName.trim(),
            createdAt: new Date(),
            samples: samplesToStorableArray(samples),
        };
        await db.sampleKits.add(kit);
        dispatch({ type: ActionType.SHOW_TOAST, payload: `サンプルキット「${kit.name}」を保存しました。` });
        refreshSampleKits();
    };

    const handleLoadSampleKit = useCallback(async (kitId: number) => {
        const kit = await db.sampleKits.get(kitId);
        if (kit && audioContext) {
            const loadedSamples = storableToSamplesArray(kit.samples, audioContext);
            dispatch({ type: ActionType.SET_SAMPLES, payload: loadedSamples });
            dispatch({ type: ActionType.SHOW_TOAST, payload: `サンプルキット「${kit.name}」を読み込みました。` });
        }
    }, [dispatch, audioContext]);

    const handleDeleteSampleKit = async (kitId: number) => {
        if (window.confirm('このサンプルキットを削除しますか？')) {
            await db.sampleKits.delete(kitId);
            refreshSampleKits();
        }
    };

    const handleSaveBankPreset = async () => {
        if (!bankPresetName.trim()) {
            dispatch({ type: ActionType.SHOW_TOAST, payload: 'バンクプリセット名を入力してください。' });
            return;
        }
        const startSampleId = activeSampleBank * PADS_PER_BANK;
        const endSampleId = startSampleId + PADS_PER_BANK;
        const bankSamples = samples.slice(startSampleId, endSampleId);

        const activePatternId = activePatternIds[activeSampleBank];
        const pattern = patterns.find(p => p.id === activePatternId);
        if (!pattern) return;

        const bankSequences = pattern.steps.slice(startSampleId, endSampleId);
        const bankParamLocks: BankPreset['paramLocks'] = {};
        for (let i = startSampleId; i < endSampleId; i++) {
            if (pattern.paramLocks[i]) {
                bankParamLocks[i - startSampleId] = pattern.paramLocks[i];
            }
        }

        const preset: BankPreset = {
            name: bankPresetName.trim(),
            createdAt: new Date(),
            samples: samplesToStorableArray(bankSamples),
            sequences: JSON.parse(JSON.stringify(bankSequences)),
            paramLocks: JSON.parse(JSON.stringify(bankParamLocks)),
            grooveId: pattern.grooveIds[activeSampleBank],
            grooveDepth: pattern.grooveDepths[activeSampleBank],
        };

        await db.bankPresets.add(preset);
        dispatch({ type: ActionType.SHOW_TOAST, payload: `バンクプリセット「${preset.name}」を保存しました。` });
        refreshBankPresets();
    };

    const handleLoadBankPreset = useCallback(async (presetId: number) => {
        if (!audioContext) return;
        const preset = await db.bankPresets.get(presetId);
        if (!preset) return;

        const loadedSamples = storableToSamplesArray(preset.samples, audioContext);

        const presetData: BankPresetData = {
            samples: loadedSamples,
            sequences: preset.sequences,
            paramLocks: preset.paramLocks,
            grooveId: preset.grooveId,
            grooveDepth: preset.grooveDepth
        };

        dispatch({
            type: ActionType.LOAD_BANK_PRESET,
            payload: { bankIndex: activeSampleBank, presetData }
        });

        dispatch({ type: ActionType.SHOW_TOAST, payload: `プリセット「${preset.name}」をバンク ${String.fromCharCode(65 + activeSampleBank)} に読み込みました。` });

    }, [audioContext, activeSampleBank, dispatch]);
    
    const handleDeleteBankPreset = async (presetId: number) => {
        if (window.confirm('このバンクプリセットを削除しますか？')) {
            await db.bankPresets.delete(presetId);
            refreshBankPresets();
        }
    };

    // --- User Default Synth Settings Handlers ---
    const handleSaveUserDefaultSynth = () => {
        const { synth, synthModMatrix } = state;
        const settings = {
            synth: JSON.parse(JSON.stringify(synth)),
            modMatrix: JSON.parse(JSON.stringify(synthModMatrix))
        };
        localStorage.setItem('groove_sampler_user_default_synth', JSON.stringify(settings));
        dispatch({ type: ActionType.SHOW_TOAST, payload: '現在のシンセ設定を起動時のデフォルトとして保存しました。' });
    };

    const handleLoadUserDefaultSynth = async () => {
        // 1. Kill sound immediately
        flushAllSources();
        
        // 2. Dispatch the Reset Action (which now includes resetting effects)
        dispatch({ type: ActionType.RESET_TO_USER_DEFAULT });
        
        // 3. Force-Save this "Clean" state to IndexedDB immediately.
        // This bypasses the 1-second auto-save debounce in AppContext.
        const stateToSave = { ...state };
        const propertiesToDelete: (keyof AppState)[] = [
            'audioContext', 'isInitialized', 'isPlaying', 'isRecording', 
            'isArmed', 'currentSteps', 'samples', 'isLoading',
            'isMasterRecording', 'isMasterRecArmed', 'toastMessage'
        ];
        propertiesToDelete.forEach(prop => delete (stateToSave as Partial<AppState>)[prop]);

        const samplesToStore: StorableSample[] = state.samples.map(s => ({
            ...s,
            buffer: undefined,
            bufferData: audioBufferToStorable(s.buffer),
        }));

        const session: Session = {
            id: 0,
            state: stateToSave,
            samples: samplesToStore,
        };

        try {
            await db.session.put(session);
            console.log("Forced session save completed.");
        } catch (error) {
            console.error("Failed to force save session:", error);
        }

        dispatch({ type: ActionType.SHOW_TOAST, payload: 'デフォルト設定を適用し、セッションを強制保存しました。' });
    };

    const handleClearUserDefaultSynth = () => {
        localStorage.removeItem('groove_sampler_user_default_synth');
        dispatch({ type: ActionType.SHOW_TOAST, payload: 'デフォルト設定を工場出荷時にリセットしました。' });
    };
    
    // --- Emergency Reset ---
    const handleDeleteSessionAndReload = async () => {
        if(window.confirm('現在の自動保存セッションを完全に削除し、アプリをリロードします。保存していない変更は失われます。よろしいですか？')) {
            try {
                await db.session.clear();
                window.location.reload();
            } catch (e) {
                console.error("Failed to clear session:", e);
                window.location.reload();
            }
        }
    };

    const renderListItem = (
        item: { id?: number; name: string; createdAt: Date }, 
        onLoad: (id: number) => void, 
        onDelete: (id: number) => void
    ) => (
        <li key={item.id} className="flex items-center justify-between bg-emerald-50 p-1.5 rounded text-sm">
            <div>
                <p className="font-semibold">{item.name}</p>
                <p className="text-xs text-slate-500">{item.createdAt.toLocaleDateString()}</p>
            </div>
            <div className="space-x-1">
                <button onClick={() => onLoad(item.id!)} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-2 py-1 rounded text-xs">読込</button>
                <button onClick={() => onDelete(item.id!)} className="bg-rose-500 hover:bg-rose-600 text-white font-bold px-2 py-1 rounded text-xs">削除</button>
            </div>
        </li>
    );

    return (
        <div className="p-2 space-y-3 h-full overflow-y-auto">
            {isManualOpen && <ManualModal onClose={() => setIsManualOpen(false)} />}

            <div className="bg-white p-2 rounded-lg shadow-md space-y-2">
                <h3 className="font-bold text-slate-700 text-center mb-1">プロジェクト管理</h3>
                <div className="flex space-x-2">
                    <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} className="bg-emerald-100 text-slate-800 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm" placeholder="プロジェクト名" />
                    <button onClick={handleSaveProject} className="bg-sky-500 hover:bg-sky-600 text-white font-bold px-4 py-2 rounded text-sm whitespace-nowrap">保存</button>
                </div>
                <ul className="space-y-1 max-h-24 overflow-y-auto pr-1">
                    {projects.map(p => renderListItem(p, handleLoadProject, handleDeleteProject))}
                </ul>
            </div>
            
             <div className="bg-white p-2 rounded-lg shadow-md space-y-2">
                <h3 className="font-bold text-slate-700 text-center mb-1">バンクプリセット</h3>
                <p className="text-xs text-slate-500 text-center -mt-1 mb-2">現在のバンクのサンプル(8個)とシーケンスを保存/読込します。</p>
                <div className="flex space-x-2">
                    <input type="text" value={bankPresetName} onChange={(e) => setBankPresetName(e.target.value)} className="bg-emerald-100 text-slate-800 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-pink-400 text-sm" placeholder="プリセット名" />
                    <button onClick={handleSaveBankPreset} className="bg-pink-500 hover:bg-pink-600 text-white font-bold px-4 py-2 rounded text-sm whitespace-nowrap">保存</button>
                </div>
                <ul className="space-y-1 max-h-24 overflow-y-auto pr-1">
                    {bankPresets.map(p => renderListItem(p, handleLoadBankPreset, handleDeleteBankPreset))}
                </ul>
            </div>

            <div className="bg-white p-2 rounded-lg shadow-md space-y-2">
                <h3 className="font-bold text-slate-700 text-center mb-1">サンプルキット (全32パッド)</h3>
                <div className="flex space-x-2">
                    <input type="text" value={sampleKitName} onChange={(e) => setSampleKitName(e.target.value)} className="bg-emerald-100 text-slate-800 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm" placeholder="サンプルキット名" />
                    <button onClick={handleSaveSampleKit} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 py-2 rounded text-sm whitespace-nowrap">保存</button>
                </div>
                <ul className="space-y-1 max-h-24 overflow-y-auto pr-1">
                    {sampleKits.map(k => renderListItem(k, handleLoadSampleKit, handleDeleteSampleKit))}
                </ul>
            </div>
            
            <div className="bg-white p-2 rounded-lg shadow-md space-y-2">
                <h3 className="font-bold text-slate-700 text-center mb-1">起動時の設定 (Startup Settings)</h3>
                <p className="text-xs text-slate-500 text-center -mt-1 mb-2">現在のシンセ設定をアプリ起動時の初期状態として保存します。</p>
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={handleSaveUserDefaultSynth} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 rounded text-xs">現在の設定を保存<br/>(Save Current as Default)</button>
                    <button onClick={handleLoadUserDefaultSynth} className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 rounded text-xs">デフォルト設定をロード<br/>(Apply & Force Save)</button>
                    <button onClick={handleClearUserDefaultSynth} className="bg-slate-400 hover:bg-slate-500 text-white font-bold py-2 rounded text-xs col-span-2">設定を初期化<br/>(Reset to Factory)</button>
                </div>
                
                <div className="flex items-center justify-between border-t border-emerald-100 pt-2 mt-2">
                    <label className="flex items-center space-x-2 text-xs font-bold text-slate-600 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={startWithDefault} 
                            onChange={toggleStartupMode}
                            className="form-checkbox h-4 w-4 text-emerald-500 rounded focus:ring-emerald-400"
                        />
                        <span>常にデフォルトで起動<br/><span className="text-[10px] font-normal text-slate-400">(前回の続きを無視)</span></span>
                    </label>
                    <button onClick={handleDeleteSessionAndReload} className="bg-rose-100 text-rose-600 border border-rose-200 hover:bg-rose-200 text-[10px] font-bold px-2 py-1 rounded">
                        セッション削除<br/>& Reload
                    </button>
                </div>
            </div>

            <div className="bg-white p-2 rounded-lg shadow-md">
                <button onClick={() => setIsManualOpen(true)} className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 rounded">
                    マニュアル
                </button>
            </div>
        </div>
    );
};

export default ProjectView;