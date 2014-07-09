/**
 * Copyright 2014 IBM Corp.
 * 
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 * 
 * http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

var RED = require(process.env.NODE_RED_HOME + "/red/red");
var util = require("util");
var connectionPool = require(process.env.NODE_RED_HOME
		+ "/nodes/core/io/lib/mqttConnectionPool");

var macAddress;

require('getmac').getMac(function(err, mac) {
	if (err) {
		console.error("getmac module not installed. Please install by 'npm install getmac'");
		throw err;
	}
	macAddress = mac.toLowerCase().replace(/-/g, "").replace(/:/g, "");


var DEVICE_PUBLISH_TOPIC = "iot-2/evt/status/fmt/json";
var QUICKSTART_HOST = "quickstart.messaging.internetofthings.ibmcloud.com";
var REGIS_HOST = "messaging.internetofthings.ibmcloud.com";

function setupConnection(node, config) {

	var clientId;
	
	util.log("[iot-dev] The connect mode is "+config.connectmode);
	if(config.connectmode == "qsmode") {
		// Quickstart Mode
		node.brokerHost = QUICKSTART_HOST;
		node.brokerPort = "1883";
	
		node.organization = "quickstart";	// Hardcoding to Quickstart
		node.typeId = config.deviceType || "iotsample-nodered";
		node.deviceId = config.deviceId || macAddress;
	
		util.log("[iot-dev] Connecting to host : " + node.brokerHost + " port : "+node.brokerPort);
	
		clientId = "d:" + node.organization + ":" + node.typeId + ":"
		+ node.deviceId;
		util.log("[iot-dev] with client ID : "+clientId);
		node.client = connectionPool.get(node.brokerHost, node.brokerPort,
				clientId, null, null);
		
	} else {
		//Registered Mode
		node.brokerHost = config.orgId +"."+REGIS_HOST;
		node.brokerPort = "1883";
	
		node.organization = config.orgId;
		node.typeId = config.deviceType || "iotsample-nodered";
		node.deviceId = config.deviceId || macAddress;
		
		//Auth
		node.authMethod = "use-token-auth";	//Hardcording it now
		node.authToken = config.authToken;
	
		util.log("[iot-dev] Connecting to host : " + node.brokerHost + " port : "+node.brokerPort + " using the Auth-Token");
	
		clientId = "d:" + node.organization + ":" + node.typeId + ":"
		+ node.deviceId;
		util.log("[iot-dev] with client ID : "+clientId);
		node.client = connectionPool.get(node.brokerHost, node.brokerPort,
				clientId, node.authMethod, node.authToken);
		
	}

	node.client.connect();
	
	
	node.on("close", function() {
		if (node.client) {
			node.client.disconnect();
		}
	});
}

function IotDevInNode(n) {
	RED.nodes.createNode(this, n);
	setupConnection(this, n);
	
	var command = n.command || "+";
	var format = n.format || "+";

	var topic = "";
	
	topic = "iot-2/cmd/" + command + "/fmt/" + format ;
	
	util.log("[Dev-In] Subscribing to topic : " + topic);
	
	var that = this;
	if (topic) {
		this.client.subscribe(topic, 0, function(topic1, payload, qos,
				retain) {
			util.log("[Dev-In] Received MQTT message: " + payload);
			//extract the command and pass it on.
			var tokens = topic1.split("/");
			var commandTopic = tokens[2];
			util.log("[Dev-In] Received command: " + commandTopic);
			// if topic string ends in "json" attempt to parse. If fails, just
			// pass through as string.
			// if topic string ends in anything other than "json" just pass
			// through as string.
			var parsedPayload = "";
			if (/json$/.test(topic1)) {
				try {
					parsedPayload = JSON.parse(payload);
				} catch (err) {
					parsedPayload = payload;
				}
			} else {
				parsedPayload = payload;
			}

			var msg = {
				"topic" : topic1,
				"command" : commandTopic,
				"payload" : parsedPayload
			};
			that.send(msg);
		});
	}
}

RED.nodes.registerType("iot-dev-in", IotDevInNode);

function IotDevOutNode(n) {
	RED.nodes.createNode(this, n);

	// based on QS or Regis mode, setup connection
	setupConnection(this, n);

	this.on("input", function(msg) {
		util.log("[Dev-Out] Message : "+msg.payload);

		msg.topic = DEVICE_PUBLISH_TOPIC;
		
		this.client.publish(msg);

	});
}

RED.nodes.registerType("iot-dev-out", IotDevOutNode);

});