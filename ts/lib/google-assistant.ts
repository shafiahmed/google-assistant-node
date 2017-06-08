import * as events from "events";
import * as stream from "stream";
import { State, Event, API } from "./constants";
import { AudioInOptions , AudioOutOptions }  from "./options";
import  AudioConverter from "./audio-converter";
import { 
  ConverseConfig, AudioInConfig, AudioOutConfig, AssistantConfig 
} from "./config";

let grpc = require('grpc');
let through2 = require('through2');
let messages = require('./googleapis/google/assistant/embedded/v1alpha1/embedded_assistant_pb');
let services = require('./googleapis/google/assistant/embedded/v1alpha1/embedded_assistant_grpc_pb');

class GoogleAssistant extends events.EventEmitter {
  private state: State
  private service: any   // gRPC Service
  private channel: any   // gRPC Duplex Channel
  private converter: AudioConverter;
  private converseConfig: ConverseConfig
  private conversationState: Array<number> | null

  private audioInConfig: AudioInConfig;
  private audioOutConfig: AudioOutConfig;

  constructor(config: AssistantConfig) {
    super();
    this.converter = new AudioConverter();
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
      API.ENDPOINT, 
      combined_creds
    ); 
  } 

  public converse() { 
    if(this.conversationState != null) {
      this.converseConfig.setConverseState(this.conversationState);
      this.conversationState = null; 
    } 

    let request = new messages.ConverseRequest(); 
    request.setConfig(this.converseConfig); 
    this.channel = this.service.converse(
      new grpc.Metadata(), request
    );

    // Setup event listeners
    this.channel.on('data', this._handleResponse);
    this.channel.on('data', this._handleConversationState);
    this.channel.on('end', this._handleConversationEnd);

    // Write first ConverseRequest
    this.channel.write(request)
    this.state = State.IN_PROGRESS;

    // Setup conversion stream
    this.converter.pipe(this.channel);

    // Signal that assistant is ready
    this.emit('ready');
  }

  public write(data: Buffer | Array<number>) {
    this.converter.write(data);
  }

  private _handleResponse(response: any) {
    if(response.hasEventType() && 
      response.getEventType() == Event.END_OF_UTTERANCE) {
      this.emit('end-of-utterance');
    }

    else if(response.hasAudioOut()) {
      this.emit('audio-data', response.getAudioData());
    }

    else if(response.hasResult()) {
      this._handleResult(response.getResult());
    }

    else if(response.hasError()) { 
      this.emit('error', response.getError());
    }
  }

  private _handleResult(result: any) {
    if(result.getMicrophoneMode()) {
      this.emit('mic-mode', result.getMicrophoneMode());
    }

    else if(result.getConversationState()) {
      this.emit('state', result.getConversationState());
    }

    else if(result.getSpokenResponseText()) {
      this.emit('response-text', result.getSpokenResponseText());
    }

    else if(result.getSpokenRequestText()) {
      this.emit('request-text', result.getSpokenRequestText());
    }
  }

  private _handleConversationState(response: any) {
    // Handle end of user input
    if(response.getEventType() == Event.END_OF_UTTERANCE) {
      this.state = State.FINISHED;
    }

    // Handle continous conversations
    if(response.hasResult() && response.getResult().getConversationState()) {
      let convState = new messages.ConverseState();
      convState.setConversationState(response.getResult().getConversationState());
      this.conversationState = convState;
    }
  }

  public _handleConversationEnd(error?: Error) {
    this.emit('end', error);
  }
}

export default GoogleAssistant;
