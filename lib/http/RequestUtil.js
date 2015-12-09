"use strict";

var Promise = require('bluebird');
var URL = require('url');

/**
 Simple utility for appending sequential path segments.  If an argument is an object and not a string, it is iterated across as a query string parameter map.
 Example:
 ```
 console.log(RequestUtil.ResolveURL('http://localhost:8080', '/predixgo', '_changes', {since: 1400}));
 //'http://localhost:8080/predixgo/_changes?since=1400'
 ```
 */
function ResolveURL() {
	var base = arguments[0];
	var len = arguments.length;
	var queryString = '';
	for (var i = 1; i < len; i++) {
		var path = arguments[i];

		if (typeof(path) === 'object') {
			for (var key in path) {
				if (queryString.length > 0) queryString += '&';
				queryString += key + '=' + path[key];
			}
			continue;
		}

		if (path && path.indexOf('/') !== 0) path = '/' + path;
		if (base.substr(base.length - 1) === '/') base = base.substr(0, base.length - 1);
		base += path;
	}

	if (queryString.length > 0) base += '?' + queryString;
	return base;
}

function BaseURL(url) {
	var struct = URL.parse(url);
	var removeList = ["pathname", "search", "path", "query", "hash"];
	var len = removeList.length;
	for (var i = 0; i < len; i++) {
		delete struct[removeList[i]];
	}
	return URL.format(struct);
}

// exports
var e = module.exports;

e.ResolveURL = ResolveURL;
e.BaseURL = BaseURL;
