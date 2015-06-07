/**
 * Copyright 2014 IBM Corp.
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

var RED = require(process.env.NODE_RED_HOME + "/red/red");
var connectionPool = require(process.env.NODE_RED_HOME + "/nodes/core/io/lib/mqttConnectionPool");
var util = require("./lib/util.js");
//var cfEnv = require("cf-env");
var cfenv = require("cfenv");
//var fs = require("fs");
var IoTAppClient = require("iotclient");

var APPLICATION_PUB_TOPIC_REGEX = /^iot-2\/(?:evt|cmd|mon)\/[^#+\/]+\/fmt\/[^#+\/]+$/;

// Load the services VCAP from the CloudFoundry environment
//var services = cfEnv.getCore().services || {};

// Load the services VCAP from the CloudFoundry environment
var appenv = cfenv.getAppEnv();
var services = appenv.services || {};

var userServices = services['iotf-service-staging'];

if(userServices === null || userServices === undefined) {
	console.log("iotf-service-staging credentials not obtained...");
	userServices = services	['iotf-service'];
} else {
	console.log("iotf-service-staging credentials obtained...");
}

if(userServices === null || userServices === undefined) {
	console.log("neither iotf-service nor iotf-service-staging credentials were obtained...");
	userServices = services	['user-provided'];
} else {
	console.log("iotf-service-staging or iotf-service credentials obtained...");
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
			console.log("Didnt find host");
		}
		

		if(fileContents !== null && fileContents.mqtt_u_port) {
			credentials.mqtt_u_port = fileContents.mqtt_u_port;
		} else {
			console.log("Didnt find u_port");
		}

		
		if(fileContents !== null && fileContents.mqtt_s_port) {
			credentials.mqtt_s_port = fileContents.mqtt_s_port;
		} else {
			console.log("Didnt find s_port");
		}

		
		if(fileContents !== null && fileContents.org) {
			credentials.org = fileContents.org;
		} else {
			console.log("Didnt find org");
		}

	}
	catch (ex){
		console.log("credentials.cfg doesn't exist or is not well formed, reverting to quickstart mode");
		credentials = null;
	}
}
*/

RED.httpAdmin.get('/iotFoundation/credential', function(req,res) {
	console.log("Credentials asked for by In node....");
	res.send("", credentials ? 200 : 403);
});


RED.httpAdmin.get('/iotFoundation/newcredential', function(req,res) {
	console.log("Credentials asked for by Out node....");
	if (credentials) {
		res.send(JSON.stringify({service:'registered', version: RED.version() }));
	} else {
		res.send(JSON.stringify({service:'quickstart', version: RED.version() }));
	}
});

function IotAppNode(n) {
	RED.nodes.createNode(this,n);
	this.name = n.name;
	var newCredentials = RED.nodes.getCredentials(n.id);
	if (newCredentials) {
		this.username = newCredentials.user;
		console.log("Username = " + this.username);
		this.password = newCredentials.password;
	}
}

RED.nodes.registerType("ibmiot",IotAppNode);

//var querystring = require('querystring');
//
RED.httpAdmin.get('/ibmiot/:id',function(req,res) {
	var newCredentials = RED.nodes.getCredentials(req.params.id);
	if (newCredentials) {
//		console.log("IN GET ");
		res.send(JSON.stringify({user:newCredentials.user,hasPassword:(newCredentials.password && newCredentials.password!="")}));
	} else {
		res.send(JSON.stringify({}));
	}
});

RED.httpAdmin.delete('/ibmiot/:id',function(req,res) {
//	console.log("IN DELETE ");
	RED.nodes.deleteCredentials(req.params.id);
	res.send(200);
});

RED.httpAdmin.post('/ibmiot/:id',function(req,res) {
//	console.log("IN POST ");
//	var body = "";
//	req.on('data', function(chunk) {
//		body += chunk;
//	});
//	req.on('end', function(){
//		var newCreds = querystring.parse(body);
//		var newCredentials = RED.nodes.getCredentials(req.params.id)||{};
//		if (newCreds.user == null || newCreds.user == "") {
//			delete newCredentials.user;
//		} else {
//			newCredentials.user = newCreds.user;
//		}
//		if (newCreds.password == "") {
//			delete newCredentials.password;
//		} else {
//			newCredentials.password = newCreds.password || newCredentials.password;
//		}
//		RED.nodes.addCredentials(req.params.id, newCredentials);
//		res.send(200);
//	});
	var newCreds = req.body;
	var newCredentials = RED.nodes.getCredentials(req.params.id)||{};
	if (newCreds.user == null || newCreds.user == "") {
		delete newCredentials.user;
	} else {
		newCredentials.user = newCreds.user;
	}
	if (newCreds.password == "") {
		delete newCredentials.password;
	} else {
		newCredentials.password = newCreds.password || newCredentials.password;
	}
	RED.nodes.addCredentials(req.params.id, newCredentials);
	res.send(200);
});


function setUpNode(node, nodeCfg, inOrOut){
    // Create a random appId
    var appId = util.guid();
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

	var newCredentials = null;
	if(nodeCfg.authentication === "apiKey") {
		 var iotnode = RED.nodes.getNode(nodeCfg.apiKey);
//		 console.log("IoTNode Name is " + iotnode.name );

//		 console.log("IoTNode Id is " + iotnode.id );
		 newCredentials = RED.nodes.getCredentials(iotnode.id);		 
//		 console.log("IoTNode APIKey is " + newCredentials.user );
//		 console.log("IoTNode APIToken is " + newCredentials.password );
	}

	if(node.service !== "quickstart") {
		node.deviceType = ( node.allDeviceTypes ) ? '+' : nodeCfg.deviceType;
		node.format = ( node.allFormats ) ? '+' : nodeCfg.format;
	} else {
		console.log("ITS A QUICKSTART FLOW");
		node.deviceType = "nodered-version" + RED.version();
		node.format = "json";
	}


	node.apikey = null;
	node.apitoken = null;
	console.log("Before trimming deviceId = " + nodeCfg.deviceId );
	nodeCfg.deviceId = nodeCfg.deviceId.trim().replace(/[^a-zA-Z0-9_\.\-]/gi, "");
	nodeCfg.deviceId = nodeCfg.deviceId.trim();

	console.log("After trimming deviceId = " + nodeCfg.deviceId );
	node.deviceId = ( node.allDevices ) ? '+' : nodeCfg.deviceId;
	node.applicationId = ( node.allApplications ) ? '+' : nodeCfg.applicationId;	
//	node.format = ( node.allFormats ) ? '+' : nodeCfg.format;

	if(newCredentials !== 'undefined' && node.authentication === 'apiKey') {
		node.apikey = newCredentials.user;
		node.apitoken = newCredentials.password;

		node.organization = node.apikey.split(':')[1];
		console.log("Organization obtained from switch = " + node.organization);
		if(node.organization === 'undefined' || node.organization === null || typeof node.organization === 'undefined') {
			node.organization = node.apikey.split('-')[1];
			console.log("Organization parsed again and obtained from switch " + node.organization);
		} else {
			console.log("UNABLE TO SPLIT");
		}
//		node.brokerHost = node.organization + ".messaging.staging.test.internetofthings.ibmcloud.com";
		node.brokerHost = node.organization + ".messaging.internetofthings.ibmcloud.com";
		node.brokerPort = 1883;	
	} else if(credentials !== null && credentials !== 'undefined' && node.authentication === 'boundService') {
		node.apikey = credentials.apiKey;
		node.apitoken = credentials.apiToken;
		if(credentials.org) {
			node.organization = credentials.org;
//			console.log("credentials.org exists..............");
		} else {
			node.organization = node.apikey.split(':')[1];
			console.log("Organization = " + node.organization);
			if(node.organization === null) {
				node.organization = node.apikey.split('-')[1];
				console.log("Organization parsed again and is " + node.organization);
			}
		}
		if(credentials.mqtt_u_port !== 'undefined' || credentials.mqtt_u_port !== null ) {
			node.brokerPort = credentials.mqtt_u_port;
		} else if(credentials !== null && credentials.mqtt_s_port) {
			node.brokerPort = credentials.mqtt_s_port;		
		} else {
			node.brokerPort = 1883;		
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

	if(inOrOut === "in") {
		console.log("InNode ");
		node.clientId = "a:" + node.organization + ":" + appId;

		if(node.inputType === "evt" || node.inputType === "cmd") {
			if(node.service !== "quickstart") {
				if(node.inputType === "evt") {
					node.topic = "iot-2/type/" + node.deviceType +"/id/" + node.deviceId + "/" + node.inputType + "/" + node.eventType +"/fmt/" + node.format;					
				} else {
					node.topic = "iot-2/type/" + node.deviceType +"/id/" + node.deviceId + "/" + node.inputType + "/" + node.commandType +"/fmt/" + node.format;					
				}

			}else {
				node.topic = "iot-2/type/+/id/" + node.deviceId + "/" + node.inputType + "/" + node.eventType +"/fmt/" + node.format;
			}
		} else if(node.inputType === "devsts") {
			node.topic = "iot-2/type/+/id/" + node.deviceId + "/mon";
		} else if(node.inputType === "appsts") {
			node.topic = "iot-2/app/" + node.applicationId + "/mon";
		} else {
			node.topic = "iot-2/app/" + node.deviceId + "/mon";
		}
	}
	else if(inOrOut === "out") {
		console.log("OutNode ");
		node.clientId = "a:" + node.organization + ":" + appId;
		node.topic = "iot-2/type/" + node.deviceType +"/id/" + node.deviceId + "/" + node.outputType + "/" + node.eventCommandType +"/fmt/" + node.format;
	}
	else {
		console.log("CANT COME HERE AT ALL");
	}
	

	node.name = nodeCfg.name;
	
    console.log('	Authentication: '		+ node.authentication);
    console.log('	Organization: '			+ node.organization);
    console.log('	Client ID: '			+ node.clientId);
    console.log('	Broker Host: '			+ node.brokerHost);
    console.log('	Broker Port: '			+ node.brokerPort);
    console.log('	Topic: '				+ node.topic);
    console.log('	InputType: '			+ node.inputType);
    console.log('	OutputType: '			+ node.outputType);
    console.log('	Device Id: '			+ node.deviceId);
    console.log('	Application Id: '		+ node.applicationId);    
    console.log('	Name: '					+ node.name);
    console.log('	Format: '				+ node.format);
	console.log('	Event/Command Type: '	+ node.eventCommandType);
	console.log('	Event Type: '			+ node.eventType);	
	console.log('	Command Type: '			+ node.commandType);	
	console.log('	DeviceType: '			+ node.deviceType);
	console.log('	Service: '				+ node.service);

	try {
		node.client = new IoTAppClient(appId, node.apikey, node.apitoken, node.brokerHost);
		node.client.connectBroker(node.brokerPort);
	}
	catch(err) {
		console.log(' IoTAppClient not has yet been initialized.... '); 
	}

    node.on("close", function() {
        if (node.client) {
            node.client.disconnectBroker();
        }
    });

/*
	node.on("error", function() {
		console.error(' IoTAppClient not yet initialized.... ');
	});
*/
}


function IotAppOutNode(n) {
    RED.nodes.createNode(this, n);
    setUpNode(this, n, "out");

	var that = this;

    this.on("input", function(msg) {
//		console.log("\n\n\nn.data = " + n.data + "\tmsg.payload = " + msg.payload + "\tmsg.deviceType = " + msg.deviceType + "\tn.deviceType" + n.deviceType);
		var payload = msg.payload || n.data;
		var deviceType = that.deviceType;
		if(that.service === "registered") {
			deviceType = msg.deviceType || n.deviceType;
		}
		var topic = "iot-2/type/" + deviceType +"/id/" + (msg.deviceId || n.deviceId) + "/" + n.outputType + "/" + (msg.eventOrCommandType || n.eventCommandType) +
			"/fmt/" + (msg.format || n.format);

        if (msg !== null && (n.service === "quickstart" || n.format === "json") ) {
			try {
				var parsedPayload = JSON.parse(payload);
				console.log("[App-Out] Trying to publish MQTT JSON message " + parsedPayload + " on topic: " + topic);
				this.client.publish(topic, payload);
			}
			catch (error) {
				if(error.name === "SyntaxError") {
					that.error("JSON Message expected");
				} else {
					that.warn("MQTTClient not yet initialized for JSON for out node");
				}

			}
		} else if(msg !== null) {
			if(typeof payload === "number") {
				payload = "" + payload + "";
				console.log("[App-Out] Trying to publish MQTT message" + payload + " on topic: " + topic);
			} else if(typeof payload === "string") {
				console.log("[App-Out] Trying to publish MQTT message" + payload + " on topic: " + topic);
			}
			try {
				this.client.publish(topic, payload);								
			}
			catch (err) {
				that.warn("MQTT Client not yet initialized for out node");
			}
		}
    });
}

RED.nodes.registerType("ibmiot out", IotAppOutNode);


function IotAppInNode(n) {
    RED.nodes.createNode(this, n);
    setUpNode(this, n, "in");

    var that = this;
    if(this.topic){
		try {
			if(that.inputType === "evt" ) {

				if(n.service === "quickstart") {
					that.deviceType = "+";
				}

				this.client.subscribeToDeviceEvents(that.deviceType, this.deviceId, this.eventType, this.format);

				this.client.on("deviceEvent", function(deviceType, deviceId, eventType, formatType, payload, topic) {
					var parsedPayload = "";
					if ( that.format === "json" ){
						try{
							parsedPayload = JSON.parse(payload);
							var msg = {"topic":topic, "payload":parsedPayload, "deviceId" : deviceId, "deviceType" : deviceType, "eventType" : eventType, "format" : formatType};
							console.log("[App-In] Forwarding message to output.");
							that.send(msg);
						}catch(err){
							that.warn("JSON payload expected");
	//						parsedPayload = payload;
						}
					} else {
						try{
							parsedPayload = JSON.parse(payload);
						}catch(err){
							parsedPayload = payload;
						}
						var msg = {"topic":topic, "payload":parsedPayload, "deviceId" : deviceId, "deviceType" : deviceType, "eventType" : eventType, "format" : formatType};
						console.log("[App-In] Forwarding message to output.");
						that.send(msg);
					}
				});
			} else if (that.inputType === "devsts") {
			
				var deviceTypeSubscribed = this.deviceType;

				if(this.service === "quickstart") {
					deviceTypeSubscribed = "+";
				}

				this.client.subscribeToDeviceStatus(deviceTypeSubscribed, this.deviceId);

				this.client.on("deviceStatus", function(deviceType, deviceId, payload, topic) {
					var parsedPayload = "";
					try{
						parsedPayload = JSON.parse(payload);
					}catch(err){
						parsedPayload = payload;
					}
					var msg = {"topic":topic, "payload":parsedPayload, "deviceId" : deviceId, "deviceType" : deviceType};
					console.log("[App-In] Forwarding message to output.");
					that.send(msg);
				});
			} else if (that.inputType === "appsts") {

				this.client.subscribeToAppStatus(this.applicationId);

				this.client.on("appStatus", function(deviceId, payload, topic) {

					var parsedPayload = "";

					try{
						parsedPayload = JSON.parse(payload);
					}catch(err){
						parsedPayload = payload;
					}
					var msg = {"topic":topic, "payload":parsedPayload, "applicationId" : deviceId};
					console.log("[App-In] Forwarding message to output.");
					that.send(msg);

				});

			} else if (that.inputType === "cmd") {

				this.client.subscribeToDeviceCommands(this.deviceType, this.deviceId, this.commandType, this.format);

				this.client.on("deviceCommand", function(deviceType, deviceId, commandType, formatType, payload, topic) {

					var parsedPayload = "";
					if ( that.format === "json" ){
						try{
							parsedPayload = JSON.parse(payload);
							var msg = {"topic":topic, "payload":parsedPayload, "deviceId" : deviceId, "deviceType" : deviceType, "commandType" : commandType, "format" : formatType};
							console.log("[App-In] Forwarding message to output.");
							that.send(msg);
						}catch(err){
							that.warn("JSON payload expected");
	//						parsedPayload = payload;
						}
					} else {
						try{
							parsedPayload = JSON.parse(payload);
						}catch(err){
							parsedPayload = payload;
						}
						var msg = {"topic":topic, "payload":parsedPayload, "deviceId" : deviceId, "deviceType" : deviceType, "commandType" : commandType, "format" : formatType};
						console.log("[App-In] Forwarding message to output.");
						that.send(msg);
					}

				});
			}
		} catch(err) {
			that.warn("MQTT Client not yet initialized for in node");			
		}
	}
}

RED.nodes.registerType("ibmiot in", IotAppInNode);
