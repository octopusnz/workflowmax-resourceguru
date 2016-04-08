var mongoose = require("mongoose");

//////////////////////
// Mongo Connection //
//////////////////////
mongoose.connect(process.env.DB_URL);

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log("DB Connected");
});

var AccountPair = mongoose.model("AccountPair", {
	resourceGuru: {
		subdomain: {type: String},
		name: {type: String},
		url: {type: String},
		index: {type: Number},
		token: {
			"access_token": {type: String},
			"token_type": {type: String},
			"expires_in": {type: String},
			"refresh_token": {type: String},
			"expires_at": {type: String}
		}
	},
	workflowmax: {
		apiKey: String,
		accountKey: String
	}
});

module.exports = AccountPair;