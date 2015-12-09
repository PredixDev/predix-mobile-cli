"use strict";
/**
 * Enable implicit-flow path of Promises;  No explicit return value from a function, is equivalent to passing forward the input parameters.  
 */

var Promise = require('bluebird');

if (Promise.prototype.__flowthen_patched !== true) {
	
	var __then_base = Promise.prototype._then; 
	Promise.prototype._then = function (
		didFulfill,
		didReject,
		didProgress,
		receiver,
		internalData
	) {
	
		if (didFulfill) didFulfill = _FlowReturnWrap.apply(this, [didFulfill]);
		if (didReject) didReject = _FlowReturnWrap.apply(this, [didReject, true]);
		if (didProgress) didProgress = _FlowReturnWrap.apply(this, [didProgress]);
	
		return __then_base.apply(this, [
				didFulfill,
				didReject,
				didProgress,
				receiver,
				internalData
			]);
	};
	
	var __spread_base = Promise.prototype.spread;
	Promise.prototype.spread = function (didFulfill, didReject) {
		
		if (didFulfill) didFulfill = _FlowReturnWrap_Spread(didFulfill);
		if (didReject) didReject = _FlowReturnWrap_Spread(didReject, true);
		
		var result = __spread_base.apply(this, [didFulfill, didReject]);
		return result;
	};
	
	Promise.prototype.__flowthen_patched = true;
}

// process methods:
function _FlowReturnWrap_Spread(handler, isRejectHandler) {
	return function spread_filter() {
		// !!! TEMP: there appears to be an issue in the Promise library handling of sequential spread handlers, where a resolved promise of an array from a success handler, immediately sent into an error handler path, returns to the normal promise path, instead of promise_array path.  To compensate for this at this time, we unwrap the value, if it appears this is the case.  We will file a bug to notify Bluebird.  Further, the issue is obviated by the new ES6 language extensions.
		var didAdjust = false;
		var args = arguments;
		if (
  			   (args.length === 1) 
			&& args[0]
			&& ('length' in args[0])
		) {
			args = args[0];
			didAdjust = true;
		}
		var result = handler.apply(this, args);
		
		if (didAdjust) {
			if (result === void(0)) {
				if (isRejectHandler) {
					return Promise.reject(args);
				} else {
					return Promise.resolve(args);
				}
			}
		}
		
		return result;
	};
}
function _FlowReturnWrap(handler, isRejectHandler) {
	
	return function response_filter() {
	
		// do not proxy for internal PromiseArray class, which smuggles in additional arguments which do not count as part of the normal flow of data.
		if (
			   this 
			&& this.constructor 
			&& (this.constructor.toString().indexOf("function PromiseArray") > -1)
		) {
			return handler.apply(this, arguments);
		}

		// uncomment to trace every Promise resolution in the system:
		// console.log("[DEBUG] _FlowReturnWrap: arguments:", arguments, "; handler:", handler);
		
		// CHROME BUG: Chrome versions <= 46 appears to re-use the arguments array, as in testing it changes from the beginning of this function to the end;  We copy the array here to avoid this issue.
		var len = arguments.length;  
		var list = [];
		for (var i = 0; i < len; i++) list.push(arguments[i]);
		
		var result = handler.apply(this, list)
		if (result === void(0)) {	
			if (len === 0) {
				if (isRejectHandler) {
					return Promise.reject(void(0));
				} else {
					return void(0);
				}
			}
			if (len === 1) {
				var returnItem = list[0];
				if (isRejectHandler) {
					if (returnItem && (returnItem.then !== null)) {
						return returnItem;
					}
					return Promise.reject(returnItem);
				} else {
					return returnItem;
				}
			}
			
			if (isRejectHandler) {
				return Promise.reject(list);
			} else {
				return list;
			}
		}
		return result;
	};
}



