/**
 * Copyright 2014, 2016 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function(RED) {
	"use strict";

	var util = require("./lib/util.js");
	var cfenv = require("cfenv");
	var fs = require("fs");
        var isUtf8 = require('is-utf8');

	//var IoTAppClient = require("iotclient");
	var WIoTClient = require("ibmiotf");
	var APPLICATION_PUB_TOPIC_REGEX = /^iot-2\/(?:evt|cmd|mon)\/[^#+\/]+\/fmt\/[^#+\/]+$/;

	// Load the services VCAP from the CloudFoundry environment
	var appenv = cfenv.getAppEnv();
	var services = appenv.services || {};

	var userServices = services['iotf-service-staging'];

	if(userServices === null || userServices === undefined) {
		userServices = services	['iotf-service'];
	}

	if(userServices === null || userServices === undefined) {
	     userServices = services	['user-provided'];
	}

	// Store the IoT Cloud credentials, if any.
	var credentials = false;

	if (userServices) {
		for(var i = 0, l = userServices.length; i < l; i++){
			var service = userServices[i];
			if(service.credentials){
				if(service.credentials.iotCredentialsIdentifier){
					credentials = service.credentials;
					break;
				}
			}
		}
	}
	/*
	else {

		var data = fs.readFileSync("credentials.cfg"), fileContents;
		try {
			fileContents = JSON.parse(data);
			credentials = {};
			credentials.apiKey = fileContents.apiKey;
			credentials.apiToken = fileContents.apiToken;
			if(fileContents !== null && fileContents.mqtt_host) {
				credentials.mqtt_host = fileContents.mqtt_host;
			} else {
				RED.log.info("[ibm iot:function(RED)] Didnt find host");
			}


			if(fileContents !== null && fileContents.mqtt_u_port) {
				credentials.mqtt_u_port = fileContents.mqtt_u_port;
			} else {
				RED.log.info("[ibm iot:function(RED)] Didnt find u_port");
			}


			if(fileContents !== null && fileContents.mqtt_s_port) {
				credentials.mqtt_s_port = fileContents.mqtt_s_port;
			} else {
				RED.log.info("[ibm iot:function(RED)] Didnt find s_port");
			}


			if(fileContents !== null && fileContents.org) {
				credentials.org = fileContents.org;
			} else {
				RED.log.info("[ibm iot:function(RED)] Didnt find org");
			}

		}
		catch (ex){
			RED.log.info("[ibm iot:function(RED)] credentials.cfg doesn't exist or is not well formed, reverting to quickstart mode");
			credentials = null;
		}
	}
	*/

	RED.httpAdmin.get('/ibmiot/service', function(req,res) {
		if (credentials) {
			res.send(JSON.stringify({service:'registered', version: RED.version() }));
		} else {
			res.send(JSON.stringify({service:'quickstart', version: RED.version() }));
		}
	});

	function IotAppNode(n) {
		RED.nodes.createNode(this,n);
		this.name = n.name;
		this.keepalive = n.keepalive;
		this.cleansession = n.cleansession;
		this.appId = n.appId;
		this.shared = n.shared;

	}

	RED.nodes.registerType("ibmiot",IotAppNode, {
		credentials: {
			user: {type:"text"},
			password: {type:"password"}
		}
	});

	function setUpNode(node, nodeCfg, inOrOut){

		node.service = nodeCfg.service;
		node.authentication = nodeCfg.authentication;
		node.topic = nodeCfg.topic || "";

		node.allDevices = nodeCfg.allDevices;
		node.allApplications = nodeCfg.allApplications;
		node.allDeviceTypes = nodeCfg.allDeviceTypes;
		node.allEventsOrCommands = nodeCfg.allEventsOrCommands;
		node.allEvents = nodeCfg.allEvents;
		node.allCommands = nodeCfg.allCommands;
		node.allFormats = nodeCfg.allFormats;

		node.inputType = nodeCfg.inputType;
		node.outputType = nodeCfg.outputType;

		node.qos = parseInt(nodeCfg.qos) || 0;

		var newCredentials = null;
		if(nodeCfg.authentication === "apiKey") {
			 var iotnode = RED.nodes.getNode(nodeCfg.apiKey);
			 newCredentials = RED.nodes.getCredentials(iotnode.id);

			 // persist data from the node
			 node.keepalive = parseInt(iotnode.keepalive);
		     node.cleansession = iotnode.cleansession;
		     node.appId = iotnode.appId;
		     node.shared = iotnode.shared;
		}

		if(node.service !== "quickstart") {
			node.deviceType = ( node.allDeviceTypes ) ? '+' : nodeCfg.deviceType;
			node.format = ( node.allFormats ) ? '+' : nodeCfg.format;
		} else {
			node.deviceType = "nodered-version" + RED.version();
			node.format = "json";
			node.qos = 0;
			node.keepalive = 60;
			node.cleansession = true;
		}


		node.apikey = null;
		node.apitoken = null;
		nodeCfg.deviceId = nodeCfg.deviceId.trim().replace(/[^a-zA-Z0-9_\.\-]/gi, "");
		nodeCfg.deviceId = nodeCfg.deviceId.trim();

		node.deviceId = ( node.allDevices ) ? '+' : nodeCfg.deviceId;
		node.applicationId = ( node.allApplications ) ? '+' : nodeCfg.applicationId;

		if(newCredentials !== 'undefined' && node.authentication === 'apiKey') {
			node.apikey = newCredentials.user;
			node.apitoken = newCredentials.password;

			node.organization = node.apikey.split(':')[1];
			if(node.organization === 'undefined' || node.organization === null || typeof node.organization === 'undefined') {
				node.organization = node.apikey.split('-')[1];
			} else {
				node.error("Unable to retrieve the organization from API Key");
			}
	//		node.brokerHost = node.organization + ".messaging.staging.test.internetofthings.ibmcloud.com";
			node.brokerHost = node.organization + ".messaging.internetofthings.ibmcloud.com";
			node.brokerPort = 8883;
		} else if(credentials !== null && credentials !== 'undefined' && node.authentication === 'boundService') {
			node.apikey = credentials.apiKey;
			node.apitoken = credentials.apiToken;
			if(credentials.org) {
				node.organization = credentials.org;
			} else {
				node.organization = node.apikey.split(':')[1];
				if(node.organization === null) {
					node.organization = node.apikey.split('-')[1];
				}
			}
			if(credentials.mqtt_u_port !== 'undefined' || credentials.mqtt_u_port !== null ) {
				node.brokerPort = credentials.mqtt_u_port;
			} else if(credentials !== null && credentials.mqtt_s_port) {
				node.brokerPort = credentials.mqtt_s_port;
			} else {
				node.brokerPort = 8883;
			}

			if(credentials.mqtt_host !== 'undefined' || credentials.mqtt_host !== null) {
				node.brokerHost = credentials.mqtt_host;
			} else {
				node.brokerHost = node.organization + ".messaging.internetofthings.ibmcloud.com";
			}

		} else {
			node.organization = "quickstart";
			node.brokerHost = node.organization + ".messaging.internetofthings.ibmcloud.com";
			node.brokerPort = 1883;
			node.apikey = null;
			node.apitoken = null;
		}
		node.eventCommandType = ( node.allEventsOrCommands ) ? '+' : nodeCfg.eventCommandType;
		node.eventType = ( node.allEvents ) ? '+' : nodeCfg.eventType;
		node.commandType = ( node.allCommands ) ? '+' : nodeCfg.commandType;

		// if appId is not provided generate random.
		if(!node.appId) {
			node.appId = util.guid();
		}

		node.name = nodeCfg.name;
		try {
			var appClientConfig = {
				"org" : node.organization,
				"id" : node.appId,
				"auth-key" : node.apikey,
				"auth-token" : node.apitoken,
                                "domain" : node.brokerHost.substring(node.brokerHost.indexOf("messaging.") + "messaging.".length)
			};

			if(node.shared) {
				appClientConfig.type = "shared";
			}
			//console.log(appClientConfig);
			node.client = new WIoTClient.IotfApplication(appClientConfig);
			node.client.setKeepAliveInterval(node.keepalive);
			node.client.setCleanSession(node.cleansession);
			node.client.connect(node.qos);
			node.client.on('error',function(err) {
				node.error(err.toString());
			});

			node.client.on('connect',function() {
				node.status({fill:"green",shape:"dot",text:"node-red:common.status.connected"});
			});

			node.client.on('disconnect',function() {
				node.status({fill:"red",shape:"ring",text:"node-red:common.status.disconnected"});
			});

			node.client.on('reconnect',function() {
				node.status({fill:"green",shape:"dot",text:"node-red:common.status.connected"});
			});

			node.on("close", function() {
				if (node.client) {
					node.client.disconnect();
				}
			});

			node.status({fill:"yellow",shape:"ring",text:"node-red:common.status.connecting"});
			if (node.client.isConnected) {
				node.status({fill:"green",shape:"dot",text:"node-red:common.status.connected"});
			}

		}
		catch(err) {
			node.error("Watson IoT client configuration: " + err.toString());
		}


	}


	function IotAppOutNode(n) {
		RED.nodes.createNode(this, n);
		setUpNode(this, n, "out");

		if (!this.client) {
			return;
		}
		var that = this;

		this.on("input", function(msg) {
			var payload = msg.payload || n.data;
			var deviceType = that.deviceType;
                        var qos = 0;
                        if (msg.qos) {
                           msg.qos = parseInt(msg.qos);
                        if ((msg.qos !== 0) && (msg.qos !== 1) && (msg.qos !== 2)) {
                           msg.qos = null;
                         }
                        }
                        qos = Number(that.qos || msg.qos || qos);
			if(that.service === "registered") {
				deviceType = msg.deviceType || n.deviceType;
			}
			var topic = "iot-2/type/" + deviceType +"/id/" + (msg.deviceId || n.deviceId) + "/" + n.outputType + "/" + (msg.eventOrCommandType || n.eventCommandType) +
				"/fmt/" + (msg.format || n.format);

			if (msg !== null && (n.service === "quickstart" || n.format === "json") ) {
				try {
					if(typeof payload !== "object") {
						// check the validity of JSON format
						JSON.parse(payload);
					}
					if(n.outputType === "evt") {
						this.client.publishDeviceEvent(deviceType, (msg.deviceId || n.deviceId), (msg.eventOrCommandType || n.eventCommandType), (msg.format || n.format), payload, qos);
					} else if(n.outputType === "cmd") {
						this.client.publishDeviceCommand(deviceType, (msg.deviceId || n.deviceId), (msg.eventOrCommandType || n.eventCommandType), (msg.format || n.format), payload, qos);
					} else {
						that.warn("Shouldn't have come here as it can either be a command or an event");
					}
				}
				catch (error) {
					if(error.name === "SyntaxError") {
						that.error("JSON Message expected");
					} else {
						that.warn("Either MQTT Client is not fully initialized (please wait) or non-JSON message has been sent");
					}

				}
			} else if(msg !== null) {
				try {
					if(n.outputType === "evt") {
						this.client.publishDeviceEvent(deviceType, (msg.deviceId || n.deviceId), (msg.eventOrCommandType || n.eventCommandType), (msg.format || n.format), payload,qos);
					} else if(n.outputType === "cmd") {
						this.client.publishDeviceCommand(deviceType, (msg.deviceId || n.deviceId), (msg.eventOrCommandType || n.eventCommandType), (msg.format || n.format), payload,qos);
					} else {
						that.warn("Shouldn't have come here as it can either be a command or an event");
					}
				}
				catch (err) {
					that.warn("MQTT Client is not fully initialized for out node - please wait");
				}
			}
		});
	}

	RED.nodes.registerType("ibmiot out", IotAppOutNode);


	function IotAppInNode(n) {

		RED.nodes.createNode(this, n);
		setUpNode(this, n, "in");

		if (!this.client) {
			return;
		}

		var that = this;

			try {
				if(that.inputType === "evt" ) {

					if(n.service === "quickstart") {
						that.deviceType = "+";
					}
					//This condition has been added as by default the device id field is blank
					//and this causes multiple subscription attempts when the default flow is created in Bluemix
					if(n.service === "quickstart" && (that.deviceId === null || that.deviceId === '') ) {
						that.warn("Device Id is not set for Quickstart flow");
					} else {
						that.client.on("connect", function () {
							that.client.subscribeToDeviceEvents(that.deviceType, that.deviceId, that.eventType, that.format,that.qos);
						});

						this.client.on("deviceEvent", function(deviceType, deviceId, eventType, format, payload, topic) {
							var parsedPayload = "";
							if ( format === "json" ){
								try{
									parsedPayload = JSON.parse(payload.toString());
									var msg = {"topic":topic, "payload":parsedPayload, "deviceId" : deviceId, "deviceType" : deviceType, "eventType" : eventType, "format" : format};
									that.send(msg);
								}catch(err){
									that.warn("JSON payload expected");
								}
							} else {
								try {
									// Using a similar technique that Node.js MQTT uses to find the content
									// whether its a buffer or not
									if (isUtf8(payload)) { payload = payload.toString(); }
									var msg = {"topic":topic, "payload":payload, "deviceId" : deviceId, "deviceType" : deviceType, "eventType" : eventType, "format" : format};
									that.send(msg);
								}catch(err){
									that.warn("payload type unexpected");
								}
							}
						});
					}
				} else if (that.inputType === "devsts") {

					var deviceTypeSubscribed = this.deviceType;

					if(this.service === "quickstart") {
						deviceTypeSubscribed = "+";
					}
					that.client.on("connect", function () {
						that.client.subscribeToDeviceStatus(that.deviceType, that.deviceId, that.qos);
					});

					this.client.on("deviceStatus", function(deviceType, deviceId, payload, topic) {
						var parsedPayload = "";
						try{
							parsedPayload = JSON.parse(payload);
						}catch(err){
							parsedPayload = payload;
						}
						var msg = {"topic":topic, "payload":parsedPayload, "deviceId" : deviceId, "deviceType" : deviceType};
						that.send(msg);
					});

				} else if (that.inputType === "appsts") {
					that.client.on("connect", function () {
						that.client.subscribeToAppStatus(that.applicationId, that.qos);
					});

					this.client.on("appStatus", function(appId, payload, topic) {

						var parsedPayload = "";

						try{
							parsedPayload = JSON.parse(payload);
						}catch(err){
							parsedPayload = payload;
						}
						var msg = {"topic":topic, "payload":parsedPayload, "applicationId" : appId};
						that.send(msg);
					});

				} else if (that.inputType === "cmd") {

					that.client.on("connect", function () {
						that.client.subscribeToDeviceCommands(that.deviceType, that.deviceId, that.commandType, that.format, that.qos);
					});

					this.client.on("deviceCommand", function(deviceType, deviceId, commandType, formatType, payload, topic) {

						var parsedPayload = "";
						if ( that.format === "json" ){
							try{
								parsedPayload = JSON.parse(payload);
								var msg = {"topic":topic, "payload":parsedPayload, "deviceId" : deviceId, "deviceType" : deviceType, "commandType" : commandType, "format" : formatType};
								that.send(msg);
							}catch(err){
								that.warn("JSON payload expected");
							}
						} else {
							try{
								parsedPayload = JSON.parse(payload);
							}catch(err){
								parsedPayload = new Buffer(payload);
							}
							var msg = {"topic":topic, "payload":parsedPayload, "deviceId" : deviceId, "deviceType" : deviceType, "commandType" : commandType, "format" : formatType};
							that.send(msg);
						}
					});
				}
			} catch(err) {
				that.warn("MQTT Client is not fully initialized for in node - please wait");
			}
	}

	RED.nodes.registerType("ibmiot in", IotAppInNode);
};
