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

   init: function(title, detail, status) {
      this._id = uuid();
      this._title = title;
      this._detail = detail;
      this._sources = [];
      this.status(status);
   },

   status: function(status) {
      if (_.isUndefined(status)) {
         return this._status;
      }

      this._status = status;
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

   toJSON: function() {
      return filterObject({
         id: this._id,
         title: this._title,
         detail: this._detail,
         status: this._status,
         sources: _.isEmpty(this._sources) ? undefined : _.map(this._sources.slice(), filterObject),
      });
   },

});

APIError.LOCATION_BODY = 'body';
APIError.LOCATION_URL = 'url';
APIError.LOCATION_HEADER = 'header';
