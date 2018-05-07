const Promise = require('bluebird');
const config = require('./config');
const DEVICES = config.devices;
const getPlayer = require('./player');
const exec = require('child_process').exec;
const CHECK_INTERVAL = 5000;
const DEBUG = true;

const logger = function() {
  console.log(...arguments);
}

const play = (url, castTargets) => {
  logger('🎺 attempting to play', url, castTargets);
  getPlayer(castTargets, (player) => {
    const media = {
      contentId: url,
      contentType: 'audio/mp3',
      streamType: 'BUFFERED'
    };
    player.load(media, { autoplay: true }, (err, status) => {
      logger('media loaded playerState', status.playerState);
    });
    player.on('status', function (status) {
      if (status.playerState === "PLAYING") {
        setTimeout(()=>{player.stop()}, 30000);
      }
    });
  });
};


const logIp = (arpLine, device) => {
  const ipAddress = arpLine.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/)[0];
  if (device.hasOwnProperty('ipAddresses') && device.ipAddresses.indexOf(ipAddress) === -1) {
    device.ipAddresses = device.ipAddresses.concat(ipAddress);
  } else {
    device.ipAddresses = [ipAddress];
  }
}

const getMacIp = (stdout, device) => {
  const lines = stdout.split('\n');
  const matches = lines.filter((line) => {
    return line.toLowerCase().indexOf(device.MAC_ADDRESS.toLowerCase()) > - 1;
  });
  matches.forEach((match) => { logIp(match, device); });
}

function promiseFromChildProcess(child) {
  return new Promise(function (resolve, reject) {
      let stdout = '';
      child.addListener('error', reject);
      child.stdout.on('data', (data) => {
        stdout += data;
      });
      child.on('close', function(code) {
        resolve(stdout);
      })
  });
}

updateDevicesOnlineStatuses = () => {
  logger('scanning local network');
  const pings =[];
  for (device in DEVICES) {
    const currentDevice = DEVICES[device];
    const ipAddresses = currentDevice.ipAddresses;
    if (!ipAddresses || ipAddresses.length === 0) {
      currentDevice.online = false;
      continue;
    }
    for (ip in ipAddresses) {
      pings.push(promiseFromChildProcess(exec(`ping -c 4 -W 200 ${ipAddresses[ip]}`)).then((stdout) => {
        const previousOnlineStatus = currentDevice.online;
        const isCurrentlyOnline = stdout.indexOf('100.0% packet loss') === -1;
        if (previousOnlineStatus !== isCurrentlyOnline){
          currentDevice.online = isCurrentlyOnline;
          const emoji = currentDevice.online ? `🏡` : `👋`;
          logger(emoji, currentDevice);
          if (previousOnlineStatus === false && currentDevice.online) {
            const ago = Date.now() - currentDevice.lastUpdate;
            currentDevice.lastUpdate = Date.now();
            if (ago > 1000 * 60 * 60 * 3) {
              play(currentDevice.url, currentDevice.castTargets);
            } else {
              logger('skipping', ago);
            }
          }
        }
      }));
    }
  }
  Promise.all(pings).then(()=>{
    console.log('all the pings are done, queueing up the next one');
    setTimeout(updateDevicesOnlineStatuses, CHECK_INTERVAL);
  });
}

const listenForDevices = () => {
  exec(`arp -a`, (error, stdout, stderr) => {
    for (device in DEVICES) {
      getMacIp(stdout, DEVICES[device]);
    }
    updateDevicesOnlineStatuses();
  });
};

const initialize = () => {
  DEVICES.forEach((device) => {
    device.online = 'INITIAL',
    device.lastUpdate = Date.now()
  });
  listenForDevices();
}

initialize();
