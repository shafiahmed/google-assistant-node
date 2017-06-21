import * as stream from "stream";
let messages = require('./googleapis/google/assistant/embedded/v1alpha1/embedded_assistant_pb');

class AudioConverter extends stream.Transform {
  constructor() {
    super({ objectMode: true });
  }
  
  _transform(chunk: any, enc: string, cb: (err?: Error) => void) {
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
}

export default AudioConverter;
