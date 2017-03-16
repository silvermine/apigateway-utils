'use strict';

var expect = require('expect.js'),
    Request = require('../src/Request'),
    ResponseBuilder = require('../src/ResponseBuilder');

describe('ResponseBuilder', function() {
   var req = new Request({}, {});

   function jsonpBody(cbName, body) {
      return 'typeof ' + cbName + ' === \'function\' && ' + cbName + '(' + JSON.stringify(body) + ');';
   }

   describe('status', function() {

      it('returns the builder and sets the value correctly', function() {
         var rb = new ResponseBuilder();

         expect(rb.toResponse(req).statusCode).to.eql(200);
         expect(rb.status(404)).to.eql(rb);
         expect(rb.toResponse(req).statusCode).to.eql(404);
      });

   });


   describe('header', function() {

      it('returns the builder and sets the value correctly', function() {
         var rb = new ResponseBuilder();

         expect(rb.toResponse(req).headers['X-Foo']).to.be(undefined);
         expect(rb.header('X-Foo', 'bar')).to.eql(rb);
         expect(rb.toResponse(req).headers['X-Foo']).to.eql('bar');
      });

   });


   describe('body', function() {

      it('returns the builder and sets the value correctly', function() {
         var rb = new ResponseBuilder();

         expect(rb.toResponse(req).body).to.eql(JSON.stringify({}));
         expect(rb.body({ foo: 'bar' })).to.eql(rb);
         expect(rb.toResponse(req).body).to.eql(JSON.stringify({ foo: 'bar' }));
      });

   });


   describe('contentType', function() {

      it('returns the builder and sets the value correctly', function() {
         var rb = new ResponseBuilder();

         expect(rb.toResponse(req).headers['Content-Type']).to.be(ResponseBuilder.CONTENT_TYPE_JSON);
         expect(rb.contentType(ResponseBuilder.CONTENT_TYPE_RSS)).to.eql(rb);
         expect(rb.toResponse(req).headers['Content-Type']).to.be(ResponseBuilder.CONTENT_TYPE_RSS);
      });

   });


   describe('allowCORS', function() {

      it('returns the builder and sets the value correctly', function() {
         var rb = new ResponseBuilder();

         expect(rb.toResponse(req).headers['Access-Control-Allow-Origin']).to.be(undefined);
         expect(rb.allowCORS()).to.eql(rb);
         expect(rb.toResponse(req).headers['Access-Control-Allow-Origin']).to.eql('*');

         expect(rb.allowCORS('www.example.org')).to.eql(rb);
         expect(rb.toResponse(req).headers['Access-Control-Allow-Origin']).to.eql('www.example.org');
      });

   });


   describe('supportJSONP', function() {
      var jsonpReq = new Request({ queryStringParameters: { cb: 'callMe' } });

      it('returns the builder and sets the value correctly', function() {
         var rb = new ResponseBuilder();

         expect(rb.toResponse(jsonpReq).body).to.eql(JSON.stringify({}));
         expect(rb.supportJSONP('cb')).to.eql(rb);

         expect(rb.toResponse(jsonpReq).body).to.eql(jsonpBody('callMe', {}));
      });

   });


   describe('_updateForJSONP', function() {
      var jsonpReq = new Request({ queryStringParameters: { cb: 'callMe', badCB: 'window.foo' } });

      it('does not do jsonp if not supported, or wrong body type', function() {
         var body = { foo: 'bar' },
             rb = new ResponseBuilder().body(body);

         // default to no JSONP
         expect(rb.toResponse(jsonpReq).body).to.eql(JSON.stringify(body));

         // enabling support, but setting the body to something that is not supported
         expect(rb.supportJSONP('cb').body('string not supported')).to.eql(rb);
         // so the body is "raw" - it's not a JSONP body
         expect(rb.toResponse(jsonpReq).body).to.eql('string not supported');
      });

      it('does not do jsonp if callback query param not present', function() {
         var body = { foo: 'bar' },
             rb = new ResponseBuilder().body(body);

         // default to no JSONP
         expect(rb.toResponse(jsonpReq).body).to.eql(JSON.stringify(body));

         // enabling support with the name of the query param that is not present in the request
         expect(rb.supportJSONP('nonexistentCB')).to.eql(rb);

         // so the body is just JSON, not JSONP
         expect(rb.toResponse(jsonpReq).body).to.eql(JSON.stringify(body));
      });

      it('does not do jsonp if invalid callback name', function() {
         var body = { foo: 'bar' },
             rb = new ResponseBuilder().body(body);

         // default to no JSONP
         expect(rb.toResponse(jsonpReq).body).to.eql(JSON.stringify(body));

         // enabling support with the name of the query param that has an invalid callback value
         expect(rb.supportJSONP('badCB')).to.eql(rb);

         // so the body is just JSON, not JSONP
         expect(rb.toResponse(jsonpReq).body).to.eql(JSON.stringify(body));
      });

      it('does do jsonp if supported, and right body type', function() {
         var body = { foo: 'bar' },
             rb = new ResponseBuilder().body(body);

         // enable support, check that it returns "this"
         expect(rb.supportJSONP('cb')).to.eql(rb);

         // trying with an array, which should be JSONP-enabled
         rb.body([ 1, 2, 3 ]);
         expect(rb.toResponse(jsonpReq).body).to.eql(jsonpBody('callMe', [ 1, 2, 3 ]));

         // now trying with an object, which should be JSONP-enabled
         rb.body(body);
         expect(rb.toResponse(jsonpReq).body).to.eql(jsonpBody('callMe', body));
      });

   });


   describe('_isValidJSONPCallback', function() {

      it('returns the correct values', function() {
         var rb = new ResponseBuilder();

         expect(rb._isValidJSONPCallback(undefined)).to.eql(false);
         expect(rb._isValidJSONPCallback('')).to.eql(false);
         expect(rb._isValidJSONPCallback('window.foo')).to.eql(false);
         expect(rb._isValidJSONPCallback('$.foo')).to.eql(false);

         expect(rb._isValidJSONPCallback('_abc')).to.eql(true);
         expect(rb._isValidJSONPCallback('$')).to.eql(true);
      });

   });


   describe('caching functions', function() {

      function runCachingTest(fnName, val, inSeconds) {
         var rb = new ResponseBuilder(),
             resp, expected, nextSec;

         resp = rb.toResponse(req);
         expect(resp.headers.Pragma).to.eql('no-cache');
         expect(resp.headers.Expires).to.eql('Thu, 19 Nov 1981 08:52:00 GMT');
         expect(resp.headers['Cache-Control']).to.eql('no-cache, max-age=0, must-revalidate');

         expected = new Date(new Date().getTime() + (inSeconds * 1000));
         nextSec = new Date(expected.getTime() + 1000);

         expect(rb[fnName](val)).to.eql(rb);
         resp = rb.toResponse(req);

         expect(resp.headers.Pragma).to.eql(undefined);
         expect(resp.headers['Cache-Control']).to.eql('must-revalidate, max-age=' + inSeconds);
         // We test both the expected time and one second after it to allow for those test
         // cases where the execution of the test or the code in test rolled us into the next second
         expect([ expected.toUTCString(), nextSec.toUTCString() ]).to.contain(resp.headers.Expires);
      }

      describe('cacheForSeconds', function() {

         it('returns the builder and sets the value correctly', function() {
            runCachingTest('cacheForSeconds', 2, 2);
            runCachingTest('cacheForSeconds', 30, 30);
         });

      });

      describe('cacheForMinutes', function() {

         it('returns the builder and sets the value correctly', function() {
            runCachingTest('cacheForMinutes', 2, 120);
            runCachingTest('cacheForMinutes', 30, 1800);
         });

      });

      describe('cacheForHours', function() {

         it('returns the builder and sets the value correctly', function() {
            runCachingTest('cacheForHours', 1, 3600);
            runCachingTest('cacheForHours', 2, 7200);
         });

      });

      // NOTE: _addCacheHeaders is tested by above tests
   });


   describe('redirect', function() {
      var url = 'http://www.example.com';

      it('returns the builder and sets the value correctly', function() {
         var rb = new ResponseBuilder();

         expect(rb.toResponse(req).headers.Location).to.be(undefined);
         expect(rb.toResponse(req).statusCode).to.eql(200);

         // temporary redirect (not supplying the isPermanent param)
         expect(rb.redirect(url)).to.eql(rb);
         expect(rb.toResponse(req).headers.Location).to.eql(url);
         expect(rb.toResponse(req).statusCode).to.eql(302);

         // temporary redirect (supplying the isPermanent param)
         expect(rb.redirect(url, false)).to.eql(rb);
         expect(rb.toResponse(req).headers.Location).to.eql(url);
         expect(rb.toResponse(req).statusCode).to.eql(302);

         // permanent redirect (supplying the isPermanent param)
         expect(rb.redirect(url, true)).to.eql(rb);
         expect(rb.toResponse(req).headers.Location).to.eql(url);
         expect(rb.toResponse(req).statusCode).to.eql(301);
      });

   });


   describe('body-changing error response functions', function() {

      function runTest(fnName, msg, status, fnArg, expectedBody) {
         var rb = new ResponseBuilder(),
             resp;

         resp = rb.toResponse(req);
         expect(resp.body).to.eql(JSON.stringify({}));

         if (fnArg === undefined) {
            expect(rb[fnName]()).to.eql(rb);
         } else {
            expect(rb[fnName](fnArg)).to.eql(rb);
         }

         resp = rb.toResponse(req);
         expect(resp.statusCode).to.eql(status);
         expect(resp.body).to.eql(expectedBody || JSON.stringify({ message: msg, status: status }));
      }


      describe('invalidRequest', function() {

         it('returns the builder and sets the value correctly', function() {
            runTest('invalidRequest', 'Invalid request', 400);
            runTest('invalidRequest', null, 400, { foo: 'bar' }, JSON.stringify({ foo: 'bar' }));
         });

      });


      describe('error', function() {

         it('returns the builder and sets the value correctly', function() {
            runTest('error', 'Error processing request', 500);
            runTest('error', null, 500, { foo: 'bar' }, JSON.stringify({ foo: 'bar' }));
         });

      });


      describe('serviceUnavailable', function() {

         it('returns the builder and sets the value correctly', function() {
            runTest('serviceUnavailable', 'Service unavailable', 503);
            runTest('serviceUnavailable', null, 503, { foo: 'bar' }, JSON.stringify({ foo: 'bar' }));
         });

      });


      describe('notFound', function() {

         it('returns the builder and sets the value correctly', function() {
            runTest('notFound', 'Not Found', 404);
            runTest('notFound', null, 404, { foo: 'bar' }, JSON.stringify({ foo: 'bar' }));
         });

      });

   });


   describe('body-changing response functions', function() {

      function runTest(fnName, fnArg, contentType) {
         var rb = new ResponseBuilder(),
             resp;

         resp = rb.toResponse(req);
         expect(resp.body).to.eql(JSON.stringify({}));
         expect(rb[fnName](fnArg)).to.eql(rb);

         resp = rb.toResponse(req);
         expect(resp.statusCode).to.eql(200);
         expect(rb.toResponse(req).headers['Content-Type']).to.be(contentType);
      }


      describe('rss', function() {

         it('returns the builder and sets the value correctly', function() {
            runTest('rss', '<xml />', ResponseBuilder.CONTENT_TYPE_RSS);
         });

      });


      describe('html', function() {

         it('returns the builder and sets the value correctly', function() {
            runTest('html', '<html />', ResponseBuilder.CONTENT_TYPE_HTML);
         });

      });

   });

});
