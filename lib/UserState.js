'use strict';

var Preferences = require("preferences");

// initialize default user state:
var userState = new Preferences('com.ge.predix.pm', {
	target: {
		api: null
	}
	, uaa: {
		
	}
});

module.exports = userState;