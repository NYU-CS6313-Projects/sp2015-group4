var http = require("http");
var mongojs = require("mongojs");
var JSONStream = require('JSONStream');
var express = require('express');
var url = require('url') ;
var fs = require('fs')
//var static = require('node-static');
//var ip = require("ip");
var async = require("async");
var outgoingRequest = require("request");
//var forEach = require('async-foreach').forEach;

var port = 8080;

var db = mongojs("meetup");

var members = db.collection('members');

//var fileServer = new static.Server("./index.html");

var app = express();

app.use(express.static('static'));


var limit = 10; // By default, but can be overridden with a param

//app.all('/', allowAccessHeaders);
//app.get("/", simpleHandler);

app.all("/listcatagories", allowAccessHeaders);
app.get("/listcatagories", listCatagoriesHandler);

app.all("/catagory/*", allowAccessHeaders);
app.get("/catagory/*", catagoryHandler);

app.all("/getCatagoryTimeline/*", allowAccessHeaders);
app.get("/getCatagoryTimeline/*", categoryTimelineHandler);

app.all("/getEventsForDay/*", allowAccessHeaders);
app.get("/getEventsForDay/*", getEventsForDayHandler);

app.all("/viz/*", allowAccessHeaders);
app.get("/viz/*", fileHandler);

app.all("/groups/*", allowAccessHeaders);
app.get("/groups/*", groupsHandler);

app.all("/getGroupFromId/*", allowAccessHeaders);
app.get("/getGroupFromId/*", getGroupFromIdHandler);

app.all("/getAllEventsForGroup/*", allowAccessHeaders);
app.get("/getAllEventsForGroup/*", getAllEventsForGroupHandler);

app.get("/favicon.ico", function (req, res) {res.end()} );

function getAllEventsForGroupHandler(request, response) {
	console.log("getAllEventsForGroupHandler")
	
	response.writeHead(200, {"Content-Type": "application/json"});
	
	var path = request.path.split("/");
	var groupId = path.pop()
	if(!groupId) {
		response.end()
		return
	}
	groupId = parseInt(groupId)
	console.log("Trying to find group " + groupId)
	getAllEventsForGroup(groupId, function(data) {response.write(JSON.stringify(data)); response.end()})
}

function getAllEventsForGroup(groupId, handler) {
	db.collection('events').find({
		'group.id': {$eq: groupId}
	},
	{time: 1, yes_rsvp_count: 1},
	function(err, data) {
		if(err) {
			console.log("ERROR");
			console.log(err);
			return;
		}
		if(handler)
		handler(data)
	}
	);
}


function getEventsForDayHandler(request, response) {
	console.log("getEventsForDayHandler---")
	response.writeHead(200, {"Content-Type": "application/json"});
	
	startTime = new Date(request.query.startTime)
	endTime = new Date(request.query.endTime);
	
	var path = request.path.split("/");
	
	var groupId = parseInt(path.pop());
	if(groupId) {
		console.log("Getting timeline for group")
	}
	
	console.log("StartTime: " + request.query.startTime + " " + startTime)
	console.log("EndTime: " + request.query.endTime + " " + endTime)
	//console.log("Handling from " + startTime + " to " + endTime)
	
	db.collection('events').find(
	{
	time:
		{
			//$gt: 1230768000000,
			//$lt: 1262304000000
			$gt: startTime.getTime(),
			$lt: endTime.getTime()
			}
	},
	//{limit: limit},
		function(err, data) {
		if(err) {
			console.log("ERROR");
			console.log(err);
			return;
		}
		includeGroups = 1
		if(includeGroups) {
			output = [];
			async.each(data, function(item, callback) {
				getGroupFromId(parseInt(item.group.id), function(d) {
					item.group.category = d.category;
					item.group.topics = d.topics;
					//item.group.description = d.description;
					output.push(item);
					callback();
				});
			}, function(err) {
				response.write(JSON.stringify(output));
				response.end();
			}
			);
		} else {
			response.write(JSON.stringify(data));
			//response.end();
			console.log("Sent " + data.length)
		}
	});
	
}

function nextDay(timeStamp) {
	return timeStamp + ((24*60*60) * 1000)
}

function categoryTimelineHandler(request, response) {
	response.writeHead(200, {"Content-Type": "application/json"});
	
	console.log("Timeline")
	
	startTime = new Date(request.query.startTime)
	endTime = new Date(request.query.endTime);
	
	
	var path = request.path.split("/");
	
	var groupId = parseInt(path.pop());
	if(groupId) {
		console.log("Getting timeline for group")
	}
	
	console.log("getting events from " + startTime + " to " + endTime)
	console.log("Stepping every 24 hours...")
	
	var startTimeStamp = startTime.getTime()
	var endTimeStamp = endTime.getTime()
	
	console.log("StartTimeStamp: " + startTimeStamp)
	console.log("EndTimeStamp: " + endTimeStamp)
	
	console.log("tomorrow: " + nextDay(startTimeStamp))
	console.log("tomorrow: " + new Date(nextDay(startTimeStamp)))
	
	console.log("Entering loop...")
	
	var i = startTimeStamp
	while(i < endTime.getTime()) {
		
		console.log("Iterating for " + i)
		///
		
		db.collection('events').find(
		{
		time:
			{
				$gt: i,
				$lt: nextDay(i)
				}
		},
		{limit: limit},
			function(err, data) {
			if(err) {
				console.log("ERROR");
				console.log(err);
				return;
			}
			includeGroups = 0
			if(includeGroups) {
				output = [];
				async.each(data, function(item, callback) {
					getGroupFromId(parseInt(item.group.id), function(d) {
						item.group.category = d.category;
						item.group.topics = d.topics;
						//item.group.description = d.description;
						output.push(item);
						callback();
					});
				}, function(err) {
					response.write(JSON.stringify(output));
					response.end();
				}
				);
			} else {
				response.write(JSON.stringify(data));
				//response.end();
				console.log("Sent " + data.length)
			}
		});
		
		///
		
		i = nextDay(i)
		
		
	}
	console.log("Finished")
}


function groupsHandler(request, response) {
	if(request.query.limit)
		limit = request.query.limit;
	
	// Why doesn't this work when I submit it as a timestamp with .getTime()?
	
	if(request.query.startTime) {
		startTime = new Date(request.query.startTime);
		//console.log(startTime);
	} else {
		startTime = new Date(2009, 04, 01);
	}
	if(request.query.endTime) {
		endTime = new Date(request.query.endTime);
	} else {
		endTime = new Date(2011, 04, 01);
	}
	var yes_rsvp_countLess = 10;
	if(request.query.yes_rsvp_countLess)
		yes_rsvp_countLess = request.query.yes_rsvp_countLess;
		
	var yes_rsvp_countMore = 30;
	if(request.query.yes_rsvp_countMore)
		yes_rsvp_countMore = request.query.yes_rsvp_countMore;
	
	var includeGroups;
	if(request.query.includeGroups == "0")
		includeGroups = 0;
	else
		includeGroups = 1;
		
	response.writeHead(200, {"Content-Type": "application/json"});
	
	yes_rsvp_countLess = parseInt(yes_rsvp_countLess)
	yes_rsvp_countMore = parseInt(yes_rsvp_countMore)
	
	//console.log(request.query)
	//console.log("yes_rsvp_countMore: " + yes_rsvp_countMore)
	//console.log("yes_rsvp_countLess: " + yes_rsvp_countLess)
	
	db.collection('events').find(
	{
	time:
		{
			$gt: startTime.getTime(),
			$lt: endTime.getTime()
			//$gt: new Date(2009, 04, 01).getTime(),
			//$lt: new Date(2015, 04, 01).getTime()
			//$gt: new Date(1238544000000).getTime()
			//$gt: 1238544000000,
			//$lt: new Date(2012, 7, 14)
			},
	yes_rsvp_count:
		{
			$lt: yes_rsvp_countMore,
			$gt: yes_rsvp_countLess
		}
	},
	{limit: limit},
		function(err, data) {
		if(err) {
			console.log("ERROR");
			console.log(err);
			return;
		}
		// This will load up the group subdocument with extra info, to make it easier
		// to pull together our vizualisation
		if(includeGroups) {
			output = [];
			async.each(data, function(item, callback) {
				getGroupFromId(parseInt(item.group.id), function(d) {
					item.group.category = d.category;
					item.group.topics = d.topics;
					//item.group.description = d.description;
					output.push(item);
					callback();
				});
			}, function(err) {
				response.write(JSON.stringify(output));
				response.end();
			}
			);
		} else {
			response.write(JSON.stringify(data));
			response.end();
		}
	});

}

function fileHandler(request, response) {
	console.log("Found file");
	fs.readFile("./index.html", "utf8", function(err, file) {
		console.log("Reading file...");
		response.writeHead(200, {"Content-Type": "text/html"});
		if(err) {
			console.log("ERROR");
			console.log(err);
			response.write("ERROR");
			response.end();
			return;
		}
		response.write(file, "utf8");
		response.end();
	});
	return;
}

app.all("/meetup1.json", allowAccessHeaders);
 
function allowAccessHeaders(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
}


app.all("/meetup1.json", allowAccessHeaders);
app.get("/meetup1.json", tempHandler);

function tempHandler(request, response) {
	console.log("Found file");
	fs.readFile("./meetup1.json", "utf8", function(err, file) {
		console.log("Reading file...");
		response.writeHead(200, {"Content-Type": "application/json", "charset": "utf-8"});
		if(err) {
			console.log("ERROR");
			console.log(err);
			response.write("ERROR");
			response.end();
			return;
		}
		response.write(file, "utf8");
		response.end();
	});
	return;
}

function listCatagoriesHandler(request, response) {
	if(request.query.limit)
		limit = request.query.limit;
	
	response.writeHead(200, {"Content-Type": "application/json"});
	
	db.collection('catagory').distinct('category.shortname', function(err, data) {
		if(err) {
			console.log(err);
			return;
		}
		var output = "";
		output += JSON.stringify(data);
		response.write(JSON.stringify(data));
		//response.write(output)
		response.end();
	});
}


// do: async.each(data, function(item, callback) {
// for events


function getGroupFromIdHandler(request, response) {
	response.writeHead(200, {"Content-Type": "application/json"});
	
	var path = request.path.split("/");
	
	var groupId = parseInt(path.pop());
	if(groupId) {
		getGroupFromId(groupId, function(data) { response.write(JSON.stringify(data)); response.end(); } );
	}
	
}

// Accepts an Integer of a group id, and returns the associated group object
// These can be found in group.id objects embedded in events objects 

function getGroupFromId(groupId, handler) {
	db.collection('catagory').findOne({
		id: {$eq: groupId}
	},
	function(err, data) {
		if(err) {
			console.log("ERROR");
			console.log(err);
			return;
		}	if(handler)
			handler(data);
	}
	);
	
}

function catagoryHandler(request, response) {
	if(request.query.limit)
		limit = request.query.limit;
		
	response.writeHead(200, {"Content-Type": "application/json"});
	
	// It's much more useful in this form
	var path = request.path.split("/");
	
	
	if(path[2] == '') {
		
		db.collection('catagory').distinct('category.shortname', function(err, data) {
			if(err) {
				console.log(err);
				return;
			}
			if(request.query.details) {
				var output = [];
				
				//https://github.com/caolan/async#forEach
				// We can always re-order in allDone() if need be.
				// eachSeries is guaranteed to be in order, but is not as safe
				
				//async.eachSeries(data, function(item, callback) {
				async.each(data, function(item, callback) {
					db.collection('catagory').count({"category.shortname": item},
						function(err, data) {
							output.push([item, data]);
							callback();
						})

				} ,function(err) {
					response.write(JSON.stringify(output));
					response.end();
				})
			} else {
				
				
				response.write(JSON.stringify(data));
				response.end();
				return;
			}
		})
	} else {
		db.collection('catagory').count({"category.shortname": path[2]}, function(err, data) {
			console.log(data);
			response.write(JSON.stringify(data));
			response.end();
		});
	}
}

function simpleHandler(request, response) {
	if(request.query.limit)
		limit = request.query.limit;
		
	response.writeHead(200, {"Content-Type": "application/json"});
	
	/*
	db.collection('members').find({joined:{$gt:1377699498000}}, {limit: limit}, function(err, data) {
		var output = "";
		//output += "First five users who's join date is after " + new Date(1377699498000) + "";
		
		output += JSON.stringify(data);
		
		response.write(output);
		
		response.end();
	});
	*/
}

var server = app.listen(port);
console.log("Server running at http://" + server.address().address + ":" + server.address().port);