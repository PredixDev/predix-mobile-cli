'use strict';

var Promise = require('bluebird'); Promise.longStackTraces();
var requestDefault = require('request');
var requestAsync = Promise.promisify(require('request'));

var Logging = require('../logging.js');
var logger = Logging.general.valueOf();

function GetResource(method, uri, headers, requestOptions) {
	
	if (!requestOptions) requestOptions = {};
	
	if (!headers) headers = {};
	
	if (!headers["user-agent"] && !headers["User-Agent"]) headers["User-Agent"] = "pm-cli 1.0";
	if (!headers.accept && !headers.Accept) headers.Accept = "application/json";
	
	if (!headers["content-type"] && !headers["Content-Type"]) {
		if ('form' in requestOptions) {
			headers["Content-Type"] = "application/x-www-form-urlencoded";
		} else if (
			   requestOptions.json 
			|| requestOptions.data
		) {
			headers["Content-Type"] = "application/json";
		}
	}
	
	var options = {
		  method: method
		, url: uri
		, headers: headers
	};
	
	for (var key in requestOptions) {
		options[key] = requestOptions[key];
	}
	
	logger.silly("[DEBUG] ------------- HTTP-Util: GetResource: request options:", JSON.stringify(options, null, 4));

	return requestAsync(options)
	.spread(function(response, body) {
		
		var contentType = response.headers["content-type"];
		if (contentType && (contentType.indexOf("application/json") > -1)) {
			if (typeof(body) === "string") {
				body = JSON.parse(body);
			}
		}
		
		var status = response.statusCode.valueOf();
		if (status < 200 || status > 299) {
			return Promise.reject([response, body]);
		}
		
		logger.silly("[DEBUG] ------------- HTTP-Util: GetResource: response: ", JSON.stringify(response, null, 4), "; Body: ", JSON.stringify(body, null, 4));
		
		return Promise.resolve([response, body]);
	})
	.spread(null, function(response, body) {
		logger.warn(
			  "GetResource: Error response received:"
			, "Input options:"
			, Logging.SanitizeTrace(options)
			, "\n------- Error response:"
			, Logging.SanitizeTrace(body || response)
		);
	});
}

// exports:
var c = {};
c.GetResource = GetResource;

module.exports = c;