import { useEffect, useRef } from 'react';

type MidiMessageCallback = (cc: number, value: number) => void;

export const useMidi = (onMidiMessage: MidiMessageCallback) => {
    const onMidiMessageRef = useRef(onMidiMessage);
    useEffect(() => {
        onMidiMessageRef.current = onMidiMessage;
    }, [onMidiMessage]);

    useEffect(() => {
        // FIX: Replaced `WebMidi.MIDIAccess` with `MIDIAccess` because the Web MIDI API types are available in the global scope, not under a `WebMidi` namespace.
        let midiAccess: MIDIAccess | null = null;

        // FIX: Replaced `WebMidi.MIDIMessageEvent` with `MIDIMessageEvent` because the Web MIDI API types are available in the global scope, not under a `WebMidi` namespace.
        const handleMidiMessage = (event: MIDIMessageEvent) => {
            const [status, data1, data2] = event.data;
            // Check for Control Change message (176-191) on any channel
            if (status >= 176 && status <= 191) {
                const ccNumber = data1;
                const value = data2; // 0-127
                onMidiMessageRef.current(ccNumber, value);
            }
        };

        const setupMidi = async () => {
            if (navigator.requestMIDIAccess) {
                try {
                    midiAccess = await navigator.requestMIDIAccess();
                    console.log('MIDI Access Granted');

                    const inputs = midiAccess.inputs.values();
                    for (let input = inputs.next(); input && !input.done; input = inputs.next()) {
                        console.log(`Attaching MIDI listener to: ${input.value.name}`);
                        input.value.onmidimessage = handleMidiMessage;
                    }

                    // FIX: Type the event as MIDIConnectionEvent to access the .port property.
                    midiAccess.onstatechange = (event: MIDIConnectionEvent) => {
                        console.log(`MIDI state change: ${event.port.name}, ${event.port.state}`);
                        if (event.port.type === 'input' && event.port.state === 'connected') {
                             // FIX: Cast `event.port` to `MIDIInput` as `MIDIPort` doesn't have `onmidimessage`.
                             (event.port as MIDIInput).onmidimessage = handleMidiMessage;
                        }
                    };

                } catch (error) {
                    console.error('Failed to get MIDI access', error);
                }
            } else {
                console.warn('Web MIDI API is not supported in this browser.');
            }
        };

        setupMidi();

        return () => {
            if (midiAccess) {
                const inputs = midiAccess.inputs.values();
                for (let input = inputs.next(); input && !input.done; input = inputs.next()) {
                    input.value.onmidimessage = null;
                }
            }
        };
    }, []);
};
