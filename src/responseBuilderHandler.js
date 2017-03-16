'use strict';

var ResponseBuilder = require('./ResponseBuilder');

module.exports = function(promiseReturningHandlerFn, request, cb) {
   promiseReturningHandlerFn()
      .then(function(respBuilder) {
         console.log('completed with %s millis left', request.getContext().getRemainingTimeInMillis());
         cb(undefined, respBuilder.toResponse(request));
      })
      .catch(function(err) {
         var respBuilder = new ResponseBuilder(request).error();

         console.log('ERROR:', err, err.stack);
         cb(undefined, respBuilder.toResponse(request));
      })
      .done();
};
