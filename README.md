Node-RED sample
===============

This is the sample program to send the following events from the Raspberry Pi to the Quickstart IBM Internet of Things service.

The events that are emitted in this sample are:

+ CPU temperature
+ CPU Load
+ Simulated Sine wave to demonstrate the different events can be pushed to IoT Portal and visualized.


Connect
-------

1. Log in to Raspberry Pi. (Default login Username: pi Password: raspberry)
2. Install node red from npm registry by running sudo npm install node-red
3. Install iotcloudDev from npm registry by running sudo npm install node-red-iotclouddev
4. cd to the node red directory
5. Note down the MAC address of your raspberry pi which is needed for the [quickstart site](http://quickstart.internetofthings.ibmcloud.com).
6. Start Node-RED with sudo node red.js -f raspi_registered_event.json. (This file is present in the samples directory of the same folder, from where you downloaded this README.md)
7. Provide MAC Address in the "Ready To View" textbox and click on Go


Troubleshooting and Development
--------------------------------
+ Check the node-red.out file for diagnostics from Node-RED.
+ You can connect a browser to port [raspberrypi-address:1880] in order to develop the flow in the Node-RED UI, activate debug nodes to show events emitted.
+ If git is not installed, install it using sudo apt-get install git
