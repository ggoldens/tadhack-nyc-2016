'use strict';

/*
 * Express Dependencies
 */
var express = require('express');
var https = require('https');
var fs = require('fs');
var app = express();
var port = 3000;
var bodyParser = require('body-parser');
var server = require('http').Server(app);
var sslRedirect = require('./middleware/ssl-redirect');

var CHROME_EXTENSION_ID = process.env.CHROME_EXTENSION_ID;

/*
 * Use Handlebars for templating
 */
var exphbs = require('express3-handlebars');
var hbs;

app.use(sslRedirect());

// For gzip compression
app.use(express.compress());

/*
 * Config for Production and Development
 */
if (process.env.NODE_ENV === 'production') {
    // Set the default layout and locate layouts and partials
    app.engine('handlebars', exphbs({
        defaultLayout: 'main',
        layoutsDir: 'dist/views/layouts/',
        partialsDir: 'dist/views/partials/',
        whitelabelDir: 'dist/views/whitelabel/'
    }));

    // Locate the views
    app.set('views', __dirname + '/views');

    // Locate the assets
    app.use(express.static(__dirname + '/assets'));

} else {
    app.engine('handlebars', exphbs({
        // Default Layout and locate layouts and partials
        defaultLayout: 'main',
        layoutsDir: 'views/layouts/',
        partialsDir: 'views/partials/',
        whitelabelDir: 'views/whitelabel/'
    }));

    // Locate the views
    app.set('views', __dirname + '/views');

    // Locate the assets
    app.use(express.static(__dirname + '/assets'));
}

// Set Handlebars
app.set('view engine', 'handlebars');
app.use(bodyParser.urlencoded());

/*
 * Routes
 */

// External handlers
var appointmentHandler = require('./request_handlers/appointment.js');
var authHandler = require('./request_handlers/authentication.js');

// Index Page
app.get('/', function(request, response, next) {
    response.render('patient/home',{layout:"themed"});
});

//login
app.get('/login', function(request, response, next) {
    response.render('physician/login',{layout:"themed"});
});

app.post('/', function(request, response, next) {
    if(request.body.username == "physician") {
        response.redirect("/physician");
    }
    if(request.body.username == "patient"){
        response.redirect("/patient");
    }
    else{
        response.redirect("/");
    }
});

app.get('/physician-home', function(request, response, next) {
    response.render('physician/home',{layout:"themed"});
});

app.get('/physician', function(request, response, next) {
    if ( !request.query.appointment ) {
        response.redirect('/dashboard');
    } else {
        response.render('physician/physician',{layout:"themed",chromeExtId:CHROME_EXTENSION_ID});
    }
});

app.get('/dashboard', function(request, response, next) {
    response.render('physician/dashboard',{layout:"themed"});
});

app.get('/widget', function(request, response, next) {
    response.render('widget');
});

app.get('/ff-extension', function(request, response, next) {
    response.redirect('https://addons.mozilla.org/en-US/firefox/addon/telehealth-screen-sharing-1/');
});

/*
 * Client Routes
 */

app.get('/home', function(request, response, next) {
    response.render('patient/home',{layout:"themed"});
});

app.get('/health-chart', function(request, response, next) {
    response.render('patient/health-chart',{layout:"themed"});
});

app.get('/health-chart/appointment', function(request, response, next) {
    response.render('patient/new-appointment',{layout:"themed"});
});

app.get('/health-chart/appointment/calendar', function(request, response, next) {
    response.render('patient/appointment-calendar',{layout:"client-internal"});
});

app.get('/health-chart/appointment/list', function(request, response, next) {
    response.render('patient/appointment-list',{layout:"themed"});
});

app.get('/patient', function(request, response, next) {
    response.render('patient/meeting',{layout:"themed", chromeExtId:CHROME_EXTENSION_ID});
});

//Session Routes
app.get('/demo/:session/:usertype', function(request, response, next) {

    if(request.params.usertype == "physician"){
        response.render("physician/physician",{layout:"themed",sessionAlias:request.params.session});
    }
    if(request.params.usertype == "patient"){
        response.render('patient/meeting',{layout:"themed",sessionAlias:request.params.session});
    }

});

/*
 * Api Endpoints
 */

app.post('/health-chart/appointment', authHandler.validateUser, appointmentHandler.createAppointment);

app.get('/health-chart/appointment/client/:client', authHandler.validateUser, appointmentHandler.getClientAppointments);

app.get('/health-chart/appointment/physician', appointmentHandler.getPhysicianAppointments);

app.get('/health-chart/appointment/:id/session', appointmentHandler.getAppointmentSession);

app.post('/user/create', authHandler.createUser);

app.post('/user/login', authHandler.loginUser);

if (app.get('env') === 'development') {
  server = https.createServer({
    key: fs.readFileSync('./server.key', 'utf8'),
    cert: fs.readFileSync('./server.crt', 'utf8')
  }, app);
}

/*
 * Start it up
 */
server.listen(process.env.PORT || port);
console.log('Express started on port ' + port);
