'use strict';

var _ = require('underscore'),
    Class = require('class.extend'),
    APIError = require('./APIError'),
    CONTENT_TYPES = require('./contentTypes');

module.exports = Class.extend({

   init: function() {
      this._headers = {};
      this._status = 200;
      this._body = {};
      this._isJSONPSupported = false;
      this._cacheDurationSeconds = 0;
      this._errors = [];
      this.contentType(CONTENT_TYPES.CONTENT_TYPE_JSON);
   },

   status: function(status) {
      if (!_.isUndefined(status)) {
         this._status = status;
      }

      return this;
   },

   header: function(key, value) {
      this._headers[key] = value;
      return this;
   },

   body: function(o) {
      this._body = o;
      return this;
   },

   getBody: function() {
      return this._body;
   },

   contentType: function(type) {
      return this.header('Content-Type', type);
   },

   allowCORS: function(origin) {
      return this.header('Access-Control-Allow-Origin', origin || '*');
   },

   supportJSONP: function(jsonpCallbackQueryParamName) {
      this._isJSONPSupported = true;
      this._jsonpQueryParamName = jsonpCallbackQueryParamName;
      return this;
   },

   getCacheDurationInSeconds: function() {
      return this._cacheDurationSeconds;
   },

   cacheForSeconds: function(s) {
      this._cacheDurationSeconds = Math.max(0, s);
      return this;
   },

   cacheForMinutes: function(m) {
      return this.cacheForSeconds(m * 60);
   },

   cacheForHours: function(h) {
      return this.cacheForMinutes(h * 60);
   },

   redirect: function(url, isPermanent) {
      this.status(isPermanent ? 301 : 302);
      this.header('Location', url);
      return this.body('Found. Redirecting to ' + url);
   },

   addErrors: function(errors) {
      _.each(errors, function(err) {
         this.addError(err);
      }.bind(this));
      return this;
   },

   addError: function(err, inheritStatus) {
      this._errors.push(err);
      if (inheritStatus) {
         this.status(err.status());
      }
      return this;
   },

   err: function(title, detail, status, inheritStatus) {
      var err = new APIError(title, detail, status, this);

      if (inheritStatus) {
         this.status(status);
      }

      this.addError(err);
      return err;
   },

   badRequest: function(title, detail) {
      return this.err(title || 'Invalid request', detail, 400, true);
   },

   unauthorized: function(title, detail) {
      return this.err(title || 'Unauthorized request', detail, 401, true);
   },

   forbidden: function(title, detail) {
      return this.err(title || 'Forbidden', detail, 403, true);
   },

   notFound: function(title, detail) {
      return this.err(title || 'Not found', detail, 404, true);
   },

   unsupportedMediaType: function(title, detail) {
      return this.err(title || 'Can not return requested media type', detail, 415, true);
   },

   unprocessableEntity: function(title, detail) {
      return this.err(title || 'Unprocessable entity', detail, 422, true);
   },

   serverError: function(title, detail) {
      return this.err(title || 'Internal error', detail, 500, true);
   },

   notImplemented: function(title, detail) {
      return this.err(title || 'Not implemented', detail, 501, true);
   },

   serviceUnavailable: function(title, detail) {
      return this.err(title || 'Service unavailable', detail, 503, true);
   },

   rss: function(body) {
      this.contentType(CONTENT_TYPES.CONTENT_TYPE_RSS);
      return this.body(body);
   },

   html: function(body) {
      this.contentType(CONTENT_TYPES.CONTENT_TYPE_HTML);
      return this.body(body);
   },

   okayOrNotFound: function(body, contentType) {
      if (body) {
         if (contentType) {
            this.contentType(contentType);
         }
         this.body(body);
      } else {
         this.notFound();
      }

      return this;
   },

   toResponse: function(req) {
      this._updateBodyWithErrors();
      this._updateForJSONP(req);

      if (req.method() !== 'GET' || this._status >= 500) {
         // Do not allow non-GET or 5xx responses to be cached.
         this.cacheForMinutes(0);
      }

      this._addCacheHeaders();

      return {
         statusCode: this._status,
         headers: this._headers,
         body: _.isObject(this._body) ? JSON.stringify(this._body) : this._body,
      };
   },

   _updateBodyWithErrors: function() {
      if (_.isEmpty(this._body) && !_.isEmpty(this._errors)) {
         this.body(_.map(this._errors, function(err) {
            var o = err.toResponseObject();

            console.log('API response includes error: %j', o); // eslint-disable-line no-console
            return o;
         }));
      }
   },


   _addCacheHeaders: function() {
      var now = new Date(),
          expiry = new Date(now.getTime() + (this._cacheDurationSeconds * 1000));

      if (this._cacheDurationSeconds) {
         delete this._headers.Pragma;
         this._headers.Expires = expiry.toUTCString();
         this._headers['Cache-Control'] = ('must-revalidate, max-age=' + this._cacheDurationSeconds);
      } else {
         this._headers.Expires = 'Thu, 19 Nov 1981 08:52:00 GMT';
         this._headers['Cache-Control'] = 'no-cache, max-age=0, must-revalidate';
         this._headers.Pragma = 'no-cache';
      }
   },

   _updateForJSONP: function(req) {
      var callback;

      if (!this._isJSONPSupported || !(_.isObject(this._body) || _.isArray(this._body))) {
         return;
      }

      if (req.hasQueryParam(this._jsonpQueryParamName) && this._isValidJSONPCallback(req.query(this._jsonpQueryParamName))) {
         callback = req.query(this._jsonpQueryParamName);

         this.contentType(CONTENT_TYPES.CONTENT_TYPE_JSONP);
         this._body = 'typeof ' + callback + ' === \'function\' && ' + callback + '(' + JSON.stringify(this._body) + ');';
      }
   },

   _isValidJSONPCallback: function(name) {
      return _.isEmpty(name) ? false : /^[A-Za-z0-9_\\$]+$/.test(name);
   },

});

_.extend(module.exports, CONTENT_TYPES);
