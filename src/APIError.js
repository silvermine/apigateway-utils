'use strict';

var _ = require('underscore'),
    uuid = require('uuid/v4'),
    Class = require('class.extend'),
    APIError;

// Get rid of all keys in an object that have undefined values.
function filterObject(o) {
   return _.pick(o, _.identity);
}

module.exports = APIError = Class.extend({

   init: function(title, detail, status, responseBuilder) {
      this._id = uuid();
      this._title = title;
      this._detail = detail;
      this._sources = [];
      this._responseBuilder = responseBuilder;
      this.status(status);
      this.isAPIError = true;
   },

   /**
    * For use in chaining error creation from ResponseBuilder. ResponseBuilder, when it
    * creates an error, sets itself on the error. When you create an error through
    * ResponseBuilder, it actually returns this error. When you're done setting fields on
    * the error, you call `.rb()` to get the ResponseBuilder back.
    */
   rb: function() {
      return this._responseBuilder;
   },

   status: function(status) {
      if (_.isUndefined(status)) {
         return this._status;
      }

      this._status = status;
      return this;
   },

   title: function(title) {
      this._title = title;
      return this;
   },

   detail: function(detail) {
      this._detail = detail;
      return this;
   },

   addSource: function(location, path, detail, schemaPath) {
      this._sources.push({
         location: location,
         path: path,
         detail: detail,
         schemaPath: schemaPath,
      });
      return this;
   },

   toResponseObject: function() {
      return filterObject({
         id: this._id,
         title: this._title,
         detail: this._detail,
         status: this._status,
         sources: _.isEmpty(this._sources) ? undefined : _.map(this._sources, filterObject),
      });
   },

});

APIError.LOC_BODY = 'body';
APIError.LOC_URL = 'url';
APIError.LOC_HEADER = 'header';
