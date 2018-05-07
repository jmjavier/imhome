const Client = require('castv2-client').Client;
const DefaultMediaReceiver = require('castv2-client').DefaultMediaReceiver;
const mdns = require('mdns');

const getPlayer = function(castTargets, cb) {
  const browser = mdns.createBrowser(mdns.tcp('googlecast'));

  browser.on('serviceUp', function (service) {
    if (castTargets.indexOf(service.txtRecord.fn) !== -1) {
      ondeviceup(service.addresses[0]);
    }
    browser.stop();
  });

  browser.start();

  function ondeviceup(host) {

    const client = new Client();

    client.connect(host, function () {
      console.log('connected, launching app ...');

      client.setVolume({ level: 0.3 }, function(err, newvol){
        if(err) console.log("there was an error setting the volume")
        console.log("volume changed to %s", JSON.stringify(newvol));
      });

      client.launch(DefaultMediaReceiver, function (err, player) {
        player.on('status', function (status) {
          console.log('status broadcast playerState=%s', status.playerState);
        });
        cb(player);
      });

    });

    client.on('error', function (err) {
      console.log('Error: %s', err.message);
      client.close();
    });
  }
}

module.exports = getPlayer;
