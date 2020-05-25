const { assert } = require('chai');
const { ElectronRequest } = require('../../');
const { startServer, stopServer } = require('../express-api.js');
const { untilBody } = require('../Utils.js');
const { logger } = require('../dummy-logger.js');

describe('ElectronRequest', () => {
  const httpPort = 8126;

  const opts = {
    logger,
  };

  before(async () => startServer(httpPort));

  after(async () => stopServer());

  describe('query parameters processing', () => {
    const requestData = {
      id: 'r-1',
      url: `http://localhost:${httpPort}/v1/qarams/`,
      method: 'GET',
      headers: '',
    };

    it('sends a query parameter', async () => {
      const r = { ...requestData };
      r.url += '?a=b';
      const request = new ElectronRequest(r, opts);
      await request.send();
      const body = await untilBody(request);
      assert.deepEqual(body, { params: { query: { a: 'b' } } });
    });

    it('sends a multiple query parameters', async () => {
      const r = { ...requestData };
      r.url += '?a=b&c=1&d=true';
      const request = new ElectronRequest(r, opts);
      await request.send();
      const body = await untilBody(request);
      assert.deepEqual(body, { params: {
        query: {
          a: 'b',
          c: '1',
          d: 'true',
        },
      },
      });
    });

    it('sends an array query parameters', async () => {
      const r = { ...requestData };
      r.url += '?a=b&a=c&a=d';
      const request = new ElectronRequest(r, opts);
      await request.send();
      const body = await untilBody(request);
      assert.deepEqual(body, { params: {
        query: {
          a: ['b', 'c', 'd'],
        },
      },
      });
    });

    it('sends an array query parameters with brackets', async () => {
      const r = { ...requestData };
      r.url += '?a[]=b&a[]=c&a[]=d';
      const request = new ElectronRequest(r, opts);
      await request.send();
      const body = await untilBody(request);
      assert.deepEqual(body, { params: {
        query: {
          a: ['b', 'c', 'd'],
        },
      },
      });
    });

    it('sends mixed query parameters', async () => {
      const r = { ...requestData };
      r.url += '?a[]=b&a[]=c&b=a&b=b&c=d';
      const request = new ElectronRequest(r, opts);
      await request.send();
      const body = await untilBody(request);
      assert.deepEqual(body, { params: {
        query: {
          a: ['b', 'c'],
          b: ['a', 'b'],
          c: 'd',
        },
      },
      });
    });
  });

  describe('headers processing', () => {
    const request = {
      id: 'r-1',
      url: `http://localhost:${httpPort}/v1/headers/`,
      method: 'GET',
      headers: '',
    };

    it('sends a header', async () => {
      const r = { ...request };
      r.headers = 'x-test-header: true';
      const er = new ElectronRequest(r, opts);
      await er.send();
      const body = await untilBody(er);
      assert.equal(body.headers['x-test-header'], 'true');
    });

    it('sends multiple headers', async () => {
      const r = { ...request };
      r.headers = 'x-test-header: true\nAccept-CH: DPR, Viewport-Width';
      const er = new ElectronRequest(r, opts);
      await er.send();
      const body = await untilBody(er);
      assert.equal(body.headers['x-test-header'], 'true');
      assert.equal(body.headers['accept-ch'], 'DPR, Viewport-Width');
    });

    it('sends array headers', async () => {
      const r = { ...request };
      r.headers = 'x-test-header: true, x-value';
      const er = new ElectronRequest(r, opts);
      await er.send();
      const body = await untilBody(er);
      assert.equal(body.headers['x-test-header'], 'true, x-value');
    });
  });
});
