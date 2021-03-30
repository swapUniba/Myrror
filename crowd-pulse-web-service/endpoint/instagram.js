'use strict';

var router = require('express').Router();
const got = require('got');
var CrowdPulse = require('./../crowd-pulse-data');
var databaseName = require('./../crowd-pulse-data/databaseName');
var config = require('./../lib/config');
var InstagramProfileSchema = require('./../crowd-pulse-data/schema/instagramProfile');
var batch = require('./../lib/batchOperations');

const DB_PROFILES = databaseName.profiles;
const DEFAULT_LANGUAGE = 'en';

const userInstagram = require("user-instagram");
const axios = require('axios');

exports.endpoint = function () {

    /**
     * Link an Instagram user profile.
     * Params:
     *    username - the username of the profile to link
     */
    router.route('/instagram/link_account')
        .post(function (req, res) {
            try {
                userInstagram(req.body.username).then(function (user) {
                    if (user.isPrivate) {
                        res.status(200);
                        res.json({auth: false, private: true});
                    } else {
                        setUserProfile(req.body.myrror_user, user);
                        res.status(200);
                        res.json({auth: true, private: false});
                    }
                }).catch(function (e) {
                    res.status(200);
                    res.json({auth: false, private: false});
                });

            } catch (err) {
                console.log(err);
                res.sendStatus(500);
            }

        });

    /**
     * Get Instagram user profile information.
     * Params:
     *    username - the username of the profile to link
     */
    router.route('/instagram/profile')
        .get(function (req, res) {
            try {
                updateUserProfile(req.session.username, function (profile) {
                    if (profile) {
                        res.status(200);
                        res.json({auth: true, user: profile});
                    } else {
                        res.status(400);
                        res.json({auth: true});
                    }
                });
            } catch (err) {
                console.log(err);
                res.sendStatus(500);
            }
        });

    /**
     * Update Instagram configuration reading parameters from query.
     */
    router.route('/instagram/config')
        .get(function (req, res) {
            try {
                var params = req.query;
                var dbConnection = new CrowdPulse();
                return dbConnection.connect(config.database.url, DB_PROFILES).then(function (conn) {
                    return conn.Profile.findOne({username: req.session.username}, function (err, user) {
                        if (user) {

                            if (params.shareProfile !== null && params.shareProfile !== undefined) {
                                user.identities.configs.instagramConfig.shareProfile = params.shareProfile;
                            }
                            if (params.shareMessages !== null && params.shareMessages !== undefined) {
                                user.identities.configs.instagramConfig.shareMessages = params.shareMessages;
                                updateShareMessages(user.identities.configs.instagramConfig.instagramId, req.session.username, params.shareMessages);
                                updateShareMessages(user.identities.configs.instagramConfig.instagramId, databaseName.globalData, params.shareMessages);
                            }

                            user.save();

                            res.status(200);
                            res.json({auth: true});

                        } else {
                            res.sendStatus(404);
                        }
                    });
                }).then(function () {
                    dbConnection.disconnect();
                });

            } catch (err) {
                console.log(err);
                res.sendStatus(500);
            }
        });

    /**
     * Get Instagram user posts.
     * Params:
     *    messages - the number of messages to retrieve
     */
    router.route('/instagram/posts')
        .post(function (req, res) {
            try {
                var messagesToRead = req.body.messages;

                // if the client do not specify a messages number to read then update the user messages
                if (!messagesToRead) {
                    updatePosts(req.session.username).then(function () {
                        res.status(200);
                        res.json({auth: true});
                    });
                } else {

                    // return the messages
                    var dbConnection = new CrowdPulse();
                    return dbConnection.connect(config.database.url, req.session.username).then(function (conn) {
                        return conn.Message.find({source: /instagram_.*/}).sort({date: -1}).limit(messagesToRead);
                    }).then(function (messages) {
                        dbConnection.disconnect();
                        res.status(200);
                        res.json({auth: true, messages: messages});
                    });
                }

            } catch (err) {
                console.log(err);
                res.sendStatus(500);
            }
        });

    /**
     * Delete Instagram information account, including posts.
     */
    router.route('/instagram/delete')
        .delete(function (req, res) {
            try {
                var dbConnection = new CrowdPulse();
                return dbConnection.connect(config.database.url, DB_PROFILES).then(function (conn) {
                    return conn.Profile.findOne({username: req.session.username}, function (err, profile) {
                        if (profile) {

                            var instagramId = profile.identities.instagram.instagramId;
                            deleteMessages(instagramId, req.session.username);
                            deleteMessages(instagramId, databaseName.globalData);
                            deleteFriends(req.session.username, req.session.username);
                            deleteFriends(req.session.username, databaseName.globalData);

                            profile.identities.instagram = undefined;
                            profile.identities.configs.instagramConfig = undefined;
                            profile.save();

                            res.status(200);
                            res.json({auth: true});
                        }
                    });
                }).then(function () {
                    dbConnection.disconnect();
                });

            } catch (err) {
                console.log(err);
                res.sendStatus(500);
            }
        });

    return router;
};

/**
 * Set the user profile information for the first time.
 * @param myrrorUsername
 * @param userData
 */
var setUserProfile = function (myrrorUsername, userData) {

    var dbConnection = new CrowdPulse();
    dbConnection.connect(config.database.url, DB_PROFILES).then(function (conn) {
        conn.Profile.findOne({username: myrrorUsername}, function (err, profile) {

            // save the Instagram user ID
            profile.identities.instagram.instagramId = userData.id;
            profile.identities.configs.instagramConfig.instagramId = userData.id;

            // share default value
            profile.identities.configs.instagramConfig.shareMessages = true;
            profile.identities.configs.instagramConfig.shareProfile = true;

            profile.identities.instagram.username = userData.username;
            profile.identities.instagram.full_name = userData.fullName;
            profile.identities.instagram.bio = userData.biography;
            profile.identities.instagram.website = userData.link;
            profile.identities.instagram.picture = userData.profilePicHD;
            profile.identities.instagram.follows = userData.subscribtions;
            profile.identities.instagram.followed_by = userData.subscribersCount;

            // change profile picture
            if (profile.identities.instagram.picture) {
                profile.pictureUrl = profile.identities.instagram.picture;
            }

            profile.save().then(function () {
                console.log("Instagram profile of " + myrrorUsername + " setted at " + new Date());
                dbConnection.disconnect();
            });

            // update demographics data
            batch.updateDemographicsForUser(profile.username);


        });
    });
};

/**
 * Update the user profile information.
 * @param username
 * @param callback
 */
var updateUserProfile = function (username, callback) {

    // default empty callback
    if (!callback) {
        callback = function () {
        }
    }

    var dbConnection = new CrowdPulse();
    return dbConnection.connect(config.database.url, DB_PROFILES).then(function (conn) {
        return conn.Profile.findOne({username: username}, function (err, profile) {
            var instagramUsername = profile.identities.instagram.username;

            userInstagram(instagramUsername).then(function (userData) {
                profile.identities.instagram.full_name = userData.fullName;
                profile.identities.instagram.bio = userData.biography;
                profile.identities.instagram.website = userData.link;
                profile.identities.instagram.picture = userData.profilePicHD;
                profile.identities.instagram.follows = userData.subscribtions;
                profile.identities.instagram.followed_by = userData.subscribersCount;

                // change profile picture
                if (profile.identities.instagram.picture) {
                    profile.pictureUrl = profile.identities.instagram.picture;
                }

                profile.save().then(function () {
                    console.log("Instagram profile of " + username + " updated at " + new Date());
                    dbConnection.disconnect();
                });

                callback(profile);

            }).catch(function () {
                callback(null);
                dbConnection.disconnect();
            });

        });
    });
};

/**
 * Update user posts.
 * @param username
 */
var updatePosts = function (username) {
    var dbConnection = new CrowdPulse();

    return dbConnection.connect(config.database.url, DB_PROFILES).then(function (conn) {
        return conn.Profile.findOne({username: username}, function (err, profile) {
            if (profile) {
                var instagramUsername = profile.identities.instagram.username;
                dbConnection.disconnect();

                var instagramConfig = profile.identities.configs.instagramConfig;

                var share = instagramConfig.shareMessages;

                userInstagram(instagramUsername).then(function (user) {

                    var messages = [];

                    var formatted_posts_info = user.posts.map(async function (post) {

                        var location_name = null;
                        var location_latitude = null;
                        var location_longitude = null;

                        if (post.location) {
                            location_name = post.location.name;

                            var coordinates = await get_location_coordinate(post.location.id);
                            if(coordinates){
                                location_latitude = coordinates.latitude;
                                location_longitude = coordinates.longitude;
                            }
                        }

                        var description = '';
                        if (post.caption) {
                            description = post.caption;
                        }

                        var images = [];
                        if (post.children.length > 0) {
                            post.children.forEach(function (childPicture) {
                                images.push(childPicture.imageUrl);
                            })
                        } else {
                            images.push(post.imageUrl);
                        }

                        return {
                            oId: post.timestamp,
                            text: description,
                            source: 'instagram_' + instagramConfig.instagramId,
                            fromUser: instagramConfig.instagramId,
                            date: new Date(post.timestamp * 1000), //unix time *1000
                            images: images,
                            likes: post.likesCount,
                            comments: post.commentsCount,
                            location: location_name,
                            latitude: location_latitude,
                            longitude: location_longitude,
                            language: DEFAULT_LANGUAGE,
                            share: share
                        };

                    });
                    Promise.all(formatted_posts_info).then(result => {
                        result.forEach(function (res) {
                            instagramConfig.lastPostId = instagramConfig.lastPostId ? instagramConfig.lastPostId : '0';

                            if (instagramConfig.lastPostId < res.oId) {
                                messages.push(res);
                            }
                        });

                        storeMessages(messages, username).then(function () {
                            storeMessages(messages, databaseName.globalData).then(function () {

                                // if new messages are saved
                                if (messages.length > 0) {

                                    // create new db connection to save last post timestamp in the user profile config
                                    dbConnection = new CrowdPulse();
                                    dbConnection.connect(config.database.url, DB_PROFILES).then(function (conn) {
                                        conn.Profile.findOne({username: username}, function (err, profile) {
                                            if (profile) {
                                                profile.identities.configs.instagramConfig.lastPostId = messages[0].oId;

                                                profile.save().then(function () {
                                                    dbConnection.disconnect();
                                                });
                                            }
                                        });
                                    });

                                    // run CrowdPulse
                                    var projects = config['crowd-pulse'].projects;
                                    if (projects && projects.length > 0) {

                                        // loop projects with a delay between each run
                                        (function loopWithDelay(i) {
                                            setTimeout(function () {
                                                batch.runCrowdPulse(projects[i], username);

                                                if (i--) {
                                                    loopWithDelay(i);
                                                }
                                            }, 60000);
                                        })(projects.length - 1);
                                    }

                                }
                            });
                        });

                    });
                }).catch(function () {
                    console.log(err);
                });

            }
        });
    });
};

/**
 * Get coordinates for Instagram posts location
 * @param id
 * @returns coordinate
 */
async function get_location_coordinate(id){
    const URL = 'https://www.instagram.com/explore/locations/' + id + '/';
    const REQUEST_PARAMETERS = {
        method: 'GET',
        url: URL
    };

    var coordinate = null;

    try{
        var loc_page = await axios(REQUEST_PARAMETERS);

        if(loc_page.data){
            var latitude = loc_page.data.match(/<meta property="place:location:latitude" content="(.*)" \/>/)[1];
            var longitude = loc_page.data.match(/<meta property="place:location:longitude" content="(.*)" \/>/)[1];
            coordinate = {
                latitude: latitude,
                longitude: longitude
            };
        }
    }catch (err){
        coordinate = null;
    }

    return coordinate;
};

/**
 * Get Instagram user friends (people tagged in posts).
 * Params:
 *    friendsNumber - the number of friends to retrieve
 */
router.route('/instagram/friends')
    .post(function (req, res) {
        try {
            var friendsNumber = req.body.friendsNumber;

            // if the client do not specify a friends number to read then update the user friends
            if (!friendsNumber) {
                updatePosts(req.session.username).then(function () {
                    res.status(200);
                    res.json({auth: true});
                });
            } else {

                // return the friends
                var dbConnection = new CrowdPulse();
                return dbConnection.connect(config.database.url, req.session.username).then(function (conn) {
                    return conn.Connection.find({source: /instagram/}).limit(friendsNumber);
                }).then(function (friends) {
                    dbConnection.disconnect();
                    res.status(200);
                    res.json({auth: true, friends: friends});
                });
            }

        } catch (err) {
            console.log(err);
            res.sendStatus(500);
        }
    });

/**
 * Store messages in the MongoDB database
 * @param messages
 * @param databaseName
 */
var storeMessages = function (messages, databaseName) {
    var dbConnection = new CrowdPulse();
    var messagesSaved = 0;
    return dbConnection.connect(config.database.url, databaseName).then(function (conn) {
        if (messages.length <= 0) {
            return dbConnection.disconnect();
        }
        messages.forEach(function (message) {
            return conn.Message.newFromObject(message).save().then(function () {
                messagesSaved++;
                if (messagesSaved >= messages.length) {
                    console.log(messages.length + " messages from Instagram saved in " + databaseName + " at " + new Date());
                    return dbConnection.disconnect();
                }
            });
        });
    });
};

/**
 * Delete messages stored in the MongoDB database
 * @param username
 * @param databaseName
 */
var deleteMessages = function (username, databaseName) {
    var dbConnection = new CrowdPulse();
    return dbConnection.connect(config.database.url, databaseName).then(function (conn) {
        return conn.Message.deleteMany({fromUser: username, source: /instagram.*/}, function (err) {
            if (err) {
                console.log(err);
            } else {
                console.log("Instagram posts deleted from " + databaseName + " at " + new Date());
            }
            return dbConnection.disconnect();
        });
    });
};

/**
 * Update share option for messages.
 * @param userId
 * @param databaseName
 * @param share
 */
var updateShareMessages = function (userId, databaseName, share) {
    var dbConnection = new CrowdPulse();
    return dbConnection.connect(config.database.url, databaseName).then(function (conn) {
        return conn.Message.update({source: 'instagram_' + userId}, {$set: {share: share}}, {multi: true},
            function (err, numAffected) {
                if (err) {
                    console.log(err);
                } else {
                    console.log(numAffected.nModified + " Instagram messages updated for " + databaseName + " at " + new Date());
                }
                return dbConnection.disconnect();
            });
    });
};

/**
 * Store friends in the MongoDB database
 * @param friends
 * @param databaseName
 */
var storeFriends = function (friends, databaseName) {
    var dbConnection = new CrowdPulse();

    return dbConnection.connect(config.database.url, databaseName).then(function (conn) {
        if (friends.length <= 0) {
            return dbConnection.disconnect();
        }

        // loop function to insert friends data synchronously
        (function loop(i) {
            var friend = friends[i];
            friend.forEach(function (fr) {
                conn.Connection.findOneAndUpdate({
                    username: fr.username,
                    contactId: fr.contactId,
                    source: 'instagram'

                }, fr, {upsert: true}, function () {

                    if (i >= friends.length) {
                        console.log(friends.length + " Instagram friends for " + fr.username + " saved or updated into " + databaseName);
                        return dbConnection.disconnect();
                    } else {
                        loop(i);
                    }
                });
            });
            i++;
        })(0);

    });
};

/**
 * Delete friends stored in the MongoDB database
 * @param username
 * @param databaseName
 */
var deleteFriends = function (username, databaseName) {
    var dbConnection = new CrowdPulse();
    return dbConnection.connect(config.database.url, databaseName).then(function (conn) {
        return conn.Connection.deleteMany({username: username, source: /instagram.*/}, function (err) {
            if (err) {
                console.log(err);
            } else {
                console.log("Instagram friends deleted from " + databaseName + " at " + new Date());
            }
            return dbConnection.disconnect();
        });
    });
};

exports.updateUserProfile = updateUserProfile;
exports.updatePosts = updatePosts;
