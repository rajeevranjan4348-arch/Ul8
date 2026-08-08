/**
 * Web Audio API based procedural Sound Synthesizer for Weather Effects
 * Generates realistic soft rain noise, low-frequency thunder rumbles, howling wind,
 * soothing ocean wave washes, organic morning bird chirps, and night crickets.
 * Completely self-contained, lightweight, and requires no audio assets.
 */

export class WeatherSoundSynth {
  private ctx: AudioContext | null = null;
  private isPlaying: boolean = false;
  private timerIds: any[] = [];
  private masterGain: GainNode | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private lfoNodes: OscillatorNode[] = [];

  constructor() {}

  /**
   * Starts playing procedural weather sounds based on the current weather type.
   * Supports 'sunny', 'cloudy', 'foggy', 'snowy', 'rainy', 'thunderstorm', 'drizzle'
   */
  public start(type: string, options: { windSpeed?: number; isNight?: boolean; isMorning?: boolean } = {}) {
    if (this.isPlaying) {
      this.stop();
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      
      // Base master volume
      const baseVolume = type === 'thunderstorm' ? 0.18 : type === 'rainy' ? 0.12 : 0.08;
      this.masterGain.gain.setValueAtTime(baseVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      const sampleRate = this.ctx.sampleRate;
      const bufferSize = 2 * sampleRate;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
      const output = noiseBuffer.getChannelData(0);

      // Pink Noise generator (approximate -3dB/octave)
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        output[i] *= 0.11;
        b6 = white * 0.115926;
      }

      this.noiseSource = this.ctx.createBufferSource();
      this.noiseSource.buffer = noiseBuffer;
      this.noiseSource.loop = true;

      const now = this.ctx.currentTime;

      // 1. RAIN & DRIZZLE CHANNEL
      if (type === 'rainy' || type === 'drizzle' || type === 'thunderstorm') {
        const rainFilter = this.ctx.createBiquadFilter();
        rainFilter.type = 'bandpass';
        
        if (type === 'drizzle') {
          rainFilter.frequency.setValueAtTime(1800, now);
          rainFilter.Q.setValueAtTime(0.5, now);
        } else if (type === 'rainy') {
          rainFilter.frequency.setValueAtTime(1200, now);
          rainFilter.Q.setValueAtTime(0.8, now);
        } else {
          rainFilter.frequency.setValueAtTime(900, now);
          rainFilter.Q.setValueAtTime(1.0, now);
        }

        const rainGain = this.ctx.createGain();
        rainGain.gain.setValueAtTime(type === 'drizzle' ? 0.3 : 0.7, now);

        this.noiseSource.connect(rainFilter);
        rainFilter.connect(rainGain);
        rainGain.connect(this.masterGain);
      }

      // 2. WIND HOWL CHANNEL (Modulated if high windSpeed, or soft on cloudy/rainy days)
      const windSpeed = options.windSpeed !== undefined ? options.windSpeed : (type === 'thunderstorm' ? 35 : 12);
      if (windSpeed > 8 || type === 'thunderstorm' || type === 'cloudy') {
        const windFilter = this.ctx.createBiquadFilter();
        windFilter.type = 'bandpass';
        windFilter.frequency.setValueAtTime(350, now);
        windFilter.Q.setValueAtTime(2.5, now);

        // Slow LFO to sweep wind frequency to simulate howling gusts
        const windLfo = this.ctx.createOscillator();
        windLfo.type = 'sine';
        windLfo.frequency.setValueAtTime(0.08, now); // slow sweep

        const windLfoGain = this.ctx.createGain();
        const sweepRange = windSpeed > 25 ? 280 : 120;
        windLfoGain.gain.setValueAtTime(sweepRange, now);

        const windGain = this.ctx.createGain();
        const windVol = Math.min(0.6, (windSpeed / 50) * 0.4);
        windGain.gain.setValueAtTime(windVol, now);

        windLfo.connect(windLfoGain);
        windLfoGain.connect(windFilter.frequency);
        this.noiseSource.connect(windFilter);
        windFilter.connect(windGain);
        windGain.connect(this.masterGain);

        windLfo.start(now);
        this.lfoNodes.push(windLfo);
      }

      // 3. OCEAN REFRESHING WAVES (Relaxing ambient layer for Clear/Sunny days)
      if (type === 'sunny' || type === 'clear' || type === 'cloudy') {
        const waveFilter = this.ctx.createBiquadFilter();
        waveFilter.type = 'lowpass';
        waveFilter.frequency.setValueAtTime(250, now);

        const waveLfo = this.ctx.createOscillator();
        waveLfo.type = 'sine';
        waveLfo.frequency.setValueAtTime(0.12, now); // slow wave period ~8 seconds

        const waveLfoGain = this.ctx.createGain();
        waveLfoGain.gain.setValueAtTime(0.35, now);

        const waveGain = this.ctx.createGain();
        waveGain.gain.setValueAtTime(0.15, now); // base level

        waveLfo.connect(waveLfoGain);
        waveLfoGain.connect(waveGain.gain);
        this.noiseSource.connect(waveFilter);
        waveFilter.connect(waveGain);
        waveGain.connect(this.masterGain);

        waveLfo.start(now);
        this.lfoNodes.push(waveLfo);
      }

      this.noiseSource.start(now);
      this.isPlaying = true;

      // 4. PERIODIC THUNDER RUMBLES (Only thunderstorm)
      if (type === 'thunderstorm') {
        const triggerThunder = () => {
          if (!this.ctx || !this.masterGain || !this.isPlaying) return;
          const current = this.ctx.currentTime;

          const thunderOsc = this.ctx.createOscillator();
          const thunderFilter = this.ctx.createBiquadFilter();
          const thunderGain = this.ctx.createGain();

          thunderOsc.type = 'sawtooth';
          thunderOsc.frequency.setValueAtTime(45 + Math.random() * 15, current);
          thunderOsc.frequency.linearRampToValueAtTime(10, current + 4.0);

          thunderFilter.type = 'lowpass';
          thunderFilter.frequency.setValueAtTime(80, current);
          thunderFilter.Q.setValueAtTime(3.0, current);

          thunderGain.gain.setValueAtTime(0.0, current);
          thunderGain.gain.linearRampToValueAtTime(0.25, current + 0.15);
          thunderGain.gain.linearRampToValueAtTime(0.12, current + 0.6);
          thunderGain.gain.exponentialRampToValueAtTime(0.002, current + 4.5);

          thunderOsc.connect(thunderFilter);
          thunderFilter.connect(thunderGain);
          thunderGain.connect(this.masterGain);

          thunderOsc.start(current);
          thunderOsc.stop(current + 4.6);
        };

        const scheduleNextThunder = () => {
          if (!this.isPlaying) return;
          const timer = setTimeout(() => {
            triggerThunder();
            scheduleNextThunder();
          }, 12000 + Math.random() * 10000);
          this.timerIds.push(timer);
        };

        // Delay first thunder rumble
        const firstThunder = setTimeout(() => {
          triggerThunder();
          scheduleNextThunder();
        }, 3000);
        this.timerIds.push(firstThunder);
      }

      // 5. MORNING BIRD CHIRPING (Clear/Sunny/Cloudy in the morning)
      const isMorning = options.isMorning || (new Date().getHours() >= 5 && new Date().getHours() < 11);
      if (isMorning && (type === 'sunny' || type === 'clear' || type === 'cloudy')) {
        const triggerBirdChirp = () => {
          if (!this.ctx || !this.isPlaying || !this.masterGain) return;
          const current = this.ctx.currentTime;
          const chirps = 2 + Math.floor(Math.random() * 3);
          let offset = 0;

          for (let i = 0; i < chirps; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            
            const startFreq = 1600 + Math.random() * 400;
            const endFreq = startFreq + 1200 + Math.random() * 500;
            osc.frequency.setValueAtTime(startFreq, current + offset);
            osc.frequency.exponentialRampToValueAtTime(endFreq, current + offset + 0.08);

            gain.gain.setValueAtTime(0, current + offset);
            gain.gain.linearRampToValueAtTime(0.03, current + offset + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.001, current + offset + 0.08);

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(current + offset);
            osc.stop(current + offset + 0.09);

            offset += 0.12 + Math.random() * 0.12;
          }
        };

        const scheduleBirds = () => {
          if (!this.isPlaying) return;
          const timer = setTimeout(() => {
            triggerBirdChirp();
            scheduleBirds();
          }, 5000 + Math.random() * 7000);
          this.timerIds.push(timer);
        };

        // Play chirp soon after starting
        const initialBirds = setTimeout(() => {
          triggerBirdChirp();
          scheduleBirds();
        }, 1500);
        this.timerIds.push(initialBirds);
      }

      // 6. NIGHT CRICKET SYNC (Clear/Sunny/Cloudy at night)
      const isNight = options.isNight || (new Date().getHours() >= 18 || new Date().getHours() < 5);
      if (isNight && (type === 'sunny' || type === 'clear' || type === 'cloudy')) {
        const triggerCrickets = () => {
          if (!this.ctx || !this.isPlaying || !this.masterGain) return;
          const current = this.ctx.currentTime;
          const duration = 3 + Math.random() * 3;

          const osc = this.ctx.createOscillator();
          const modOsc = this.ctx.createOscillator();
          const modGain = this.ctx.createGain();
          const gain = this.ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(3900 + Math.random() * 300, current);

          modOsc.type = 'sawtooth';
          modOsc.frequency.setValueAtTime(22, current); // high frequency pulsing chirps
          modGain.gain.setValueAtTime(1500, current);

          gain.gain.setValueAtTime(0, current);
          gain.gain.linearRampToValueAtTime(0.015, current + 0.25);
          gain.gain.setValueAtTime(0.015, current + duration - 0.25);
          gain.gain.exponentialRampToValueAtTime(0.001, current + duration);

          modOsc.connect(modGain);
          modGain.connect(osc.frequency);
          osc.connect(gain);
          gain.connect(this.masterGain);

          modOsc.start(current);
          osc.start(current);

          modOsc.stop(current + duration);
          osc.stop(current + duration);
        };

        const scheduleCrickets = () => {
          if (!this.isPlaying) return;
          const timer = setTimeout(() => {
            triggerCrickets();
            scheduleCrickets();
          }, 2000 + Math.random() * 4000);
          this.timerIds.push(timer);
        };

        const initialCrickets = setTimeout(() => {
          triggerCrickets();
          scheduleCrickets();
        }, 1000);
        this.timerIds.push(initialCrickets);
      }

    } catch (e) {
      console.warn('Audio synthesis failed to initialize:', e);
    }
  }

  /**
   * Stops the synthesis and frees Web Audio contexts cleanly.
   */
  public stop() {
    this.isPlaying = false;
    this.timerIds.forEach(id => clearTimeout(id));
    this.timerIds = [];

    this.lfoNodes.forEach(node => {
      try {
        node.stop();
      } catch (e) {}
    });
    this.lfoNodes = [];

    if (this.noiseSource) {
      try {
        this.noiseSource.stop();
      } catch (e) {}
      this.noiseSource = null;
    }
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch (e) {}
      this.ctx = null;
    }
  }

  /**
   * Sets the volume dynamically (value between 0.0 and 1.0)
   */
  public setVolume(vol: number) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, vol)), this.ctx.currentTime);
    }
  }

  public getActive(): boolean {
    return this.isPlaying;
  }
}
