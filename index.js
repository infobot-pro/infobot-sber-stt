const fs = require('fs');
const uuid = require('uuid').v4;
const tls = require('tls');
const request = require('request');

const RS = require('./session');

class InfobotSberSTT {
    static get FORMAT_PCM() {
        return 'PCM_S16LE';
    }

    constructor(clientId, clientSecret) {
        this._trustedCaFiles = [
            `${__dirname}/certs/russian_trusted_root_ca.cer`,
            `${__dirname}/certs/russian_trusted_sub_ca.cer`,
        ];

        this._trustedCa = [];

        for (const caFile of this._trustedCaFiles) {
            this._trustedCa.push(fs.readFileSync(caFile));
        }

        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.token = null;

        if (!this.clientId) throw new Error('No Service Client ID provided');
        if (!this.clientSecret) throw new Error('No Service Client Secret provided');
    }

    generateToken() {
        const self = this;
        return new Promise(function (resolve, reject) {
            if (!(self.token && self.tokenExpire && self.tokenExpire < (new Date().getTime() - 10 * 1000))) {
                const payload = {
                    'scope': 'SBER_SPEECH'
                };
                const code = Buffer.from(`${self.clientId}:${self.clientSecret}`).toString('base64');
                request.post(
                    'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
                    {
                        headers: {
                            'RqUID': uuid(),
                            'Authorization': `Basic ${code}`,
                        },
                        form: payload,
                        json: true,
                        agentOptions: {
                            ca: self._trustedCa,
                        },
                    },
                    function (error, response, body) {
                        if (!error && parseInt(response.statusCode) === 200) {
                            self.token = body.access_token;
                            self.tokenExpire = body.expires_at;
                            resolve(self.token);
                        } else {
                            reject(error);
                        }
                    }
                );
            } else {
                resolve(self.token);
            }
        });
    }

    startRecognitionSession(specification) {
        const self = this;
        return new Promise(function (resolve, reject) {
            self.generateToken().then(function (token) {
                if (!specification) specification = {};
                specification.language = specification.language_code || 'ru-RU';
                specification.sample_rate_hertz = specification.sample_rate_hertz || 8000;
                specification.audio_encoding = specification.audio_encoding || InfobotSberSTT.FORMAT_PCM;
                specification.profanity_filter = specification.profanity_filter || false;
                specification.partial_results = specification.partial_results || true;
                resolve(new RS(token, specification, self._trustedCa[0]));
            }).catch(function (err) {
                reject(err);
            });
        });
    }

    recognizeFile(path, specification) {
        var self = this;
        return new Promise(function (resolve, reject) {
            if (fs.existsSync(path)) {
                self.startRecognitionSession(specification).then(function (recSess) {
                    setTimeout(function () {
                        var Writable = require('stream').Writable;
                        var ws = Writable();
                        ws._write = function (chunk, enc, next) {
                            recSess.writeChunk(chunk);
                            next();
                        };

                        var readStream = fs.createReadStream(path);
                        readStream.pipe(ws);

                        readStream.on("end", function () {
                            recSess.finishStream();
                        });

                        recSess.on('data', function (data) {
                            if (data.eou) {
                                resolve(data.results)
                            }
                        });

                        recSess.on('error', function (data) {
                            reject(data);
                        });
                    }, 2000);
                }).catch(function (err) {
                    reject(err);
                });
            } else {
                throw new Error(`File not found ${path}`);
            }
        });
    }
}

module.exports = InfobotSberSTT;
