# Google Assistant SDK for Node

This wrapper allows you to use the Google Assistant api in any Node application.
It handles events, audio buffering, and client connection automatically.

## Installation
```sh
npm install google-assistant-node
```

## Usage
```js
let GoogleAssistant = require('google-assistant-node');
let constants = GoogleAssistant.Constants;
let encodings = constants.Encoding;

let assistant = new GoogleAssistant({
  input: {
    encoding: encodings.LINEAR16,
    sampleRateHertz: 16000
  },
  output: {
    encoding: encodings.MP3,
    sampleRateHertz: 16000,
    volumePercentage: 100
  }
});

// Audio Data (bytes)
assistant.on('audio-data', (data) => {
});

//  Reponse Text (string)
assistant.on('response-text', (text) => {
});

//  Request Text (string)
assistant.on('request-text', (text) => {
});

//  Conversation State (bytes)
assistant.on('state', (state) => {
});

//  Microphone Mode (int)
assistant.on('mic-mode', (mode) => {
});

// Authorization error (error)
// E.g. Did not authenticate with OAuth client
assistant.on('unauthorized', (error) => {
})

//  Error (error)
assistant.on('error', (error) => {
});

// Assistant is ready to accept audio data. NOTE: .once() is used.
assistant.once('ready', (wstream) => {
  audioData.pipe(wstream);
});

// Current conversation is over. 
// NOTE: 'end' will be called even if there is a 'follow-on' event.
assistant.once('end', () => {
}

// Assistant is expecting a follow-on response from user.
assistant.on('follow-on', () => {
  
  // Setup follow-on 'ready' and 'end' event handler to change audio source
  // if desired (or if you used .once()).
  assistant.once('ready', (wstream) => { 
    moreAudioData.pipe(wstream)
  }
  
  // Handle follow-on conversation end.
  assistant.once('end', () => {
    moreAudioData.end();
  }) 

  // Don't forget to call .converse() to resume conversation
  assistant.converse();
})

// Use Google OAuth Client to authenticate: 
// https://github.com/google/google-auth-library-nodejs 
// or
// https://github.com/google/google-api-nodejs-client
assistant.authenticate(authClient);

// Start conversation
assistant.converse();
```

