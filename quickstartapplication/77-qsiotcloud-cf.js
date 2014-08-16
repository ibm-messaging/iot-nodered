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


function setUpNode(node, nodeCfg, inOrOut){
    // Create a random appId
    var appId = util.guid();    
    node.topic = nodeCfg.topic || "";
    	
   	// QUICKSTART MODE (IoT Service NOT bound to this instance)
   	node.organization = "quickstart";
	node.type = nodeCfg.type1;
	node.mac = nodeCfg.mac;
	node.event = nodeCfg.event;

	if(inOrOut == "in") {
		console.log("InNode ");
		node.clientId = "a:" + node.organization + ":" + appId;

		if(node.type == "evt") {
			node.topic = "iot-2/type/+/id/" + node.mac + "/" + node.type + "/+/fmt/json";
		} else if(node.type == "devsts") {
			node.topic = "iot-2/type/+/id/" + node.mac + "/mon";
		} else if(node.type == "appsts") {
			node.topic = "iot-2/app/" + node.mac + "/mon";
		} else {
			node.topic = "iot-2/app/" + node.mac + "/mon";
		}
	}
	else if(inOrOut == "out") {
		console.log("OutNode ");
		node.clientId = "a:" + node.organization + ":" + appId;
//		node.topic = "iot-2/evt/status/fmt/json";
		node.topic = "iot-2/type/iotsample-sensor/id/" + node.mac + "/evt/" + node.event + "/fmt/json";
	}
	else {
		console.log("CANT COME HERE AT ALL");
	}
	//node.clientId = "d:" + node.organization + ":iotsample-arduino:" + "00aabbccde02";
	node.brokerHost = "quickstart.messaging.internetofthings.ibmcloud.com";
	node.brokerPort = "1883";

	node.name = nodeCfg.name;
	
    
    console.log('	Organization: '	+ node.organization);
    console.log('	Client ID: '	+ node.clientId); 
    console.log('	Broker Host: '	+ node.brokerHost); 
    console.log('	Broker Port: '	+ node.brokerPort);    
    console.log('	Topic: ' 		+ node.topic); 
    console.log('	Type: ' 		+ node.type); 
    console.log('	MAC: ' 			+ node.mac); 
    console.log('	Name: ' 		+ node.name); 

/*
    node.client = connectionPool.get(node.brokerHost, node.brokerPort, node.clientId, null, null);
    node.client.connect();

    node.on("close", function() {
        if (node.client) {
            node.client.disconnect();
        }
    });
*/
    node.client = new IoTAppClient(appId, null, null);
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
    	console.log("Subscribing to topic: '"+this.topic+"'");

		if(that.type == "evt" ) {
			this.client.subscribeToDeviceEvents("+", this.mac, "+", "json");

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
		} else if (that.type == "devsts") {
		
			this.client.subscribeToDeviceStatus("+", this.mac);

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
		} else if (that.type == "appsts") {

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
		}
	}  
}

RED.nodes.registerType("iot-client-qs-in", IotAppInNode);


function IotAppOutNode(n) {
    RED.nodes.createNode(this, n);
    setUpNode(this, n, "out");

	var that = this;

    this.on("input", function(msg) {

//		console.log("n.data = " + n.data);
		var payload = msg.payload || n.data;
		var topic = "iot-2/type/nodered-version-0.8.1/id/" + (msg.id || n.mac) + "/evt/" + ( msg.eventCommandType || n.event) + "/fmt/json";

        console.log("[App-Out] The following message arrived at input:" + payload);

//		console.log("\n\nPassed Topic: " + this.topic + "\tDefault id = " + msg.id + "\tmsg.topic = " + msg.topic);
        if (msg.payload !== null) {
            console.log("[App-Out] Trying to publish MQTT message on topic: " + topic);
            this.client.publish(topic, payload);
         }
    });
}

RED.nodes.registerType("iot-client-qs-out", IotAppOutNode);   
