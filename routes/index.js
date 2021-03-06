var express = require('express'),
	router = express.Router(),
	AccountPair = require("../models/accountpairs"),
	rgAuth = require('simple-oauth2')({
        clientID: process.env.RG_CLIENT_ID,
        clientSecret: process.env.RG_CLIENT_SECRET,
        site: 'https://api.resourceguruapp.com',
        tokenPath: '/oauth/token'
    });

//////////////
//Home Page //
//////////////
router.get('/', function (req, res) {
	res.render('index');
});

//////////////////////////////
//Resource Guru Splash Page //
//////////////////////////////
router.get('/resourceguru', function (req, res) {
	res.render('resourceguru');
});

////////////////////////////////
//Resource Guru Auth Redirect //
////////////////////////////////
router.get('/auth/resourceguru', function (req, res) {
	// Authorization oauth2 URI
	var authorization_uri = rgAuth.authCode.authorizeURL({
	  redirect_uri: process.env.BASE_URL + '/auth/resourceguru/callback'
	});
	
	res.redirect(authorization_uri);
});

/////////////////////////////////
// Resource Guru Callback Page //
/////////////////////////////////
router.get('/auth/resourceguru/callback', function (req, res) {
	console.log("callback received");
	// Authorization oauth2 URI
	var authorization_uri = rgAuth.authCode.authorizeURL({
	  redirect_uri: process.env.BASE_URL + '/auth/resourceguru/callback'
	});
	console.log("*******************************");
	console.log(req.query);
	console.log("*******************************");
	// Get the access token object (the authorization code is given from /auth/resourceguru).
	if (req.query.code) {	
		var token;
		rgAuth.authCode.getToken({
		  code: req.query.code,
		  redirect_uri: process.env.BASE_URL + '/auth/resourceguru/callback'
		}, saveToken);
	} else {
		res.redirect(authorization_uri);
	}

	// Save the access token
	function saveToken(error, result) {
	  if (error) { 
	  	console.log('Access Token Error', error.message); 
	  	res.redirect(authorization_uri);
	  } else {
		  token = rgAuth.accessToken.create(result);

		  console.log("=====================================================");
		  console.log(token.token.access_token);
		  console.log("=====================================================");

		  rgAuth.api('GET', '/v1/accounts', {
	        access_token: token.token.access_token
	      }, function (err, data) {
	      	if (err) { 
	      		console.log('Error getting data', err.message); 
	      	} else {
	      		if (data.length > 1) {
	      			res.render("resourceguruauth", {
						token: JSON.stringify(token),
						multipleAccounts: true,
						accounts: data,
						code: req.query.code
					});
	      		} else {
	      			console.log("------------------------------------------------");
	      			console.log(err);
	      			console.log(data);
	      			console.log("------------------------------------------------");

		      		AccountPair.findOneAndUpdate(
			      		{"resourceGuru.subdomain": data[0].subdomain},
			      		{
			      			"resourceGuru.name": data[0].name, 
			      			"resourceGuru.subdomain": data[0].subdomain, 
			      			"resourceGuru.url": data[0].url,
			      			"resourceGuru.token": token.token
			      		},
			      		{
			      			upsert: true
			      		},
			      		function(){
			      			res.render("resourceguruauth", {
								token: JSON.stringify(token),
								accounts: data
							});
			      		}
		      		);	
	      		}
	      	}
	        
	      });

	  }
	};
});


/////////////////////////////////////////////
// Resource Guru multiple accounts handler //
/////////////////////////////////////////////
router.post('/auth/resourceguru/multiple', function (req, res) {
	console.log(req.body.accounts);
	console.log(req.body.index);
	console.log(req.body.token);

	if (req.body.accounts && req.body.index && req.body.token) {
		var accounts = JSON.parse(req.body.accounts);
		var token = JSON.parse(req.body.token);

		AccountPair.findOneAndUpdate(
      		{"resourceGuru.subdomain": accounts[req.body.index].subdomain},
      		{
      			"resourceGuru.name": accounts[req.body.index].name, 
      			"resourceGuru.subdomain": accounts[req.body.index].subdomain, 
      			"resourceGuru.url": accounts[req.body.index].url,
      			"resourceGuru.token": token.token
      		},
      		{
      			upsert: true
      		},
      		function(){
      			res.render("resourcegurumultiple", {
					name: accounts[req.body.index].name,
					subdomain: accounts[req.body.index].subdomain
				});
      		}
  		);	
	}
});

//////////////////////////////
// Workflow Max Splash Page //
//////////////////////////////
router.post('/workflowmax', function (req, res) {
	if (req.body.subdomain) {
		res.render('workflowmax', {subdomain: req.body.subdomain});
	} else {
		res.redirect("/");
	}
});

//////////////////////////////
// Workflow Max Auth Page //
//////////////////////////////
router.post('/auth/workflowmax', function (req, res) {
	if (req.body.wfmApiKey && req.body.wfmAccKey && req.body.subdomain){
		AccountPair.findOneAndUpdate(
			{"resourceGuru.subdomain": req.body.subdomain},
			{
				"workflowmax.apiKey": req.body.wfmApiKey,
				"workflowmax.accountKey": req.body.wfmAccKey
			},
			{
				upsert: false
			},
			function(){
				res.render("workflowmaxauth", {});
			}
		);	
	} else {
		res.redirect("/");
	}
});

module.exports = router;
