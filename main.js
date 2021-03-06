//////////////////
// Dependencies //
//////////////////
var express = require('express'),
    app = express(),
    path = require("path"),
    routes = require('./routes/index'),
    schedule = require("./repeater"),
    bodyParser = require('body-parser'),
    hbs = require('hbs');

//////////////////////
// Express Settings //
//////////////////////
app.set('view engine', 'hbs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(routes);
app.use(express.static(__dirname + '/public'));

hbs.registerHelper('toJSON', function(object) {
  return JSON.stringify(object);
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

//start server
app.listen(process.env.PORT || 3000);

console.log('Express server started on port' + process.env.PORT);