'use strict';

var _ = require('underscore'),
    APIError = require('./APIError'),
    Class = require('class.extend'),
    CONTENT_TYPE_JSON = 'application/json;charset=UTF-8',
    CONTENT_TYPE_JSONP = 'text/javascript;charset=UTF-8',
    CONTENT_TYPE_RSS = 'application/rss+xml',
    CONTENT_TYPE_HTML = 'text/html;charset=UTF-8';

module.exports = Class.extend({

   init: function() {
      this._headers = {};
      this._status = 200;
      this._body = {};
      this._isJSONPSupported = false;
      this._cacheDurationSeconds = 0;
      this._errors = [];
      this.contentType(CONTENT_TYPE_JSON);
   },

   status: function(status) {
      this._status = status;
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

   addError: function(e) {
      this._errors.push(e);
      return this;
   },

   invalidRequest: function(body) {
      this.status(400);
      return body ? this.body(body) : this.addError(new APIError('Invalid request', undefined, 400));
   },

   error: function(body) {
      this.status(500);
      return body ? this.body(body) : this.addError(new APIError('Error processing request', undefined, 500));
   },

   serviceUnavailable: function(body) {
      this.status(503);
      return body ? this.body(body) : this.addError(new APIError('Service unavailable', undefined, 503));
   },

   notFound: function(body) {
      this.status(404);
      return body ? this.body(body) : this.addError(new APIError('Not found', undefined, 404));
   },

   rss: function(body) {
      this.contentType(CONTENT_TYPE_RSS);
      return this.body(body);
   },

   html: function(body) {
      this.contentType(CONTENT_TYPE_HTML);
      return this.body(body);
   },

   toResponse: function(req) {
      this._updateBodyWithErrors();
      this._updateForJSONP(req);
      this._addCacheHeaders();

      return {
         statusCode: this._status,
         headers: this._headers,
         body: _.isObject(this._body) ? JSON.stringify(this._body) : this._body,
      };
   },

   _updateBodyWithErrors: function() {
      if (_.isEmpty(this._body) && !_.isEmpty(this._errors)) {
         this.body(_.invoke(this._errors, 'toJSON'));
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

         this.contentType(CONTENT_TYPE_JSONP);
         this._body = 'typeof ' + callback + ' === \'function\' && ' + callback + '(' + JSON.stringify(this._body) + ');';
      }
   },

   _isValidJSONPCallback: function(name) {
      return _.isEmpty(name) ? false : /^[A-Za-z0-9_\\$]+$/.test(name);
   },

});

module.exports.CONTENT_TYPE_JSON = CONTENT_TYPE_JSON;
module.exports.CONTENT_TYPE_JSONP = CONTENT_TYPE_JSONP;
module.exports.CONTENT_TYPE_RSS = CONTENT_TYPE_RSS;
module.exports.CONTENT_TYPE_HTML = CONTENT_TYPE_HTML;
