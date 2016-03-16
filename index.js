var Scout = require('zetta-scout');
var util = require('util');
var HoneywellTotalConnectSecurity = require('./honeywell_total_connect_security');
var SECURITY_DEVICE_CLASS_ID = 1;

var HoneywellTotalConnectSecurityScout = module.exports = function() {
  Scout.call(this);
};
util.inherits(HoneywellTotalConnectSecurityScout, Scout);

HoneywellTotalConnectSecurityScout.prototype.init = function(next) {
  var securityQuery = this.server.where({ type: 'security' });
  var soapQuery = this.server.where({ type: 'soap' });

  var self = this;
  
  this.server.observe(soapQuery, function(honeywellSoap) {
    for (i=0; i < honeywellSoap.deviceLocations.length; i++) {
      console.log('device list: ' + util.inspect(honeywellSoap.deviceLocations[i].DeviceList.DeviceInfoBasic));
      var deviceLocation = honeywellSoap.deviceLocations[i];
      securityDevices = deviceLocation.DeviceList.DeviceInfoBasic.filter(function(device) {
        return device.DeviceClassID === SECURITY_DEVICE_CLASS_ID;
      });
      for (j=0; j < securityDevices.length; j++) {
        var securityDevice = securityDevices[i];
        (function(deviceLocation, securityDevice){
          console.log('deviceLocation.LocationID: ' +  deviceLocation.LocationID);
          console.log('securityDevice.DeviceID: ' + securityDevice.DeviceID);
          var query = self.server.where({type: 'security', locationID: deviceLocation.LocationID, deviceID: securityDevice.DeviceID});
          self.server.find(query, function(err, results) {
            if (results[0]) {
              self.provision(results[0], HoneywellTotalConnectSecurity, honeywellSoap, deviceLocation, securityDevice);
            } else {
              self.discover(HoneywellTotalConnectSecurity, honeywellSoap, deviceLocation, securityDevice);
            }
          });
        })(deviceLocation, securityDevice);
        next();
      }
    }

  });
}