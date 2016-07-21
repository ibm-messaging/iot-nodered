Node-RED sample
===============
This node-red code has 2 sample programs
1) Quickstart Flow
2) Registered Flow

Quickstart Flow
===============================
This has a single flow
Quickstart Flow from device
===============================
This is the sample program to send the following events from the Raspberry Pi to the Quickstart messaging service of IBM Watson IoT Platform.

The events that are emitted in this sample are:

+ CPU temperature
+ CPU Load
+ Simulated Sine wave to demonstrate the different events can be pushed to IoT Portal and visualized.

Connect
-------
1. Log in to Raspberry Pi. (Default login Username: pi Password: raspberry)
2. Install node red from npm registry by running sudo npm install node-red
3. Install iotcloudDev from npm registry by running sudo npm install node-red-contrib-iotclouddev
4. cd to the node red directory
5. Note down the MAC address of your raspberry pi which is needed for the [quickstart site](http://quickstart.internetofthings.ibmcloud.com).
6. Start Node-RED with sudo node red.js -f raspi_quickstart_event.json. (This file is present in the samples directory of the same folder, from where you downloaded this README.md)
7. Open http://<IP Address>:1880/ in browser
8. Double-click IoT device out and provide the following details
	a. For Connection select "Quickstart Mode"
	b. For Org Id enter "Quickstart" without quotes
	c. For DeviceType "iotsample-nodered" without quotes
	d. For DeviceID "b827ebb030a1" without quotes
	e. For AuthToken, keep it blank
9. The device immediately starts publishing events.
10.These events can be seen on the quickstart dashboard by providing the MAC Address.



Registered Flow
===============================
This has 2 flows
1) Registered Flow from device
2) Registered Flow to device

Registered Flow from device
===============================
This is the sample program to send the following events from the Raspberry Pi to the Registered messaging service of IBM Watson IoT Platform.

The events that are emitted in this sample are:

+ CPU temperature
+ CPU Load
+ Simulated Sine wave to demonstrate the different events can be pushed to IoT Portal and visualized.

Connect
-------

1. Log in to Raspberry Pi. (Default login Username: pi Password: raspberry)
2. Install node red from npm registry by running sudo npm install node-red (No need to do this step, if its done previously)
3. Install iotcloudDev from npm registry by running sudo npm install node-red-contrib-iotclouddev (No need to do this step, if its done previously) 
4. cd to the node red directory
5. Note down the MAC address of your raspberry pi which is needed for the registered flow
6. Register organization, device id, authorization tokens as these are needed for registered flow
7. In the 
6. Start Node-RED with sudo node red.js -f raspi_registered_event.json. (This file is present in the samples directory of the same folder, from where you downloaded this README.md)
7. Open http://<IP Address>:1880/ in browser
8. Double-click IoT device out and provide the following details
	a. For Connection select "Registered Mode"
	b. For Org Id enter the org id obtained after registering your organization, for e.g. "w8wx0" without quotes
	c. For DeviceType enter the deviceType as entered while registering the device, for e.g. "iotsample-raspberrypi" without quotes
	d. For DeviceID enter the deviceid as entered while registering the device, for. e.g. "b827ebb030a1" without quotes
	e. For AuthToken, provide the Auth Token thats returned, after registering the device
9. The device immediately starts publishing events.
10.These events can be subscribed to by using either an application deployed on Bluemix or using an MQTT subscriber


Registered Flow to device
===============================
This is the sample program which subscribes to events sent to Raspberry Pi from the Registered messaging of IBM Internet of Things service.


Connect
-------

1. Log in to Raspberry Pi. (Default login Username: pi Password: raspberry)
2. Install node red from npm registry by running sudo npm install node-red (No need to do this step, if its done previously)
3. Install iotcloudDev from npm registry by running sudo npm install node-red-contrib-iotclouddev (No need to do this step, if its done previously) 
4. cd to the node red directory
5. Note down the MAC address of your raspberry pi which is needed for the registered flow
6. Register organization, device id, authorization tokens as these are needed for registered flow
7. In the 
6. Start Node-RED with sudo node red.js -f raspi_registered_event.json. (This file is present in the samples directory of the same folder, from where you downloaded this README.md)
7. Open http://<IP Address>:1880/ in browser
8. Double-click IoT device In and provide the following details
	a. For Org Id enter the org id obtained after registering your organization, for e.g. "w8wx0" without quotes
	b. For DeviceType enter the deviceType as entered while registering the device, for e.g. "iotsample-raspberrypi" without quotes
	c. For DeviceID enter the deviceid as entered while registering the device, for. e.g. "b827ebb030a1" without quotes
	d. For AuthToken, provide the Auth Token thats returned, after registering the device
	e. For Command, provide '+' to get all commands
	f. For format, provide "json"
9. The device immediately starts subscribing to events.
10.These events can be published to by using either an application deployed on Bluemix or using an MQTT subscriber



Troubleshooting and Development
--------------------------------
+ Check the node-red.out file for diagnostics from Node-RED.
+ You can connect a browser to port [raspberrypi-address:1880] in order to develop the flow in the Node-RED UI, activate debug nodes to show events emitted.
+ If git is not installed, install it using sudo apt-get install git
