import { AudioInOptions, AudioOutOptions } from "./options";

export interface AudioInConfig extends AudioInOptions {
  setEncoding(encoding: number): void
  setSampleRateHertz(encoding: number): void
}

export interface AudioOutConfig extends AudioOutOptions, AudioInConfig {
  setVolumePercentage(percentage: number): void
}

export interface AssistantConfig {
  input: AudioInOptions
  output: AudioOutOptions
}

export interface ConverseConfig {
  setConverseState(state: Array<number>): void
  setAudioInConfig(config: AudioInConfig): void
  setAudioOutConfig(config: AudioOutConfig): void
}
