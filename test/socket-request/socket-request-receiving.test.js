const assert = require('chai').assert;
const {SocketRequest} = require('../../');
const chunkedServer = require('../chunked-server');

global.performance = {
  now: function() {
    return Date.now();
  }
};

describe('Socket request - receiving data', function() {
  const httpPort = 8123;
  const sslPort = 8124;

  const requests = [{
    url: `http://localhost:${httpPort}/api/endpoint?query=param`,
    method: 'GET',
    headers: 'Host: test.com\nContent-Length: 0',
    payload: 'abc',
    id: 'test1'
  }];

  const opts = [{
    timeout: 10000,
    followRedirects: true
  }];

  before(function() {
    return chunkedServer.startServer(httpPort, sslPort);
  });

  after(function() {
    return chunkedServer.stopServer();
  });

  describe('Chunked responses', function() {
    let request;

    this.timeout(10000);

    it('Receives chunked response.', function(done) {
      request = new SocketRequest(requests[0], opts[0]);
      request.once('load', function(id, response) {
        let parts = response.payload.toString().split('\n');
        assert.lengthOf(parts, 6);
        for (let i = 0; i < 5; i++) {
          assert.equal(parts[i].length, 128);
        }
        done();
      });
      request.once('error', function(error) {
        done(error);
      });
      request.send();
    });
  });

  describe('readChunkSize()', function() {
    let request;
    before(function() {
      request = new SocketRequest(requests[0], opts[0]);
    });

    it('Returns the the same array when new line not found', function() {
      const b = Buffer.from('test');
      const result = request.readChunkSize(b);
      assert.isTrue(b === result);
    });

    it('Do not set _chunkSize propery', function() {
      const b = Buffer.from('test');
      request.readChunkSize(b);
      assert.isUndefined(request._chunkSize);
    });

    it('Parses chunk size', function() {
      let chunk = Number(128).toString(16);
      chunk += '\r\ntest';
      const b = Buffer.from(chunk);
      request.readChunkSize(b);
      assert.equal(request._chunkSize, 128);
    });

    it('Buffer is truncated', function() {
      let chunk = Number(128).toString(16);
      chunk += '\r\ntest';
      const b = Buffer.from(chunk);
      const result = request.readChunkSize(b);
      assert.equal(result.toString(), 'test');
    });
  });

  describe('_processBodyChunked()', function() {
    let request;
    beforeEach(function() {
      request = new SocketRequest(requests[0], opts[0]);
      request._reportResponse = function() {};
    });

    it('Reads body chunk', function() {
      let chunk = Number(4).toString(16);
      chunk += '\r\ntest\r\n0\r\n';
      const b = Buffer.from(chunk);
      request._processBodyChunked(b);
      assert.equal(request._chunkSize, 0);
      assert.equal(request._rawBody.toString(), 'test');
    });

    it('Reads multi chunks', function() {
      let chunk = Number(6).toString(16);
      chunk += '\r\ntest\r\n\r\n';
      chunk += Number(8).toString(16);
      chunk += '\r\ntest1234\r\n';
      chunk += '0\r\n';
      const b = Buffer.from(chunk);
      request._processBodyChunked(b);
      assert.equal(request._chunkSize, 0);
      assert.equal(request._rawBody.toString(), 'test\r\ntest1234');
    });

    it('Reads multi chunks with partial buffor', function() {
      let chunk = Number(6).toString(16);
      chunk += '\r\nte';
      request._processBodyChunked(Buffer.from(chunk));
      chunk = 'st\r\n\r\n';
      request._processBodyChunked(Buffer.from(chunk));
      chunk = Number(8).toString(16);
      chunk += '\r\ntest';
      request._processBodyChunked(Buffer.from(chunk));
      chunk = '1234\r\n0\r\n';
      request._processBodyChunked(Buffer.from(chunk));
      assert.equal(request._chunkSize, 0);
      assert.equal(request._rawBody.toString(), 'test\r\ntest1234');
    });
  });

  describe('_processBody()', function() {
    let request;
    const testData = Buffer.from('abcdefghijklmn');
    const testLength = testData.length;

    beforeEach(function() {
      request = new SocketRequest(requests[0], opts[0]);
      request._reportResponse = function() {};
    });

    it('Sets _rawBody property', function() {
      request._contentLength = testLength + 1;
      request._processBody(testData);
      assert.isTrue(request._rawBody === testData);
    });

    it('Does not call _reportResponse when length is higher than data',
      function() {
      request._contentLength = testLength + 1;
      let called = false;
      request._reportResponse = function() {
        called = true;
      };
      request._processBody(testData);
      assert.isFalse(called);
    });

    it('Reports response when the data is read as whole on one socket buffer',
      function() {
      request._contentLength = testLength;
      let called = false;
      request._reportResponse = function() {
        called = true;
      };
      request._processBody(testData);
      assert.isTrue(called, '_reportResponse was called');
    });

    it('Reports response after more calls', function() {
      request._contentLength = testLength;
      let called = false;
      request._reportResponse = function() {
        called = true;
      };
      request._processBody(Buffer.from('abcdef'));
      request._processBody(Buffer.from('ghijklmn'));
      assert.isTrue(called, '_reportResponse was called');
    });
  });
});
