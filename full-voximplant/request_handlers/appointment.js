'use strict';

// Imports
var OpenTok = require('opentok');
var Firebase = require('firebase');

// OpenTok
var apiAccess = {key: '45621172', secret: 'cb4a75d3198ffd5cb28331e70864d83531a8ecf1'};
var opentok = new OpenTok(apiAccess.key, apiAccess.secret);

// Firebase
var firebaseDomain = process.env.FIREBASE_HOME || 'https://telehealthdemo.firebaseio.com/';
var ref = new Firebase(firebaseDomain);
var appointmentsRef = ref.child('appointments');

// Helper functions

var generateCallback = function(response, error) {

    var errorStatus = error && error.status ? error.status : 500;
    var errorMessage = error && error.message ? error.messsage : 'An error occured';

    return {
        error: function(err) {
            response.status(errorStatus);
            response.send([errorMessage, err].join(': '));
        },
        success: function(data) {
            response.json(data);
        }
    };

};

// Generate a token for patient or physician
var generateToken = function(sessionId, role) {
    var expireTime = (Date.now() / 1000 | 0) + (60 * 60 * 24 * 30);
    return opentok.generateToken(sessionId, {
        role: 'publisher',
        data: 'role=' + role,
        expireTime: expireTime
    });
};

var buildSession = function(appointment, sessionData, role) {

    var session = {
        appointmentId: appointment.id,
        clientId: appointment.clientId,
        sessionId: sessionData.sessionId,
        details: {
          date: appointment.details.date,
          day: appointment.details.day,
          time: appointment.details.time
        },
        apiKey: sessionData.apiKey,
    };

    session[role + 'Token'] = appointment[role + 'Token'];

    return session;
};

var VERSION = 2;

// Need to return apiKey, sessionId, and token
var getAppointmentSession = function(appointment, role, callback) {

    var tokenType = [role, 'Token'].join('');

    // No existing session or old metadata
    if (!appointment.session || appointment._v !== VERSION) {
        opentok.createSession({
            mediaMode: 'routed'
        }, function(err, session) {

            if (err) {
                callback.error(err);
            }

            // Generate token
            appointment[tokenType] = generateToken(session.sessionId, role);

            // Get what we need from the session object
            session.apiKey = session.ot.apiKey;
            var sessionData = buildSession(appointment, session, role);

            // Save in FB
            ref.child('appointments').child(appointment.id).update({
                '_v': VERSION,
                'session': sessionData
            });

            // Get client info
            ref.child('users/' + sessionData.clientId).once('value', function(snapshot) {
                sessionData.client = snapshot.val();
                callback.success(sessionData);
            })
        });

        // Session exists, but no token for requested role
    } else if (!appointment.session[tokenType]) {

        appointment[tokenType] = generateToken(appointment.session.sessionId, role);

        var sessionData = buildSession(appointment, appointment.session, role);

        var newToken = {};
        newToken[tokenType] = sessionData[tokenType];

        ref.child('appointments').child(appointment.id).child('session').update(newToken);

        ref.child('users/' + appointment.clientId).once('value', function(snapshot) {
            sessionData.client = snapshot.val();
            callback.success(sessionData);
        });

        // Return appointment with client info
    } else {

        ref.child('users/' + appointment.clientId).once('value', function(snapshot) {
            appointment.session.client = snapshot.val();
            appointment.session.details = {
              date: appointment.details.date,
              day: appointment.details.day,
              time: appointment.details.time
            };
            callback.success(appointment.session);
        });

    }

};

var createNewAppointment = function(request, response, next) {

    appointmentsRef.push().set({
        details: request.appointment,
        clientId: request.user.id,
        createdAt: Firebase.ServerValue.TIMESTAMP
    });

    return {
        appointment: request.appointment
    };
};

// Get current appointments
var filterAppointments = function(appointments) {

    if (!appointments) {
        return [];
    }

    var appointmentIds = Object.keys(appointments);

    var getCurrentAppointments = function(acc, id) {

        if (appointments[id].details.unix > Date.now() - 1000 * 60 * 15) { // 15-minute grace period
            appointments[id].id = id;
            acc.push(appointments[id]);
        }
        return acc;
    };

    // Remove appointments that occurred in the past
    var filteredAppointments = appointmentIds.reduce(getCurrentAppointments, []);

    return filteredAppointments.sort(function(a, b) {
        return a.details.unix > b.details.unix;
    });
};

// Return a hash of clients { clientId => client }
var getClientMap = function(appointments, callback) {
    ref.child('users')
        .once('value', function(snapshot) {
            var clients = snapshot.val();
            var appointmentData = {
                appointments: appointments,
                clientMap: clients
            };
            callback.success(appointmentData);
        });
};

// Request handlers
exports.createAppointment = function(request, response, next) {
    response.json(createNewAppointment(request.body));
};

exports.getClientAppointments = function(request, response, next) {

    var id = request.params.client;

    ref.child('appointments')
        .orderByChild('clientId').equalTo(id)
        .once('value', function(snapshot) {
            var appointments = filterAppointments(snapshot.val());
            response.json(appointments);
        });
};

exports.getPhysicianAppointments = function(request, response, next) {

    ref.child('appointments')
        .once('value', function(snapshot) {
            var appointments = filterAppointments(snapshot.val());
            getClientMap(appointments, generateCallback(response));
        });
};

exports.getAppointmentSession = function(request, response, next) {

    var id = request.params.id;
    var role = request.query.role;
    var callback = generateCallback(response, {
        message: 'Error generating token'
    });

    ref.child('appointments/' + id).once('value', function(snapshot) {
        var appointment = snapshot.val();
        if (appointment) {
            appointment.id = id;
            getAppointmentSession(appointment, role, callback);
        } else {
            response.json({});
        }
    });
};

exports.createScreenSharingSession = function(request, response) {


    opentok.createSession({
        mediaMode: 'routed'
    }, function(err, session) {

        if (err) {
            response.status(500);
            response.send('Error occurred in generating token');
        }

        var sessionData = {
            key: session.ot.apiKey,
            sessionId: session.sessionId,
            token: generateToken(session.sessionId)
        };

        response.json(sessionData);

    });
};
