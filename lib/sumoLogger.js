"use strict";

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var superagent = require('superagent');

var formatDate = require('./formatDate');

var DEFAULT_INTERVAL = 0;
var DEFAULT_BATCH = 0;

var NOOP = function NOOP() {};

function getUUID() {
  // eslint gets funny about bitwise

  /* eslint-disable */
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var piece = Math.random() * 16 | 0;
    var elem = c === 'x' ? piece : piece & 0x3 | 0x8;
    return elem.toString(16);
  });
  /* eslint-enable */
}
/**
 * Axios has been replaced with SuperAgent (issue #28), to maintain some backwards
 * compatibility the SuperAgent response object is marshaled to conform
 * to the Axios response object
 */


function marshalHttpResponse(response) {
  var statusMessage = response.res ? response.res.statusMessage : '';
  return {
    data: response.body,
    status: response.status,
    statusText: response.statusText || statusMessage,
    headers: response.headers,
    request: response.xhr || response.req,
    config: response.req
  };
}

var SumoLogger =
/*#__PURE__*/
function () {
  function SumoLogger(options) {
    _classCallCheck(this, SumoLogger);

    if (!options || !Object.prototype.hasOwnProperty.call(options, 'endpoint') || options.endpoint === undefined || options.endpoint === '') {
      console.error('An endpoint value must be provided');
      return;
    }

    this.config = {};
    this.pendingLogs = [];
    this.interval = 0;
    this.logSending = false;
    this.setConfig(options);
    this.startLogSending();
  }

  _createClass(SumoLogger, [{
    key: "setConfig",
    value: function setConfig(newConfig) {
      this.config = {
        endpoint: newConfig.endpoint,
        returnPromise: Object.prototype.hasOwnProperty.call(newConfig, 'returnPromise') ? newConfig.returnPromise : true,
        clientUrl: newConfig.clientUrl || '',
        useIntervalOnly: newConfig.useIntervalOnly || false,
        interval: newConfig.interval || DEFAULT_INTERVAL,
        batchSize: newConfig.batchSize || DEFAULT_BATCH,
        sourceName: newConfig.sourceName || '',
        hostName: newConfig.hostName || '',
        sourceCategory: newConfig.sourceCategory || '',
        session: newConfig.sessionKey || getUUID(),
        onSuccess: newConfig.onSuccess || NOOP,
        onError: newConfig.onError || NOOP,
        graphite: newConfig.graphite || false,
        raw: newConfig.raw || false,
        carbon2: newConfig.carbon2 || false
      };
    }
  }, {
    key: "updateConfig",
    value: function updateConfig() {
      var newConfig = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      if (newConfig.endpoint) {
        this.config.endpoint = newConfig.endpoint;
      }

      if (newConfig.returnPromise) {
        this.config.returnPromise = newConfig.returnPromise;
      }

      if (newConfig.useIntervalOnly) {
        this.config.useIntervalOnly = newConfig.useIntervalOnly;
      }

      if (newConfig.interval) {
        this.config.interval = newConfig.interval;
        this.startLogSending();
      }

      if (newConfig.batchSize) {
        this.config.batchSize = newConfig.batchSize;
      }

      if (newConfig.sourceCategory) {
        this.config.sourceCategory = newConfig.sourceCategory;
      }
    }
  }, {
    key: "batchReadyToSend",
    value: function batchReadyToSend() {
      if (this.config.batchSize === 0) {
        return this.config.interval === 0;
      } else {
        var pendingMessages = this.pendingLogs.reduce(function (acc, curr) {
          var log = JSON.parse(curr);
          return acc + log.msg + '\n';
        }, '');
        var pendingBatchSize = pendingMessages.length;
        var ready = pendingBatchSize >= this.config.batchSize;

        if (ready) {
          this.stopLogSending();
        }

        return ready;
      }
    }
  }, {
    key: "_postSuccess",
    value: function _postSuccess(logsSentLength) {
      this.pendingLogs = this.pendingLogs.slice(logsSentLength);
      this.logSending = false; // Reset interval if needed:

      this.startLogSending();
      this.config.onSuccess();
    }
  }, {
    key: "sendLogs",
    value: function sendLogs() {
      var _this = this;

      if (this.logSending || this.pendingLogs.length === 0) {
        return false;
      }

      try {
        this.logSending = true;
        var headers = {
          'X-Sumo-Client': 'sumo-javascript-sdk'
        };

        if (this.config.graphite) {
          _extends(headers, {
            'Content-Type': 'application/vnd.sumologic.graphite'
          });
        } else if (this.config.carbon2) {
          _extends(headers, {
            'Content-Type': 'application/vnd.sumologic.carbon2'
          });
        } else {
          _extends(headers, {
            'Content-Type': 'application/json'
          });
        }

        if (this.config.sourceName !== '') {
          _extends(headers, {
            'X-Sumo-Name': this.config.sourceName
          });
        }

        if (this.config.sourceCategory !== '') {
          _extends(headers, {
            'X-Sumo-Category': this.config.sourceCategory
          });
        }

        if (this.config.hostName !== '') {
          _extends(headers, {
            'X-Sumo-Host': this.config.hostName
          });
        }

        if (this.config.returnPromise && this.pendingLogs.length === 1) {
          return superagent.post(this.config.endpoint).set(headers).send(this.pendingLogs.join('\n')).then(marshalHttpResponse).then(function (res) {
            _this._postSuccess(1);

            return res;
          }).catch(function (error) {
            _this.config.onError(error);

            _this.logSending = false;
            return Promise.reject(error);
          });
        }

        var logsToSend = Array.from(this.pendingLogs);
        return superagent.post(this.config.endpoint).set(headers).send(logsToSend.join('\n')).then(marshalHttpResponse).then(function () {
          _this._postSuccess(logsToSend.length);
        }).catch(function (error) {
          _this.config.onError(error);

          _this.logSending = false;

          if (_this.config.returnPromise) {
            return Promise.reject(error);
          }
        });
      } catch (ex) {
        this.config.onError(ex);
        return false;
      }
    }
  }, {
    key: "startLogSending",
    value: function startLogSending() {
      var _this2 = this;

      if (this.config.interval > 0) {
        if (this.interval) {
          this.stopLogSending();
        }

        this.interval = setInterval(function () {
          _this2.sendLogs();
        }, this.config.interval);
      }
    }
  }, {
    key: "stopLogSending",
    value: function stopLogSending() {
      clearInterval(this.interval);
    }
  }, {
    key: "emptyLogQueue",
    value: function emptyLogQueue() {
      this.pendingLogs = [];
    }
  }, {
    key: "flushLogs",
    value: function flushLogs() {
      return this.sendLogs();
    }
  }, {
    key: "log",
    value: function log(msg, optionalConfig) {
      var _this3 = this;

      var message = msg;

      if (!message) {
        console.error('A value must be provided');
        return false;
      }

      var isArray = message instanceof Array;
      var testEl = isArray ? message[0] : message;

      var type = _typeof(testEl);

      if (type === 'undefined') {
        console.error('A value must be provided');
        return false;
      }

      if (this.config.graphite && (!Object.prototype.hasOwnProperty.call(testEl, 'path') || !Object.prototype.hasOwnProperty.call(testEl, 'value'))) {
        console.error('Both "path" and "value" properties must be provided in the message object to send Graphite metrics');
        return false;
      }

      if (this.config.carbon2 && (!Object.prototype.hasOwnProperty.call(testEl, 'intrinsic_tags') || !Object.prototype.hasOwnProperty.call(testEl, 'meta_tags') || !Object.prototype.hasOwnProperty.call(testEl, 'value'))) {
        console.error('All "intrinsic_tags", "meta_tags" and "value" properties must be provided in the message object to send Carbon2 metrics');
        return false;
      }

      if (type === 'object') {
        if (Object.keys(message).length === 0) {
          console.error('A non-empty JSON object must be provided');
          return false;
        }
      }

      if (!isArray) {
        message = [message];
      }

      var ts = new Date();
      var sessKey = this.config.session;
      var client = {
        url: this.config.clientUrl
      };

      if (optionalConfig) {
        if (Object.prototype.hasOwnProperty.call(optionalConfig, 'sessionKey')) {
          sessKey = optionalConfig.sessionKey;
        }

        if (Object.prototype.hasOwnProperty.call(optionalConfig, 'timestamp')) {
          ts = optionalConfig.timestamp;
        }

        if (Object.prototype.hasOwnProperty.call(optionalConfig, 'url')) {
          client.url = optionalConfig.url;
        }
      }

      var timestamp = formatDate(ts);
      var messages = message.map(function (item) {
        if (_this3.config.graphite) {
          return "".concat(item.path, " ").concat(item.value, " ").concat(Math.round(ts.getTime() / 1000));
        }

        if (_this3.config.carbon2) {
          return "".concat(item.intrinsic_tags, "  ").concat(item.meta_tags, " ").concat(item.value, " ").concat(Math.round(ts.getTime() / 1000));
        }

        if (_this3.config.raw) {
          return item;
        }

        if (typeof item === 'string') {
          return JSON.stringify(_extends({
            msg: item,
            sessionId: sessKey,
            timestamp: timestamp
          }, client));
        }

        var current = {
          sessionId: sessKey,
          timestamp: timestamp
        };
        return JSON.stringify(_extends(current, client, item));
      });
      this.pendingLogs = this.pendingLogs.concat(messages);

      if (!this.config.useIntervalOnly && this.batchReadyToSend()) {
        return this.sendLogs();
      }
    }
  }]);

  return SumoLogger;
}();

module.exports = SumoLogger;