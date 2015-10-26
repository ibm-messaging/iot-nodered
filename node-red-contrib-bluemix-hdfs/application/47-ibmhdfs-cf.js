/**
 * Copyright 2014, 2015 IBM Corp.
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
var httpForRead = require("follow-redirects").http;
var httpsForRead = require("follow-redirects").https;

var http = require("http");
var https = require("https");

var urllib = require("url");
var getBody = require('raw-body');
var fs = require("fs");

var cfenv = require("cfenv");
// Load the services VCAP from the CloudFoundry environment
var appenv = cfenv.getAppEnv();
var services = appenv.services || {};

var userServices = services['Analytics for Apache Hadoop'];
var bigcredentials = false;

if (userServices) {
	for(var i = 0, l = userServices.length; i < l; i++){
		var service = userServices[i];
		if(service.credentials){
			if(service.credentials.WebhdfsUrl){
				bigcredentials = service.credentials;
				console.log("BIG CREDENTIALS FOUND.....");
				break;
			}
		}
	}
} 
/*
else {
	var vcapData = fs.readFileSync("credentials.cfg"), fileContents;
	try {
		fileContents = JSON.parse(vcapData);

		bigcredentials = {};
		bigcredentials.WebhdfsUrl = fileContents.WebhdfsUrl;
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
	node.status({fill:"grey",shape:"dot",text:"done"});
	this.on("input",function(msg) {
		node.status({fill:"blue",shape:"ring",text:"requesting"});
		var filename = msg.filename || this.filename;
		var homeDirectory = "user/" + bigcredentials.userid;

		var url = bigcredentials.WebhdfsUrl;
		url = url + homeDirectory + filename;

		node.log("filename = " + filename);
		if (filename == "") {
			node.warn('No filename specified');
			node.status({fill:"grey",shape:"dot",text:""});
		} else {
			var opts = urllib.parse(url + "?op=OPEN");
			opts.method = "GET";
			opts.headers = {};
			var payload = null;
			opts.auth = bigcredentials.userid+":"+(bigcredentials.password||"");
			var req = ((/^https/.test(url))?httpsForRead:httpForRead).request(opts,function(res) {
				if(options['encoding'] == 'utf8') {
					res.setEncoding('utf8');
				} else {
					res.setEncoding('binary');
				}
				msg.statusCode = res.statusCode;
				msg.headers = res.headers;

				if(msg.payload === null) {
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
					node.status({fill:"grey",shape:"dot",text:"read"});
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
	node.status({fill:"grey",shape:"dot",text:"done"});
	this.on("input",function(msg) {
		var that = this;
		node.status({fill:"blue",shape:"ring",text:"requesting"});
		var filename = msg.filename || this.filename;
		var homeDirectory = "user/" + bigcredentials.userid;

		var url = bigcredentials.WebhdfsUrl;
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
				node.warn(filename + " deleted from HDFS");
				opts = urllib.parse(url + "?op=DELETE");
				opts.method = "DELETE";
				opts.headers = {};
				opts.auth = bigcredentials.userid+":"+(bigcredentials.password||"");
				node.status({fill:"grey",shape:"dot",text:"deleted"});
			}
			else {
				if(n.overwriteFile)  {
					opts = urllib.parse(url + "?op=CREATE&data=true");
					opts.method = "PUT";
					opts.headers = {};
					opts.auth = bigcredentials.userid+":"+(bigcredentials.password||"");
					opts.headers['transfer-encoding'] = 'chunked';
					opts.headers['content-type'] = 'application/octet-stream';
					opts.encoding = options.encoding;
				} else {
					opts = urllib.parse(url + "?op=APPEND&data=true");
					opts.method = "POST";
					opts.headers = {};
					opts.auth = bigcredentials.userid+":"+(bigcredentials.password||"");
					opts.headers['transfer-encoding'] = 'chunked';
					opts.headers['content-type'] = 'application/octet-stream';				
					opts.encoding = options.encoding;
				}
				if (opts.headers['content-length'] == null) {
					opts.headers['content-length'] = Buffer.byteLength(data);
				}
			}
			var req = ((/^https/.test(url))?https:http).request(opts,function(res) {
				if(opts['encoding'] == 'utf8') {
					res.setEncoding('utf8');
				} else {
					res.setEncoding('binary');
				}
				
				msg.statusCode = res.statusCode;
				msg.headers = res.headers;

				if(msg.statusCode == 307) {
					node.status({fill:"green",shape:"dot",text:"connected"});
					var newLocation = res.headers.location;

					opts1 = urllib.parse(newLocation);
					opts1.method = opts.method;
					opts1.headers = {};
					opts1.auth = bigcredentials.userid+":"+(bigcredentials.password||"");
					opts1.headers['transfer-encoding'] = 'chunked';
					opts1.headers['content-type'] = 'application/octet-stream';
					opts1.encoding = "UTF-8";

					req.end();
					node.log("newLocation=" + newLocation);

					var reqPut = https.request(opts1, function(res) {
						res.on('data', function(d) {
							process.stdout.write(d);
						});

					});
					reqPut.write(data);
					reqPut.end();
					node.send(data);
					node.status({fill:"grey",shape:"dot",text:"inserted / updated"});
				}


				res.on('data',function(chunk) {
					node.status({fill:"green",shape:"dot",text:"connected"});
					node.log("Status code = " + msg.statusCode);
					if(msg.statusCode == 404 ) {
						node.error("File doesnt exist, so creating one");	

						node.log("WebHDFSFile = " + url);					
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
						
							if(msg.statusCode == 307) {
									node.status({fill:"green",shape:"dot",text:"connected"});
									newLocation = res1.headers.location;
									node.log("newLocation =" + newLocation);

									opts = urllib.parse(newLocation);
									opts.method = "PUT";
									opts.headers = {};
									opts.auth = bigcredentials.userid+":"+(bigcredentials.password||"");
									opts.headers['transfer-encoding'] = 'chunked';
									opts.headers['content-type'] = 'application/octet-stream';
									opts.encoding = "UTF-8";

									req.end();

									var reqPut = https.request(opts, function(resPut) {
										resPut.on('data', function(d) {
											process.stdout.write(d);
										});

									});
								reqPut.write(data);
								reqPut.end();
								node.status({fill:"grey",shape:"dot",text:"inserted / updated"});
							}
	
							res1.on('data',function(chunk) {
								node.status({fill:"green",shape:"dot",text:"connected"});
								if(msg.statusCode == 404 ) {
									node.error("Unable to create the file......");	
									fileChanged = false;
								}  else {
									data += chunk;
									fileChanged = true
								}
								node.log("Payload in DATA AGAIN= " + data);
								node.log("Exiting....");
							});
							res1.on('end',function() {
								node.log("Before sending...");
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
					node.log("Payload in END = " + data);
					node.send(data);
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
