'use strict';

var router = require('express').Router();
var request = require('request');
var qs = require('querystring');
var CrowdPulse = require('./../crowd-pulse-data');
var databaseName = require('./../crowd-pulse-data/databaseName');
var config = require('./../lib/config');
var TelegramProfileSchema = require('./../crowd-pulse-data/schema/telegramProfile');
var batch = require('./../lib/batchOperations');
const DB_PROFILES = databaseName.profiles;

exports.endpoint = function() {


    router.route('/telegram/link_account')
      .post(function (req, res) {
        //axios is used to send a json in post to MilellaBotAPI
        const axios = require('axios')

        axios.post('http://193.204.187.192/MilellaBotAPI/api_gateway.php', {
          username: req.body.username,
            action: "actionGetUserInfo"
        })
        .then((res2) => {
          console.log(`statusCode: ${res2.statusCode}`)
          console.log(res2.data)

          

          //check if an account with given username already exists or not
          try {
            
            
            
            res.status(200);

            res.json({
              username: res2.data[0].username
            });
            updateUserProfile(req.body.mirrorUsername, res2.data[0]);
          } catch(e){
            console.log(e);
            res.status(200);
            res.json({
              username: "This username does not exist"
            });
          }
         
        })
        .catch((error) => {
          console.error(error)
        })

        //ste cose stanno solo per debug, devo toglierle
        var params = {
            username: req.body.mirrorUsername,
            action: "actionGetUserInfo"
        }
        
      
  
      console.log(params.username);
        //fine roba toglibile per debug
    }
    );

  /**
   * Update telegram configuration reading parameters from query.
   */
  router.route('/telegram/config')
  .get(function (req, res) {
    try {
      var params = req.query;
      var dbConnection = new CrowdPulse();
      return dbConnection.connect(config.database.url, DB_PROFILES).then(function (conn) {
        return conn.Profile.findOne({username: req.session.username}, function (err, user) {
          if (user) {

            if (params.shareTherapy !== null && params.shareTherapy !== undefined)
            {
              user.identities.configs.telegramConfig.shareTherapy = params.shareTherapy;
            }

            if (params.shareAnalysis !== null && params.shareAnalysis !== undefined)
            {
              user.identities.configs.telegramConfig.shareAnalysis = params.shareAnalysis;
            }

            if (params.shareMedicalArea !== null && params.shareMedicalArea !== undefined)
            {
              user.identities.configs.telegramConfig.shareMedicalArea = params.shareMedicalArea;
            }

            if (params.shareDiagnosis !== null && params.shareDiagnosis !== undefined)
            {
              user.identities.configs.telegramConfig.shareDiagnosis = params.shareDiagnosis;
            }

            
            user.save();
            res.status(200);
            res.json({auth: true});
          }
          else
          {
            res.sendStatus(404);
          }
        });
      }).then(function () {
        dbConnection.disconnect();
      });

    } catch(err) {
      console.log(err);
      res.sendStatus(500);
    }
  });
  
  /**
   * Delete Fitbit information account.
   */
  router.route('/telegram/delete')
    .delete(function (req, res) {
      try {
        var dbConnection = new CrowdPulse();
        return dbConnection.connect(config.database.url, DB_PROFILES).then(function (conn) {
          return conn.Profile.findOne({username: req.session.username}, function (err, profile) {
            if (profile) {


              profile.identities.telegram = undefined;
              profile.identities.configs.telegramConfig = undefined;
              profile.save();
              deleteMedicalArea(req.session.username, req.session.username);
              deleteMedicalArea(req.session.username, databaseName.globalData);
              deleteAnalysis(req.session.username, req.session.username);
              deleteAnalysis(req.session.username, databaseName.globalData);
              deleteDiagnosis(req.session.username, req.session.username);
              deleteDiagnosis(req.session.username, databaseName.globalData);
              deleteTherapy(req.session.username, req.session.username);
              deleteTherapy(req.session.username, databaseName.globalData);

              res.status(200);
              res.json({auth: true});
            }
          });
        }).then(function () {
          dbConnection.disconnect();
        });

      } catch(err) {
        console.log(err);
        res.sendStatus(500);
      }
    });


    router.route('/telegram/diagnosis')
    .post(function (req, res) {
      try {
        var diagnosisNumber = req.body.diagnosisNumber;

        // if the client do not specify a foods number to read then update the user food
        if (!diagnosisNumber) {

          updateUserDiagnosis(req.session.username).then(function () {
            res.status(200);
            res.json({auth: true});
          });
        } else {

          // return the diagnosis
          var dbConnection = new CrowdPulse();
          return dbConnection.connect(config.database.url, req.session.username).then(function (conn) {
            return conn.PersonalData.find({source: /telegram-diagnosis/}).limit(diagnosisNumber);
          }).then(function (diagnosis) {
            dbConnection.disconnect();
            res.status(200);
            res.json({auth: true, diagnosis: diagnosis});
          });
        }

      } catch(err) {
        console.log(err);
        res.sendStatus(500);
      }
    });

    router.route('/telegram/analysis')
    .post(function (req, res) {
      try {
        var analysisNumber = req.body.analysisNumber;

        // if the client do not specify a analysis number to read then update the user analysis
        if (!analysisNumber) {

          updateUserAnalysis(req.session.username).then(function () {
            res.status(200);
            res.json({auth: true});
          });
        } else {

          // return the analysis
          var dbConnection = new CrowdPulse();
          return dbConnection.connect(config.database.url, req.session.username).then(function (conn) {
            return conn.PersonalData.find({source: /telegram-analysis/}).limit(analysisNumber);
          }).then(function (analysis) {
            dbConnection.disconnect();
            res.status(200);
            res.json({auth: true, analysis: analysis});
          });
        }

      } catch(err) {
        console.log(err);
        res.sendStatus(500);
      }
    });

    router.route('/telegram/therapy')
    .post(function (req, res) {
      try {
        var therapyNumber = req.body.therapyNumber;

        // if the client do not specify a analysis number to read then update the user analysis
        if (!therapyNumber) {

          updateUserTherapy(req.session.username).then(function () {
            res.status(200);
            res.json({auth: true});
          });
        } else {

          // return the analysis
          var dbConnection = new CrowdPulse();
          return dbConnection.connect(config.database.url, req.session.username).then(function (conn) {
            return conn.PersonalData.find({source: /telegram-therapy/}).limit(therapyNumber);
          }).then(function (therapy) {
            dbConnection.disconnect();
            res.status(200);
            res.json({auth: true, therapy: therapy});
          });
        }

      } catch(err) {
        console.log(err);
        res.sendStatus(500);
      }
    });
    router.route('/telegram/medicalArea')
    .post(function (req, res) {
      try {
        var medicalAreaNumber = req.body.medicalAreaNumber;

        // if the client do not specify a analysis number to read then update the user analysis
        if (!medicalAreaNumber) {

          deleteMedicalArea(req.session.username, databaseName.globalData);
          deleteMedicalArea(req.session.username, req.session.username).then(
          updateUserMedicalArea(req.session.username).then(function () {
            res.status(200);
            res.json({auth: true});
          }));
        } else {

          // return the analysis
          var dbConnection = new CrowdPulse();
          return dbConnection.connect(config.database.url, req.session.username).then(function (conn) {
            return conn.PersonalData.find({source: /telegram-medicalArea/}).limit(medicalAreaNumber);
          }).then(function (medicalArea) {
            dbConnection.disconnect();
            res.status(200);
            res.json({auth: true, medicalArea: medicalArea});
          });
        }

      } catch(err) {
        console.log(err);
        res.sendStatus(500);
      }
    });
  
 
    return router;
  };
/**
 * Update the user profile information.
 * @param username
 * @param callback
 */
var updateUserProfile = function(username, userData) {

 
  var dbConnection = new CrowdPulse();
  return dbConnection.connect(config.database.url, DB_PROFILES).then(function (conn) {
    return conn.Profile.findOne({username: username}, function (err, profile) {
      var telegramConfig = profile.identities.configs.telegramConfig;


        // true if it is the first time user requests telegram profile
        var firstRequest = !profile.identities.configs.telegramConfig.shareProfile;

        console.log('telegram: Daily profile extraction:'+  new Date().toDateString());
        // retrieve profile information about the current user

          if (firstRequest)
          {
            // share default value
            telegramConfig.shareProfile = true;
            telegramConfig.shareTherapy = true;
            telegramConfig.shareAnalysis = true;
            telegramConfig.shareMedicalArea = true;
            telegramConfig.shareDiagnosis = true;
           
          }

          // save the telegram user ID
          if (userData.id)
          {
            profile.identities.telegram.telegramId = userData.id;
           
          }

          if(userData.firstname){
            profile.identities.telegram.firstname = userData.firstname
          }

          if(userData.lastname){
            profile.identities.telegram.lastname = userData.lastname
          }
          
          if(userData.username){
            profile.identities.telegram.username = userData.username
          }
        
          if(userData.sex){
            profile.identities.telegram.sex = userData.sex
          }
          if(userData.birth){
            profile.identities.telegram.birth = userData.birth
          }

          if(userData.city){
            profile.identities.telegram.city = userData.city
          }
          if(userData.province){
            profile.identities.telegram.province = userData.province
          }


          profile.save().then(function () {
            console.log("Telegram profile of " + username + " updated at " + new Date());
            dbConnection.disconnect();
          });

       
          if (firstRequest) {
            batch.updateDemographicsForUser(profile.username);
          }
      
    });
  });
};



/**
 * Update the user diagnosis information.
 * @param username
 * 
 */
var updateUserDiagnosis = function(username) {
  var dbConnection = new CrowdPulse();
  return dbConnection.connect(config.database.url, DB_PROFILES).then(function (conn) {
    return conn.Profile.findOne({username: username}, function (err, profile) {
      if (profile) {


        var diagnosisToSave = [];
        var telegramUsername = profile.identities.telegram.username;

        const axios = require('axios')


        var params;

        if (profile.identities.configs.telegramConfig.lastDiagnosisTimestamp ){

          params ={
                username : telegramUsername,
                action : "actionGetDiagnosisSince",
                startdate: profile.identities.configs.telegramConfig.lastDiagnosisTimestamp
          }
          console.log("not first diagnosys request");
        }else{

          params = {  username : telegramUsername,
                      action: "actionGetDiagnosis"
                    }
          console.log("first diagnosys request "+ telegramUsername);
        }
        
        axios.post('http://193.204.187.192/MilellaBotAPI/api_gateway.php', params)
        .then((res2) => {
          console.log(`statusCode: ${res2.statusCode}`)
          console.log(res2.data)

          try {
            
            for (let i = 0; i < res2.data.length; i++) {
              diagnosisToSave.push({
                username: username,
                diagnosis_name: res2.data[i].diagnosis_name,
                diagnosis_accuracy: res2.data[i].diagnosis_accuracy,
                timestamp: res2.data[i].timestamp,
                source: 'telegram-diagnosis'

              })
            }

            storeDiagnosis(diagnosisToSave, username).then(function () {
            storeDiagnosis(diagnosisToSave, databaseName.globalData);
            });
            
          } catch(e){
            console.log(e);
          }
         
        })
        .catch((error) => {
          console.error(error)
        })

        profile.identities.configs.telegramConfig.lastDiagnosisTimestamp = Math.floor(Date.now() / 1000);
        profile.save().then(function () {
          console.log("Telegram profile of " + username + " updated at " + new Date());
          dbConnection.disconnect();
        });

        
        

        
      }
    });
  });
};

/**
 * Update the user analysis information.
 * @param username
 * 
 */
var updateUserAnalysis = function(username) {
  var dbConnection = new CrowdPulse();
  return dbConnection.connect(config.database.url, DB_PROFILES).then(function (conn) {
    return conn.Profile.findOne({username: username}, function (err, profile) {
      if (profile) {


        var analysisToSave = [];
        var telegramUsername = profile.identities.telegram.username;

        const axios = require('axios')


        var params;

        if (profile.identities.configs.telegramConfig.lastAnalysisTimestamp ){

          params ={
                username : telegramUsername,
                action : "actionGetAnalysisSince",
                startdate: profile.identities.configs.telegramConfig.lastAnalysisTimestamp
          }
          console.log("not first Analysis request");
        }else{

          params = {  username : telegramUsername,
                      action: "actionGetAnalysisAll"
                    }
          console.log("first Analysis request "+ telegramUsername);
        }
        
        axios.post('http://193.204.187.192/MilellaBotAPI/api_gateway.php', params)
        .then((res2) => {
          console.log(`statusCode: ${res2.statusCode}`)
         

          try {
            
            for (let i = 0; i < res2.data.length; i++) {
              analysisToSave.push({
                username: username,
                analysisName: res2.data[i].analysisName,
                min: res2.data[i].min,
                max: res2.data[i].max,
                result: res2.data[i].result,
                unit: res2.data[i].unit,
                acronym: res2.data[i].acronym,
                timestamp: res2.data[i].timestamp,
                source: 'telegram-analysis'

              })
            }


            storeAnalysis(analysisToSave, username).then(function () {
            storeAnalysis(analysisToSave, databaseName.globalData);
            });
            
          } catch(e){
            console.log(e);
          }
         
        })
        .catch((error) => {
          console.error(error)
        })
        // il timestamp delle analisi per qualche motivo è in millisecondi
        profile.identities.configs.telegramConfig.lastAnalysisTimestamp = Date.now();
        profile.save().then(function () {
          console.log("Telegram profile of " + username + " updated at " + new Date());
          dbConnection.disconnect();
        });

        
        

        
      }
    });
  });
};
/**
 * Update the user analysis information.
 * @param username
 * 
 */
var updateUserTherapy = function(username) {
  var dbConnection = new CrowdPulse();
  return dbConnection.connect(config.database.url, DB_PROFILES).then(function (conn) {
    return conn.Profile.findOne({username: username}, function (err, profile) {
      if (profile) {


        var therapyToSave = [];
        var telegramUsername = profile.identities.telegram.username;

        const axios = require('axios')


        var params;

        if (profile.identities.configs.telegramConfig.lastTherapyTimestamp ){
          var date = new Date(profile.identities.configs.telegramConfig.lastTherapyTimestamp);
          var year = date.getFullYear();
          var month = date.getMonth() + 1;
          var day = date.getDate();
          var startdate = year+"-"+month +"-"+day;
          console.log(startdate);
          params ={
                username : telegramUsername,
                action : "actionGetTherapySince",
                startdate: startdate,
          }
          console.log("not first Therapy request");
          
        }else{

          params = {  username : telegramUsername,
                      action: "actionGetTherapy"
                    }
          console.log("first Therapy request "+ telegramUsername);
        }
        
        axios.post('http://193.204.187.192/MilellaBotAPI/api_gateway.php', params)
        .then((res2) => {
          console.log(`statusCode: ${res2.statusCode}`)

         

          try {
            
            for (let i = 0; i < res2.data.length; i++) {
              therapyToSave.push({
                username: username,
                timestamp: new Date(res2.data[i].start_date).getTime(),
                therapyName: res2.data[i].therapyName,
                dosage: res2.data[i].dosage,
                start_date: res2.data[i].start_date,
                end_date: res2.data[i].end_date,
                type: res2.data[i].type,
                drug_name: res2.data[i].drug_name,               
                inteval_days: res2.data[i].inteval_days,
                day: res2.data[i].day,
                hour: res2.data[i].hour,
                source: 'telegram-therapy'

              })
            }

            console.log(therapyToSave);


            storeTherapy(therapyToSave, username).then(function () {
            storeTherapy(therapyToSave, databaseName.globalData);
            });
            
          } catch(e){
            console.log(e);
          }
         
        })
        .catch((error) => {
          console.error(error)
        })
        profile.identities.configs.telegramConfig.lastTherapyTimestamp = Date.now();
        profile.save().then(function () {
          console.log("Telegram profile of " + username + " updated at " + new Date());
          dbConnection.disconnect();
        });

        
        

        
      }
    });
  });
};

/**
 * Update the user medicalArea information.
 * @param username
 * 
 */
var updateUserMedicalArea = function(username) {
  var dbConnection = new CrowdPulse();
  return dbConnection.connect(config.database.url, DB_PROFILES).then(function (conn) {
    return conn.Profile.findOne({username: username}, function (err, profile) {
      if (profile) {


        var medicalAreaToSave = [];
        var telegramUsername = profile.identities.telegram.username;

        const axios = require('axios')


        var params;

        

          params ={
                username : telegramUsername,
                action : "actionGetMedicalArea",
          }
          console.log("updating Medical Area");

        
        axios.post('http://193.204.187.192/MilellaBotAPI/api_gateway.php', params)
        .then((res2) => {
          console.log(`statusCode: ${res2.statusCode}`)
          console.log(res2.data)

          try {
            
            for (let i = 0; i < res2.data.length; i++) {
              medicalAreaToSave.push({
                username: username,
                medicalArea: res2.data[i].medicalArea,
               
                source: 'telegram-medicalArea'

              })
            }

            storemedicalArea(medicalAreaToSave, username).then(function () {
            storemedicalArea(medicalAreaToSave, databaseName.globalData);
            });
            
          } catch(e){
            console.log(e);
          }
         
        })
        .catch((error) => {
          console.error(error)
        })

        profile.save().then(function () {
          console.log("Telegram profile of " + username + " updated at " + new Date());
          dbConnection.disconnect();
        });

        
        

        
      }
    });
  });
};
/**
 * Store Diagnosiss in the MongoDB database
 * @param Diagnosiss
 * @param databaseName
 */
var storeDiagnosis = function(Diagnosiss, databaseName) {

  var dbConnection = new CrowdPulse();
  var DiagnosisSaved = 0;
  return dbConnection.connect(config.database.url, databaseName).then(function (conn) {
    if (Diagnosiss.length <= 0) {
      return dbConnection.disconnect();
    }
    Diagnosiss.forEach(function (Diagnosis) {

      return conn.PersonalData.newFromObject(Diagnosis).save().then(function () {
        DiagnosisSaved++;

        if (DiagnosisSaved >= Diagnosiss.length) {
          console.log(Diagnosiss.length + " Diagnosiss from MilellaBotAPI saved in " + databaseName + " at " + new Date());
          return dbConnection.disconnect();
        }
      });
    });
  });
};


/**
 * StoreAnalysis in the MongoDB database
 * @param Analysis
 * @param databaseName
 */
var storeAnalysis = function(analyses, databaseName) {

  var dbConnection = new CrowdPulse();
  var analysisSaved = 0;
  return dbConnection.connect(config.database.url, databaseName).then(function (conn) {
    if (analyses.length <= 0) {
      return dbConnection.disconnect();
    }
    analyses.forEach(function (analysis) {

      return conn.PersonalData.newFromObject(analysis).save().then(function () {
        analysisSaved++;

        if (analysisSaved >= analyses.length) {
          console.log(analyses.length + " analyses from MilellaBotAPI saved in " + databaseName + " at " + new Date());
          return dbConnection.disconnect();
        }
      });
    });
  });
};

var storeTherapy = function(therapies, databaseName) {

  var dbConnection = new CrowdPulse();
  var therapiesaved = 0;
  return dbConnection.connect(config.database.url, databaseName).then(function (conn) {
    if (therapies.length <= 0) {
      return dbConnection.disconnect();
    }
    therapies.forEach(function (Therapy) {

      return conn.PersonalData.newFromObject(Therapy).save().then(function () {
        therapiesaved++;

        if (therapiesaved >= therapies.length) {
          console.log(therapies.length + " therapies from MilellaBotAPI saved in " + databaseName + " at " + new Date());
          return dbConnection.disconnect();
        }
      });
    });
  });
};

/**
 * Store medicalArea in the MongoDB database
 * @param medicalArea
 * @param databaseName
 */
var storemedicalArea = function(medicalArea, databaseName) {

  var dbConnection = new CrowdPulse();
  var medicalAreaSaved = 0;
  return dbConnection.connect(config.database.url, databaseName).then(function (conn) {
    if (medicalArea.length <= 0) {
      return dbConnection.disconnect();
    }
    medicalArea.forEach(function (Diagnosis) {

      return conn.PersonalData.newFromObject(Diagnosis).save().then(function () {
        medicalAreaSaved++;

        if (medicalAreaSaved >= medicalArea.length) {
          console.log(medicalArea.length + " medicalArea from MilellaBotAPI saved in " + databaseName + " at " + new Date());
          return dbConnection.disconnect();
        }
      });
    });
  });
};

/**
 * Delete medical area stored in the MongoDB database
 * @param username
 * @param databaseName
 */
var deleteMedicalArea = function(username, databaseName) {
  var dbConnection = new CrowdPulse();
  return dbConnection.connect(config.database.url, databaseName).then(function (conn) {
    return conn.PersonalData.deleteMany({username: username, source: /telegram-medicalArea.*/}, function (err) {
      if (err) {
        console.log(err);
      } else {
        console.log("Telegram Medical Area deleted from " + databaseName + " at " + new Date());
      }
      return dbConnection.disconnect();
    });
  });
};


/**
 * Delete therapies stored in the MongoDB database
 * @param username
 * @param databaseName
 */
var deleteTherapy = function(username, databaseName) {
  var dbConnection = new CrowdPulse();
  return dbConnection.connect(config.database.url, databaseName).then(function (conn) {
    return conn.PersonalData.deleteMany({username: username, source: /telegram-therapy.*/}, function (err) {
      if (err) {
        console.log(err);
      } else {
        console.log("Telegram Therapy deleted from " + databaseName + " at " + new Date());
      }
      return dbConnection.disconnect();
    });
  });
};


/**
 * Delete analyses stored in the MongoDB database
 * @param username
 * @param databaseName
 */
var deleteAnalysis = function(username, databaseName) {
  var dbConnection = new CrowdPulse();
  return dbConnection.connect(config.database.url, databaseName).then(function (conn) {
    return conn.PersonalData.deleteMany({username: username, source: /telegram-analysis.*/}, function (err) {
      if (err) {
        console.log(err);
      } else {
        console.log("Telegram Analysis deleted from " + databaseName + " at " + new Date());
      }
      return dbConnection.disconnect();
    });
  });
};


/**
 * Delete Diagnoses stored in the MongoDB database
 * @param username
 * @param databaseName
 */
var deleteDiagnosis = function(username, databaseName) {
  var dbConnection = new CrowdPulse();
  return dbConnection.connect(config.database.url, databaseName).then(function (conn) {
    return conn.PersonalData.deleteMany({username: username, source: /telegram-diagnosis.*/}, function (err) {
      if (err) {
        console.log(err);
      } else {
        console.log("Telegram Diagnosis deleted from " + databaseName + " at " + new Date());
      }
      return dbConnection.disconnect();
    });
  });
};