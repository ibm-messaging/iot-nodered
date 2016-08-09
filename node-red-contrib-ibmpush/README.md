node-red-contrib-ibmpush
========================
Sends push notifications to mobile devices in [Node-RED](http://nodered.org) using IBM Push Notification for Bluemix

Install
-------
Install from [npm](http://npmjs.org)
```
npm install node-red-contrib-ibmpush
```

Usage
-----
	
`msg.payload` is used as the alert in the Notification.

**Mobile Push Properties**

*Application Mode* - Select the mode of operation for the IBM Push Notification. You can override this property by providing ```msg.mode```

*Application ID and Secret* - mandatory only when used in *non-Bluemix environment* and must be copied from the IBM Push Notification service in Bluemix. If used in *Bluemix environment*, these properties will be automatically read and these properties are not displayed in the configuration screen.

**Notification Type**

Type of notification to be pushed.

- Broadcast - Send notifications to all the registered devices
- By Tags - Send notifications to devices subscribed to that tag. Can take multiple values seperated by comma(,)
- By DeviceIds - Send notifications to devices by their device ID. Can take multiple values seperated by comma(,)
- Only Android devices - Send notifications to all the registered Android devices
- Only iOS devices - Send notifications to all the registered iOS devices

*Notification Identifiers* - Used when notifications are sent *By Tags and By DeviceIds*. This can take multiple values seperated by comma(,). Example: GoldCoupons,SilverCoupons

Visit this [link](https://new-console.ng.bluemix.net/docs/services/mobilepush/c_overview_push.html) for more information on IBM Push Notification for Bluemix