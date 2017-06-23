import * as events from "events";
import * as stream from "stream";
import * as constants from "./constants";
import  AudioConverter from "./audio-converter";
import { State, Event, API, MicMode } from "./constants";
import { AudioInOptions , AudioOutOptions }  from "./options";
import { 
  ConverseConfig, AudioInConfig, AudioOutConfig, AssistantConfig 
} from "./config";

let grpc = require('grpc');
let messages = require('./googleapis/google/assistant/embedded/v1alpha1/embedded_assistant_pb');
let services = require('./googleapis/google/assistant/embedded/v1alpha1/embedded_assistant_grpc_pb');

class GoogleAssistant extends events.EventEmitter {
  static Constants = constants;

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
    if(this.state == State.IN_PROGRESS && this.conversationState != null) {
      this.converseConfig.setConverseState(this.conversationState);
      this.conversationState = null; 
    } 

    let request = new messages.ConverseRequest(); 
    request.setConfig(this.converseConfig); 

    // GUARD: Make sure service is created and authenticated
    if(this.service == null) {
      this.emit('unauthorized');
      return;
    }

    this.channel = this.service.converse(
      new grpc.Metadata(), request
    );

    // Setup event listeners
    this.channel.on('data', this._handleResponse.bind(this));
    this.channel.on('data', this._handleConversationState.bind(this));
    this.channel.on('error', this._handleError.bind(this));
    this.channel.on('end', this._handleConversationEnd.bind(this));

    // Write first ConverseRequest
    this.channel.write(request)
    this.state = State.IN_PROGRESS;

    // Wait for any errors to emerge before piping
    // audio data
    setTimeout(() => {
      if(this.channel != null) {
        // Setup conversion stream
        this.converter
          .pipe(this.channel)
          .on('error', this._handleError.bind(this));

        // Signal that assistant is ready
        this.emit('ready', this.converter);
      }
    }, 100);
  }

  private _handleResult(result: any) {
    if(result.getMicrophoneMode()) {
      this.emit('mic-mode', result.getMicrophoneMode());
    } 

    if(result.getConversationState()) {
      this.emit('state', 
        new Buffer(result.getConversationState())
      );
    }

    if(result.getSpokenResponseText()) {
      this.emit('response-text', result.getSpokenResponseText());
    }

    if(result.getSpokenRequestText()) {
      this.emit('request-text', result.getSpokenRequestText());
    }
  }

  private _handleResponse(response: any) {
    if(response.hasEventType() && 
      response.getEventType() == Event.END_OF_UTTERANCE) {
      this.emit('end-of-utterance');
    }

    else if(response.hasAudioOut()) {
      this.emit('audio-data', 
        new Buffer(response.getAudioOut().getAudioData())
      );
    }

    else if(response.hasResult()) {
      this._handleResult(response.getResult());
    }

    else if(response.hasError()) { 
      this.emit('error', response.getError());
    }
  }

  private _handleConversationState(response: any) {
    // Process state-specific results
    if(response.hasResult()) {
      let result = response.getResult(); 

      // Determine state based on microphone mode.
      if(result.getMicrophoneMode()) {
        let micMode = result.getMicrophoneMode();

        // Keep state, and expect more input
        if(micMode == MicMode.DIALOG_FOLLOW_ON) {
          this.state = State.IN_PROGRESS;
        } 
        
        // Conversation is over, wait for output to finish streaming
        else if(micMode == MicMode.CLOSE_MICROPHONE) {
          this.state = State.FINISHED;
        }
      }

      // Handle continous conversations
      if(result.getConversationState()) {
        let convState = new messages.ConverseState();
        convState.setConversationState(result.getConversationState());
        this.conversationState = convState;
      }
    }
  }

  public _handleConversationEnd() {
    this.emit('end');
    if(this.state == State.IN_PROGRESS) {
      this.emit('follow-on');
    }
  }

  public _handleError(error: any) {
    if(this.channel != null) {
      this.channel.end();
      this.channel = null;
    }

    if(error.code && error.code == grpc.status.UNAUTHENTICATED) {
      this.emit('unauthorized', error);
    } else {
      this.emit('error', error);
    }
  }
}

export = GoogleAssistant;
