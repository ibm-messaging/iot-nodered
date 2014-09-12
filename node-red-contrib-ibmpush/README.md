node-red-contrib-ibmpush
========================
Sends push notifications to mobile devices using IBM Push for Bluemix

Install
-------
Install from [npm](http://npmjs.org)
```
npm install node-red-contrib-ibmpush
```

Usage
-----
	
`msg.payload` is used as the alert in the Notification. Optionally, `msg.url` can be used as the URL in the notification

**MBaaS Application Properties**

*Application ID and Route* - mandatory only when used in *non-Bluemix environment* and must be copied from the IBM MBaaS service in Bluemix. If used in *Bluemix environment*, these properties will be automatically read and are not displayed in the configuration screen.
	 
*Application Secret* - Bluemix application secret key. 

**Notification Type**

Type of notification to be pushed.

- Broadcast - Send notifications to all the registered devices
- By Tags - Send notifications to devices subscribed to that tag. Can take multiple values
- By DeviceIds - Send notifications to devices by their device ID. Can take multiple values
- By ConsumerIds - Send notifications to devices by their consumer ID. Can take multiple values

*Notification Identifiers* - Used when notifications are sent By Tags, By DeviceIds and By ConsumerIds. This can take multiple values seperated by comma(,). Example: Killer,Robots