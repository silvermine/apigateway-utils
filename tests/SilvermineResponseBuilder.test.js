'use strict';

var _ = require('underscore'),
    expect = require('expect.js'),
    Request = require('../src/Request'),
    ResponseBuilder = require('../src/SilvermineResponseBuilder');

describe('SilvermineResponseBuilder', function() {
   var jsonpReq = new Request({ httpMethod: 'GET', queryStringParameters: { callback: 'callMe' } }, {});

   function jsonpBody(cbName, body) {
      return 'typeof ' + cbName + ' === \'function\' && ' + cbName + '(' + JSON.stringify(body) + ');';
   }

   function testCachingExpectations(resp, minutes) {
      var expectedExpiry, expiryNextSec;

      if (minutes) {
         expectedExpiry = new Date(new Date().getTime() + (minutes * 60000));
         expiryNextSec = new Date(expectedExpiry.getTime() + 1000);
         expect(resp.headers.Pragma).to.eql(undefined);
         expect(resp.headers['Cache-Control']).to.eql('must-revalidate, max-age=' + (minutes * 60));
         // We test both the expected time and one second after it to allow for those test
         // cases where the execution of the test or the code in test rolled us into the
         // next second
         expect([ expectedExpiry.toUTCString(), expiryNextSec.toUTCString() ]).to.contain(resp.headers.Expires);
      } else {
         expect(resp.headers.Expires).to.eql('Thu, 19 Nov 1981 08:52:00 GMT');
         expect(resp.headers['Cache-Control']).to.eql('no-cache, max-age=0, must-revalidate');
         expect(resp.headers.Pragma).to.eql('no-cache');
      }
   }

   it('overrides defaults', function() {
      var rb = new ResponseBuilder(),
          resp = rb.toResponse(jsonpReq);

      expect(resp.headers['Access-Control-Allow-Origin']).to.eql('*');
      expect(resp.body).to.eql(jsonpBody('callMe', {}));
      testCachingExpectations(resp, 30);

      // TODO: add tests for X-Built-On, X-Page-Built, X-Elapsed-Millis
   });

   it('respects no-cache rules for non-GET requests, 5xx responses, despite default 30m cache', function() {
      var rb = new ResponseBuilder(),
          req = new Request({ httpMethod: 'GET' }, {});

      testCachingExpectations(rb.toResponse(req), 30);
      rb.cacheForHours(1);
      testCachingExpectations(rb.toResponse(req), 60);

      _.each([ 500, 501 ], function(status) {
         rb.status(status);
         rb.cacheForHours(1);
         testCachingExpectations(rb.toResponse(req), 0);
      });

      _.each([ 'POST', 'PUT', 'PATCH', 'DELETE' ], function(method) {
         req = new Request({ httpMethod: method }, {});
         testCachingExpectations(rb.toResponse(req), 0);
         rb.cacheForHours(1);
         testCachingExpectations(rb.toResponse(req), 0);
      });
   });

   it('exposes the content type constants', function() {
      expect(ResponseBuilder.CONTENT_TYPE_JSON).to.be('application/json;charset=UTF-8');
      expect(ResponseBuilder.CONTENT_TYPE_JSONP).to.be('text/javascript;charset=UTF-8');
      expect(ResponseBuilder.CONTENT_TYPE_RSS).to.be('application/rss+xml');
      expect(ResponseBuilder.CONTENT_TYPE_HTML).to.be('text/html;charset=UTF-8');
   });

});
