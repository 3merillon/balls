/*
MIT License

2024, Cyril Monkewitz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
export const audioContext = new (window.AudioContext || window.webkitAudioContext)();
export let isPlaying = false;
export let mainGainNode;
let seed = Math.random();
let currentKey = 0;
let currentScale = [];
let globalReverb, globalDelay;
let voicesWithEffects = 0;
const MAX_VOICES_WITH_EFFECTS = 2;
const TEMPO = 120; // BPM
const BEAT_DURATION = 60 / TEMPO;

// Extended scale frequencies (3 octaves)
const baseFrequencies = [
    220.00, 233.08, 246.94, 261.63, 277.18, 293.66, 311.13, 329.63, 349.23, 369.99, 392.00, 415.30,
    440.00, 466.16, 493.88, 523.25, 554.37, 587.33, 622.25, 659.25, 698.46, 739.99, 783.99, 830.61,
    880.00, 932.33, 987.77, 1046.50, 1108.73, 1174.66, 1244.51, 1318.51, 1396.91, 1479.98, 1567.98, 1661.22
];

// More complex chord progressions with diminished and augmented chords
const chordProgressions = [
    [0, 3, 5, 4, 1, 6, 2, 5], // i - iv - v - iv - ii - vii - iii - v
    [0, 5, 1, 4, 6, 2, 3, 5], // i - v - ii - iv - vii - iii - iv - v
    [0, 3, 6, 2, 5, 1, 4, 0], // i - iv - vii - iii - v - ii - iv - i
    [0, 5, 3, 6, 1, 4, 2, 5], // i - v - iv - vii - ii - iv - iii - v
    [0, 4, 5, 3, 6, 1, 2, 5], // i - iv - v - iv - vii - ii - iii - v
    [0, 2, 5, 1, 6, 4, 2, 5], // i - iii - v - ii - vii - iv - iii - v
    [0, 5, 1, 6, 3, 4, 2, 5], // i - v - ii - vii - iv - iv - iii - v
    [0, 3, 4, 1, 5, 6, 2, 5], // i - iv - iv - ii - v - vii - iii - v
];

// Rhythm patterns (adjusted for better coordination)
const rhythmPatterns = [
    [1, 1, 1, 1],
    [1, 0.5, 0.5, 1, 1],
    [0.75, 0.75, 0.5, 1, 1],
    [0.5, 0.5, 1, 1, 1],
    [1, 1, 0.5, 0.5, 1]
];

// Percussion patterns (simplified for better coordination)
const percussionPatterns = [
    [1, 0, 0, 1],
    [1, 0, 1, 0],
    [1, 1, 0, 1],
    [1, 0, 0.5, 0.5]
];

function seededRandom() {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

function choose(arr) {
    return arr[Math.floor(seededRandom() * arr.length)];
}

function createOscillator(frequency, type = 'sine') {
    const osc = audioContext.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, audioContext.currentTime);
    return osc;
}

function createEnvelope(attackTime = 0.1, decayTime = 0.2, sustainLevel = 0.3, releaseTime = 1.5) {
    const envelope = audioContext.createGain();
    const now = audioContext.currentTime;
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(1, now + attackTime);
    envelope.gain.linearRampToValueAtTime(sustainLevel, now + attackTime + decayTime);
    envelope.gain.linearRampToValueAtTime(0, now + attackTime + decayTime + releaseTime);
    return envelope;
}

function createFilter(frequency, type = 'lowpass', q = 1) {
    const filter = audioContext.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    return filter;
}

function createReverb(duration = 1, decay = 0.3) {
    const convolver = audioContext.createConvolver();
    const rate = audioContext.sampleRate;
    const length = rate * duration;
    const impulse = audioContext.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
        const n = i / length;
        left[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, decay);
        right[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, decay);
    }

    convolver.buffer = impulse;
    
    const dryWet = audioContext.createGain();
    dryWet.gain.value = 0.3; // 30% wet signal
    
    convolver.connect(dryWet);
    
    return dryWet;
}

function createDelay(time = BEAT_DURATION, feedbackAmount = 0.2) {
    const delay = audioContext.createDelay();
    const feedback = audioContext.createGain();
    const dryWet = audioContext.createGain();
    
    delay.delayTime.value = time;
    feedback.gain.value = feedbackAmount;
    dryWet.gain.value = 0.5; // 50% wet signal
    
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(dryWet);
    
    return dryWet;
}

function createScale(key) {
    const minorScale = [0, 2, 3, 5, 7, 8, 10];
    return minorScale.map(interval => baseFrequencies[key + interval]);
}

function initializeEffects() {
    globalReverb = createReverb(1, 0.3);
    globalDelay = createDelay(BEAT_DURATION, 0.2);
    
    globalDelay.connect(mainGainNode);
    globalReverb.connect(mainGainNode);
}

function chooseEffects() {
    if (voicesWithEffects >= MAX_VOICES_WITH_EFFECTS) return null;
    
    const effectChoice = Math.random();
    if (effectChoice < 0.2) {
        voicesWithEffects++;
        return globalDelay;
    } else if (effectChoice < 0.4) {
        voicesWithEffects++;
        return globalReverb;
    }
    return null;
}

function playNote(frequency, duration, type = 'sine', volume = 0.5) {
    const osc = createOscillator(frequency, type);
    const envelope = createEnvelope(0.01, 0.1, 0.3, duration);
    const noteGain = audioContext.createGain();
    noteGain.gain.value = volume * 0.5; // Reduced overall volume

    osc.connect(envelope);
    envelope.connect(noteGain);
    
    const effect = chooseEffects();
    if (effect) {
        const dryGain = audioContext.createGain();
        const wetGain = audioContext.createGain();
        dryGain.gain.value = 0.7;
        wetGain.gain.value = 0.3;
        
        noteGain.connect(dryGain);
        dryGain.connect(mainGainNode);
        
        noteGain.connect(effect);
        effect.connect(wetGain);
        wetGain.connect(mainGainNode);
        
        setTimeout(() => {
            voicesWithEffects--;
        }, duration * 1000);
    } else {
        noteGain.connect(mainGainNode);
    }

    osc.start();
    osc.stop(audioContext.currentTime + duration);
}

function playChord(chord, duration, volume = 0.2) {
    let chordNotes;
    if (typeof chord === 'string') {
        switch(chord) {
            case 'dim':
                chordNotes = [0, 3, 6];
                break;
            case 'aug':
                chordNotes = [0, 4, 8];
                break;
            default:
                chordNotes = [0, 3, 7]; // Default to minor
        }
    } else {
        chordNotes = [chord, (chord + 2) % 7, (chord + 4) % 7];
    }
    
    chordNotes.forEach((note, index) => {
        const noteVolume = index === 0 ? volume : volume * 0.7;
        playNote(currentScale[note], duration, choose(['sine', 'triangle', 'sawtooth']), noteVolume);
    });
}

function playArpeggio(chord, duration, pattern) {
    let chordNotes;
    if (typeof chord === 'string') {
        switch(chord) {
            case 'dim':
                chordNotes = [0, 3, 6];
                break;
            case 'aug':
                chordNotes = [0, 4, 8];
                break;
            default:
                chordNotes = [0, 3, 7];
        }
    } else {
        chordNotes = [chord, (chord + 2) % 7, (chord + 4) % 7];
    }
    
    let totalPatternDuration = pattern.reduce((a, b) => a + b, 0);
    let elapsedTime = 0;
    pattern.forEach((step, i) => {
        if (step > 0) {
            setTimeout(() => {
                playNote(currentScale[chordNotes[i % chordNotes.length]], step * duration / totalPatternDuration, 'triangle', 0.3);
            }, elapsedTime * duration * 1000 / totalPatternDuration);
        }
        elapsedTime += step;
    });
}

function playBass(chord, duration, volume = 0.7) {
    let bassNote;
    if (typeof chord === 'string') {
        bassNote = 0; // Root note for special chords
    } else {
        bassNote = chord;
    }
    playNote(currentScale[bassNote] / 2, duration, 'sine', volume);
}

function playPercussion(pattern, duration) {
    pattern.forEach((hit, i) => {
        if (hit) {
            setTimeout(() => {
                const noise = audioContext.createBufferSource();
                const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.1, audioContext.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < buffer.length; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                noise.buffer = buffer;

                const envelope = createEnvelope(0.001, 0.05, 0.1, 0.1);
                const filter = createFilter(1000 + seededRandom() * 2000, 'bandpass', 5);

                noise.connect(envelope);
                envelope.connect(filter);
                filter.connect(mainGainNode);

                noise.start();
                noise.stop(audioContext.currentTime + 0.1);
            }, i * duration * 1000 / pattern.length);
        }
    });
}

function generateMelody(chord, duration, complexity = 0.5) {
    let chordNotes;
    if (typeof chord === 'string') {
        switch(chord) {
            case 'dim':
                chordNotes = [0, 3, 6];
                break;
            case 'aug':
                chordNotes = [0, 4, 8];
                break;
            default:
                chordNotes = [0, 3, 7];
        }
    } else {
        chordNotes = [chord, (chord + 2) % 7, (chord + 4) % 7];
    }
    
    const melodyNotes = [...chordNotes, ...currentScale.filter(note => !chordNotes.includes(note))];
    const rhythm = choose(rhythmPatterns);
    let totalRhythmDuration = rhythm.reduce((a, b) => a + b, 0);
    let elapsedTime = 0;
    let lastNote = choose(chordNotes);

    rhythm.forEach(noteDuration => {
        if (seededRandom() < 0.9) { // 10% chance of rest
            const noteOptions = melodyNotes.filter(note => Math.abs(note - lastNote) <= 2);
            const note = choose(noteOptions);
            setTimeout(() => {
                playNote(currentScale[note], noteDuration * duration / totalRhythmDuration, choose(['sine', 'triangle']), 0.4);
            }, elapsedTime * duration * 1000 / totalRhythmDuration);
            lastNote = note;
        }
        elapsedTime += noteDuration;
    });
}

function generateMusic() {
    if (!isPlaying) return;

    const progression = choose(chordProgressions);
    const totalDuration = progression.length * 4; // 4 seconds per chord

    if (seededRandom() > 0.8) {
        currentKey = (currentKey + choose([-5, -4, -3, 3, 4, 5]) + 12) % 12;
        currentScale = createScale(currentKey);
    }

    const complexity = seededRandom() * 0.5 + 0.5;
    const bassPattern = choose(rhythmPatterns);
    const percussionPattern = choose(percussionPatterns);

    progression.forEach((chord, index) => {
        setTimeout(() => {
            playChord(chord, 4, 0.4 + complexity * 0.2);
            playArpeggio(chord, 4, choose(rhythmPatterns));
            playBass(chord, 4, 0.6 + complexity * 0.2);
            playPercussion(percussionPattern, 4);
            generateMelody(chord, 4, complexity);
        }, index * 4000);
    });

    setTimeout(generateMusic, totalDuration * 1000);
}

export function initializeMusic() {
    seed = Math.random();
    currentKey = 0;
    currentScale = createScale(currentKey);
    mainGainNode = audioContext.createGain();
    mainGainNode.gain.setValueAtTime(0.15, audioContext.currentTime); // Reduced overall volume
    mainGainNode.connect(audioContext.destination);
    
    initializeEffects();
    generateMusic();
}

export function setIsPlaying(value) {
    isPlaying = value;
}