export enum State {
  IN_PROGRESS = 0,
  FINISHED    = 1
}

export enum Event {
  END_OF_UTTERANCE = 1
}

export enum Encoding {
  LINEAR16      = 1,
  FLAC          = 2, // Input
  MP3           = 2, // Output
  OPUS_IN_OGG   = 3  // Output
}

export module API {
  export const ENDPOINT = 'embeddedassistant.googleapis.com'
}
