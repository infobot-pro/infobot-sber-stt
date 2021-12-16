var EventEmitter = require('events').EventEmitter;
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO = __dirname + '/stt.proto';
const HOST = 'smartspeech.sber.ru';
const OPTIONS = {
    language: 'ru-RU',
    model: 'general',
    hypotheses_count: 1,
    enable_partial_results: false,
    enable_multi_utterance: false,
    enable_profanity_filter: false,
    no_speech_timeout: {seconds: 7},
    max_speech_timeout: {seconds: 20},
    hints: {
        words: [],
        enable_letters: false,
        hints_eou_timeout: {seconds: 0},
    },
};

class RecognitionSession {
    constructor(accessToken, specification) {
        var self = this;
        self.events = new EventEmitter;
        self.isEnd = false;
        self.requestId = null;
        let packageDefinition = protoLoader.loadSync(
            PROTO,
            {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true
            });

        const proto = grpc.loadPackageDefinition(packageDefinition);
        const service = new proto['smartspeech']['recognition']['v1']['SmartSpeech'](HOST, grpc.credentials.createSsl());

        let metadata = new grpc.Metadata();
        metadata.set('authorization', 'Bearer ' + accessToken);

        self._call = service['Recognize'](metadata);
        self._call.on('metadata', (metadata) => {
            self.requestId = metadata.get('x-request-id');
        });
        self._call.on('data', (response) => {
            self._onData(response)
        });
        self._call.on('end', () => {
            this.isEnd = true;
        });
        self._call.on('error', (error) => {
            self._onError(error)
        });

        const options = Object.assign(OPTIONS, {
            audio_encoding: specification.audio_encoding,
            language: specification.language,
            sample_rate: specification.sample_rate_hertz,
            enable_partial_results: specification.partial_results,
            enable_profanity_filter: specification.profanity_filter,
        });
        self._call.write({options: options});
    }

    _onData(data) {
        this.events.emit('data', data);
    }

    _onError(data) {
        this.events.emit('error', data);
    }

    writeChunk(chunk) {
        if (!this.isEnd) {
            this._call.write({audio_chunk: chunk});
        }
    }

    finishStream() {
        this.isEnd = true;
        this._call.end();
    }

    on(event, callback) {
        this.events.on(event, callback);
    }

    once(event, callback) {
        this.events.once(event, callback);
    }
}

module.exports = RecognitionSession;
