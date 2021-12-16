# infobot-sber-stt
Node.JS library for [Sber SmartSpeech](https://developers.sber.ru/portal/tools/smartspeech) service.
Library can work in stream mode or recognize stored audio file.

To work with this library you need to obtain from Sber SmartSpeech:
* Client ID
* Client Secret

Please check [this page](https://developers.sber.ru/portal/tools/smartspeech) for information about credentials.

## Audio file recognition example:
```javascript
var STT = require('infobot-sber-stt');

var clientID = '*';
var clientSecret = '*';


var sttObj = new STT(clientID, clientSecret);
sttObj.recognizeFile('./test.wav',
    {
        sample_rate_hertz: 16000,
    }).then(res => {
    console.log(JSON.stringify(res));
}).catch(err => console.log(err));
````


## Stream recognition example:
```javascript
var STT = require('infobot-sber-stt');

var clientID = '*';
var clientSecret = '*';

var sttObj = new STT(clientID, clientSecret);
sttObj.startRecognitionSession({
        language: 'ru-RU', 
        sample_rate_hertz: 16000, 
        enable_partial_results: true
    }).then((recSess) => {
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
            if (data && data.results) {
                console.log(`Transcript: ${data.results[0].text}`);
            }
        });
        
        recSess.on('error', function (data) {
            console.error(data);
        });
}).catch((err) => {
    console.error(err);
});
````

Provided by [INFOBOT LLC.](https://infobot.pro) under Apache 2.0 license.

