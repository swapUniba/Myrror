'use strict';

var router = require('express').Router();
const got = require('got');
var CrowdPulse = require('./../crowd-pulse-data');
var databaseName = require('./../crowd-pulse-data/databaseName');
var config = require('./../lib/config');
var InstagramProfileSchema = require('./../crowd-pulse-data/schema/instagramProfile');
var batch = require('./../lib/batchOperations');

const DB_PROFILES = databaseName.profiles;
const userInstagram = require("user-instagram");
const DEFAULT_LANGUAGE = 'en';

var OSM_REQUEST_URL = 'https://nominatim.openstreetmap.org/search?';
var OSM_REQUEST_OPTIONS = '&limit=1&format=json';

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
                }).catch(function () {
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
    var friendsToSave = [];
    var temp = [];
    return dbConnection.connect(config.database.url, DB_PROFILES).then(function (conn) {
        return conn.Profile.findOne({username: username}, function (err, profile) {
            if (profile) {
                var instagramUsername = profile.identities.instagram.username;
                dbConnection.disconnect();

                var instagramConfig = profile.identities.configs.instagramConfig;

                var share = instagramConfig.shareMessages;

                userInstagram(instagramUsername).then(function (user) {

                    var messages = [];

                    var formatted_posts_info = user.posts.map(async function (user_post) {
                        var post = await userInstagram.getPostData(user_post.shortCode);

                        var query = 'q=';

                        var location_name = null;
                        var location_latitude = null;
                        var location_longitude = null;

                        if (post.location) {
                            location_name = post.location.name;
                            var location = JSON.parse(post.location.jsonName);
                            query = query + location.street_address + ' ' + location.city_name + ' ' + location.zip_code + ' ' + location.country_code;
                            query = query.split(' ').join('+');

                            await got(OSM_REQUEST_URL + query + OSM_REQUEST_OPTIONS).then(function (result) {
                                if (result.statusCode === 200) {
                                    var location_details = JSON.parse(result.body)[0];
                                    if (location_details) {
                                        location_latitude = location_details.lat;
                                        location_longitude = location_details.lon;
                                    }
                                }
                            });
                        }

                        var description = '';
                        if (post.caption) {
                            description = post.caption;
                        }

                        var images = [];
                        if (post.childrenPictures.length > 0) {
                            post.childrenPictures.forEach(function (childPicture) {
                                images.push(childPicture.displayUrl);
                            })
                        }

                        // users in photo control
                        var users = [];
                        var friends = [];

                        if (post.taggedUsers) {

                            post.taggedUsers.forEach(function (user) {
                                if (user.username !== instagramUsername) {
                                    users.push(user.username);
                                    friends.push({
                                        username: username,
                                        contactId: user.username,
                                        source: 'instagram'
                                    })
                                }

                            });
                        }
                        temp.push(friends);

                        return {
                            oId: post.takenAt,
                            picture: post.displayUrl,
                            text: description,
                            source: 'instagram_' + instagramConfig.instagramId,
                            fromUser: instagramConfig.instagramId,
                            date: new Date(post.takenAt * 1000), //unix time *1000
                            images: images,
                            likes: post.likesCount,
                            comments: post.comments.length,
                            location: location_name,
                            latitude: location_latitude,
                            longitude: location_longitude,
                            refUsers: users,
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

                        temp.forEach(function (u) {
                            if (u && u.length > 0) {
                                friendsToSave.push(u)
                            }
                        });

                        storeFriends(friendsToSave, username).then(function () {
                            storeFriends(friendsToSave, databaseName.globalData);
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
