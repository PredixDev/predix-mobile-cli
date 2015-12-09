"use strict";

// --- imports
var Promise = require('bluebird');

// --- logging
var logger = require('./logging.js').general.valueOf();

/**
Promise retry program;  automatic exponential backoff;  retry limit.
*/
function RetryUntil(retrySettings, fn) {

	if (typeof(retrySettings) === "function") {
		fn = retrySettings;
		retrySettings = null;
	}

    if (!retrySettings) {
        retrySettings = {};
    }

    if (typeof(retrySettings) === "number") {
        retrySettings = {retry: retrySettings};
    }

    var retryCount = retrySettings.retry || 3;
    var maxRetryDelay = retrySettings.maxDelay || 16;

    var currentDelay = 0;
    var tryCount = 0;

    return tryNow();

    function tryNow() {
        return fn()
        .catch(function (status) {
            tryCount++;
            if (
                   (retryCount !== -1) // permit indefinite retry.
                && (tryCount > retryCount)
            ) {
            	logger.warn("RetryUntil: Fault received;  Retry limit reached:", retryCount, "; Error detail:", status);
                return;
            }

            currentDelay = Math.max(Math.pow(2, tryCount), maxRetryDelay) * 1000;

            logger.warn("RetryUntil: Fault received;  Retrying with delay:", currentDelay, "; Error detail:", status);

            return Promise.delay(currentDelay).then(function () {
                return tryNow();
            })
        });
    }
}

// exports
var e = module.exports;

e.RetryUntil = RetryUntil;

