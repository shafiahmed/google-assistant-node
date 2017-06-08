import * as stream from "stream";
import { State, Event } from "./constants";
import { AudioInOptions , AudioOutOptions }  from "./options";
import { 
  ConverseConfig, AudioInConfig, 
  AudioOutConfig, AssistantConfig } from "./config";

let grpc = require('grpc');
let through2 = require('through2');
let messages = require('./googleapis/google/assistant/embedded/v1alpha1/embedded_assistant_pb');
let services = require('./googleapis/google/assistant/embedded/v1alpha1/embedded_assistant_grpc_pb');

// Impl
class GoogleAssistantLogger {
  parseResponse(response: any) {
    if(response.hasResult()) {
      var result = response.getResult();
      console.log('Response: ');

      if(result.getMicrophoneMode()) {
        console.log("\tMicrophone Mode: ", result.getMicrophoneMode());
      }

      if(result.getConversationState()) {
        console.log("\tState: ");
      }

      if(result.getSpokenResponseText()) {
        console.log("\tResponse Text: ", response.getSpokenResponseText());
      }

      if(result.getSpokenRequestText()) {
        console.log("\tRequest Text: ", result.getSpokenRequestText());
      }
    }
  }
}

class GoogleAssistant {
  static ENDPOINT = 'embeddedassistant.googleapis.com'

  private state: State
  private service: any   // gRPC Service
  private converseConfig: ConverseConfig
  private conversationState: Array<number> | null

  private audioInConfig: AudioInConfig;
  private audioOutConfig: AudioOutConfig;

  constructor(config: AssistantConfig) {
    this.converseConfig = new messages.ConverseConfig();
    this.audioInConfig = new messages.AudioInConfig();
    this.audioOutConfig = new messages.AudioOutConfig();
    this.setInputConfig(config.input);
    this.setOutputConfig(config.output);
  }

  public setInputConfig(config: AudioInOptions) {
    this.audioInConfig.setEncoding(config.encoding);
    this.audioInConfig.setSampleRateHertz(config.sampleRateHertz);
    this._updateConverseConfig();
  }

  public setOutputConfig(config: AudioOutOptions) {
    this.audioOutConfig.setEncoding(config.encoding);
    this.audioOutConfig.setSampleRateHertz(config.sampleRateHertz);
    this.audioOutConfig.setVolumePercentage(config.volumePercentage);
    this._updateConverseConfig();
  }

  private _updateConverseConfig() {
    this.converseConfig.setAudioInConfig(this.audioInConfig);
    this.converseConfig.setAudioOutConfig(this.audioOutConfig);
  }
  
  public authenticate(authClient: any) {
    let ssl_creds = grpc.credentials.createSsl();
    let call_creds = grpc.credentials.createFromGoogleCredential(authClient);
    let combined_creds = grpc.credentials.combineChannelCredentials(
      ssl_creds, 
      call_creds
    );
    this.service = new services.EmbeddedAssistantClient(
      GoogleAssistant.ENDPOINT, 
      combined_creds
    ); 
  } 

  public converse() {
    if(this.conversationState != null) {
      this.converseConfig.setConverseState(this.conversationState);
      this.conversationState = null; 
    } 

    var request = new messages.ConverseRequest(); 
    request.setConfig(this.converseConfig); 
    var meta = new grpc.Metadata();

    var call = this.service.converse(meta, request);
    call.on('data', this._handleConversationState)

    call.write(request)
    this.state = State.IN_PROGRESS;
    return call;
  }

  private _handleConversationState(res: any) {
    let response = res.toObject();

    // Handle end of user input
    if(response.eventType == Event.END_OF_UTTERANCE) {
      this.state = State.FINISHED;
    }

    // Handle continous conversations
    if(response.result && response.result.conversationState) {
      let convState = new messages.ConverseState();
      convState.setConversationState(response.result.conversationState);
      this.conversationState = convState;
    }
  }

  // Convert audio chunks to 16KB ConverseRequests
  public createAudioConverter() {
    return through2({ objectMode: true },
      function(chunk: any, enc: string, cb: Function) {
        var buff = Buffer.from(chunk)
        var offset = 0;
        var size = 1024 * 16;
        for(var i = 0; i < chunk.length / size; i++) {
          var nibble = buff.slice(offset, (offset + size));
          offset += size;
          var request = new messages.ConverseRequest(); 
          request.setAudioIn(nibble);
          this.push(request);
        }

        return cb(null);
      }
    )
  }

  public createLogger() {
    return new GoogleAssistantLogger();
  }
}

export default GoogleAssistant;
