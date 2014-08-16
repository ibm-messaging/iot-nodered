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
var cfEnv = require("cf-env");
var fs = require("fs");
var IoTAppClient = require("iotclient");

var APPLICATION_PUB_TOPIC_REGEX = /^iot-2\/(?:evt|cmd|mon)\/[^#+\/]+\/fmt\/[^#+\/]+$/;


// Load the services VCAP from the CloudFoundry environment
var services = cfEnv.getCore().services || {};
var userServices = services['user-provided'];

// Store the IoT Cloud credentials, if any.
var credentials;
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


function setUpNode(node, nodeCfg, inOrOut){
    // Create a random appId
    var appId = util.guid();    
    node.topic = nodeCfg.topic || "";
    	
   	// REGISTERED MODE (IoT Service bound to this instance)

	node.macchecked = nodeCfg.macchecked;
	node.type2checked = nodeCfg.type2checked;
	node.event1checked = nodeCfg.event1checked;
	node.formatchecked = nodeCfg.formatchecked;

	node.type1 = nodeCfg.type1;
	node.type2 = ( node.type2checked ) ? '+' : nodeCfg.type2;
//	node.apikey = nodeCfg.apikey;
    node.apiKey = credentials.apiKey;

//	node.apitoken = nodeCfg.apitoken;
	node.apiToken = credentials.apiToken;

	node.mac = ( node.macchecked ) ? '+' : nodeCfg.mac;
	node.format = ( node.formatchecked ) ? '+' : nodeCfg.format;
	node.organization = node.apiKey.split(':')[1];
	node.event = ( node.event1checked ) ? '+' : nodeCfg.event;

	node.brokerHost = node.organization + ".messaging.internetofthings.ibmcloud.com";
	node.brokerPort = "1883";

//	console.log("macchecked = " + node.macchecked + "\ttype2checked = " + node.type2checked + "\tevent1checked = " + node.event1checked + "\tformatchecked = " + node.formatchecked);
	if(inOrOut == "in") {
		console.log("InNode ");
		node.clientId = "a:" + node.organization + ":" + appId;

		if(node.type1 == "evt" || node.type1 == "cmd") {
			node.topic = "iot-2/type/" + node.type2 +"/id/" + node.mac + "/" + node.type1 + "/" + node.event +"/fmt/" + node.format;
		} else if(node.type1 == "devsts") {
			node.topic = "iot-2/type/+/id/" + node.mac + "/mon";
		} else if(node.type1 == "apsts") {
			node.topic = "iot-2/app/" + node.mac + "/mon";
		} else {
			node.topic = "iot-2/app/" + node.mac + "/mon";
		}
	}
	else if(inOrOut == "out") {
		console.log("OutNode ");
		node.clientId = "a:" + node.organization + ":" + appId;

		if(node.type1 == "evt" || node.type1 == "cmd") {
			node.topic = "iot-2/type/" + node.type2 +"/id/" + node.mac + "/" + node.type1 + "/" + node.event +"/fmt/" + node.format;
		} else if(node.type1 == "devsts") {
			node.topic = "iot-2/type/+/id/" + node.mac + "/mon";
		} else if(node.type1 == "apsts") {
			node.topic = "iot-2/app/" + node.mac + "/mon";
		} else {
			node.topic = "iot-2/app/" + node.mac + "/mon";
		}

	}
	else {
		console.log("CANT COME HERE AT ALL");
	}

	node.name = nodeCfg.name;
	
    
    console.log('	Organization: '	+ node.organization);
    console.log('	Client ID: '	+ node.clientId); 
    console.log('	Broker Host: '	+ node.brokerHost); 
    console.log('	Broker Port: '	+ node.brokerPort);    
    console.log('	Topic: ' 		+ node.topic); 
    console.log('	Type: ' 		+ node.type1); 
    console.log('	MAC: ' 			+ node.mac); 
    console.log('	Name: ' 		+ node.name); 
    console.log('	Format: ' 		+ node.format); 
    console.log('	API Key: ' 		+ node.apiKey); 
    console.log('	API Token: ' 	+ node.apiToken);
	console.log('	Event: '		+ node.event);

    node.client = new IoTAppClient(appId, node.apiKey, node.apiToken);
    node.client.connectBroker();

    node.on("close", function() {
        if (node.client) {
            node.client.disconnectBroker();
        }
    });
}

function IotAppInNode(n) {
    RED.nodes.createNode(this, n);
    setUpNode(this, n, "in");

    var that = this;
    if(this.topic){
//    	console.log("Subscribing to topic: '"+this.topic+"'");

/*		this.client.subscribe(this.topic, 0, function(topic, payload, qos, retain) {
            console.log("[App-In] Received MQTT message: " + payload);
            // if topic string ends in "json" attempt to parse. If fails, just pass through as string.
            // if topic string ends in anything other than "json" just pass through as string.
            var parsedPayload = "";
            if ( /json$/.test(topic) ){
                try{
                    parsedPayload = JSON.parse(payload);
                }catch(err){
                    parsedPayload = payload;
                }
            } else{
                parsedPayload = payload;
            }

            var msg = {"topic":topic, "payload":parsedPayload};
            console.log("[App-In] Forwarding message to output.");
            that.send(msg);
        });
  
*/
//		console.log("\n\n\nType = " + that.type1);
		if(that.type1 == "evt" ) {
			this.client.subscribeToDeviceEvents(this.type2, this.mac, this.event, this.format);

			this.client.on("deviceEvent", function(deviceType, deviceId, eventType, formatType, payload) {
//				console.log("\nPayload = " + payload + "\ndeviceType = " + deviceType + "\tdeviceId = " + deviceId + "\teventType = " + eventType + "\tformatType = " + formatType);

//				console.log("\nTopic defined previously = " + that.topic);

				var parsedPayload = "";
				if ( /json$/.test(that.topic) ){
					try{
						parsedPayload = JSON.parse(payload);
					}catch(err){
						parsedPayload = payload;
					}
				} else{
					parsedPayload = payload;
				}

				var msg = {"topic":that.topic, "payload":parsedPayload};
				console.log("[App-In] Forwarding message to output.");
				that.send(msg);
			});
		} else if (that.type1 == "devsts") {
		
			this.client.subscribeToDeviceStatus(that.type2, this.mac);

			this.client.on("deviceStatus", function(deviceType, deviceId, payload) {
//				console.log("\nPayload = " + payload + "\ndeviceType = " + deviceType + "\tdeviceId = " + deviceId );

//				console.log("\nTopic defined previously = " + that.topic);

				var parsedPayload = "";
				if ( /json$/.test(that.topic) ){
					try{
						parsedPayload = JSON.parse(payload);
					}catch(err){
						parsedPayload = payload;
					}
				} else{
					parsedPayload = payload;
				}

				var msg = {"topic":that.topic, "payload":parsedPayload};
				console.log("[App-In] Forwarding message to output.");
				that.send(msg);
			});
		} else if (that.type1 == "appsts") {

			this.client.subscribeToAppStatus(this.mac);

			this.client.on("appStatus", function(deviceId, payload) {
//				console.log("\nPayload = " + payload + "\tdeviceId = " + deviceId );

//				console.log("\nTopic defined previously = " + that.topic);

				var parsedPayload = "";
				if ( /json$/.test(that.topic) ){
					try{
						parsedPayload = JSON.parse(payload);
					}catch(err){
						parsedPayload = payload;
					}
				} else{
					parsedPayload = payload;
				}

				var msg = {"topic":that.topic, "payload":parsedPayload};
				console.log("[App-In] Forwarding message to output.");
				that.send(msg);
			});

		} else if (that.type1 == "cmd") {

			this.client.subscribeToDeviceCommands(that.type2, that.mac, that.event, that.format);

			this.client.on("deviceCommand", function(deviceType, deviceId, commandType, formatType, payload) {
//				console.log("\nPayload = " + payload + "\ndeviceType = " + deviceType + "\tdeviceId = " + deviceId + "\tcommandType = " + commandType + "\tformatType = " + formatType);

//				console.log("\nTopic defined previously = " + that.topic);

				var parsedPayload = "";
				if ( /json$/.test(that.topic) ){
					try{
						parsedPayload = JSON.parse(payload);
					}catch(err){
						parsedPayload = payload;
					}
				} else{
					parsedPayload = payload;
				}

				var msg = {"topic":that.topic, "payload":parsedPayload};
				console.log("[App-In] Forwarding message to output.");
				that.send(msg);
			});
		}
	}
}

RED.nodes.registerType("iot-new-in", IotAppInNode);


function IotAppOutNode(n) {
    RED.nodes.createNode(this, n);
    setUpNode(this, n, "out");

	var that = this;

    this.on("input", function(msg) {

		var payload = msg.payload || n.data;
		var topic = n.topic;
		
		if(n.type1 == "evt" || n.type1 == "cmd") {
			topic = "iot-2/type/" + (msg.deviceType || n.type2) +"/id/" + (msg.id || n.mac) + "/" + n.type1 + "/" + (msg.eventCommandType || n.event) +"/fmt/" + (msg.format || n.format);
		} else if(that.type1 == "devsts") {
			that.topic = "iot-2/type/+/id/" + (msg.id || n.mac) + "/mon";
		} else if(that.type1 == "apsts") {
			that.topic = "iot-2/app/" + (msg.id || n.mac) + "/mon";
		} else {
			that.topic = "iot-2/app/" + (msg.id || n.mac) + "/mon";
		}

//      console.log("[App-Out] The following message arrived at input:" + payload);

//		console.log("Topic: " + topic);
        if (msg !== null) {
            msg.topic = that.topic || msg.topic;
            console.log("[App-Out] Trying to publish MQTT message on topic: " + topic);
            this.client.publish(topic, payload);
        }
    });
}

RED.nodes.registerType("iot-new-out", IotAppOutNode);   
