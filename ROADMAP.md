
# Project Roadmap

This document outlines the future development plan for the Groove Sampler. While the current version focuses on a powerful sequencing and groove engine, the next phase aims to elevate it into a complete beat-making station by adding dedicated mixing, mastering, and final export capabilities.

## Phase 1: UI & Ergonomics Refactor (In Progress)

### 1. Navigation Consolidation

#### **Overview**
A major refactor of the application's core layout to improve ergonomics, especially on mobile devices.

#### **UI/UX**
*   **Move Navigation to Bottom:** All primary navigation tabs (`SAMPLE`, `SEQ`, `SYNTH`, etc.) and secondary, view-specific tabs (`OSC/FLT`, `PART/P.L`, etc.) will be moved to the bottom of the screen, just above the global performance keyboard.
*   **Rationale:** This places all critical interaction points within easy reach of the thumb, enabling more comfortable and efficient one-handed use on mobile phones.

### 2. Bank & Track Renaming

#### **Overview**
Clarify the roles of the different tracks within the sequencer.

#### **UI/UX**
*   **"Bank D" becomes "SYNTH":** The fourth track, which is a dedicated synthesizer, will be explicitly labeled "SYNTH" throughout the UI (in the bank selector, mixer, etc.) instead of "D".
*   **Rationale:** This removes ambiguity and makes the distinction between the three sampler tracks (A, B, C) and the one synthesizer track immediately obvious to new users.


## Phase 2: The Mixing & Mastering Update

### 1. Mixer Tab & Functionality

#### **Overview**
A new "MIXER" tab will be introduced to provide intuitive, professional-style control over the four independent sequencer tracks (sample banks).

#### **UI/UX**
*   **New "MIXER" Tab:** Will be added as a fifth primary tab alongside "SEQ", "SAMPLE", "GROOVE", and "PROJECT".
*   **Channel Strips:**
    *   Four vertical channel strips, one for each sample bank (A, B, C, SYNTH).
    *   Each strip will feature:
        *   **Volume Fader:** For intuitive control over each bank's level.
        *   **Pan Knob:** To position each bank in the stereo field.
        *   **MUTE Button:** To temporarily silence a specific bank.
        *   **SOLO Button:** To listen to a single bank in isolation.
*   **Master Channel:**
    *   A final master channel strip on the right, where all bank signals are summed.
    *   It will include a master volume fader to control the final output level.

#### **Technical Implementation**
*   A `GainNode` will be added to each bank's audio chain to control volume.
*   A `StereoPannerNode` will be added for panning.
*   The global state will be updated to manage each bank's `volume`, `pan`, `isMuted`, and `isSoloed` status.

### 2. Master Effects: Limiter / Clipper

#### **Overview**
A master effect unit will be added to the final output stage to prevent clipping and increase the overall loudness and punch of the mix.

#### **UI/UX**
*   A "MASTER FX" section will be located on the Master Channel Strip within the new MIXER tab.
*   Controls will include:
    *   **FX ON/OFF Switch:** To bypass or engage the master effect.
    *   **TYPE Selector:** To choose between "Limiter" (for clean peak prevention) and "Clipper" (for a slightly more saturated, aggressive sound).
    *   **AMOUNT Knob:** To control the intensity of the effect (e.g., threshold for the limiter, drive for the clipper).

#### **Technical Implementation**
*   **Limiter:** Will be implemented using the Web Audio API's `DynamicsCompressorNode`, configured with a very high ratio (e.g., 20:1) and a low threshold.
*   **Clipper:** Will be implemented using a `WaveShaperNode` with a custom curve to apply soft or hard clipping to the signal.
*   This effect node will be the last in the audio chain before the `audioContext.destination`.

### 3. Master Recorder

#### **Overview**
A function to record the final, mixed-down audio output (all banks + master effects) into a single, high-quality audio file for sharing or further editing.

#### **UI/UX**
*   A master "REC" button will be placed in a prominent location, either on the master channel strip or in the main transport header.
*   Clear visual feedback (e.g., a blinking red light) will indicate that recording is in progress.
*   Upon stopping the recording, a file download prompt will automatically appear for a `.wav` file, named with the project name and a timestamp.

#### **Technical Implementation**
*   The final audio signal (post-master effects) will be routed to a `MediaStreamAudioDestinationNode` in parallel with the `audioContext.destination`.
*   This `MediaStream` will be fed into the `MediaRecorder` API to capture the output.
*   The recorded Blob data will be packaged into a WAV file format and offered to the user for download.

## Phase 3: The Performance & Composition Update (今後の計画)

### 1. 高度なシーケンサーモード

#### **概要**
従来のステップシーケンサーを超え、メロディやベースラインの作成、ステップごとの詳細なサウンドデザインを可能にするためのモードを導入します。**リアルタイムレコーディング機能**も統合し、演奏を直接シーケンスに記録できるようになります。

*   **Keyboard Mode:** リアルタイム演奏でノートピッチを入力できます。選択したスケールに自動でクオンタイズされるため、音楽理論の知識がなくてもハーモニーを外すことなく入力可能です。
*   **Parameter Lock Mode:** ステップごとにサンプルの各種パラメータ（**ノートピッチ**、ボリューム、ディケイ、フィルター周波数など）を記録（ロック）できます。各ステップにロックされた値は、シーケンサーグリッド上で視覚的に表現され、直感的なエディットをサポートします。シーケンサーで設定されたノートピッチとは独立して、サンプル自体の基本ピッチも調整可能です。また、各トラックのノートシーケンスを一時的に無効にするミュートボタンも追加し、メロディとリズムの切り替えを容易にします。
*   **Part Edit Mode:** 従来のA/Bパートの長さや再生レートを設定するモードです。
*   **リアルタイムREC:** 再生中にパッドを叩いたタイミングや、ノブ/フェーダーを操作した動きをシーケンスデータとして直接記録します。記録されたノートはステップシーケンサーのグリッドに、パラメータの動きはParameter Lockデータに反映され、後から微調整が可能です。

#### **UI/UX**
*   **モード切替:** SEQビューに、3つの編集モード（Part Edit, Keyboard, Parameter Lock）を切り替えるためのスイッチを設置します。
*   **RECボタン:** TransportエリアのRECボタン（またはSEQビュー内の専用ボタン）を押して再生すると、リアルタイムRECが有効になります。クオンタイズ設定（1/16, 1/8, OFFなど）も可能にします。

### 2. グローバル・スケールシステム

#### **概要**
メジャー/マイナースケールといった基本的な音階から、ご要望のあった**アフリカ、アラブ世界、イラン、中東、東欧、アジア（インドネシアのガムラン、インド古典音楽など）、さらには古代の音階**まで、多彩なスケールをサポートします。Gemini APIを活用してこれらの音階データを収集・データベース化し、アプリケーションに実装します。

#### **UI/UX**
*   楽曲のキー（ルート音）とスケールの種類を、ドロップダウンメニューから簡単に選択できるグローバル設定を導入します。
*   選択されたスケールは、Keyboard Modeの鍵盤表示に反映されます。スケールに含まれない音は無効化（または非表示に）することで、ユーザーは音楽理論の知識がなくても、選択した音階に沿った本格的なメロディを直感的に作成できます。これにより、作曲プロセスが大幅に簡素化され、創造性が促進されます。

### 3. サンプルキット管理機能

#### **概要**
プロジェクト全体の設定とは別に、32個のサンプルパッドに読み込まれたサンプルのセットを「キット」として素早く保存・ロードする機能です。

#### **UI/UX**
*   Projectビューに「Save Kit」「Load Kit」セクションを追加します。
*   ユーザーは作成したドラムキットやサウンドセットを名前を付けて保存し、他のプロジェクトで再利用できます。これにより、同じシーケンスパターンのまま音色だけを瞬時に変更するなど、ライブパフォーマンスや制作効率が飛躍的に向上します。

### 4. パッド/バンク構成の再設計

#### **概要**
現在の「1バンク＝8パッド（8トラック）」という構成を、「1バンク＝2パッド（2トラック）」または「1バンク＝4パッド（4トラック）」へと変更することを検討します。

#### **目的・メリット**
*   **操作性の向上:** 1画面に表示するトラック数を減らすことで、各トラックのシーケンスデータやパラメータロック情報をより広く、見やすく表示できます。
*   **詳細なエディット:** 各トラックに割り当てられる画面スペースが増えるため、ノートのピッチ、ベロシティ、長さなどをグラフィカルに表示・編集するような、より高度なUIの実装が可能になります。
*   **直感的なワークフロー:** 少ないトラックに集中することで、ユーザーはより音楽的なアイデアの構築に専念できます。

#### **検討事項**
最終的なパッド数は、プロトタイピングを通じてUI/UXの観点から最もバランスの良い構成（2または4）を決定します。この変更はアプリケーションの基本的な構造に影響するため、慎重に計画を進めます。

### 5. テンプレートシステムの拡張

#### **概要**
シーケンスパターンとグルーブ（タイミング）を豊かにするため、多彩なテンプレートを導入します。

*   **シーケンスパターンテンプレート:**
    *   **ドラム用:** 8ビート、16ビート、ロック、ファンクなど、基本的なジャンルのパターン。
    *   **世界の打楽器用:** サンバ、アフロビート、ラテンなど、特徴的なリズムパターン。
    *   **音階楽器用:** ベースラインのアルペジオ、基本的なコード進行のパターンなど。
*   **テンプレートの組み合わせ:**
    *   これらのシーケンスパターンテンプレートは、既存のグルーブテンプレート（Grooveビューで設定）と自由に組み合わせることが可能です。例えば、「サンバ」のリズムパターンに「MPC 62%」の人間的な揺れ（グルーブ）を加えるなど、無限のグルーヴを生み出せます。

### 6. Ornament Sequence Library & Triggering

#### **概要**
To add more complexity and flair to sequences, a library of micro-sequences (ornaments) will be introduced. This allows a single step in the main sequencer to trigger a more complex, pre-defined musical phrase.

#### **UI/UX**
*   A new "ORNAMENT" or "FLAM" mode will be added to the sequencer.
*   When a step is selected in this mode, the user can choose an ornament from a library via a popup or dedicated panel.
*   The library will be categorized (e.g., Flams, Drags, Rolls, Trills, Arpeggios).
*   The main sequencer grid will visually indicate which steps have an ornament trigger applied.

#### **Technical Implementation**
*   A new data structure for "Ornaments" will be created, defining a series of notes/triggers with fine-grained timing offsets and velocity changes.
*   The sequencer engine (`useSequencer.ts`) will be modified. When it encounters a step with an ornament trigger, instead of playing a single sample, it will schedule the multiple events defined in the ornament sequence.
*   All ornament timings will be tempo-synced, scaling correctly with BPM changes.
*   The ornament library itself will be designed to be easily expandable with new patterns.
