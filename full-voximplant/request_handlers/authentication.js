'use strict';

// Imports
var Firebase = require('firebase');

// Firebase
var ref = new Firebase(process.env.FIREBASE_HOME || 'https://telehealthdemo.firebaseio.com/');

exports.createUser = function(request, response, next) {

    var user = request.body.user;

    ref.createUser({
        email: user.email,
        password: user.password
    }, function(error, userData) {
        if (error) {
            switch (error.code) {
                case 'EMAIL_TAKEN':
                    console.log('The new user account cannot be created because the email is already in use.');
                    break;
                case 'INVALID_EMAIL':
                    console.log('The specified email is not a valid email.');
                    break;
                default:
                    console.log('Error creating user:', error);
            }
        } else {
            ref.child('users').child(userData.uid).set({
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
            });

            response.json(userData);
        }
    });
};


exports.loginUser = function(request, response, next) {

    var user = request.body.user;

    ref.authWithPassword({
        email: user.email,
        password: user.password
    }, function(error, authData) {
        if (error) {
            response.status(401).send('Incorrect email/password combination');
        } else {

            ref.child('users').child(authData.uid).once('value', function(snapshot) {
                var user = snapshot.val();

                var userData = {
                    id: authData.uid,
                    auth: {
                        token: authData.token,
                        expires: authData.expires * 1000 // Convert seconds to ms
                    },
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email
                };

                response.json(userData);
            })

        }
    }, {
        remember: 'sessionOnly'
    });

};

exports.validateUser = function(request, response, next) {

    var token = request.body.user ? request.body.user.auth.token : request.query.token;

    ref.authWithCustomToken(token, function(error, result) {

        if (error) {
            response.status(401).send('Please login before creating an appointment');
            return;
        }

        return next();
    });
};
