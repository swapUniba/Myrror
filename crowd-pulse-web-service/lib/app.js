var path = require('path');

var http = require('http');
var socket = require('socket.io');
var express = require('express');
var schedule = require('node-schedule');

var session = require('express-session');
var cookieParser = require('cookie-parser');
var cors = require('cors');
var logger = require('morgan');
var bodyParser = require('body-parser');
var RateLimit = require('express-rate-limit');

var CrowdPulse = require('./../crowd-pulse-data');
var batch = require('./batchOperations');

var bootstrapMeMaybe = require('./../bootstrap/bootstrap');
var validationRequest = require('./validateRequest');
var validationScope = require('./validateScope');

var endpointProjects = require('./../endpoint/projects');
var endpointDatabases = require('./../endpoint/databases');
var endpointTerms = require('./../endpoint/terms');
var endpointStats = require('./../endpoint/stats');
var endpointProfiles = require('./../endpoint/profiles');
var endpointLanguages = require('./../endpoint/languages');
var twitter = require('./../endpoint/twitter');
var facebook = require('./../endpoint/facebook');
var linkedIn = require('./../endpoint/linkedin');
var fitbit = require('./../endpoint/fitbit');
var telegram = require('./../endpoint/telegram');
var music = require('./../endpoint/music');
var news = require('./../endpoint/news');
var training = require('./../endpoint/training');
var programmatv = require('./../endpoint/programmatv');
var removeInterest = require('../endpoint/removeInterest');
var video = require('./../endpoint/video');
var recipes = require('./../endpoint/recipes');
var instagram = require('./../endpoint/instagram');

var endpointAuth = require('./../endpoint/auth');
var socketLogs = require('./../sockets/logs');
var socketMobileApp = require('./../sockets/mobileapp');

var config = require('./config');

// the main server
var server = undefined;

// the express application
var app = {};

// the websocket server
var io = undefined;

var crowdPulse = new CrowdPulse();

var connect = function() {
  return crowdPulse.connect(config.database.url, config.database.db);
};

var webServiceSetup = function(crowdPulse) {

  // create the application and bind it to a server
  app = express();
  server = http.createServer(app);

  // setup middlewares
  app.use(cookieParser());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({extended: true}));
  app.use(logger('dev'));
  app.use(cors());
  app.use(new RateLimit({
    windowMs: 15 * 60 * 1000,       // 15 minutes
    max: 5000,                       // limit each IP to 250 requests per windowMs
    delayMs: 0                      // disable delaying - full speed until the max limit is reached
  }));

  // TODO: add more endpoints here
  var API = '/api';
  var AUTH = '/auth';

  // used to restrict API access
  app.all(API + '/*', [validationRequest, validationScope]);

  app.use(API, endpointProjects(crowdPulse));
  app.use(API, endpointDatabases(crowdPulse));
  app.use(API, endpointTerms(crowdPulse));
  app.use(API, endpointStats(crowdPulse));
  app.use(API, endpointProfiles(crowdPulse));
  app.use(API, endpointLanguages(crowdPulse));
  app.use(API, twitter.endpoint());
  app.use(API, telegram.endpoint());
  app.use(API, facebook.endpoint());
  app.use(API, linkedIn.endpoint());
  app.use(API, fitbit.endpoint());
  app.use(API, instagram.endpoint());
  app.use(AUTH, endpointAuth());
  app.use(API, music.endpoint());
  app.use(API, training.endpoint());
  app.use(API,news.endpoint());
  app.use(API,programmatv.endpoint());
  app.use(API,video.endpoint());
  app.use(API,recipes.endpoint());
  app.use(API,removeInterest.endpoint());

  return crowdPulse;
};

var webSocketSetup = function() {
  io = socket(server);
  socketLogs(io, crowdPulse);
  socketMobileApp(io);
};

// updating data jobs (eg. Twitter user data, stats, etc.)
// how to set timeout in the correct way: https://github.com/node-schedule/node-schedule#cron-style-scheduling
var scheduleJobSetup = function () {
  var crowdPulseRunTimeout = config.batch.crowdPulseRunTimeout;
  if (!crowdPulseRunTimeout || crowdPulseRunTimeout === '') {
    crowdPulseRunTimeout =  '30 0 * * *';    // thirty past midnight
  }
  schedule.scheduleJob(crowdPulseRunTimeout, function(){
    batch.executeCrowdPulseProjects();
  });

  var socialProfileTimeout = config.batch.socialProfileTimeout;
  if (!socialProfileTimeout || socialProfileTimeout === '') {
    socialProfileTimeout =  '0 0 * * *';    // midnight
  }
  schedule.scheduleJob(socialProfileTimeout, function(){
    batch.updateUserSocialInformation(true, true, true, true);
  });

  var cleaningPersonalDataTimeout = config.batch.cleaningPersonalDataTimeout;
  if (!cleaningPersonalDataTimeout || cleaningPersonalDataTimeout === '') {
    cleaningPersonalDataTimeout =  '*/30 * * * *'; // every thirty minutes
  }
  schedule.scheduleJob(cleaningPersonalDataTimeout, function(){
    batch.cleanPersonalData();
  });

  var demographicsTimeout = config.batch.demographicsTimeout;
  if (!demographicsTimeout || demographicsTimeout === '') {
    demographicsTimeout =  '0 0 1 * *'; // midnight of the first day of the month
  }
  schedule.scheduleJob(demographicsTimeout, function(){
    batch.updateDemographics();
  });

  var interestsTimeout = config.batch.interestsTimeout;
  if (!interestsTimeout || interestsTimeout === '') {
    interestsTimeout =  '0 0 * * *'; // midnight
  }
  schedule.scheduleJob(interestsTimeout, function(){
    batch.updateInterests();
  });
};

module.exports = function() {
  return connect()
      .then(function() {
        return bootstrapMeMaybe(crowdPulse, config);
      })
      .then(function() {
        return webServiceSetup(crowdPulse);
      })
      .then(function() {
        return webSocketSetup(crowdPulse);
      })
      .then(function () {
        return scheduleJobSetup();
      })
      .then(function() {

        app.set('port', config.port || process.env.PORT || 5000);

        server.listen(app.get('port'), function() {
          console.log('Crowd Pulse Web Service listening at %s:%s...',
              server.address().address, server.address().port);
          console.log('Press CTRL+C to quit.');
        });

        return {
          app: app,
          io: io,
          server: server,
          crowdPulse: crowdPulse
        };
      })
      .catch(function(err) {
        console.error(err.stack);
      });
};
