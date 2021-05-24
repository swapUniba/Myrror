'use strict';

var Q = require('q');
var _ = require('lodash');
var qSend = require('../lib/expressQ').send;
var qErr = require('../lib/expressQ').error;
var router = require('express').Router();
var CrowdPulse = require('./../crowd-pulse-data');
var config = require('../lib/config');

module.exports = function () {

    var asArray = function (value) {
        var terms = [];
        if (!_.isUndefined(value)) {
            terms = _.isArray(value) ? value : [value];
        }
        return terms;
    };

    router.route('/stats/terms')
        // /api/stats/terms?db=sexism&from=2015-10-11&to=2015-10-13&type=tag&terms=aword&terms=anotherword
        .get(function (req, res) {
            var dbConn = new CrowdPulse();
            return dbConn.connect(config.database.url, req.query.db)
                .then(function (conn) {
                    var stats = [];
                    var queryTypes = ['tag', 'category', 'token'];
                    // if the query type is not known, assume all
                    if (_.isUndefined(req.query.type) || queryTypes.indexOf(req.query.type) < 0) {
                        queryTypes.forEach(function (queryType) {
                            stats.push(conn.Message.statTerms(queryType, [], req.query.from, req.query.to, req.query.sentiment, req.query.language, req.query.lat, req.query.lng, req.query.ray));
                        });
                    } else {
                        var terms = asArray(req.query.terms);
                        stats.push(conn.Message.statTerms(req.query.type, terms, req.query.from, req.query.to, req.query.sentiment, req.query.language, req.query.lat, req.query.lng, req.query.ray));
                    }
                    return Q.all(stats);
                })
                .then(function (results) {
                    var result = [];
                    results.forEach(function (r) {
                        result = result.concat(r);
                    });
                    var all = _.sortByOrder(result, ['value'], ['desc']);
                    return all.slice(0, 200);
                })
                .then(qSend(res))
                .catch(qErr(res))
                .finally(function () {
                    dbConn.disconnect();
                });
        });

    var handleGenericStat = function (req, res, handler) {
        var dbConn = new CrowdPulse();
        return dbConn.connect(config.database.url, req.query.db)
            .then(function (conn) {
                var terms = asArray(req.query.terms);
                var users = asArray(req.query.users);
                return handler(conn, req.query.type, terms, req.query.from, req.query.to, req.query.sentiment, req.query.language, req.query.lat, req.query.lng, req.query.ray, req.query.topic, users);
            })
            .then(qSend(res))
            .catch(qErr(res))
            .finally(function () {
                dbConn.disconnect();
            });
    };


    router.route('/stats/sentiment')
        // /api/stats/sentiment?db=sexism&from=2015-10-11&to=2015-10-13&type=tag&terms=aword&terms=anotherword
        .get(function (req, res) {
            return handleGenericStat(req, res, function (conn, type, terms, from, to, sentiment, language, lat, lng, ray) {
                return conn.Message.statSentiment(type, terms, from, to, sentiment, language, lat, lng, ray);
            });
        });

    router.route('/stats/topic')
        // /api/stats/sentiment?db=sexism&from=2015-10-11&to=2015-10-13&type=tag&terms=aword&terms=anotherword
        .get(function (req, res) {
            return handleGenericStat(req, res, function (conn, type, terms, from, to, sentiment, language, lat, lng, ray) {
                return conn.Message.statTopic(type, terms, from, to, sentiment, language, lat, lng, ray);
            });
        });

    router.route('/stats/cluster')
        // /api/stats/sentiment?db=sexism&from=2015-10-11&to=2015-10-13&type=tag&terms=aword&terms=anotherword
        .get(function (req, res) {
            return handleGenericStat(req, res, function (conn, type, terms, from, to, sentiment, language, lat, lng, ray) {
                return conn.Message.statCluster(type, terms, from, to, sentiment, language, lat, lng, ray);
            });
        });

    router.route('/stats/map')
        // /api/stats/sentiment?db=sexism&from=2015-10-11&to=2015-10-13&type=tag&terms=aword&terms=anotherword
        .get(function (req, res) {
            return handleGenericStat(req, res, function (conn, type, terms, from, to, sentiment, language, lat, lng, ray) {

                // use type parameter to save database name if empty
                if (!type) {
                    type = req.query.db;
                }
                return conn.Message.statMap(type, terms, from, to, sentiment, language, lat, lng, ray);
            });
        });

    router.route('/stats/topic/messages')
        // /api/stats/sentiment?db=sexism&from=2015-10-11&to=2015-10-13&type=tag&terms=aword&terms=anotherword
        .get(function (req, res) {
            return handleGenericStat(req, res, function (conn, type, terms, from, to, sentiment, language, lat, lng, ray, topic) {
                console.log(topic);
                return conn.Message.statTopicMessages(type, terms, from, to, sentiment, language, lat, lng, ray, topic);
            });
        });

    router.route('/stats/cluster/messages')
        // /api/stats/sentiment?db=sexism&from=2015-10-11&to=2015-10-13&type=tag&terms=aword&terms=anotherword
        .get(function (req, res) {
            return handleGenericStat(req, res, function (conn, type, terms, from, to, sentiment, language, lat, lng, ray, cluster) {
                return conn.Message.statClusterMessages(type, terms, from, to, sentiment, language, lat, lng, ray, cluster);
            });
        });

    router.route('/stats/sentiment/messages')
        // /api/stats/sentiment?db=sexism&from=2015-10-11&to=2015-10-13&type=tag&terms=aword&terms=anotherword
        .get(function (req, res) {
            return handleGenericStat(req, res, function (conn, type, terms, from, to, sentiment, language, lat, lng, ray, sen) {
                return conn.Message.statSentimentMessages(type, terms, from, to, sentiment, language, lat, lng, ray, sen);
            });
        });


    router.route('/stats/sentiment/timeline')
        // /api/stats/sentiment?db=sexism&from=2015-10-11&to=2015-10-13&type=tag&terms=aword&terms=anotherword
        .get(function (req, res) {
            return handleGenericStat(req, res, function (conn, type, terms, from, to, sentiment, language, lat, lng, ray) {
                return conn.Message.statSentimentTimeline(type, terms, from, to, sentiment, language, lat, lng, ray);
            });
        });

    router.route('/stats/emotion/timeline')
        .get(function (req, res) {
            return handleGenericStat(req, res, function (conn, type, terms, from, to, sentiment, language, lat, lng, ray) {
                return conn.Message.statEmotionTimeline(type, terms, from, to, sentiment, language, lat, lng, ray);
            });
        });

    router.route('/stats/message/timeline')
        // /api/stats/message/timeline?db=sexism&from=2015-10-11&to=2015-10-13&type=tag&terms=aword&terms=anotherword
        .get(function (req, res) {
            return handleGenericStat(req, res, function (conn, type, terms, from, to, sentiment, language, lat, lng, ray) {
                return conn.Message.statMessageTimeline(type, terms, from, to, sentiment, language, lat, lng, ray);
            });
        });

    router.route('/stats/profile/graph')
        // /api/stats/profile/graph?db=sexism&users=frapontillo&users=kotlin
        .get(function (req, res) {
            return handleGenericStat(req, res, function (conn, type, terms, from, to, sentiment, language, lat, lng, ray, topic, users) {
                console.log(users);
                return Q.all([conn.Profile.listGraphNodes(users), conn.Profile.listGraphEdges(users)])
                    .spread(function (nodes, edges) {
                        return {
                            nodes: nodes,
                            edges: edges
                        };
                    });
            })
        });

    router.route('/stats/personal_data/source')
        .get(function (req, res) {
            var dbConn = new CrowdPulse();
            return dbConn.connect(config.database.url, req.query.db).then(function (conn) {
                return conn.PersonalData.statPersonalDataSource();
            })
                .then(qSend(res))
                .catch(qErr(res))
                .finally(function () {
                    dbConn.disconnect();
                });
        });


    router.route('/stats/activity_data/source')
        .get(function (req, res) {
            var dbConn = new CrowdPulse();
            return dbConn.connect(config.database.url, req.query.db).then(function (conn) {
                return conn.PersonalData.statActivityTypeDataFitbit(req.query.from, req.query.to);
            })
                .then(qSend(res))
                .catch(qErr(res))
                .finally(function () {
                    dbConn.disconnect();
                });
        });


    router.route('/stats/activity_line_data/source')
        .get(function (req, res) {
            var dbConn = new CrowdPulse();
            return dbConn.connect(config.database.url, req.query.db).then(function (conn) {
                return conn.PersonalData.statActivityLineTypeDataFitbit(req.query.from, req.query.to);
            })
                .then(qSend(res))
                .catch(qErr(res))
                .finally(function () {
                    dbConn.disconnect();
                });
        });


    router.route('/stats/activity_line_data_steps/source')
        .get(function (req, res) {
            var dbConn = new CrowdPulse();
            return dbConn.connect(config.database.url, req.query.db).then(function (conn) {
                return conn.PersonalData.statActivityLineTypeDataFitbitSteps(req.query.from, req.query.to);
            })
                .then(qSend(res))
                .catch(qErr(res))
                .finally(function () {
                    dbConn.disconnect();
                });
        });

    router.route('/stats/activity_line_data_calories/source')
        .get(function (req, res) {
            var dbConn = new CrowdPulse();
            return dbConn.connect(config.database.url, req.query.db).then(function (conn) {
                return conn.PersonalData.statActivityLineTypeDataFitbitCalories(req.query.from, req.query.to);
            })
                .then(qSend(res))
                .catch(qErr(res))
                .finally(function () {
                    dbConn.disconnect();
                });
        });


    router.route('/stats/sleep_line_data/source')
        .get(function (req, res) {
            var dbConn = new CrowdPulse();
            return dbConn.connect(config.database.url, req.query.db).then(function (conn) {
                return conn.PersonalData.statSleepLineTypeDataFitbit(req.query.from, req.query.to);
            })
                .then(qSend(res))
                .catch(qErr(res))
                .finally(function () {
                    dbConn.disconnect();
                });
        });


    router.route('/stats/sleep_line_data_efficiency/source')
        .get(function (req, res) {
            var dbConn = new CrowdPulse();
            return dbConn.connect(config.database.url, req.query.db).then(function (conn) {
                return conn.PersonalData.statSleepLineTypeDataFitbitEfficiency(req.query.from, req.query.to);
            })
                .then(qSend(res))
                .catch(qErr(res))
                .finally(function () {
                    dbConn.disconnect();
                });
        });


    router.route('/stats/heart_line_data/source')
        .get(function (req, res) {
            var dbConn = new CrowdPulse();
            return dbConn.connect(config.database.url, req.query.db).then(function (conn) {
                return conn.PersonalData.statHeartLineTypeDataFitbit(req.query.from, req.query.to);
            })
                .then(qSend(res))
                .catch(qErr(res))
                .finally(function () {
                    dbConn.disconnect();
                });
        });

    router.route('/stats/diagnosis_bar_data/source')
        .get(function (req, res) {
            var dbConn = new CrowdPulse();
            return dbConn.connect(config.database.url, req.query.db).then(function (conn) {
                return conn.PersonalData.statDiagnosisBarTypeDataTelegram(req.query.from, req.query.to);
            })
                .then(qSend(res))
                .catch(qErr(res))
                .finally(function () {
                    dbConn.disconnect();
                });
        });

    router.route('/stats/analysis_line_data/source')
        .get(function (req, res) {
            var dbConn = new CrowdPulse();
            console.log(req.query.name);
            return dbConn.connect(config.database.url, req.query.db).then(function (conn) {
                return conn.PersonalData.statAnalysisLineTypeDataTelegram(req.query.from, req.query.to, req.query.name);
            })
                .then(qSend(res))
                .catch(qErr(res))
                .finally(function () {
                    dbConn.disconnect();
                });
        });
    router.route('/stats/therapy_table_data/source')
        .get(function (req, res) {
            var dbConn = new CrowdPulse();
            return dbConn.connect(config.database.url, req.query.db).then(function (conn) {
                return conn.PersonalData.statTherapyTableTypeDataTelegram(req.query.from, req.query.to);
            })
                .then(qSend(res))
                .catch(qErr(res))
                .finally(function () {
                    dbConn.disconnect();
                });
        });

    router.route('/stats/medicalVisit_table_data/source')
        .get(function (req, res) {
            var dbConn = new CrowdPulse();
            return dbConn.connect(config.database.url, req.query.db).then(function (conn) {
                return conn.PersonalData.statMedicalVisitTableTypeDataTelegram(req.query.from, req.query.to);
            })
                .then(qSend(res))
                .catch(qErr(res))
                .finally(function () {
                    dbConn.disconnect();
                });
        });

    router.route('/stats/disease_table_data/source')
        .get(function (req, res) {
            var dbConn = new CrowdPulse();
            return dbConn.connect(config.database.url, req.query.db).then(function (conn) {
                return conn.PersonalData.statDiseaseTableTypeDataTelegram(req.query.from, req.query.to);
            })
                .then(qSend(res))
                .catch(qErr(res))
                .finally(function () {
                    dbConn.disconnect();
                });
        });


    router.route('/stats/hospitalization_table_data/source')
        .get(function (req, res) {
            var dbConn = new CrowdPulse();
            return dbConn.connect(config.database.url, req.query.db).then(function (conn) {
                return conn.PersonalData.statHospitalizationTableTypeDataTelegram(req.query.from, req.query.to);
            })
                .then(qSend(res))
                .catch(qErr(res))
                .finally(function () {
                    dbConn.disconnect();
                });
        });


    router.route('/stats/body_data/source')
        .get(function (req, res) {
            var dbConn = new CrowdPulse();
            return dbConn.connect(config.database.url, req.query.db).then(function (conn) {
                return conn.PersonalData.statBodyTypeDataFitbit(req.query.from, req.query.to);
            })
                .then(qSend(res))
                .catch(qErr(res))
                .finally(function () {
                    dbConn.disconnect();
                });
        });


    router.route('/stats/body_line_data/source')
        .get(function (req, res) {
            var dbConn = new CrowdPulse();
            return dbConn.connect(config.database.url, req.query.db).then(function (conn) {
                return conn.PersonalData.statBodyLineTypeDataFitbit(req.query.from, req.query.to);
            })
                .then(qSend(res))
                .catch(qErr(res))
                .finally(function () {
                    dbConn.disconnect();
                });
        });


    router.route('/stats/personal_data/gps')
        .get(function (req, res) {
            var dbConn = new CrowdPulse();
            /*
            return dbConn.connect(config.database.url, req.query.db).then(function (conn) {
                // return conn.PersonalData.statGPSMap(req.query.from, req.query.to, req.query.lat, req.query.lng, req.query.ray);
                return conn.Message.coordinatesMessages(req.query.from, req.query.to, req.query.lat, req.query.lng, req.query.ray);
            })
                .then(qSend(res))
                .catch(qErr(res))
                .finally(function () {
                    dbConn.disconnect();
                });

            */
            return dbConn.connect(config.database.url, req.query.db).then(function (conn) {
                return conn.PersonalData.statGPSMap(req.query.from, req.query.to, req.query.lat, req.query.lng, req.query.ray).then(function (pers_data){
                    return conn.Message.coordinatesMessages(req.query.from, req.query.to, req.query.lat, req.query.lng, req.query.ray).then(function (mess_data){

                        return new Promise(function (resolve, reject){

                            pers_data.forEach(function (data){
                               data.source = 'personalData';
                            });

                            resolve(pers_data.concat(mess_data));
                        });
                    });
                })
            })
                .then(qSend(res))
                .catch(qErr(res))
                .finally(function () {
                    dbConn.disconnect();
                });

        });

    router.route('/stats/personal_data/appinfo/bar')
        .get(function (req, res) {
            var dbConn = new CrowdPulse();
            return dbConn.connect(config.database.url, req.query.db).then(function (conn) {
                return conn.PersonalData.statAppInfoBar(req.query.from, req.query.to, req.query.limitResults, req.query.groupByCategory);
            })
                .then(qSend(res))
                .catch(qErr(res))
                .finally(function () {
                    dbConn.disconnect();
                });
        });

    router.route('/stats/personal_data/appinfo/timeline')
        .get(function (req, res) {
            var dbConn = new CrowdPulse();
            return dbConn.connect(config.database.url, req.query.db).then(function (conn) {
                return conn.PersonalData.statAppInfoTimeline(req.query.from, req.query.to);
            })
                .then(qSend(res))
                .catch(qErr(res))
                .finally(function () {
                    dbConn.disconnect();
                });
        });

    router.route('/stats/personal_data/netstat/timeline')
        .get(function (req, res) {
            var dbConn = new CrowdPulse();
            return dbConn.connect(config.database.url, req.query.db).then(function (conn) {
                return conn.PersonalData.statNetStatTimeline(req.query.from, req.query.to);
            })
                .then(qSend(res))
                .catch(qErr(res))
                .finally(function () {
                    dbConn.disconnect();
                });
        });

    router.route('/stats/personal_data/netstat/bar')
        .get(function (req, res) {
            var dbConn = new CrowdPulse();
            return dbConn.connect(config.database.url, req.query.db).then(function (conn) {
                return conn.PersonalData.statNetStatBar(req.query.from, req.query.to);
            })
                .then(qSend(res))
                .catch(qErr(res))
                .finally(function () {
                    dbConn.disconnect();
                });
        });

    router.route('/stats/personal_data/contact/bar')
        .get(function (req, res) {
            var dbConn = new CrowdPulse();
            return dbConn.connect(config.database.url, req.query.db).then(function (conn) {
                return conn.Connection.statContactBar(req.query.limitResults);
            })
                .then(qSend(res))
                .catch(qErr(res))
                .finally(function () {
                    dbConn.disconnect();
                });
        });

    router.route('/stats/personal_data/display/bar')
        .get(function (req, res) {
            var dbConn = new CrowdPulse();
            return dbConn.connect(config.database.url, req.query.db).then(function (conn) {
                return conn.PersonalData.statDisplayBar(req.query.from, req.query.to);
            })
                .then(qSend(res))
                .catch(qErr(res))
                .finally(function () {
                    dbConn.disconnect();
                });
        });

    router.route('/stats/personal_data/activity')
        .get(function (req, res) {
            var dbConn = new CrowdPulse();
            return dbConn.connect(config.database.url, req.query.db).then(function (conn) {
                return conn.PersonalData.statActivityRawData(req.query.from, req.query.to);
            })
                .then(qSend(res))
                .catch(qErr(res))
                .finally(function () {
                    dbConn.disconnect();
                });
        });


    router.route('/stats/personal_data/activity_fitbit')
        .get(function (req, res) {
            var dbConn = new CrowdPulse();
            return dbConn.connect(config.database.url, req.query.db).then(function (conn) {
                return conn.PersonalData.statActivityRawDataFitbit(req.query.from, req.query.to);
            })
                .then(qSend(res))
                .catch(qErr(res))
                .finally(function () {
                    dbConn.disconnect();
                });
        });


    router.route('/stats/interests/wordcloud')
        .get(function (req, res) {
            var dbConn = new CrowdPulse();
            return dbConn.connect(config.database.url, req.query.db).then(function (conn) {
                return conn.Interest.statWordCloud(req.query.from, req.query.to, req.query.source, req.query.limitResults);
            })
                .then(qSend(res))
                .catch(qErr(res))
                .finally(function () {
                    dbConn.disconnect();
                });
        });

    router.route('/stats/demographics/location')
        .get(function (req, res) {
            var dbConn = new CrowdPulse();
            return dbConn.connect(config.database.url, req.query.db).then(function (conn) {
                return conn.Profile.demographicsLocation();
            })
                .then(qSend(res))
                .catch(qErr(res))
                .finally(function () {
                    dbConn.disconnect();
                });
        });

    router.route('/stats/demographics/gender')
        .get(function (req, res) {
            var dbConn = new CrowdPulse();
            return dbConn.connect(config.database.url, req.query.db).then(function (conn) {
                return conn.Profile.demographicsGender();
            })
                .then(qSend(res))
                .catch(qErr(res))
                .finally(function () {
                    dbConn.disconnect();
                });
        });

    router.route('/stats/demographics/language')
        .get(function (req, res) {
            var dbConn = new CrowdPulse();
            return dbConn.connect(config.database.url, req.query.db).then(function (conn) {
                return conn.Profile.demographicsLanguage();
            })
                .then(qSend(res))
                .catch(qErr(res))
                .finally(function () {
                    dbConn.disconnect();
                });
        });

    return router;
};
