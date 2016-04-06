var _ = require("lodash"),
	AccountPair = require("./models/accountpairs"),
	request = require('request'),
	parser = require('xml2js').parseString,
	moment = require("moment"),
	rgAuth = require('simple-oauth2')({
        clientID: process.env.RG_CLIENT_ID,
        clientSecret: process.env.RG_CLIENT_SECRET,
        site: 'https://api.resourceguruapp.com',
        tokenPath: '/oauth/token'
    });

/**
 * Fetches all WorkFlow Max jobs
 * @param  {String}   apiKey   Api Key
 * @param  {String}   accKey   Account Key
 * @param  {Function} callback contains jobs array
 */
function fetchWfmJobs(apiKey, accKey, callback){
	if (apiKey && accKey){
		request('https://api.workflowmax.com/job.api/tasks?apiKey=' + apiKey +'&accountKey=' + accKey + '&complete=false', function (error, response, body) {
			if (!error && response.statusCode == 200) {
				parser(body, function (err, result) {
					if (result.Response.Jobs){
					    callback(result.Response.Jobs);
					}
				});
			}
		})
	}
}

/**
 * Fetches all ResourceGuru projects
 * @param  {String}   subdomain   The subdomain associated with the account
 * @param  {Object}   token    The auth token for the account
 * @param  {Function} callback contains projects array
 */
function fetchRgProjects(subdomain, token, callback){
	if (subdomain && token){
		rgAuth.api('GET', '/v1/' + subdomain + '/projects', {
			access_token: token.access_token
		}, function (err, data) {
			callback(data)
		});
	}
}

/**
 * Fetches all ResourceGuru resources
 * @param  {String}   subdomain   The subdomain associated with the account
 * @param  {Object}   token    The auth token for the account
 * @param  {Function} callback contains resources array
 */
function fetchRgUsers(subdomain, token, callback){
	if (subdomain && token){
		rgAuth.api('GET', '/v1/' + subdomain + '/resources', {
			access_token: token.access_token
		}, function (err, data) {
			callback(data)
		});	
	}
};

/**
 * Returns project with the same name as the specified job (case insensitive)
 * @param  {Object} job      single workflow max job
 * @param  {Array} projects  Resource Guru projects array
 * @return {Object}          Matching Resource Guru project
 */
function matchJobProjectNames(job, projects){
	if (job && projects){
		var matchingProject = _.find(projects, function(project){
			return project.name.toLowerCase() === job.Name[0].toLowerCase();
		});

		return matchingProject;
	}
}

/**
 * Gets the ResourceGuru ID's of any users assigned a task in Workflow Max (based on their name)
 * @param  {Array} assignees  array of assignees from Workflow max
 * @param  {Array} users      array of all users from Resource Guru
 * @return {Array}            array of user ID's
 */
function getRgAssignees(assignees, users){
	if (assignees && users){
		var userIds = users.filter(function(user){
			var matchingUser = _.find(assignees, function(assignee){
				return assignee.Staff[0].Name[0].toLowerCase() === user.name.toLowerCase();
			});
			return matchingUser;
		}).map(function(user){
			return user.id;
		});
		return userIds;
	}
}

/**
 * Checks if a booking has already been created in Resource Guru for the Task
 * @param  {String}   subdomain   The subdomain associated with the account
 * @param  {Object}   token    	  The auth token for the account
 * @param  {Number}   userId      The Resource Guru user ID
 * @param  {Number}   taskId      The Resource Guru user Id
 * @param  {Function} callback    returns a boolean representing whether a task has NOT been created or not
 */
function taskNotCreatedInRg(subdomain, token, userId, taskId, callback){
	if (subdomain && token && userId && taskId) {
		rgAuth.api('GET', '/v1/' + subdomain + '/bookings', {
			access_token: token.access_token
		}, function (err, data) {
			var matchingBooking = _.find(data, function(booking){
				return booking.resource_id === userId && booking.details && booking.details.indexOf(taskId) > -1;
			});
			callback( !matchingBooking );
		});	
	}
}

// export 
module.exports = setInterval(function(){
	var stream = AccountPair.find().stream();

	stream.on('data', function (doc) {
	  //Fetch WorkFlow Max Jobs	
	  fetchWfmJobs(doc.workflowmax.apiKey, doc.workflowmax.accountKey, function(jobs){

	  	if (jobs && jobs.length) {
	  		//Fetch Resource Guru Projects
	  		fetchRgProjects(doc.resourceGuru.subdomain, doc.resourceGuru.token, function(projects){

	  			if (projects && projects.length){
	  				// Fetch Resource Guru Users (Resources)
	  				fetchRgUsers(doc.resourceGuru.subdomain, doc.resourceGuru.token, function(users){

	  					if (users && users.length){
	  						//iterate over each WFM job
					  		jobs.forEach(function(job, i){
					  			job = job.Job[0];
								var matchingProject = matchJobProjectNames(job, projects);
								if (matchingProject){
									job.Tasks[0].Task.forEach(function(task){
										var userIds = getRgAssignees(task.Assigned, users);
										if (userIds && userIds.length) {
											userIds.forEach(function(userId){
												taskNotCreatedInRg(doc.resourceGuru.subdomain, doc.resourceGuru.token, userId, task.ID, function(notCreated){
													if (notCreated){
														if ( (task.EstimatedMinutes[0] / 60) > 8 ) {
															var minutes =  8 * 60,
																startDate = moment(new Date()).format("YYYY-MM-DD"),
																endDate = moment(new Date()).add(Math.round((task.EstimatedMinutes[0] / 60) / 8), "days").format("YYYY-MM-DD");
														} else {
															var minutes =  task.EstimatedMinutes[0],
																startDate = moment(new Date()).format("YYYY-MM-DD"),
																endDate = moment(new Date()).format("YYYY-MM-DD");
														}
														//send that mofo
														request(
															{
																method: "POST",
																json: true,
																url: "https://api.resourceguruapp.com/v1/"+doc.resourceGuru.subdomain+"/bookings",
																body: {
																	"start_date": startDate,
																	"end_date": endDate,
																	"duration": parseInt(minutes) === 0 ? 5 : minutes,
																	"resource_id": userId,
																	"allow_waiting": true,
																	"project_id": matchingProject.id,
																	"details": task.Name[0] + " (WFM: #" + task.ID[0] + ")"
																},
																headers: {
																		Authorization: "Bearer " + doc.resourceGuru.token.access_token
																}
															}, 
															function (err, response, body) {
																console.log(err);
																console.log(body);
															}
														);	
													}
												});
											});
										}
									});
								}
							});
	  					}

	  				});

	  			}

	  		});
	  	}

	  });
	})
}, 200000);
