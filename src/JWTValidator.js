'use strict';

var _ = require('underscore'),
    jwt = require('jwt-simple'),
    Class = require('class.extend'),
    APIError = require('./APIError'),
    BEARER_REGEX = /^Bearer /,
    INVALID_TOKEN_MSG = 'Invalid authorization token';

function createError(title, detail, headerFieldName) {
   var err = new APIError(title, detail);

   if (headerFieldName) {
      err.addSource(APIError.LOCATION_HEADER, headerFieldName);
   }

   return err;
}

function invalidFieldResp(field, headerFieldName) {
   return createError(INVALID_TOKEN_MSG, 'Invalid "' + field + '" value in the token.', headerFieldName);
}

module.exports = Class.extend({

   init: function(publicKey) {
      this._publicKey = publicKey;
   },

   issuer: function(issuer) {
      this._issuer = issuer;
      return this;
   },

   audience: function(audience) {
      this._audience = audience;
      return this;
   },

   revocation: function(revokedIDs) {
      this._revokedIDs = revokedIDs;
      return this;
   },

   validate: function(rawTokenString, isBearerFormat, headerFieldName) {
      var errors = [],
          tokenString = (isBearerFormat ? (rawTokenString || '').replace(BEARER_REGEX, '') : rawTokenString),
          token;

      // These first several types of errors must stop the flow of the rest of the
      // validation ... they can not be compounded because they result in no token to
      // actually validate.
      if (_.isEmpty(tokenString)) {
         return {
            errors: [ createError('No token supplied', undefined, headerFieldName) ],
         };
      }

      if (isBearerFormat && !BEARER_REGEX.test(rawTokenString)) {
         return {
            errors: [ createError('Authorization header not in correct format', undefined, headerFieldName) ],
         };
      }

      try {
         token = jwt.decode(tokenString, this._publicKey, false, 'RS256');
      } catch(err) {
         return {
            errors: [ createError(INVALID_TOKEN_MSG, err.message, headerFieldName) ],
         };
      }

      // The rest of these errors can be built up into an array of errors so that you can
      // report all the errors that were found with the decoded token.
      if (!_.isEmpty(this._issuer) && token.iss !== this._issuer) {
         errors.push(invalidFieldResp('iss', headerFieldName));
      }

      if (!_.isEmpty(this._audience)) {
         if (_.isArray(token.aud) && !_.contains(token.aud, this._audience)) {
            errors.push(invalidFieldResp('aud', headerFieldName));
         }

         if (!_.isArray(token.aud) && token.aud !== this._audience) {
            errors.push(invalidFieldResp('aud', headerFieldName));
         }
      }

      if (!_.isEmpty(this._revokedIDs) && _.contains(this._revokedIDs, token.jti)) {
         errors.push(createError(INVALID_TOKEN_MSG, 'Token has been revoked', headerFieldName));
      }

      return { errors: errors, token: token };
   },

});
