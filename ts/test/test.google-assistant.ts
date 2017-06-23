import { assert } from "chai";
import * as chai from "chai";
chai.use(require("chai-events"));

let should = chai.should();
let GoogleAssistant = require('../lib/google-assistant');
let constants = GoogleAssistant.Constants;
let encoding = constants.Encoding;

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
  return {};
}

describe('GoogleAssistant', function() {
  describe('constructor' , function() {
    it('should error on null config', function() {
      assert.throws(() => { new GoogleAssistant() }, TypeError);
    })

    it('should error on blank config', function() {
      assert.throws(() => { new GoogleAssistant({}) }, TypeError);
    })

    it('should error on missing input config', function() {
      assert.throws(() => { 
        new GoogleAssistant({
          output: outputConfig
        }) 
      }, TypeError);
    })

    it('should error on missing output config', function() {
      assert.throws(() => { 
        new GoogleAssistant({
          input: inputConfig
        }) 
      }, TypeError);
    })
  })

  describe('.authenticate', function() {
    let assistant: any = null;
    beforeEach(function() {
      assistant = buildAssistant();
    })

    it('should error on null authClient', function() {
      let p = assistant.should.emit("unauthorized");
      assistant.converse();
      return p;
    })
  })

  describe('.converse', function() {
    let assistant = buildAssistant();
    let authClient = buildAuthClient();

    it('should error if not authenticated', function() {
      assert.throw(assistant.converse, Error);
    })

    it('should succeed if authenticated', function() {
      assistant.authenticate(authClient);
      assistant.converse();
    })
  })

  describe('events', function() {
  })
})
