
'use strict';

function RouterConfiguration(document) {
	
	function GetCommandProcessors() {
		return document.COMMAND_PROCESSORS.valueOf();
	}
	
	function GetServiceMapping() {
		return document.SERVICE_MAPPING.valueOf();
	}
	
	// exports
	this.GetCommandProcessors = GetCommandProcessors;
	this.GetServiceMapping = GetServiceMapping;
	
}

module.exports = RouterConfiguration;
