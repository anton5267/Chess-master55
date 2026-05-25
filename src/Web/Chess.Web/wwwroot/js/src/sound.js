let audioContext = null;

const soundProfiles = {
    move: [{ frequency: 520, duration: 0.075, gain: 0.045 }],
    capture: [
        { frequency: 360, duration: 0.055, gain: 0.05 },
        { frequency: 230, duration: 0.085, gain: 0.04, delay: 0.045 },
    ],
    check: [
        { frequency: 660, duration: 0.075, gain: 0.045 },
        { frequency: 880, duration: 0.09, gain: 0.04, delay: 0.06 },
    ],
    gameOver: [
        { frequency: 392, duration: 0.11, gain: 0.045 },
        { frequency: 330, duration: 0.14, gain: 0.038, delay: 0.1 },
    ],
    mate: [
        { frequency: 587, duration: 0.1, gain: 0.05 },
        { frequency: 784, duration: 0.13, gain: 0.045, delay: 0.095 },
        { frequency: 988, duration: 0.16, gain: 0.035, delay: 0.21 },
    ],
};

function getAudioContext() {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
        return null;
    }

    if (!audioContext) {
        audioContext = new AudioContextCtor();
    }

    return audioContext;
}

function playTone(context, profile) {
    const startAt = context.currentTime + (profile.delay || 0);
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(profile.frequency, startAt);

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(profile.gain, startAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + profile.duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + profile.duration + 0.02);
}

export function primeGameAudio() {
    const context = getAudioContext();
    if (context && context.state === 'suspended') {
        context.resume().catch(() => {});
    }
}

export function playGameSound(state, type) {
    if (!state.soundEnabled) {
        return;
    }

    const profile = soundProfiles[type] || soundProfiles.move;
    const context = getAudioContext();
    if (!context) {
        return;
    }

    const play = () => profile.forEach((tone) => playTone(context, tone));
    if (context.state === 'suspended') {
        context.resume().then(play).catch(() => {});
        return;
    }

    play();
}

export function resolveMoveSoundType(moveNotation) {
    const notation = moveNotation || '';
    if (notation.includes('#')) {
        return 'mate';
    }

    if (notation.includes('+')) {
        return 'check';
    }

    if (notation.includes('x')) {
        return 'capture';
    }

    return 'move';
}
