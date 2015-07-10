IBM IoT App In Node
========================
The IoT App In Node is used to subscribe to device, of a given organization, identified by the device type and device id, on clicking the deploy button.
It can also subscribe to device events, on the behalf of a device. 
It allows the single=level wild character '+' to substitute for one topic level.


Usage
-------

In case of registered flow, the App In node can be used to 

1. Receive device events, 
2. Receive device status, 
3. Receive device commands, on the behalf of a device, and 
4. Receive application status.

In case of quickstart flow, the App In node can be used to 

1. Receive device events, 
2. Receive device status and 
3. Receive application status.


----

MQTT Topic
----------

Event Subscription
^^^^^^^^^^^^^^^^^^
This node subscribes to device events on the following topic.

.. code:: text

	iot-2/type/<type id>/id/<device id>/evt/<event type>/fmt/<format type>

	where
		<device type> denotes the device type, say for e.g. iotsample-arduino
		In case of quickstart flow, the device type refers to Node-RED version
		<device id> denotes the device id, say for e.g. 00aabbccdd01
		<event type> denotes the event to be subscribed from the device, say for e.g. status
		<format type> denotes the format, say for e.g. json

Internally, it invokes the

.. code:: javascript
	
		iotclient.subscribeToDeviceEvents() method to subscribe to the events


Device Status Subscription
^^^^^^^^^^^^^^^^^^^^^^^^^^
This node subscribes to device status on the following topic.

.. code:: text

	iot-2/type/<type id>/id/<device id>/mon

	where
		<device type> denotes the device type, say for e.g. iotsample-arduino
		<device id> denotes the device id, say for e.g. 00aabbccdd01

Internally, it invokes the

.. code:: javascript
	
		iotclient.subscribeToDeviceStatus() method to subscribe to the device status


Application Status Subscription
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
This node subscribes to application status on the following topic.

.. code:: text

	iot-2/app/<app id>/mon

	where
		<app id> denotes the application id, 
		<event type> denotes the event to be subscribed from the device, say for e.g. status
		<format type> denotes the format, say for e.g. json


In case of quickstart flow, the "device type" denotes the Node-RED version. 

Internally, it invokes the

.. code:: javascript
	
		iotclient.subscribeToAppStatus() method to subscribe to the application status


Command Subscription
^^^^^^^^^^^^^^^^^^^^
On the behalf of a registered device, it subscribes to the device commands on the following topic

.. code:: text

	iot-2/type/<device type>/id/<device id>/cmd/<command type>/fmt/<format type>

	where
		<device type> denotes the device type, say for e.g. iotsample-arduino
		<device id> denotes the device id, say for e.g. 00aabbccdd01
		<command type> denotes the command to be subscribed to, say for e.g. blink
		<format type> denotes the format, say for e.g. json

Internally, it invokes the

.. code:: javascript
	
		iotclient.subscribeToDeviceCommands() method to subscribe to the device commands


The node creates the Topic string by reading the values from the textfield.

----

MQTT Client Id
---------------
As explained in the previous document, this Node is an application and so generates the MQTT Client Id in the following manner

.. code:: text
	

	a:<organization id>:<app Id>
	

	where
		<organization id> denotes the organization and in case of quickstart, it means "quickstart"
		<app Id> a random number

----

	
MQTT Userid and Password
------------------------
In case of quickstart flow, these are set to null. In case of registered flow, MQTT Userid corresponds to the API Key and the MQTT Password corresponds to the API Token. 

In case of Bluemix flow, these values are obtained from the VCAP credentials.

----

**Note**

Most of the textfields are provided with a check-box option, which when clicked, disables the adjacent textfield. Selecting the checkbox is like passing the wild-card character '+' for that topic 
string and results in subscribing to all.