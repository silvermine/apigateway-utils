'use strict';

var expect = require('expect.js'),
    Request = require('../src/Request'),
    ResponseBuilder = require('../src/SilvermineResponseBuilder');

describe('SilvermineResponseBuilder', function() {
   var jsonpReq = new Request({ queryStringParameters: { callback: 'callMe' } }, {});

   function jsonpBody(cbName, body) {
      return 'typeof ' + cbName + ' === \'function\' && ' + cbName + '(' + JSON.stringify(body) + ');';
   }

   it('overrides defaults', function() {
      var rb = new ResponseBuilder(),
          resp = rb.toResponse(jsonpReq),
          expectedExpiry, expiryNextSec;

      expect(resp.headers['Access-Control-Allow-Origin']).to.eql('*');
      expect(resp.body).to.eql(jsonpBody('callMe', {}));

      expectedExpiry = new Date(new Date().getTime() + 1800000);
      expiryNextSec = new Date(expectedExpiry.getTime() + 1000);
      expect(resp.headers.Pragma).to.eql(undefined);
      expect(resp.headers['Cache-Control']).to.eql('must-revalidate, max-age=1800');
      // We test both the expected time and one second after it to allow for those test
      // cases where the execution of the test or the code in test rolled us into the next second
      expect([ expectedExpiry.toUTCString(), expiryNextSec.toUTCString() ]).to.contain(resp.headers.Expires);

      // TODO: add tests for X-Built-On, X-Page-Built, X-Elapsed-Millis
   });

});
