"use strict";

var Promise_flowthen_init = require('./bluebird-flowthen.js'); 
var winston = require('winston-lm');
var Promise = require('bluebird'); Promise.longStackTraces();

var _default_log_level = 'info';
var isDebugSpecified = (process.argv || []).indexOf("--debug") > -1;
var isVerboseSpecified = (process.argv || []).indexOf("--verbose") > -1;
if (isVerboseSpecified) {
    _default_log_level = 'debug';
} else if (isDebugSpecified) {
    _default_log_level = 'silly';
}

var feedLogger = new winston.Logger({
    transports: [
		new (winston.transports.Console)(),
	]
	, exitOnError: false
    , level: _default_log_level
});

(function () { // Prepare feedLogger for use with Follow stream library.
    process.env.follow_log_level = 'debug'; // Increase log level for nano follow component.
    var _logLevel = feedLogger.level;
    feedLogger.level = {
    	  valueOf: function () { return _logLevel; }
    	, levelStr: _logLevel
    };
    if (!feedLogger.setLevel) feedLogger.setLevel = function () {};
})();

var _general = new winston.Logger({
    transports: [
        new (winston.transports.Console)(),
    ]
    , exitOnError: false
    , level: _default_log_level
});

module.exports = {
      SanitizeTrace: SanitizeTrace
    , ErrorAndReject: ErrorAndReject
    , general: _general
    , feed: feedLogger
};

// process methods:
function SanitizeTrace(err) {
    if (err === null || err === void(0)) return err;
    
    var stack = err.stack;
    if (stack) {
        return stack;
    }
    
    try {
        return JSON.parse(JSON.stringify(err));
    } catch (err) {
        module.exports.general.error("SanitizeTrace: error in duplication:", err);
        return "__ERROR_IN_DUPLICATION__";
    }
}

function ErrorAndReject(msg) {
    _general.error(msg);
    return Promise.reject({error: msg});
}



