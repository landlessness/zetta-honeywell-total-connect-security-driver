var util = require('util');
var extend = require('node.extend');

var IMAGE_URL_ROOT = 'http://www.zettaapi.org/icons/';
var IMAGE_EXTENSION = '.png';

var stateImageForDevice = function(device) {
  return IMAGE_URL_ROOT + device.type + '-' + device.state + IMAGE_EXTENSION;
}

module.exports = function(server) {
  ['security'].forEach(function(deviceType){
    var deviceQuery = server.where({ type: deviceType});
    server.observe([deviceQuery], function(device) {
      device.style = extend(true, device.style, {properties: {}, actions: {}});
      device.style.actions = {'update-state-image': {display: 'none'}, 'update-state': {display: 'none'}};
      var states = Object.keys(device._allowed);
      for (i = 0; i < states.length; i++) {
        device._allowed[states[i]].push('update-state-image');
      }
      device._transitions['update-state-image'] = {
        handler: function(updatedStateImage, cb) {
          device.style.properties = extend(device.style.properties, {stateImage: {url: updatedStateImage}});
          cb();
        },
        fields: [
          {name: 'image', type: 'text'}
        ]
      };

      device.call('update-state-image', stateImageForDevice(device));
      var stateStream = device.createReadStream('state');
      stateStream.on('data', function(newState) {
        device.call('update-state-image', stateImageForDevice(device));
      });
    });
  });
}