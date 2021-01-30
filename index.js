#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const io = require('socket.io-client');
const jwt = require('jsonwebtoken');
const get = require('lodash/get');
var gamepad = require("gamepad");

console.log("Testing");

gamepad.init();

for (var i = 0, l = gamepad.numDevices(); i < l; i++) {
    console.log(i, gamepad.deviceAtIndex());
}

const generateAccessToken = function(payload, secret, expiration) {
    const token = jwt.sign(payload, secret, {
        expiresIn: expiration
    });

    return token;
};

// Get secret key from the config file and generate an access token
const getUserHome = function() {
    return process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
};

module.exports = function(options, callback) {
    options = options || {};
    options.secret = get(options, 'secret', process.env['CNCJS_SECRET']);
    options.baudrate = get(options, 'baudrate', 115200);
    options.socketAddress = get(options, 'socketAddress', 'localhost');
    options.socketPort = get(options, 'socketPort', 8000);
    options.controllerType = get(options, 'controllerType', 'Grbl');
    options.accessTokenLifetime = get(options, 'accessTokenLifetime', '30d');

    if (!options.secret) {
        const cncrc = path.resolve(getUserHome(), '.cncrc');
        try {
            const config = JSON.parse(fs.readFileSync(cncrc, 'utf8'));
            options.secret = config.secret;
        } catch (err) {
            console.error(err);
            process.exit(1);
        }
    }

    const token = generateAccessToken({ id: '', name: 'cncjs-pendant' }, options.secret, options.accessTokenLifetime);
    const url = 'ws://' + options.socketAddress + ':' + options.socketPort + '?token=' + token;

    socket = io.connect('ws://' + options.socketAddress + ':' + options.socketPort, {
        'query': 'token=' + token
    });

    socket.on('connect', () => {
        console.log('Connected to ' + url);

        // Open port
        socket.emit('open', options.port, {
            baudrate: Number(options.baudrate),
            controllerType: options.controllerType
        });
    });

    socket.on('error', (err) => {
        console.error('Connection error.');
        if (socket) {
            socket.destroy();
            socket = null;
        }
    });

    socket.on('close', () => {
        console.log('Connection closed.');
    });

    socket.on('serialport:open', function(options) {
        options = options || {};

        console.log('Connected to port "' + options.port + '" (Baud rate: ' + options.baudrate + ')');

        callback(null, socket);
    });

    socket.on('serialport:error', function(options) {
        callback(new Error('Error opening serial port "' + options.port + '"'));
    });

    socket.on('serialport:read', function(data) {
        console.log((data || '').trim());
    });

    /*
    socket.on('serialport:write', function(data) {
        console.log((data || '').trim());
    });
    */
};

// Create a game loop and poll for events
setInterval(gamepad.processEvents, 50);
// Scan for new gamepads as a slower rate
setInterval(gamepad.detectDevices, 500);

var sensitiity = 1;
var left_x = 0;
var left_y = 0;
var right_z = 0;
var x_step_size = 128;
var y_step_size = 128;
var z_step_size = 5;

// [Function] map(value, fromLow, fromHigh, toLow, toHigh)   https://www.arduino.cc/en/Reference/Map
function map(x, in_min, in_max, out_min, out_max)
{
  return Number((x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min);
}

// Listen for move events on all gamepads
gamepad.on("move", function (id, axis, value) {
  switch(axis) {
    case 0:
      //Left joy left right
      //X axis
      left_x = map(value, 1,-1, 2, -2).toFixed(4);
      //!!!!!!!!!!!!!!!!! need to detect if it's in inches or millimetersmm to avoid and overrun in the multiplier this can be done with agreeable status I believe.
      socket.emit('command', options.port, 'gcode', 'G21');  // set to millimeters

      // Move based on stick imput and mapping, need to add exponital curve.
      socket.emit('command', options.port, 'gcode', 'G91 G0 X' + left_x);// + ' Y' + map(sum_y, 0, 128, 0.0001, 2).toFixed(4)); // Switch to relative coordinates, Move one unit right in X and one unit right in Y
      socket.emit('command', options.port, 'gcode', 'G90'); 
      break;
    case 1:
      //Right joy up down
      //Y axis
      left_y = map(value, 1,-1, 2, -2).toFixed(4);
      //!!!!!!!!!!!!!!!!! need to detect if it's in inches or millimetersmm to avoid and overrun in the multiplier this can be done with agreeable status I believe.
      socket.emit('command', options.port, 'gcode', 'G21');  // set to millimeters

      // Move based on stick imput and mapping, need to add exponital curve.
      socket.emit('command', options.port, 'gcode', 'G91 G0 Y' + left_y); // Switch to relative coordinates, Move one unit right in X and one unit right in Y
      socket.emit('command', options.port, 'gcode', 'G90'); 
      break;
    case 2:
      //Left trigger
      break;
    case 3:
      // Right joy left right
      break;
    case 4:
      // Right joy up down
      right_z = map(value, 1,-1, 1, -1).toFixed(4);
      break;
    case 5:
      // Right Trigger
      break;
    case 6:
      // Dpad left and right
      break;
    case 7:
      // Dpad up and down
      break;

  }
  console.log("move", {x: left_x, y: left_y, z: right_z});
  // console.log("move", {
  //     id: id,
  //     axis: axis,
  //     value: value,
  // });
});

// // Listen for button up events on all gamepads
// gamepad.on("up", function (id, num) {
//     console.log("up", {
//         id: id,
//         num: num,
//     });
// });
   
// Listen for button down events on all gamepads
var feedhold = false;

gamepad.on("down", function (id, num) {
    switch(num) {
      case 0:
        console.log("A");
        A = true;
        break;
      case 1:
        console.log("B");
        B = true;
        break;
      case 2:
        console.log("X");
        X = true;
        break;
      case 3:
        console.log("Y");
        Y = true;
        break;
      case 4:
        console.log("LJ");
        LJ = true;
        break;
      case 5:
        console.log("RJ");
        RJ = true;
        break;
      case 6:
        console.log("BACK");
        BACK = true;
        break;
      case 7:
        console.log("START");
        START = true
        break;
      case 8:
        console.log("LOGO");
        LOGO = true;
        break;
      case 9:
        console.log("LB");
        LB = true;
        break;
      case 10:
        console.log("RB");
        RB = true;
        break;
      default:
        console.log("down", {
          id: id,
          num: num,
        });
    };
});

gamepad.on("up", function (id, num) {
  switch(num) {
    case 0:
      console.log("A");
      A = false;
      break;
    case 1:
      console.log("B");
      break;
    case 2:
      console.log("X");
        // socket.emit('command', options.port, 'pause');
      break;
    case 3:
      console.log("Y");
      break;
    case 4:
      console.log("LJ");
      LJ = false;
      break;
    case 5:
      console.log("RJ");
      RJ = false;
      break;
    case 6:   
      console.log("BACK");
      socket.emit('command', options.port, 'stop');
      break;
    case 7:
      console.log("START");
      if (feedhold) { 
        // socket.emit('command', options.port, 'start');
				socket.emit('command', options.port, 'resume');
        feedhold = false;
      }
      else {      //Cycle Start
				socket.emit('command', options.port, 'cyclestart');
      }
      break;
    case 8:
      console.log("LOGO");
      // LOGO = false;
      socket.emit('command', options.port, 'feedhold');
      feedhold = true;

      break;
    case 9:
      console.log("LB");
      LB = false;
      break;
    case 10:
      console.log("RB");
      RB = false;
      break;
    default:
      console.log("up", {
        id: id,
        num: num,
      });
  };
});
