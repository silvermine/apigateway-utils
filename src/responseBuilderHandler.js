'use strict';

var Q = require('q'),
    ResponseBuilder = require('./ResponseBuilder');

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
         // eslint-disable-next-line no-console
         console.log('completed with %s millis left', request.getContext().getRemainingTimeInMillis());
         cb(undefined, respBuilder.toResponse(request));
      })
      .catch(function(err) {
         var RB = CustomRespBuilderClass || ResponseBuilder,
             respBuilder = new RB().serverError().rb();

         // eslint-disable-next-line no-console
         console.log('ERROR:', err, err.stack);
         cb(undefined, respBuilder.toResponse(request));
      })
      .done();
};
