'use strict';

var Q = require('q'),
    ResponseBuilder = require('./ResponseBuilder'),
    log = console.log.bind(console); // eslint-disable-line no-console

/**
 * In our APIs, we often have errors that are several promises deep, and without this,
 * it's hard to tell where the error actually originated (especially with AWS calls, etc).
 * This will generally make error stack traces much more helpful to us, so we are making
 * it a default.
 */
Q.longStackSupport = true;

module.exports = function(promiseReturningHandlerFn, request, cb, CustomRespBuilderClass) {
   Q.promised(promiseReturningHandlerFn)()
      .then(function(respBuilder) {
         log('completed with %s millis left', request.getContext().getRemainingTimeInMillis());
         cb(undefined, respBuilder.toResponse(request));
      })
      .catch(function(err) {
         var RB = CustomRespBuilderClass || ResponseBuilder,
             respBuilder = new RB().serverError().rb();

         log('ERROR:', err, err.stack);
         cb(undefined, respBuilder.toResponse(request));
      })
      .done();
};
