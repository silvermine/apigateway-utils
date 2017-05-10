'use strict';

var ResponseBuilder = require('./ResponseBuilder');

module.exports = function(promiseReturningHandlerFn, request, cb, CustomRespBuilderClass) {
   promiseReturningHandlerFn()
      .then(function(respBuilder) {
         // eslint-disable-next-line no-console
         console.log('completed with %s millis left', request.getContext().getRemainingTimeInMillis());
         cb(undefined, respBuilder.toResponse(request));
      })
      .catch(function(err) {
         var RB = CustomRespBuilderClass || ResponseBuilder,
             respBuilder = new RB().error();

         // eslint-disable-next-line no-console
         console.log('ERROR:', err, err.stack);
         cb(undefined, respBuilder.toResponse(request));
      })
      .done();
};
