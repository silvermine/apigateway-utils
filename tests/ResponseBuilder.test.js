'use strict';

var _ = require('underscore'),
    sinon = require('sinon'),
    expect = require('expect.js'),
    Request = require('../src/Request'),
    APIError = require('../src/APIError'),
    ResponseBuilder = require('../src/ResponseBuilder');

describe('ResponseBuilder', function() {
   var req = new Request({ httpMethod: 'GET' }, {}),
       rb;

   beforeEach(function() {
      rb = new ResponseBuilder();
   });

   function jsonpBody(cbName, body) {
      return 'typeof ' + cbName + ' === \'function\' && ' + cbName + '(' + JSON.stringify(body) + ');';
   }

   describe('status', function() {

      it('returns the builder and sets the value correctly', function() {
         expect(rb.toResponse(req).statusCode).to.eql(200);
         expect(rb.status(404)).to.eql(rb);
         expect(rb.toResponse(req).statusCode).to.eql(404);
      });

      it('does not change the status if called with undefined', function() {
         expect(rb._status).to.eql(200);
         rb.status(undefined);
         expect(rb._status).to.eql(200);
         rb.status(999);
         expect(rb._status).to.eql(999);
      });

   });


   describe('header', function() {

      it('returns the builder and sets the value correctly', function() {
         expect(rb.toResponse(req).headers['X-Foo']).to.be(undefined);
         expect(rb.header('X-Foo', 'bar')).to.eql(rb);
         expect(rb.toResponse(req).headers['X-Foo']).to.eql('bar');
      });

   });


   describe('body', function() {

      it('returns the builder and sets the value correctly', function() {
         expect(rb.toResponse(req).body).to.eql(JSON.stringify({}));
         expect(rb.body({ foo: 'bar' })).to.eql(rb);
         expect(rb.toResponse(req).body).to.eql(JSON.stringify({ foo: 'bar' }));
      });

   });

   describe('getBody', function() {

      it('returns the body that was set', function() {
         expect(rb.body({ foo: 'bar' })).to.eql(rb);
         expect(rb.getBody()).to.eql({ foo: 'bar' });
      });

   });


   describe('contentType', function() {

      it('returns the builder and sets the value correctly', function() {
         expect(rb.toResponse(req).headers['Content-Type']).to.be(ResponseBuilder.CONTENT_TYPE_JSON);
         expect(rb.contentType(ResponseBuilder.CONTENT_TYPE_RSS)).to.eql(rb);
         expect(rb.toResponse(req).headers['Content-Type']).to.be(ResponseBuilder.CONTENT_TYPE_RSS);
      });

   });


   describe('allowCORS', function() {

      it('returns the builder and sets the value correctly', function() {
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
         expect(rb.toResponse(jsonpReq).body).to.eql(JSON.stringify({}));
         expect(rb.supportJSONP('cb')).to.eql(rb);

         expect(rb.toResponse(jsonpReq).body).to.eql(jsonpBody('callMe', {}));
      });

   });


   describe('_updateForJSONP', function() {
      var jsonpReq = new Request({ queryStringParameters: { cb: 'callMe', badCB: 'window.foo' } });

      it('does not do jsonp if not supported, or wrong body type', function() {
         var body = { foo: 'bar' };

         rb = new ResponseBuilder().body(body);

         // default to no JSONP
         expect(rb.toResponse(jsonpReq).body).to.eql(JSON.stringify(body));

         // enabling support, but setting the body to something that is not supported
         expect(rb.supportJSONP('cb').body('string not supported')).to.eql(rb);
         // so the body is "raw" - it's not a JSONP body
         expect(rb.toResponse(jsonpReq).body).to.eql('string not supported');
      });

      it('does not do jsonp if callback query param not present', function() {
         var body = { foo: 'bar' };

         rb = new ResponseBuilder().body(body);

         // default to no JSONP
         expect(rb.toResponse(jsonpReq).body).to.eql(JSON.stringify(body));

         // enabling support with the name of the query param that is not present in the
         // request
         expect(rb.supportJSONP('nonexistentCB')).to.eql(rb);

         // so the body is just JSON, not JSONP
         expect(rb.toResponse(jsonpReq).body).to.eql(JSON.stringify(body));
      });

      it('does not do jsonp if invalid callback name', function() {
         var body = { foo: 'bar' };

         rb = new ResponseBuilder().body(body);

         // default to no JSONP
         expect(rb.toResponse(jsonpReq).body).to.eql(JSON.stringify(body));

         // enabling support with the name of the query param that has an invalid callback
         // value
         expect(rb.supportJSONP('badCB')).to.eql(rb);

         // so the body is just JSON, not JSONP
         expect(rb.toResponse(jsonpReq).body).to.eql(JSON.stringify(body));
      });

      it('does do jsonp if supported, and right body type', function() {
         var body = { foo: 'bar' };

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
         expect(rb._isValidJSONPCallback(undefined)).to.eql(false);
         expect(rb._isValidJSONPCallback('')).to.eql(false);
         expect(rb._isValidJSONPCallback('window.foo')).to.eql(false);
         expect(rb._isValidJSONPCallback('$.foo')).to.eql(false);

         expect(rb._isValidJSONPCallback('_abc')).to.eql(true);
         expect(rb._isValidJSONPCallback('$')).to.eql(true);
      });

   });


   describe('caching functions', function() {

      function runCachingTest(method, fnName, val, inSeconds, respStatus) {
         var cachingReq = new Request({ httpMethod: method }, {}),
             resp, expected, nextSec;

         rb = new ResponseBuilder();

         resp = rb.toResponse(cachingReq);
         expect(resp.headers.Expires).to.eql('Thu, 19 Nov 1981 08:52:00 GMT');
         expect(resp.headers['Cache-Control']).to.eql('no-cache, max-age=0, must-revalidate');
         expect(resp.headers.Pragma).to.eql('no-cache');

         expect(rb[fnName](val)).to.eql(rb);

         if (!_.isUndefined(respStatus)) {
            rb.status(respStatus);
         }

         resp = rb.toResponse(cachingReq);

         if (inSeconds > 0) {
            expected = new Date(new Date().getTime() + (inSeconds * 1000));
            nextSec = new Date(expected.getTime() + 1000);

            // We test both the expected time and one second after it to allow for those
            // test cases where the execution of the test or the code in test rolled us
            // into the next second
            expect([ expected.toUTCString(), nextSec.toUTCString() ]).to.contain(resp.headers.Expires);
            expect(resp.headers['Cache-Control']).to.eql('must-revalidate, max-age=' + inSeconds);
            expect(resp.headers.Pragma).to.eql(undefined);
         } else {
            expect(resp.headers.Expires).to.eql('Thu, 19 Nov 1981 08:52:00 GMT');
            expect(resp.headers['Cache-Control']).to.eql('no-cache, max-age=0, must-revalidate');
            expect(resp.headers.Pragma).to.eql('no-cache');
         }

      }

      describe('cacheForSeconds', function() {

         it('returns the builder and sets the value correctly', function() {
            runCachingTest('GET', 'cacheForSeconds', 2, 2);
            runCachingTest('GET', 'cacheForSeconds', 30, 30);
         });

      });

      describe('cacheForMinutes', function() {

         it('returns the builder and sets the value correctly', function() {
            runCachingTest('GET', 'cacheForMinutes', 2, 120);
            runCachingTest('GET', 'cacheForMinutes', 30, 1800);
         });

      });

      describe('cacheForHours', function() {

         it('returns the builder and sets the value correctly', function() {
            runCachingTest('GET', 'cacheForHours', 1, 3600);
            runCachingTest('GET', 'cacheForHours', 2, 7200);
         });

      });

      describe('getCacheDurationInSeconds', function() {

         it('returns the correct caching duration when set using seconds', function() {
            rb.cacheForSeconds(25);
            expect(rb.getCacheDurationInSeconds()).to.eql(25);
         });

         it('returns the correct caching duration when set using minutes', function() {
            rb.cacheForMinutes(2);
            expect(rb.getCacheDurationInSeconds()).to.eql(120);
         });

         it('returns the correct caching duration when set using hours', function() {
            rb.cacheForHours(3);
            expect(rb.getCacheDurationInSeconds()).to.eql(10800);
         });

      });

      describe('toResponse', function() {

         it('erases any caches set for non-GET requests', function() {
            runCachingTest('POST', 'cacheForHours', 1, 0);
            runCachingTest('PUT', 'cacheForHours', 1, 0);
            runCachingTest('PATCH', 'cacheForHours', 1, 0);
            runCachingTest('DELETE', 'cacheForHours', 1, 0);
         });

         it('erases any caches set for 5xx responses', function() {
            runCachingTest('GET', 'cacheForHours', 1, 0, 500);
            runCachingTest('POST', 'cacheForHours', 1, 0, 500);
            runCachingTest('PUT', 'cacheForHours', 1, 0, 500);
            runCachingTest('PATCH', 'cacheForHours', 1, 0, 500);
            runCachingTest('DELETE', 'cacheForHours', 1, 0, 500);
         });

      });

      // NOTE: _addCacheHeaders is tested by above tests
   });


   describe('redirect', function() {
      var url = 'http://www.example.com';

      it('returns the builder and sets the value correctly', function() {
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


   describe('error response functions', function() {
      var errorFunctions;

      errorFunctions = [
         { name: 'badRequest', title: 'Invalid request', statusCode: 400 },
         { name: 'unauthorized', title: 'Unauthorized request', statusCode: 401 },
         { name: 'forbidden', title: 'Forbidden', statusCode: 403 },
         { name: 'notFound', title: 'Not found', statusCode: 404 },
         { name: 'unsupportedMediaType', title: 'Can not return requested media type', statusCode: 415 },
         { name: 'unprocessableEntity', title: 'Unprocessable entity', statusCode: 422 },
         { name: 'serverError', title: 'Internal error', statusCode: 500 },
         { name: 'notImplemented', title: 'Not implemented', statusCode: 501 },
         { name: 'serviceUnavailable', title: 'Service unavailable', statusCode: 503 },
      ];

      _.each(errorFunctions, function(ef) {
         describe(ef.name, function() {
            it('returns the error itself', function() {
               var err = rb[ef.name]();

               expect(err).to.not.be(rb);
               expect(err.isAPIError).to.be.ok();
            });

            it('passes through the title and detail provided', function() {
               expect(rb._errors.length).to.be(0);
               rb[ef.name]('title1', 'detail1');
               expect(rb._errors.length).to.be(1);
               expect(rb._errors[0]._title).to.eql('title1');
               expect(rb._errors[0]._detail).to.eql('detail1');
            });

            it('uses the default title and proper status, leaves detail undefined when none is supplied', function() {
               expect(rb._errors.length).to.be(0);
               rb[ef.name]();
               expect(rb._errors.length).to.be(1);
               expect(rb._errors[0]._title).to.eql(ef.title);
               expect(rb._errors[0]._detail).to.eql(undefined);
               expect(rb._errors[0]._status).to.eql(ef.statusCode);
            });
         });
      });

   });


   describe('err', function() {
      it('does not set the status if inheritStatus is not truthy', function() {
         expect(rb._status).to.eql(200);
         rb.err('title1', 'detail1', 999);
         expect(rb._status).to.eql(200);
      });

      it('does set the status if inheritStatus is truthy', function() {
         expect(rb._status).to.eql(200);
         rb.err('title1', 'detail1', 999, true);
         expect(rb._status).to.eql(999);
      });
   });


   describe('_updateBodyWithErrors', function() {
      it('overrides an empty body', function() {
         expect(rb._body).to.eql({});
         rb.serverError();
         expect(rb._errors.length).to.eql(1);
         rb._updateBodyWithErrors();
         expect(rb._body).to.be.an('array');
         expect(rb._body.length).to.eql(1);
         expect(_.map(rb._body, _.partial(_.omit, _, 'id'))).to.eql([
            { title: 'Internal error', status: 500 },
         ]);
      });

      it('does nothing if there is already a body set', function() {
         expect(rb._body).to.eql({});
         rb.body({ foo: 'bar' });
         rb.serverError();
         expect(rb._errors.length).to.eql(1);
         rb._updateBodyWithErrors();
         expect(rb._body).not.to.be.an('array');
         expect(rb._body).to.eql({ foo: 'bar' });
      });
   });


   describe('addError', function() {
      var err = new APIError('foo', 'bar', 999);

      it('adds an error and returns the response builder', function() {
         expect(rb._errors.length).to.be(0);
         expect(rb.addError(err)).to.be(rb);
         expect(rb._errors.length).to.be(1);
         expect(rb._errors[0]).to.be(err);
      });

      it('does not change the status if inheritStatus is not truthy', function() {
         expect(rb._status).to.be(200);
         expect(rb.addError(err)).to.be(rb);
         expect(rb._status).to.be(200);
         expect(rb.addError(err, undefined)).to.be(rb);
         expect(rb._status).to.be(200);
         expect(rb.addError(err, false)).to.be(rb);
         expect(rb._status).to.be(200);
      });

      it('changes the status if inheritStatus is truthy', function() {
         expect(rb._status).to.be(200);
         expect(rb.addError(err, true)).to.be(rb);
         expect(rb._status).to.be(999);
      });
   });


   describe('addErrors', function() {
      // This is here in case anyone ever change that _.each loop to _.invoke or _.map,
      // etc, where underscore would pass the index as the second arg (inheritStatus) ...
      // which would result in the second error changing the status of the response
      it('calls addError for each error, without passing inheritStatus', function() {
         var stub = sinon.stub(rb, 'addError'),
             errors;

         errors = [
            new APIError('t1', 'd1', 101),
            new APIError('t2', 'd2', 102),
            new APIError('t3', 'd3', 103),
         ];

         rb.addErrors(errors);

         expect(stub.callCount).to.eql(3);
         expect(stub.getCall(0).args[0]).to.eql(errors[0]);
         expect(stub.getCall(0).args.length).to.eql(1);
         expect(stub.getCall(1).args[0]).to.eql(errors[1]);
         expect(stub.getCall(1).args.length).to.eql(1);
         expect(stub.getCall(2).args[0]).to.eql(errors[2]);
         expect(stub.getCall(2).args.length).to.eql(1);
      });

      it('adds multiple errors, without impacting response status by accident', function() {
         var err1 = new APIError('t1', 'd1', 999),
             err2 = new APIError('t2', 'd2', 998);

         expect(rb._errors.length).to.be(0);
         expect(rb._status).to.be(200);

         expect(rb.addErrors([ err1, err2 ])).to.be(rb);

         expect(rb._errors.length).to.be(2);
         expect(rb._status).to.be(200);
      });
   });


   describe('body-changing response functions', function() {

      function runTest(fnName, fnArg, contentType) {
         var resp;

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

   describe('okayOrNotFound', function() {

      function runTest(body, contentType, expectedStatusCode, expectedContentType, expectedBody) {
         var resp;

         resp = rb.toResponse(req);
         expect(resp.body).to.eql(JSON.stringify({}));
         expect(rb.okayOrNotFound(body, contentType)).to.eql(rb);

         resp = rb.toResponse(req);
         expect(resp.statusCode).to.eql(expectedStatusCode);
         expect(rb.toResponse(req).headers['Content-Type']).to.be(expectedContentType);
         expect(resp.body).to.eql(expectedBody);
      }

      it('sets the body and content type when both are provided', function() {
         var body = '<html />';

         rb.contentType(ResponseBuilder.CONTENT_TYPE_XML);
         runTest(body, ResponseBuilder.CONTENT_TYPE_HTML, 200, ResponseBuilder.CONTENT_TYPE_HTML, body);
      });

      it('only sets the body when a valid body is provided, but not a content type', function() {
         var body = { test: 'data' };

         rb.contentType(ResponseBuilder.CONTENT_TYPE_JSON);
         runTest(body, undefined, 200, ResponseBuilder.CONTENT_TYPE_JSON, JSON.stringify(body));
      });

      it('configures the response for "not found" when no body was given', function() {
         var resp;

         rb.contentType(ResponseBuilder.CONTENT_TYPE_XML);

         resp = rb.toResponse(req);
         expect(resp.body).to.eql(JSON.stringify({}));
         expect(rb.okayOrNotFound(undefined, ResponseBuilder.CONTENT_TYPE_HTML)).to.eql(rb);

         resp = rb.toResponse(req);
         expect(resp.statusCode).to.eql(404);
         expect(rb.toResponse(req).headers['Content-Type']).to.be(ResponseBuilder.CONTENT_TYPE_XML);
         expect(resp.body).to.be.a('string');
      });

   });

   it('exposes the content type constants', function() {
      expect(ResponseBuilder.CONTENT_TYPE_JSON).to.be('application/json;charset=UTF-8');
      expect(ResponseBuilder.CONTENT_TYPE_JSONP).to.be('text/javascript;charset=UTF-8');
      expect(ResponseBuilder.CONTENT_TYPE_RSS).to.be('application/rss+xml');
      expect(ResponseBuilder.CONTENT_TYPE_HTML).to.be('text/html;charset=UTF-8');
   });

});
