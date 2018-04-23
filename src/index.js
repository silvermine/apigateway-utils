'use strict';

var EXPORTABLE_RESOURCES;

EXPORTABLE_RESOURCES = {
   Request: './Request',
   APIError: './APIError',
   JWTSecuredRequest: './JWTSecuredRequest',
   ResponseBuilder: './ResponseBuilder',
   SilvermineResponseBuilder: './SilvermineResponseBuilder',
   responseBuilderHandler: './responseBuilderHandler',
   JWTValidator: './JWTValidator',
};

module.exports = {

   /**
    * This function provides a way of getting named classes and functions that
    * we export from our library without needing them to be required when the
    * file is loaded. If they were required when this file was loaded, then all
    * their dependencies would need to be found. If someone is not using one of
    * our classes (e.g. JWTSecuredRequest) they should not be required to pull
    * in (or themselves provide) its dependencies (e.g. jwt-simple).
    */
   get: function(resourceName) {
      if (EXPORTABLE_RESOURCES[resourceName]) {
         return require(EXPORTABLE_RESOURCES[resourceName]); // eslint-disable-line global-require
      }

      throw new Error('No exportable resource by the name "' + resourceName + '"');
   },

};
