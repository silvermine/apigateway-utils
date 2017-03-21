'use strict';

var ResponseBuilder = require('./ResponseBuilder');

module.exports = function(promiseReturningHandlerFn, request, cb) {
   promiseReturningHandlerFn()
      .then(function(respBuilder) {
         // eslint-disable-next-line no-console
         console.log('completed with %s millis left', request.getContext().getRemainingTimeInMillis());
         cb(undefined, respBuilder.toResponse(request));
      })
      .catch(function(err) {
         var respBuilder = new ResponseBuilder(request).error();

         // eslint-disable-next-line no-console
         console.log('ERROR:', err, err.stack);
         cb(undefined, respBuilder.toResponse(request));
      })
      .done();
};
