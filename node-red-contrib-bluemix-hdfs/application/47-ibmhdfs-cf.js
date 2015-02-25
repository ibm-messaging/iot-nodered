/**
 * Copyright 2013, 2015 IBM Corp.
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

var RED = require(process.env.NODE_RED_HOME+"/red/red");
//var util = require("util");
var http = require("follow-redirects").http;
var https = require("follow-redirects").https;
var urllib = require("url");
var getBody = require('raw-body');
//var mustache = require("mustache");
//var fs = require("fs");

//var cors = require('cors');

//var cfEnv = require("cf-env");
// Load the services VCAP from the CloudFoundry environment
//var services = cfEnv.getCore().services || {};

var cfenv = require("cfenv");
// Load the services VCAP from the CloudFoundry environment
var appenv = cfenv.getAppEnv();
var services = appenv.services || {};
var userServices = services['IBM Analytics for Hadoop'];

var bigcredentials = false;

if (userServices) {
	for(var i = 0, l = userServices.length; i < l; i++){
		var service = userServices[i];
		if(service.credentials){
			if(service.credentials.HttpfsUrl){
				bigcredentials = service.credentials;
				console.log("BIG CREDENTIALS FOUND.....");
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

		bigcredentials = {};
		bigcredentials.HttpfsUrl = fileContents.HttpfsUrl;
		bigcredentials.userid = fileContents.userid;
		bigcredentials.password = fileContents.password;

	}
	catch (ex){
		console.log("credentials.cfg doesn't exist or is not well formed");
		credentials = null;
	}
}
*/

RED.httpAdmin.get('/iotFoundation/bigdata', function(req,res) {
	console.log("BIG Credentials asked for .....");	
	res.send("", bigcredentials ? 200 : 403);
});


function HDFSRequestInNode(n) {
	RED.nodes.createNode(this,n);

	this.filename = n.filename;
	this.format = n.format;
	var node = this;
	var payload = null;
	var options = {};
	if (this.format) {
		options['encoding'] = this.format;
	}
	this.on("input",function(msg) {
		node.status({fill:"blue",shape:"dot",text:"requesting"});
		var filename = msg.filename || this.filename;
		var homeDirectory = "user/" + bigcredentials.userid;

		var url = bigcredentials.HttpfsUrl;
		url = url + homeDirectory + filename;

		node.log("filename = " + filename);
		if (filename == "") {
			node.warn('No filename specified');
		} else {
			var opts = urllib.parse(url + "?op=OPEN");
			opts.method = "GET";
			opts.headers = {};
			var payload = null;
			opts.auth = bigcredentials.userid+":"+(bigcredentials.password||"");
			var req = ((/^https/.test(url))?https:http).request(opts,function(res) {
				if(options['encoding'] == 'utf8') {
					res.setEncoding('utf8');
				} else {
					res.setEncoding('binary');
				}
				msg.statusCode = res.statusCode;
				node.log("Status = " + msg.statusCode);
				msg.headers = res.headers;
				if(msg.payload !== null) {

				} else {
					msg.payload = "";
				}
				var begun = false;
				res.on('data',function(chunk) {
					node.status({fill:"green",shape:"dot",text:"connected"});
					if( begun )
						msg.payload += chunk;
					else {
						msg.payload = chunk;
						begun = true;
					}

					payload = msg.payload;

					node.log("Payload in DATA = " + msg.payload);
				});
				res.on('end',function() {
					node.send(msg);
					node.log("Payload in END = " + msg.payload);
					if(msg.payload.boolean == false) {
						node.error("Unable to delete the file");
					}
					node.status({fill:"grey",shape:"dot",text:"done"});
				});
			});
			req.on('error',function(err) {
				msg.payload = err.toString();
				msg.statusCode = err.code;
				node.send(msg);
				node.status({fill:"red",shape:"ring",text:err.code});
			});
			if (payload) {
				req.write(payload);
			}
			req.end();
		}
	});
}

RED.nodes.registerType("ibm hdfs in",HDFSRequestInNode);

function HDFSRequest(n) {
	RED.nodes.createNode(this,n);

	this.filename = n.filename;
	this.format = n.format;
	var appendNewline = n.appendNewline;
	var node = this;
	var payload = null;
	var options = {};
	if (this.format) {
		options['encoding'] = this.format;
	}
	this.on("input",function(msg) {
		var that = this;
		node.status({fill:"blue",shape:"dot",text:"requesting"});
		var filename = msg.filename || this.filename;
		var homeDirectory = "user/" + bigcredentials.userid;

		var url = bigcredentials.HttpfsUrl;
		url = url + homeDirectory + filename;

		var fileChanged = false;
		node.log("filename = " + filename);

		if (filename == "") {
			node.warn('No filename specified');
		} else if (typeof msg.payload != "undefined") {
			var data = msg.payload;
			var opts;
			if (typeof data == "object") {
				data = JSON.stringify(data); 
			}
			if (typeof data == "boolean") { 
				data = data.toString(); 
			}

			if (typeof data == "number") { 
				data += ""; 
			}

			if (appendNewline) {
				data += "\n";
			}
			if (msg.hasOwnProperty('delete')) {
				opts = urllib.parse(url + "?op=DELETE");
				opts.method = "DELETE";
				opts.headers = {};
				opts.auth = bigcredentials.userid+":"+(bigcredentials.password||"");
			}
			else {
				if(n.overwriteFile)  {
					opts = urllib.parse(url + "?op=CREATE&data=true");
					opts.method = "PUT";
					opts.headers = {};
					opts.auth = bigcredentials.userid+":"+(bigcredentials.password||"");
					opts.headers['transfer-encoding'] = 'chunked';
					opts.headers['content-type'] = 'application/octet-stream';
				} else {
					opts = urllib.parse(url + "?op=APPEND&data=true");
					opts.method = "POST";
					opts.headers = {};
					opts.auth = bigcredentials.userid+":"+(bigcredentials.password||"");
					opts.headers['transfer-encoding'] = 'chunked';
					opts.headers['content-type'] = 'application/octet-stream';				

				}
				if (opts.headers['content-length'] == null) {
					opts.headers['content-length'] = Buffer.byteLength(data);
				}
			}
			var req = ((/^https/.test(url))?https:http).request(opts,function(res) {
				res.setEncoding('utf8');
				msg.statusCode = res.statusCode;
				msg.headers = res.headers;

				res.on('data',function(chunk) {
					node.status({fill:"green",shape:"dot",text:"connected"});
					node.log("Status code = " + msg.statusCode);
					if(msg.statusCode == 404 ) {
						node.error("File doesnt exist, so creating one");	

						
						opts = null;				
						opts = urllib.parse(url + "?op=CREATE&data=true");
						opts.method = "PUT";
						opts.headers = {};
						opts.auth = bigcredentials.userid+":"+(bigcredentials.password||"");
						opts.headers['transfer-encoding'] = 'chunked';
						opts.headers['content-type'] = 'application/octet-stream';
						if (opts.headers['content-length'] == null) {
							opts.headers['content-length'] = Buffer.byteLength(data);
						}
						var req1 = ((/^https/.test(url))?https:http).request(opts,function(res1) {
							res1.setEncoding('utf8');
							msg.statusCode = res1.statusCode;
							msg.headers = res1.headers;

							res1.on('data',function(chunk) {
								node.status({fill:"green",shape:"dot",text:"connected"});
								node.log("Status code = " + msg.statusCode);
								if(msg.statusCode == 404 ) {
									node.error("Unable to create the file......");	
									fileChanged = false;
								} else {
									data += chunk;
									fileChanged = true
								}
								node.log("Payload in DATA AGAIN= " + data);
							});
							res1.on('end',function() {
								node.send(msg);
								node.log("Payload in END AGAIN= " + data);
								node.status({fill:"grey",shape:"dot",text:"done"});
							});
						});
						req1.on('error',function(err) {
							data = err.toString();
							msg.statusCode = err.code;
							node.send(msg);
							node.status({fill:"red",shape:"ring",text:err.code});
							fileChanged = false;
						});
						if (data) {
							req1.write(data);
						}
						req1.end();

					} else {
						data += chunk;
						fileChanged = true
					}
					node.log("Payload in DATA = " + data);
				});
				res.on('end',function() {
					node.send(msg);
//					node.log("Payload in END = " + data);
					node.status({fill:"grey",shape:"dot",text:"done"});
				});
			});
			req.on('error',function(err) {
				node.log("Payload in ERROR = " + data);
				msg.statusCode = err.code;
				node.send(msg);
				node.status({fill:"red",shape:"ring",text:err.code});
				fileChanged = false;
			});
			if (data) {
				req.write(data);
			}
			req.end();
		}
	});
}

RED.nodes.registerType("ibm hdfs",HDFSRequest);

RED.httpAdmin.get('/http-request/:id',function(req,res) {
	var credentials = RED.nodes.getCredentials(req.params.id);
	if (credentials) {
		res.send(JSON.stringify({user:credentials.user,hasPassword:(credentials.password&&credentials.password!="")}));
	} else {
		res.send(JSON.stringify({}));
	}
});

RED.httpAdmin.delete('/http-request/:id',function(req,res) {
	RED.nodes.deleteCredentials(req.params.id);
	res.send(200);
});

RED.httpAdmin.post('/http-request/:id',function(req,res) {
    var newCreds = body.req;
    var credentials = RED.nodes.getCredentials(req.params.id)||{};
    if (newCreds.user == null || newCreds.user == "") {
        delete credentials.user;
    } else {
        credentials.user = newCreds.user;
    }
    if (newCreds.password == "") {
        delete credentials.password;
    } else {
        credentials.password = newCreds.password||credentials.password;
    }
    RED.nodes.addCredentials(req.params.id,credentials);
    res.send(200);
});
