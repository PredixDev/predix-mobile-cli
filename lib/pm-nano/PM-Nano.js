"use strict";

var Promise = require('bluebird'); Promise.longStackTraces();
var nano_factory = require('nano');
var nanoPromise_factory = require('nano-blue');
var NanoRepository = require('../nano-repository/index.js');
var AsyncUtil = require('../AsyncUtil.js');
var requestDefault = require('request');
var requestAsync = Promise.promisify(require('request'));
var RequestUtil = require('../http/RequestUtil.js');
var node_url = require('url');

/**
Logging
*/
var logger = require('../logging.js').general.valueOf();
var feedLogger = require('../logging.js').feed.valueOf();


function PM_Nano(url, bucketName, authHeaders) {
	
	var nanoBucketName = bucketName;
	var _re_bucketURIFix = new RegExp("/" + nanoBucketName + "$", "");
	
	// nano attempts to guess the bucket from the URL if a slash is present, therefore we extract the host and path, and specify the path before the use command:
	var fullURL = url;
	var baseURL = node_url.resolve(url, "/");
		
	var nanoConfig = { 
		  "url": baseURL
		, "requestDefaults": { 
			followAllRedirects: true // !!! refactor;  The nano library does not construct a correct POST URI (the trailing slash is missing), and this causes POST redirection.
		}
		, "request": _RequestFilter
		, "log": function () {
			logger.debug.apply(logger, arguments);
		}
	};
	
	function _RequestFilter(options, callback) {
		
		// include authorization headers:
		if (!options.headers) options.headers = {};
		var headers = options.headers;
		for (var key in authHeaders) {
			headers[key] = authHeaders[key];
		}
		
		// correct for document compound names which require a non-encoded slash:
		options.uri = options.uri
			.replace(/\/_user%2F/g, "/_user/")
			.replace(/\/_role%2F/g, "/_role/");

		// uncomment to view details of all requests to server from Nano:
		
		if (logger.level === "silly") {
			var traceOptions = JSON.parse(JSON.stringify(options));
			if (
				   traceOptions.headers 
				&& traceOptions.headers['content-type']
				&& ((traceOptions.headers['content-type'] + "").indexOf("application/json") > -1)
				&& (traceOptions.body && (typeof(traceOptions.body) === "string"))
			) { 
				traceOptions.body = JSON.parse(traceOptions.body);
			}
			logger.silly("[DEBUG] ------------- PM-Nano: _RequestFilter: request options: ", JSON.stringify(traceOptions, null, 4));
		}
		
		// Note: The SyncGateway uses a more strict REST interaction.  We filter for, and correct the default nano requests here. 
		if (_re_bucketURIFix.test(options.uri)) {
			options.uri += "/";

			if (options.method === "POST") {
				// Note: For the SyncGateway, A POST to the bucket does not currently allow updating a document (A 404 response is returned, where the existing document is not found.)  We correct for this here, by translating the POST to a PUT to the actual document ID.
				// This may be corrected in sync-gateway versions newer than v1.1.0.
				if ( 
					   (options.body.indexOf('"_rev"') > -1)
					|| (options.body.indexOf('"_id"') > -1)
				) { // We have what appears to be a document with an existing revision;  Translate to PUT.
					options.method = "PUT";
					var documentID = options.body.match(/"_id"\s*:\s*"(.*?)"/)[1];
					if (!documentID) {
						logger.error("Nano Request: Unable to re-route POST to PUT: document _id not found in document content:", options);
					}
					options.uri += documentID;
				}
			}
		}
		
		return requestDefault(options, function (error, response, body) {

			// uncomment to view details of all responses before they are handled by Nano:
			if (logger.level === "silly") {
				var traceBody = body;
				if (
					   response.headers
					&& traceBody 
					&& (typeof(traceBody) === "string")  
					&& (
						(
								response.headers['content-type'] 
							&& ((response.headers['content-type'] + "").indexOf("application/json") > -1)
						)
						|| (traceBody.indexOf("{") === 0) // text/plain may also be returned, with JSON content.
					) 
				) { 
					traceBody = JSON.parse(traceBody);
				}
				logger.silly("[DEBUG] ------------- PM-Nano: _RequestFilter: response: ", JSON.stringify(response, null, 4), "; Body: ", JSON.stringify(traceBody, null, 4));
			}
			
			// Note: The SyncGateway returns some CB Server error codes as 500.  We filter for, and correct these types here.
			if (
				   response 
				&& (response.statusCode.valueOf() === 500)
			) {
				// {"error": "Internal Server Error", "reason": "Internal error: Error reading view: 404 Object Not Found / {\"error\":\"not_found\",\"reason\":\"missing\"}\n"}
				var parsedBody = null;
				try { parsedBody = JSON.parse(body); } catch (err) { }
				if (parsedBody && parsedBody.reason) {
					var reason = parsedBody.reason;
					if (reason.indexOf("404 Object Not Found") > -1) {
						response.statusCode = 404;
					}

					// sync-gateway v1.1.0, when querying for design document existance:
					// This may be corrected in sync-gateway v1.2.0 or newer.
					// {"error":"Internal Server Error","reason":"Internal error: http: read on closed response body"} 
					if (reason.indexOf("Internal error: http: read on closed response body") === 0) {
						response.statusCode = 200;
					}

				}

			}

			callback(error, response, body);
		});
	}
	
	// configure database connection.
	var nano = nano_factory(nanoConfig);
	if (!nano.config.url) throw new Error("nano config url object not at expected location");
	nano.config.url = fullURL;
	
	var nanoBucket = nano.db.use(nanoBucketName);
	var repository = Promise.promisifyAll(new NanoRepository(nanoBucket));
	
	var nanoPromise = nanoPromise_factory(nanoConfig);
	if (!nanoPromise.config.url) throw new Error("nano config url object not at expected location");
	nanoPromise.config.url = fullURL;
	
	var nanoBucketAsync = nanoPromise.db.use(nanoBucketName);
	
	function GetNano() {
		return nanoBucketAsync;
	}
	
	function GetNanoNonPromise() {
		return nanoBucket;
	}
	
	function GetNanoRepository() {
		return repository;
	}
	
	// exports:
	this.GetNano = GetNano;
	this.GetNanoNonAsync = GetNanoNonPromise;
	this.GetNanoRepository = GetNanoRepository;
	
}

module.exports = PM_Nano;
