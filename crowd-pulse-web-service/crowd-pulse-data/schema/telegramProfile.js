'use strict';

/*
 * This is not a Mongoose Schema
 */
var TelegramProfileSchema = {
    telegramId: Number ,
    firstname: String ,
    lastname: String,
    username: String,
    sex: String,
    birth: String,
    city: String,
    province: String,
};

module.exports = TelegramProfileSchema;