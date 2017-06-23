import * as chai from "chai";
import * as stream from "stream";
chai.use(require("chai-events"));

let should = chai.should();
let GoogleAssistant = require('../lib/google-assistant');
let constants = GoogleAssistant.Constants; let encoding = constants.Encoding;
let helpers = require('./helpers');
let clone = require('lodash.clone');

const inputConfig = {
  encoding: encoding.LINEAR16,
  sampleRateHertz: 16000
}

const outputConfig = {
  encoding: encoding.LINEAR16,
  sampleRateHertz: 16000,
  volumePercentage: 100
}

let buildAssistant = (): any => {
  return new GoogleAssistant({
    input: inputConfig,
    output: outputConfig
  })
}

let buildAuthClient = (): any => {
  return helpers.authClient;
}

describe('GoogleAssistant', function() {
  describe('constructor' , function() {
    it('should error on null config', function() {
      (() => { new GoogleAssistant() }).should.throw(TypeError);
    })

    it('should error on blank config', function() {
      (() => { new GoogleAssistant({}) }).should.throw(TypeError);
    })

    it('should error on missing input config', function() {
      (() => { 
        new GoogleAssistant({
          output: outputConfig
        }) 
      }).should.throw(TypeError);
    })

    it('should error on missing output config', function() {
      (() => { 
        new GoogleAssistant({
          input: inputConfig
        }) 
      }).should.throw(TypeError);
    })
  })

  describe('authenticate()', function() {
    let assistant: any = null;
    let authClient: any = null;

    beforeEach(function() {
      assistant = buildAssistant();
      authClient = buildAuthClient();
    })
  
    it('should error if authClient is missing', function() {
      assistant.authenticate();
    })

    it('should error if authClient is null', function() {
      authClient = null;
      assistant.authenticate(authClient);
    })
  })

  describe('converse()', function() {
    let assistant: any = null;
    let authClient: any = null;

    beforeEach(function() {
      assistant = buildAssistant();
      authClient = buildAuthClient();
    })

    it('should error if not authenticated', function() {
      assistant.converse.should.throw(Error);
    })

  })

  describe('events', function() {
    let assistant: any = null;
    let authClient: any = null;

    beforeEach(function() {
      assistant = buildAssistant();
      authClient = buildAuthClient();
    })

    describe('unauthenticated', function() {
      it('should emit `unauthorized` if not authenticated', function() {
        let p = assistant.should.emit("unauthorized");
        assistant.converse();
        return p;
      })

      it('should not emit `ready` if not authenticated', function() {
        let e = assistant.should.not.emit('ready');
        assistant.converse();
        return e;
      })

      it('should not emit `end` if not authenticated', function() {
        let e = assistant.should.not.emit('end');
        assistant.converse();
        return e;
      })

      it('should emit `unauthorized` if using incorrect credentials', function () {
        let e = assistant.should.emit('unauthorized');
        let invalidAuthClient = clone(authClient);
        invalidAuthClient.setCredentials({
          access_token: 'THIS IS WRONG'
        })
        assistant.authenticate(invalidAuthClient);
        assistant.converse();
        return e;
      })
    })

    describe('authenticated', function() {
      beforeEach(function() {
        assistant.authenticate(authClient);
      })

      let initConversation = function() {
        assistant.authenticate(authClient);
        assistant.on('ready', function(wstream: any) {
          let stream = helpers.audioStreams.createSimple();
          stream.pipe(wstream);
        })
        assistant.converse();
      }

      describe('`ready`', function() {
        it('should emit `ready` if authenticated correctly', function() {
          let e = assistant.should.emit('ready');
          assistant.converse();
          return e;
        })

        it('should create a write stream when `ready`', function(done) {
          assistant.on('ready', function(wstream: any) {
            wstream.should.be.an.instanceof(stream.Writable);
            done();
          })
          assistant.converse();
        })
      })

      describe('`request-text`', function() {
        it('should emit `request-text` after writing valid audio data', function(done) {
          assistant.on('request-text', function() {
            done();
          })
          initConversation();
        }).timeout(3000);

        it('should return a string on `request-text`', function(done) {
          assistant.on('request-text', function(requestText: any) {
            requestText.should.be.a('string');
            done();
          });
          initConversation();
        }).timeout(3000);
      })

      describe('`audio-data`', function() {
        it('should emit `audio-data` after writing valid audio data', function(done) {
          assistant.once('audio-data', function() {
            done();
          })
          initConversation();
        }).timeout(3000);

        it('should return a buffer on `audio-data`', function(done) {
          assistant.once('audio-data', function(data: any) {
            data.should.be.an.instanceof(Buffer);
            done();
          })
          initConversation();
        }).timeout(3000);
      })
    })
  })
})
